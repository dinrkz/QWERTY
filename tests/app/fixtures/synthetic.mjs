import { estimates } from '../../../src/shared/policy.mjs';

// Artificial unit-test records only. These are not collected Astana POIs or demo data.
// The reserved .invalid domain makes the absence of real provenance explicit.
export const SYNTHETIC_NOW = '2026-10-18T12:00:00Z';
export const SYNTHETIC_FRESH = '2026-10-18T10:00:00Z';
export const SYNTHETIC_OLD = '2026-08-01T10:00:00Z';

export function syntheticInput(overrides = {}) {
  return { latitude: 51.1, longitude: 71.4, query: 'A short walk', available_minutes: 60, ...overrides };
}

export function syntheticRequest(overrides = {}) {
  return { ...syntheticInput(), language: 'en', travel_mode: 'walking', categories: [],
    required_amenities: [], preferred_amenities: [], max_distance_m: 3000,
    return_to_start: false, buffer_minutes: 0, require_open: false, events_only: false,
    first_visit: false, query_terms: [], now: SYNTHETIC_NOW, ...overrides };
}

export function syntheticIntent(overrides = {}) {
  return { categories: [], required_amenities: [], preferred_amenities: [], available_minutes: null,
    max_distance_m: null, buffer_minutes: null, return_to_start: null, require_open: null,
    events_only: null, first_visit: null, clarification_code: null, query_terms: [], ...overrides };
}

export function syntheticEvidence(id = 'description', overrides = {}) {
  return { id, source_url: 'https://synthetic.invalid/unit-test', source_field: id,
    collected_at: SYNTHETIC_FRESH, source_updated_at: null, ...overrides };
}

export function syntheticPoi(overrides = {}) {
  return { id: 'synthetic:park', source_id: 'synthetic-park', name: 'Synthetic park — unit test only',
    latitude: 51.101, longitude: 71.4, description: 'Artificial park description for validation tests.',
    description_kind: 'source', description_language: 'en', categories: ['park'], tags: [],
    source_url: 'https://synthetic.invalid/unit-test', collected_at: SYNTHETIC_FRESH,
    source_updated_at: null, attribution: 'Synthetic test fixture', reuse_terms: 'Artificial test data only',
    evidence: [syntheticEvidence()], description_evidence_ids: ['description'], amenities: {},
    opening_hours: null, event: null, access: { value: 'unknown', evidence_ids: [] },
    operating_status: { value: 'unknown', evidence_ids: [] }, ...overrides };
}

export function withEvidence(poi, id, overrides = {}) {
  poi.evidence.push(syntheticEvidence(id, overrides));
  return [id];
}

export function syntheticHours(poi, overrides = {}) {
  return { text: 'Synthetic interval only', timezone: 'Asia/Almaty',
    evidence_ids: withEvidence(poi, 'hours'),
    intervals: [{ start: '2026-10-18T16:00:00+05:00', end: '2026-10-18T19:00:00+05:00' }],
    ...overrides };
}

export function syntheticEvent(poi, overrides = {}) {
  return { status: 'scheduled', starts_at: '2026-10-18T11:00:00Z',
    ends_at: '2026-10-18T14:00:00Z', evidence_ids: withEvidence(poi, 'event'), ...overrides };
}

export function syntheticCandidate(request = syntheticRequest(), poi = syntheticPoi()) {
  // Consistent setup for validator tests. Independent numerical policy checks are in policy.test.mjs.
  return { poi, ...estimates(request, poi) };
}

export function syntheticRetrieval(candidates = [syntheticCandidate()], overrides = {}) {
  return { status: candidates.length ? 'ok' : 'no_match', dataset_kind: 'synthetic',
    snapshot_id: 'synthetic-unit-tests-only', collected_at: SYNTHETIC_FRESH,
    candidates, warnings: [], ...overrides };
}

export function syntheticRecommendation(candidate = syntheticCandidate(), overrides = {}) {
  return { poi_id: candidate.poi.id, evidence_ids: ['description'],
    reason_codes: ['nearby'], activity_code: 'stroll', ...overrides };
}
