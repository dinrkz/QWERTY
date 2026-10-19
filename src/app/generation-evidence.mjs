// Local evidence preparation only. No provider transport, credentials or file I/O.
import { randomUUID } from 'node:crypto';
import { AppError, allowedActivities, validInstant } from '../shared/policy.mjs';
import { validateOfflineInput, validatePrivateRetrieval, presentOffline } from './offline.mjs';

export const EVIDENCE_CONTRACT = 'qadam-generation-evidence-v1';
export const MAX_PACKET_BYTES = 24 * 1024;
export const MAX_SELECTION_BYTES = 8 * 1024;
const RUBRICS = { '162': 'coffeehouse', '58871': 'coffee_point', '168': 'park', '193': 'museum',
  '190': 'gallery', '111526': 'viewpoint', '112670': 'interesting_building', '112720': 'fountain', '112900': 'sculpture' };
const CONTEXT_FIELDS = ['language', 'travel_mode', 'categories', 'required_amenities', 'preferred_amenities',
  'available_minutes', 'max_distance_m', 'return_to_start', 'buffer_minutes', 'require_open', 'events_only', 'first_visit'];
const fail = code => { throw new AppError(code); };
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) => object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uniqueList = (v, allowed, min, max) => Array.isArray(v) && v.length >= min && v.length <= max
  && new Set(v).size === v.length && v.every(x => allowed.includes(x));

