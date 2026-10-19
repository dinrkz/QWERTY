import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateRetrieval } from '../../src/shared/validate.mjs';
import { SYNTHETIC_OLD, syntheticRequest, syntheticPoi, syntheticCandidate, syntheticRetrieval,
  syntheticHours, syntheticEvent, withEvidence } from './fixtures/synthetic.mjs';

const rejects = (run, code = 'DATA_INVALID') => assert.throws(run, { name: 'AppError', code });
function validatePoiFixture(poi, request = syntheticRequest()) {
  return validateRetrieval(syntheticRetrieval([syntheticCandidate(request, poi)]), request);
}

test('valid synthetic candidates retain explicit dataset identity and unknown facts', () => {
  const result = validatePoiFixture(syntheticPoi());
  assert.equal(result.dataset_kind, 'synthetic');
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].poi.opening_hours, null);
  assert.equal(result.candidates[0].poi.access.value, 'unknown');
  assert.deepEqual(result.candidates[0].poi.amenities, {});
});

test('empty retrieval is valid only when marked no_match', () => {
  assert.equal(validateRetrieval(syntheticRetrieval([]), syntheticRequest()).status, 'no_match');
  rejects(() => validateRetrieval(syntheticRetrieval([], { status: 'ok' }), syntheticRequest()));
  rejects(() => validateRetrieval(syntheticRetrieval([syntheticCandidate()], { status: 'no_match' }), syntheticRequest()));
});

for (const code of ['DATA_UNAVAILABLE', 'DATA_INVALID', 'INVALID_INPUT', 'UNSUPPORTED_MODE']) {
  test(`typed retrieval error ${code} remains typed`, () =>
    rejects(() => validateRetrieval({ status: 'error', code }, syntheticRequest()), code));
}

test('unrecognized error text is not propagated as a public error code', () => {
  rejects(() => validateRetrieval({ status: 'error', code: 'private provider detail' }, syntheticRequest()));
});

for (const [label, mutate] of [
  ['missing provenance', p => { delete p.attribution; }],
  ['missing reuse terms', p => { delete p.reuse_terms; }],
  ['generated source description', p => { p.description_kind = 'generated'; }],
  ['invalid POI coordinate', p => { p.latitude = NaN; }],
  ['outside-city POI', p => { p.longitude = 72; }],
  ['duplicate evidence IDs', p => { p.evidence.push(structuredClone(p.evidence[0])); }],
  ['unknown description evidence', p => { p.description_evidence_ids = ['missing']; }],
  ['unproven positive amenity', p => { p.amenities.quiet = { value: true, evidence_ids: [] }; }],
  ['unproven negative amenity', p => { p.amenities.quiet = { value: false, evidence_ids: [] }; }],
  ['invented amenity key', p => { p.amenities.rooftop = { value: null, evidence_ids: [] }; }],
  ['duplicate categories', p => { p.categories = ['park', 'park']; }],
  ['no category', p => { p.categories = []; }],
  ['script URL', p => { p.source_url = 'javascript:alert(1)'; }],
  ['credential-bearing URL', p => { p.source_url = 'https://user:password@synthetic.invalid'; }],
  ['credential-bearing evidence URL', p => { p.evidence[0].source_url = 'https://user:password@synthetic.invalid'; }],
  ['future record collection', p => { p.collected_at = '2026-10-19T10:00:00Z'; }],
  ['future record update', p => { p.source_updated_at = '2026-10-19T10:00:00Z'; }],
  ['future evidence collection', p => { p.evidence[0].collected_at = '2026-10-19T10:00:00Z'; }],
  ['future evidence update', p => { p.evidence[0].source_updated_at = '2026-10-19T10:00:00Z'; }],
  ['calendar-overflow date', p => { p.collected_at = '2026-02-30T10:00:00Z'; }],
  ['timezone-free date', p => { p.evidence[0].collected_at = '2026-10-18T10:00:00'; }],
  ['invalid hours timezone', p => { p.opening_hours = syntheticHours(p, { timezone: 'Not/A_Timezone' }); }],
  ['reversed hours interval', p => { p.opening_hours = syntheticHours(p, { intervals: [
    { start: '2026-10-18T13:00:00Z', end: '2026-10-18T12:00:00Z' }] }); }],
]) test(`retrieval rejects ${label}`, () => {
  const poi = syntheticPoi();
  mutate(poi);
  rejects(() => validatePoiFixture(poi));
});

test('duplicate POI IDs invalidate the whole retrieval batch', () => {
  const candidate = syntheticCandidate();
  rejects(() => validateRetrieval(syntheticRetrieval([candidate, structuredClone(candidate)]), syntheticRequest()));
});

test('batch metadata and candidate bounds are validated', () => {
  for (const overrides of [{ dataset_kind: 'live' }, { collected_at: '2026-10-19T00:00:00Z' },
    { snapshot_id: '' }, { warnings: [null] }, { candidates: Array(11).fill(syntheticCandidate()) }]) {
    rejects(() => validateRetrieval(syntheticRetrieval(undefined, overrides), syntheticRequest()));
  }
});

test('distance, category, and total budget remain hard requirements after retrieval', () => {
  rejects(() => validatePoiFixture(syntheticPoi(), syntheticRequest({ max_distance_m: 100 })));
  rejects(() => validatePoiFixture(syntheticPoi(), syntheticRequest({ categories: ['cafe'] })));
  rejects(() => validatePoiFixture(syntheticPoi(), syntheticRequest({ available_minutes: 21 })));
  assert.equal(validatePoiFixture(syntheticPoi(), syntheticRequest({ available_minutes: 23 })).status, 'ok');
  rejects(() => validatePoiFixture(syntheticPoi(), syntheticRequest({ available_minutes: 23, return_to_start: true })));
  rejects(() => validatePoiFixture(syntheticPoi(), syntheticRequest({ available_minutes: 23, buffer_minutes: 1 })));
});

