import { AMENITIES, AppError, CATEGORIES, LANGUAGES, allowedActivities, allowedReasons,
  detectLanguage, estimates, eventFits, freshEvidence, scheduledVisit, validInstant } from './policy.mjs';

const fail = (code = 'INVALID_INPUT') => { throw new AppError(code); };
const obj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = 1000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(v);
const num = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const list = (v, vocabulary, max = vocabulary.length) => Array.isArray(v) && v.length <= max
  && new Set(v).size === v.length && v.every(x => vocabulary.includes(x));
const keys = (value, allowed) => Object.keys(value).every(k => allowed.includes(k));
export const safeUrl = value => {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password; }
  catch { return false; }
};
export function validateInput(raw) {
  if (!obj(raw) || !keys(raw, ['latitude','longitude','query','available_minutes','language','travel_mode','categories',
    'required_amenities','preferred_amenities','max_distance_m','return_to_start','buffer_minutes','require_open','events_only','first_visit'])) fail();
  if (!num(raw.latitude, -90, 90) || !num(raw.longitude, -180, 180) || !text(raw.query)
    || !Number.isInteger(raw.available_minutes) || !num(raw.available_minutes, 5, 480)) fail();
  if (!num(raw.latitude, 50.9, 51.35) || !num(raw.longitude, 71.15, 71.75)) fail('OUTSIDE_COVERAGE');
  const result = { ...raw, query: raw.query.trim(), language: raw.language ?? 'auto', travel_mode: raw.travel_mode ?? 'walking',
    categories: raw.categories ?? [], required_amenities: raw.required_amenities ?? [], preferred_amenities: raw.preferred_amenities ?? [],
    max_distance_m: raw.max_distance_m ?? 3000, return_to_start: raw.return_to_start ?? false,
    buffer_minutes: raw.buffer_minutes ?? 0, require_open: raw.require_open ?? false,
    events_only: raw.events_only ?? false, first_visit: raw.first_visit ?? false };
  if (result.travel_mode !== 'walking') fail('UNSUPPORTED_MODE');
  if (!['auto', ...LANGUAGES].includes(result.language) || !list(result.categories, CATEGORIES)
    || !list(result.required_amenities, AMENITIES) || !list(result.preferred_amenities, AMENITIES)
    || !num(result.max_distance_m, 1, 10000) || !num(result.buffer_minutes, 0, 479)
    || result.buffer_minutes >= result.available_minutes
    || ['return_to_start','require_open','events_only','first_visit'].some(k => typeof result[k] !== 'boolean')) fail();
  result.language = detectLanguage(result.query, result.language);
  return result;
}

export function mergeIntent(request, intent) {
  const fields = ['categories','required_amenities','preferred_amenities','available_minutes','max_distance_m','buffer_minutes',
    'return_to_start','require_open','events_only','first_visit','clarification_code','query_terms'];
  if (!obj(intent) || !keys(intent, fields) || fields.some(k => !Object.hasOwn(intent, k))
    || !list(intent.categories, CATEGORIES) || !list(intent.required_amenities, AMENITIES)
    || !list(intent.preferred_amenities, AMENITIES) || !Array.isArray(intent.query_terms) || intent.query_terms.length > 12
    || intent.query_terms.some(x => !text(x, 60)) || ![null,'unsupported_request','departure_details','constraint_details'].includes(intent.clarification_code)) fail('INVALID_MODEL_OUTPUT');
  for (const field of ['available_minutes','max_distance_m','buffer_minutes']) {
    if (intent[field] !== null && !num(intent[field], field === 'buffer_minutes' ? 0 : 1, field === 'max_distance_m' ? 10000 : 480)) fail('INVALID_MODEL_OUTPUT');
  }
  for (const field of ['return_to_start','require_open','events_only','first_visit']) {
    if (intent[field] !== null && typeof intent[field] !== 'boolean') fail('INVALID_MODEL_OUTPUT');
  }
  if (intent.clarification_code) fail('NEEDS_CLARIFICATION');
  const categories = request.categories.length && intent.categories.length
    ? request.categories.filter(c => intent.categories.includes(c)) : [...request.categories, ...intent.categories];
  if (request.categories.length && intent.categories.length && !categories.length) fail('NEEDS_CLARIFICATION');
  const next = { ...request, categories, query_terms: intent.query_terms,
    required_amenities: [...new Set([...request.required_amenities, ...intent.required_amenities])],
    preferred_amenities: [...new Set([...request.preferred_amenities, ...intent.preferred_amenities])],
    available_minutes: Math.floor(Math.min(request.available_minutes, intent.available_minutes ?? Infinity)),
    max_distance_m: Math.min(request.max_distance_m, intent.max_distance_m ?? Infinity),
    buffer_minutes: Math.max(request.buffer_minutes, intent.buffer_minutes ?? 0) };
  for (const k of ['return_to_start','require_open','events_only','first_visit']) next[k] = request[k] || intent[k] === true;
  if (next.available_minutes <= next.buffer_minutes || next.available_minutes < 5) fail('NEEDS_CLARIFICATION');
  return next;
}