export function cloneBounded(value, max, code = 'DATA_INVALID') {
  try {
    const json = JSON.stringify(value);
    if (typeof json !== 'string' || Buffer.byteLength(json, 'utf8') > max) fail(code);
    return JSON.parse(json);
  } catch { fail(code); }
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

const COPY = {
  en: {
    selected: 'Local mock selection only. No AI or provider request; all wording uses templates.',
    fallback: 'Local mock failed. Retrieval-only results with template ideas; no provider request.',
    empty: 'No eligible saved places. No mock or provider request.',
    reasons: { nearby: 'Near the selected point in straight-line distance.', fits_time: 'Fits your time budget under the stated estimate.',
      interest: 'The mapped category matches your selected category.', first_visit: 'The source description below explains what this place is.' },
    activities: { observe: 'If public access is permitted, take a look around and pause here.',
      stroll: 'If public access is permitted, stroll through the accessible part of the area.',
      coffee_break: 'Check access and hours; if the cafe is receiving guests, take a coffee break. Seating is unconfirmed.',
      museum_visit: 'Check access and tickets; if visiting is possible, explore part of the exhibition.' },
  },
  ru: {
    selected: 'Только локальная имитация выбора. Без ИИ и запросов к провайдерам; текст шаблонный.',
    fallback: 'Локальная имитация не удалась. Только поиск и шаблонные идеи; запросов к провайдерам нет.',
    empty: 'Подходящих сохранённых мест нет. Имитация и запросы к провайдерам не выполнялись.',
    reasons: { nearby: 'Рядом с выбранной точкой по прямой.', fits_time: 'Укладывается в бюджет времени по указанной оценке.',
      interest: 'Сопоставленная категория соответствует выбранному фильтру.', first_visit: 'Описание из источника ниже объясняет, что это за место.' },
    activities: { observe: 'Если публичный доступ разрешён, осмотритесь и сделайте здесь паузу.',
      stroll: 'Если публичный доступ разрешён, прогуляйтесь по доступной части территории.',
      coffee_break: 'Уточните доступ и часы работы; если кафе принимает гостей, сделайте перерыв на кофе. Посадочные места не подтверждены.',
      museum_visit: 'Уточните доступ и билеты; если посещение возможно, осмотрите часть экспозиции.' },
  },
  kk: {
    selected: 'Тек жергілікті таңдау имитациясы. ЖИ және провайдер сұраулары жоқ; мәтін үлгі бойынша берілген.',
    fallback: 'Жергілікті имитация орындалмады. Тек іздеу және үлгілік идеялар; провайдер сұрауы жоқ.',
    empty: 'Сәйкес сақталған орындар жоқ. Имитация мен провайдер сұраулары орындалмады.',
    reasons: { nearby: 'Таңдалған нүктеге түзу сызық бойынша жақын.', fits_time: 'Көрсетілген есеп бойынша уақытыңызға сыяды.',
      interest: 'Сәйкестендірілген санат таңдаған сүзгіңізге сәйкес келеді.', first_visit: 'Төмендегі дереккөз сипаттамасы бұл орын туралы түсіндіреді.' },
    activities: { observe: 'Жалпыға ашық кіруге рұқсат болса, орынды қарап, аздап демалыңыз.',
      stroll: 'Жалпыға ашық кіруге рұқсат болса, аумақтың қолжетімді бөлігінде серуендеңіз.',
      coffee_break: 'Кіру мен жұмыс уақытын нақтылаңыз; кафе қабылдаса, кофе ішіп демалыңыз. Отыратын орындар расталмаған.',
      museum_visit: 'Кіру мен билет шарттарын нақтылаңыз; мүмкіндік болса, көрменің бір бөлігін тамашалаңыз.' },
  },
};

// Closure retains private IDs, exact evidence versions and records. Only packet is
// intended as a future transport projection; false flags forbid external use now.
export function createEvidenceSession({ input, envelope, expected, now }) {
  if (!validInstant(now)) fail('DATA_INVALID');
  const request = { ...validateOfflineInput(cloneBounded(input, 16 * 1024)), now, query_terms: [], limit: 10 };
  const retrieval = validatePrivateRetrieval(cloneBounded(envelope, 512 * 1024), request,
    cloneBounded(expected, 2048));
  const prefix = randomUUID();
  const bindings = new Map();
  const candidates = retrieval.candidates.slice(0, 5).map((candidate, index) => {
    const p = candidate.poi;
    // Do not claim source support merely because fine and broad labels agree.
    const fine = [...new Set((p.source_rubrics ?? []).map(r => RUBRICS[String(r.id)]).filter(Boolean))].sort();
    if (JSON.stringify(fine) !== JSON.stringify([...p.source_categories].sort())
      || [...p.name].length > 1000 || (p.description !== null && [...p.description].length > 4000)) fail('DATA_INVALID');
    const alias = `${prefix}:c${index + 1}`;
    const refs = { name: `${alias}:name`, categories: `${alias}:categories`, estimates: `${alias}:estimates`,
      ...(p.description !== null ? { description: `${alias}:description` } : {}) };
    const allowedReasons = ['nearby', 'fits_time',
      ...(request.categories.some(c => p.categories.includes(c)) ? ['interest'] : []),
      ...(request.first_visit && p.description !== null ? ['first_visit'] : [])];
    const allowedActivityCodes = [...new Set(allowedActivities(request, candidate))];
    const evidence = Object.entries(refs).map(([field, ref]) => ({ ref, field,
      kind: field === 'estimates' ? 'computed_estimate' : field === 'categories' ? 'mapped_from_source_rubrics' : 'source' }));
    const localEvidence = Object.fromEntries(Object.entries(refs).map(([field, ref]) => [ref, {
      source_version: p.source_version,
      source_fields: { name: ['name'], categories: ['source_rubrics'], description: ['source_description'], estimates: ['coordinates', 'source_rubrics'] }[field],
      policy_id: ['categories', 'estimates'].includes(field) ? retrieval.policy_id : null,
    }]));
    bindings.set(alias, { candidate, refs, localEvidence, allowedReasons, allowedActivityCodes });
    return { alias, name: p.name, description: p.description, description_language: p.description_language,
      categories: [...p.categories], fine_categories: fine, category_kind: 'mapped_from_source_rubrics',
      estimates: { kind: 'heuristic_not_walking_route', distance_m: Math.round(candidate.distance_m / 50) * 50,
        travel_minutes: Math.ceil(candidate.travel_minutes_estimate), visit_minutes: candidate.visit_minutes_estimate,
        total_minutes: Math.ceil(candidate.total_minutes_estimate) },
      unknowns: ['opening_hours', 'amenities', 'seating', 'access', 'operating_status', 'source_update_time'],
      evidence, allowed_reason_codes: allowedReasons, allowed_activity_codes: allowedActivityCodes };
  });
  const packet = freeze(cloneBounded({ contract: EVIDENCE_CONTRACT, mode: 'local_mock', external_processing_allowed: false,
    context: Object.fromEntries(CONTEXT_FIELDS.map(k => [k, request[k]])), candidates }, MAX_PACKET_BYTES));

  function validate(value) {
    let output = value;
    if (typeof output === 'string') {
      if (Buffer.byteLength(output, 'utf8') > MAX_SELECTION_BYTES) fail('INVALID_MODEL_OUTPUT');
      try { output = JSON.parse(output); } catch { fail('INVALID_MODEL_OUTPUT'); }
    }
    output = cloneBounded(output, MAX_SELECTION_BYTES, 'INVALID_MODEL_OUTPUT');
    if (!exact(output, ['recommendations']) || !Array.isArray(output.recommendations)
      || output.recommendations.length < 1 || output.recommendations.length > Math.min(3, candidates.length)) fail('INVALID_MODEL_OUTPUT');
    const seen = new Set();
    return output.recommendations.map(r => {
      if (!exact(r, ['candidate_alias', 'evidence_refs', 'reason_codes', 'activity_code'])) fail('INVALID_MODEL_OUTPUT');
      const binding = bindings.get(r.candidate_alias);
      if (!binding || seen.has(r.candidate_alias)) fail('INVALID_MODEL_OUTPUT');
      seen.add(r.candidate_alias);
      const { refs, localEvidence, allowedReasons, allowedActivityCodes } = binding;
      if (!uniqueList(r.evidence_refs, Object.keys(localEvidence), 2, 4)
        || !uniqueList(r.reason_codes, allowedReasons, 1, 2) || !allowedActivityCodes.includes(r.activity_code)) fail('INVALID_MODEL_OUTPUT');
      const required = new Set([refs.name, refs.categories]); // identity and activity category
      for (const reason of r.reason_codes) required.add(reason === 'first_visit' ? refs.description
        : reason === 'interest' ? refs.categories : refs.estimates);
      if ([...required].some(ref => !r.evidence_refs.includes(ref))) fail('INVALID_MODEL_OUTPUT');
      return { ...r, binding };
    });
  }

  function render(selections, outcome, failureCode = null) {
    const chosen = selections ? selections.map(s => s.binding.candidate) : retrieval.candidates.slice(0, 3);
    const result = presentOffline(request, { ...retrieval, candidates: chosen });
    const copy = COPY[request.language];
    result.status = { selected: 'mock_generation', fallback: 'mock_retrieval_only', empty: 'mock_no_match' }[outcome];
    result.message = copy[outcome];
    result.generation = { mode: 'local_mock', outcome, mock_calls: outcome === 'empty' ? 0 : 1, provider_calls: 0,
      failure_code: failureCode, external_processing_allowed: false };
    if (selections) result.recommendations.forEach((card, i) => {
      const selection = selections[i];
      card.why = selection.reason_codes.map(code => copy.reasons[code]);
      card.activity = { kind: 'mock_template_suggestion', text: copy.activities[selection.activity_code] };
      // Local-only provenance, not part of the packet passed to a mock.
      card.selection_evidence = selection.evidence_refs.map(ref => ({
        field: ref.slice(ref.lastIndexOf(':') + 1), ...selection.binding.localEvidence[ref],
      }));
    });
    return cloneBounded(result, 512 * 1024);
  }
  return Object.freeze({ packet,
    complete: value => render(validate(value), 'selected'),
    noMatch: () => { if (candidates.length) fail('DATA_INVALID'); return render([], 'empty'); },
    fallback: code => render(null, 'fallback', ['MOCK_TIMEOUT', 'MOCK_FAILURE', 'INVALID_MODEL_OUTPUT'].includes(code) ? code : 'MOCK_FAILURE'),
  });
}
