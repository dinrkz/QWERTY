import { AppError, AMENITIES, CATEGORIES, estimates, validInstant } from '../shared/policy.mjs';
import { validateInput } from '../shared/validate.mjs';
import { errorResult } from './presentation.mjs';

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = 4000) => typeof v === 'string' && v.trim().length > 0 && [...v].length <= max && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(v);
const strings = (v, max = 40) => Array.isArray(v) && v.length <= max && v.every(x => text(x));
const empty = v => Array.isArray(v) && v.length === 0;
const hex = v => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const bad = () => { throw new AppError('DATA_INVALID'); };
const unknown = v => object(v) && v.value === 'unknown' && empty(v.evidence_ids);
const categoryMap = { coffeehouse: 'cafe', coffee_point: 'cafe', park: 'park', museum: 'museum',
  viewpoint: 'landmark', interesting_building: 'landmark', fountain: 'landmark', sculpture: 'landmark', gallery: null };

// Offline text is lexical ranking only. A punctuation placeholder has no search
// tokens, while preserving the existing Python and live input contracts.
export function validateOfflineInput(raw) {
  if (!object(raw) || typeof raw.query !== 'string' || raw.query.length > 1000) throw new AppError('INVALID_INPUT');
  return validateInput({ ...raw, query: raw.query.trim() ? raw.query : '—' });
}

export function validatePrivateRetrieval(envelope, request, expected) {
  if (object(envelope) && envelope.status === 'error') {
    if (!['DATA_UNAVAILABLE', 'DATA_INVALID', 'INVALID_INPUT', 'UNSUPPORTED_MODE'].includes(envelope.code)) bad();
    throw new AppError(envelope.code);
  }
  if (!object(envelope) || envelope.status !== 'offline_evaluation' || envelope.contract !== 'qadam-private-retrieval-v1') bad();
  const r = envelope.result;
  if (!object(r) || r.demo_eligible !== false || r.external_processing_allowed !== false
    || !['collected', 'synthetic'].includes(r.dataset_kind) || r.dataset_kind !== expected?.dataset_kind) bad();
  for (const key of ['snapshot_id', 'review_id', 'binding_id', 'policy_id']) {
    if (!hex(r[key]) || r[key] !== expected[key]) bad();
  }
  const date = v => validInstant(v) && Date.parse(v) <= Date.parse(request.now);
  if (!date(r.collected_at) || !['ok', 'no_match'].includes(r.status)
    || !Array.isArray(r.candidates) || r.candidates.length > 10
    || (r.status === 'ok') !== (r.candidates.length > 0)
    || !Number.isInteger(r.eligible_count) || r.eligible_count < r.candidates.length
    || r.eligible_count > 100000 || (r.status === 'no_match' && r.eligible_count !== 0)
    || !strings(r.warnings) || !strings(r.reason_codes, 60)) bad();
  const ids = new Set();
  for (const c of r.candidates) {
    const p = c?.poi;
    if (!object(c) || !object(p) || !text(p.id, 522) || ids.has(p.id) || !text(p.source_id, 512)
      || p.id !== `${r.dataset_kind === 'collected' ? '2gis' : 'synthetic'}:${p.source_id}`
      || !text(p.name, 1000) || !hex(p.source_version) || p.demo_eligible !== false
      || !Number.isFinite(p.latitude) || p.latitude < 50.9 || p.latitude > 51.35
      || !Number.isFinite(p.longitude) || p.longitude < 71.15 || p.longitude > 71.75
      || !strings(p.categories, 5) || !p.categories.length || new Set(p.categories).size !== p.categories.length
      || p.categories.some(v => !CATEGORIES.includes(v)) || !strings(p.source_categories, 20)
      || !date(p.collected_at) || Date.parse(p.collected_at) > Date.parse(r.collected_at)
      || p.source_updated_at !== null || p.description_language !== null
      || p.source_url !== null || p.reuse_terms !== null
      || p.attribution !== (r.dataset_kind === 'collected' ? '2GIS' : 'Synthetic test fixture')
      || !empty(p.tags) || !object(p.amenities) || Object.keys(p.amenities).length
      || p.opening_hours !== null || p.event !== null || !unknown(p.access) || !unknown(p.operating_status)
      || c.review_status !== 'candidate' || !object(c.review)
      || c.review.kind !== 'analyst_judgment_not_source_fact' || !text(c.review.reason)
      || !strings(c.review.caveats, 100) || !strings(c.uncertainty_codes, 60)) bad();
    ids.add(p.id);
    if (!p.source_categories.length || new Set(p.source_categories).size !== p.source_categories.length
      || p.source_categories.some(v => !Object.hasOwn(categoryMap, v))
      || JSON.stringify([...new Set(p.source_categories.map(v => categoryMap[v]).filter(Boolean))].sort())
        !== JSON.stringify([...p.categories].sort())) bad();
    if (p.description === null ? p.description_kind !== null || !empty(p.description_evidence_ids)
      : !text(p.description, 64000) || p.description_kind !== 'source'
        || !Array.isArray(p.description_evidence_ids) || p.description_evidence_ids.length !== 1
        || p.description_evidence_ids[0] !== `source:${p.source_version}`) bad();
    if (p.source_schedule_comment !== null && !text(p.source_schedule_comment)) bad();
    if (p.source_rubrics !== null && (!Array.isArray(p.source_rubrics) || p.source_rubrics.length > 100
      || p.source_rubrics.some(v => !object(v) || !text(v.name, 500)))) bad();
    const fields = ['name', 'coordinates', 'source_rubrics', ...(p.description ? ['source_description'] : [])];
    const evidence = p.evidence?.[0];
    if (!Array.isArray(p.evidence) || p.evidence.length !== 1 || !object(evidence)
      || evidence.id !== `source:${p.source_version}` || evidence.source_version !== p.source_version
      || evidence.collected_at !== p.collected_at || JSON.stringify(evidence.source_fields) !== JSON.stringify(fields)) bad();
    if (request.required_amenities.length || request.require_open || request.events_only
      || (request.categories.length && !request.categories.some(v => p.categories.includes(v)))) bad();
    const computed = estimates(request, p);
    if (computed.distance_m > request.max_distance_m || computed.total_minutes_estimate > request.available_minutes
      || c.distance_kind !== 'straight_line') bad();
    for (const key of ['distance_m', 'travel_minutes_estimate', 'visit_minutes_estimate', 'total_minutes_estimate']) {
      if (!Number.isFinite(c[key]) || Math.abs(c[key] - computed[key]) > (key === 'distance_m' ? 1 : 0.05)) bad();
    }
    // Present independently recomputed values, not values supplied by the child.
    Object.assign(c, computed);
  }
  return r;
}