test('numeric agreement tolerance cannot turn an over-budget or over-radius POI into a match', () => {
  const candidate = syntheticCandidate();
  const request = syntheticRequest({ available_minutes: candidate.total_minutes_estimate - 0.01 });
  candidate.total_minutes_estimate -= 0.02;
  rejects(() => validateRetrieval(syntheticRetrieval([candidate]), request));
  const byDistance = syntheticCandidate();
  const radiusRequest = syntheticRequest({ max_distance_m: byDistance.distance_m - 0.1 });
  byDistance.distance_m -= 0.2;
  rejects(() => validateRetrieval(syntheticRetrieval([byDistance]), radiusRequest));
});

test('accepted minor estimate drift is replaced with exact recomputed values', () => {
  const request = syntheticRequest();
  const candidate = syntheticCandidate(request);
  const expected = structuredClone(candidate);
  candidate.distance_m += 0.5;
  candidate.travel_minutes_estimate += 0.01;
  candidate.total_minutes_estimate += 0.01;
  const actual = validateRetrieval(syntheticRetrieval([candidate]), request).candidates[0];
  assert.deepEqual(actual, expected);
});

for (const [label, mutate] of [
  ['wrong distance kind', c => { c.distance_kind = 'walking_route'; }],
  ['fabricated distance', c => { c.distance_m = 0; }],
  ['missing return time', c => { c.total_minutes_estimate = 20; }],
  ['non-finite time', c => { c.travel_minutes_estimate = Infinity; }],
  ['string estimate', c => { c.visit_minutes_estimate = '20'; }],
]) test(`retrieval rejects ${label}`, () => {
  const candidate = syntheticCandidate();
  mutate(candidate);
  rejects(() => validateRetrieval(syntheticRetrieval([candidate]), syntheticRequest()));
});

test('all hard amenities need true and fresh evidence, including accessibility', () => {
  for (const amenity of ['quiet', 'sockets', 'child_friendly', 'wheelchair']) {
    const request = syntheticRequest({ required_amenities: [amenity] });
    for (const value of [undefined, null, false, true]) {
      const poi = syntheticPoi();
      if (value !== undefined) poi.amenities[amenity] = { value, evidence_ids: value === null ? [] : withEvidence(poi, amenity) };
      if (value === true) assert.equal(validatePoiFixture(poi, request).status, 'ok');
      else rejects(() => validatePoiFixture(poi, request));
    }
    const stale = syntheticPoi();
    stale.amenities[amenity] = { value: true, evidence_ids: withEvidence(stale, amenity, { source_updated_at: SYNTHETIC_OLD }) };
    rejects(() => validatePoiFixture(stale, request));
  }
});

test('negative access and closure evidence excludes places even if other facts are suitable', () => {
  for (const [field, value] of [['access', 'restricted'], ['operating_status', 'temporarily_closed'],
    ['operating_status', 'permanently_closed']]) {
    const poi = syntheticPoi();
    poi[field] = { value, evidence_ids: withEvidence(poi, field) };
    rejects(() => validatePoiFixture(poi));
  }
});

test('require_open excludes unknown, stale, and closing-before-end schedules', () => {
  const request = syntheticRequest({ require_open: true });
  rejects(() => validatePoiFixture(syntheticPoi(), request));
  const poi = syntheticPoi();
  poi.opening_hours = syntheticHours(poi);
  assert.equal(validatePoiFixture(poi, request).status, 'ok');
  poi.opening_hours.intervals[0].end = '2026-10-18T17:21:00+05:00';
  rejects(() => validatePoiFixture(poi, request));
  poi.opening_hours = { ...poi.opening_hours, intervals: [] };
  rejects(() => validatePoiFixture(poi, request));
  poi.opening_hours.intervals = [{ start: '2026-10-18T11:00:00Z', end: '2026-10-18T14:00:00Z' }];
  poi.evidence.find(e => e.id === 'hours').collected_at = SYNTHETIC_OLD;
  rejects(() => validatePoiFixture(poi, request));
});

test('events-only rejects ordinary POIs, and invalid events fail even without an events filter', () => {
  rejects(() => validatePoiFixture(syntheticPoi(), syntheticRequest({ events_only: true })));
  const poi = syntheticPoi({ categories: ['event'] });
  rejects(() => validatePoiFixture(poi));
  poi.event = syntheticEvent(poi);
  assert.equal(validatePoiFixture(poi).status, 'ok');
  for (const change of [{ status: 'cancelled' }, { status: 'unknown' },
    { starts_at: '2026-10-19T11:00:00Z', ends_at: '2026-10-19T14:00:00Z' },
    { starts_at: '2026-10-18T09:00:00Z', ends_at: '2026-10-18T10:00:00Z' },
    { ends_at: '2026-10-18T12:20:00Z' }]) {
    rejects(() => validatePoiFixture({ ...poi, event: { ...poi.event, ...change } }));
  }
  poi.evidence.find(e => e.id === 'event').collected_at = '2026-10-16T11:59:59Z';
  rejects(() => validatePoiFixture(poi));
});

test('event attached to a non-event category is still constrained by its dates', () => {
  const poi = syntheticPoi();
  poi.event = syntheticEvent(poi, { status: 'cancelled' });
  rejects(() => validatePoiFixture(poi));
});