function validatePoi(p, now) {
  const bad = () => fail('DATA_INVALID');
  if (!obj(p) || !text(p.id, 200) || !text(p.source_id, 200) || !text(p.name, 200) || !text(p.description, 4000)
    || p.description_kind !== 'source' || !text(p.description_language, 32) || !num(p.latitude, 50.9, 51.35)
    || !num(p.longitude, 71.15, 71.75) || !list(p.categories, CATEGORIES) || !p.categories.length
    || !Array.isArray(p.tags) || p.tags.length > 30 || p.tags.some(t => !text(t, 80))
    || !safeUrl(p.source_url) || !text(p.attribution, 500) || !text(p.reuse_terms, 2000)) bad();
  const date = v => validInstant(v) && Date.parse(v) <= Date.parse(now);
  if (!date(p.collected_at) || (p.source_updated_at !== null && !date(p.source_updated_at))
    || !Array.isArray(p.evidence) || !p.evidence.length || p.evidence.length > 40) bad();
  const ids = new Set();
  for (const e of p.evidence) {
    if (!obj(e) || !text(e.id, 200) || ids.has(e.id) || !safeUrl(e.source_url) || !text(e.source_field, 200)
      || !date(e.collected_at) || (e.source_updated_at !== null && !date(e.source_updated_at))) bad();
    ids.add(e.id);
  }
  const refs = (r, required = true) => Array.isArray(r) && (!required || r.length > 0) && r.length <= 40
    && new Set(r).size === r.length && r.every(id => ids.has(id));
  if (!refs(p.description_evidence_ids) || !obj(p.amenities) || !keys(p.amenities, AMENITIES)) bad();
  for (const a of Object.values(p.amenities)) {
    if (!obj(a) || ![true,false,null].includes(a.value) || !refs(a.evidence_ids, a.value !== null)) bad();
  }
  for (const [field, values] of [['access',['public','restricted','unknown']],
    ['operating_status',['operating','temporarily_closed','permanently_closed','unknown']]]) {
    if (!obj(p[field]) || !values.includes(p[field].value) || !refs(p[field].evidence_ids, p[field].value !== 'unknown')) bad();
  }
  if (p.opening_hours !== null) {
    const h = p.opening_hours;
    if (!obj(h) || !text(h.text, 1000) || !text(h.timezone, 100) || !refs(h.evidence_ids)
      || !Array.isArray(h.intervals) || h.intervals.length > 50) bad();
    try { new Intl.DateTimeFormat('en', { timeZone: h.timezone }).format(); } catch { bad(); }
    if (h.intervals.some(i => !obj(i) || !validInstant(i.start) || !validInstant(i.end) || Date.parse(i.end) <= Date.parse(i.start))) bad();
  }
  if (p.event !== null) {
    const e = p.event;
    if (!obj(e) || !validInstant(e.starts_at) || !validInstant(e.ends_at) || Date.parse(e.starts_at) >= Date.parse(e.ends_at)
      || !['scheduled','cancelled','unknown'].includes(e.status) || !refs(e.evidence_ids)) bad();
  }
}

export function validateRetrieval(result, request) {
  const bad = () => fail('DATA_INVALID');
  if (!obj(result)) bad();
  if (result.status === 'error') {
    if (!['DATA_UNAVAILABLE','DATA_INVALID','INVALID_INPUT','UNSUPPORTED_MODE'].includes(result.code)) bad();
    fail(result.code);
  }
  if (!['ok','no_match'].includes(result.status) || !['collected','synthetic'].includes(result.dataset_kind)
    || !text(result.snapshot_id, 200) || !validInstant(result.collected_at) || Date.parse(result.collected_at) > Date.parse(request.now)
    || !Array.isArray(result.candidates) || result.candidates.length > 10
    || (result.status === 'ok') !== (result.candidates.length > 0)
    || !Array.isArray(result.warnings) || result.warnings.length > 20 || result.warnings.some(w => !text(w, 500))) bad();
  const ids = new Set();
  for (const c of result.candidates) {
    if (!obj(c)) bad();
    validatePoi(c.poi, request.now);
    if (ids.has(c.poi.id)) bad();
    ids.add(c.poi.id);
    const expected = estimates(request, c.poi);
    if (c.distance_kind !== 'straight_line' || Object.entries(expected).some(([k,v]) => typeof v === 'number'
      && (!num(c[k], 0, 100000) || Math.abs(c[k] - v) > (k === 'distance_m' ? 1 : 0.05)))) bad();
    // Eligibility is independently checked with exact recomputed values, never tolerance/rounded display values.
    if (expected.distance_m > request.max_distance_m || expected.total_minutes_estimate > request.available_minutes
      || c.poi.access.value === 'restricted' || ['temporarily_closed','permanently_closed'].includes(c.poi.operating_status.value)
      || (request.categories.length && !request.categories.some(cat => c.poi.categories.includes(cat)))
      || request.required_amenities.some(a => c.poi.amenities[a]?.value !== true
        || !freshEvidence(c.poi, c.poi.amenities[a].evidence_ids, request.now, 30))
      || (request.require_open && scheduledVisit(request, { ...c, ...expected }) !== 'scheduled')
      || ((request.events_only || c.poi.categories.includes('event') || c.poi.event) && !eventFits(request, { ...c, ...expected }))) bad();
    Object.assign(c, expected);
  }
  return result;
}

export function validateGenerated(value, request, candidates) {
  const bad = () => fail('INVALID_MODEL_OUTPUT');
  if (!obj(value) || !keys(value, ['recommendations']) || !Array.isArray(value.recommendations)
    || value.recommendations.length < 1 || value.recommendations.length > Math.min(3, candidates.length)) bad();
  const seen = new Set();
  for (const r of value.recommendations) {
    if (!obj(r) || !keys(r, ['poi_id','evidence_ids','reason_codes','activity_code'])) bad();
    const c = candidates.find(c => c.poi.id === r.poi_id);
    if (!c || seen.has(r.poi_id)) bad();
    seen.add(r.poi_id);
    if (!list(r.evidence_ids, c.poi.description_evidence_ids, 3) || !r.evidence_ids.length
      || !list(r.reason_codes, allowedReasons(request, c), 2) || !r.reason_codes.length
      || !allowedActivities(request, c).includes(r.activity_code)) bad();
  }
  return value;
}