const COPY = {
  en: {
    seating: 'This may be a takeaway coffee point; seating is unconfirmed.',
    entrance: 'The coordinate represents an area, not a verified entrance.',
    mode: 'Private offline search. No AI or provider requests; activity ideas use templates.',
    empty: 'No saved places satisfy these filters. Unknown opening hours, events or amenities cannot satisfy required filters.',
    private: 'Private evaluation only. Dataset storage, redistribution and external AI-processing permissions remain unresolved.',
    synthetic: 'Synthetic test records only; not real-place recommendations.',
    why: ['Near the selected point in straight-line distance.', 'Fits the selected time budget under the stated estimate.'],
    caveats: ['Opening hours, amenities and entry conditions are unverified. Check before visiting.', 'Source update time is unknown; collection date does not guarantee current information.'],
    assumption: 'Straight-line × 1.3 at 4 km/h; category-based visit estimate. Not a verified walking route.',
    activity: 'If public access is permitted, take a look around and pause here.',
    cafe: 'Check access and opening hours; if the cafe is receiving guests, take a coffee break.',
    museum: 'Check access and tickets; if visiting is possible, explore part of the exhibition.',
    park: 'If public access is permitted, stroll through the accessible part of the area.',
  },
  ru: {
    seating: 'Это может быть кофе с собой; наличие посадочных мест не подтверждено.',
    entrance: 'Координата обозначает территорию, а не проверенный вход.',
    mode: 'Частный офлайн-поиск. Без ИИ и запросов к провайдерам; идеи действий — шаблонные.',
    empty: 'Сохранённые места не подходят под эти фильтры. Неизвестные часы работы, события и удобства не подтверждают обязательные условия.',
    private: 'Только частная проверка. Разрешения на хранение, распространение и внешнюю обработку данных ИИ остаются невыясненными.',
    synthetic: 'Только синтетические тестовые записи, не рекомендации реальных мест.',
    why: ['Рядом с выбранной точкой по прямой.', 'Укладывается в выбранный бюджет времени по указанной оценке.'],
    caveats: ['Часы работы, удобства и условия входа не подтверждены. Уточните их перед посещением.', 'Дата обновления источника неизвестна; дата сбора не гарантирует актуальность сведений.'],
    assumption: 'По прямой × 1,3 при 4 км/ч; время визита оценено по категории. Это не проверенный пешеходный маршрут.',
    activity: 'Если публичный доступ разрешён, осмотритесь и сделайте здесь паузу.',
    cafe: 'Уточните доступ и часы работы; если кафе принимает гостей, сделайте перерыв на кофе.',
    museum: 'Уточните доступ и билеты; если посещение возможно, осмотрите часть экспозиции.',
    park: 'Если публичный доступ разрешён, прогуляйтесь по доступной части территории.',
  },
  kk: {
    seating: 'Бұл кофені алып кету орны болуы мүмкін; отыратын орындар расталмаған.',
    entrance: 'Координат аумақты көрсетеді, расталған кіреберісті емес.',
    mode: 'Жеке офлайн іздеу. ЖИ және провайдер сұраулары қолданылмайды; әрекет идеялары үлгі бойынша берілген.',
    empty: 'Сақталған орындар бұл сүзгілерге сәйкес келмейді. Белгісіз жұмыс уақыты, іс-шаралар мен қолайлылықтар міндетті шарттарды растамайды.',
    private: 'Тек жеке тексеру. Деректерді сақтау, тарату және сыртқы ЖИ арқылы өңдеу рұқсаттары әлі анықталмаған.',
    synthetic: 'Тек синтетикалық тест жазбалары; нақты орындар туралы кеңес емес.',
    why: ['Таңдалған нүктеге түзу сызық бойынша жақын.', 'Көрсетілген есеп бойынша таңдаған уақытыңызға сыяды.'],
    caveats: ['Жұмыс уақыты, қолайлылықтар және кіру шарттары расталмаған. Барар алдында нақтылаңыз.', 'Дереккөздің жаңарту күні белгісіз; жинау күні ақпараттың өзектілігіне кепілдік бермейді.'],
    assumption: 'Түзу қашықтық × 1,3, жылдамдық 4 км/сағ; бару уақыты санат бойынша бағаланған. Бұл тексерілген жаяу бағыт емес.',
    activity: 'Жалпыға ашық кіруге рұқсат болса, орынды қарап, аздап демалыңыз.',
    cafe: 'Кіру мен жұмыс уақытын нақтылаңыз; кафе қонақ қабылдаса, кофе ішіп демалыңыз.',
    museum: 'Кіру мен билет шарттарын нақтылаңыз; мүмкіндік болса, көрменің бір бөлігін тамашалаңыз.',
    park: 'Жалпыға ашық кіруге рұқсат болса, аумақтың қолжетімді бөлігінде серуендеңіз.',
  },
};

export function presentOffline(request, retrieval) {
  const copy = COPY[request.language];
  const recommendations = retrieval.candidates.slice(0, 3).map(c => {
    const p = c.poi;
    const travel = Math.round(c.travel_minutes_estimate * 10) / 10;
    const back = request.return_to_start ? travel : 0;
    return {
      poi_id: p.id, name: p.name, latitude: p.latitude, longitude: p.longitude,
      source_facts: { description: p.description, description_language: p.description_language,
        categories: p.categories, source_categories: p.source_categories,
        source_rubrics: p.source_rubrics?.map(v => v.name) ?? [], source_schedule_comment: p.source_schedule_comment,
        opening_hours: null, collected_at: p.collected_at, amenities: AMENITIES.map(name => ({ name, value: null })), event: null },
      why: [...copy.why], activity: { kind: 'template_suggestion', text: copy[p.categories.find(v => ['cafe', 'museum', 'park'].includes(v))] ?? copy.activity },
      estimates: { distance_m: Math.round(c.distance_m), travel_minutes: travel,
        visit_minutes: c.visit_minutes_estimate, return_minutes: back,
        buffer_minutes: request.buffer_minutes, total_minutes: Math.round((travel + back + c.visit_minutes_estimate + request.buffer_minutes) * 10) / 10,
        distance_kind: 'straight_line', assumptions: copy.assumption },
      sources: [{ url: null, attribution: p.attribution, source_id: p.source_id, source_version: p.source_version,
        collected_at: p.collected_at, source_updated_at: null, evidence_ids: p.evidence.map(v => v.id) }],
      review: { ...c.review, caveats: [...c.review.caveats] }, uncertainty_codes: [...c.uncertainty_codes],
      caveats: [...copy.caveats, ...(c.uncertainty_codes.includes('coffee_point_seating_unknown') ? [copy.seating] : []),
        ...(c.uncertainty_codes.includes('area_point_not_entrance') ? [copy.entrance] : [])],
    };
  });
  const context = {};
  for (const key of ['available_minutes', 'language', 'travel_mode', 'categories', 'required_amenities', 'preferred_amenities',
    'max_distance_m', 'return_to_start', 'buffer_minutes', 'require_open', 'events_only', 'first_visit']) context[key] = request[key];
  return { status: 'offline_evaluation', language: request.language,
    message: copy.mode + (recommendations.length ? '' : ` ${copy.empty}`),
    context_used: { ...context, location: 'manual_or_simulated_ephemeral', query_mode: 'keywords_only' },
    recommendations, warnings: [copy.private, ...(retrieval.dataset_kind === 'synthetic' ? [copy.synthetic] : [])],
    dataset: { kind: retrieval.dataset_kind, snapshot_id: retrieval.snapshot_id, review_id: retrieval.review_id,
      policy_id: retrieval.policy_id, binding_id: retrieval.binding_id, collected_at: retrieval.collected_at,
      demo_eligible: false, external_processing_allowed: false } };
}

export function createOfflineService({ retrieve, expected, now = () => new Date().toISOString() }) {
  return async raw => {
    let request;
    try {
      request = { ...validateOfflineInput(raw), now: now(), query_terms: [], limit: 10 };
      return presentOffline(request, validatePrivateRetrieval(await retrieve(request), request, expected));
    } catch (error) {
      return errorResult(error instanceof AppError ? error.code : 'DATA_INVALID', request?.language);
    }
  };
}
