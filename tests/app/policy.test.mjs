import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distanceMetres, estimates, freshEvidence, scheduledVisit, eventFits, validInstant } from '../../src/shared/policy.mjs';
import { SYNTHETIC_NOW, SYNTHETIC_OLD, syntheticRequest, syntheticPoi, syntheticCandidate,
  syntheticHours, syntheticEvent } from './fixtures/synthetic.mjs';

const near = (actual, expected, tolerance = 0.000001) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${actual} should be within ${tolerance} of ${expected}`);

test('geographic distance has independently known units, zero, symmetry, and finite antipodes', () => {
  const origin = { latitude: 0, longitude: 0 };
  const oneDegreeNorth = { latitude: 1, longitude: 0 };
  near(distanceMetres(origin, origin), 0);
  near(distanceMetres(origin, oneDegreeNorth), 111194.926644559);
  near(distanceMetres(oneDegreeNorth, origin), 111194.926644559);
  near(distanceMetres(origin, { latitude: 0, longitude: 180 }), 20015086.79602057);
});

test('one degree of latitude gives expected walking, visit, return, and buffer estimates', () => {
  // Analytic meridian distance. Geometric policy is tested separately from service coverage validation.
  const request = syntheticRequest({ latitude: 0, longitude: 0, return_to_start: true, buffer_minutes: 7 });
  const poi = syntheticPoi({ latitude: 1, longitude: 0 });
  const result = estimates(request, poi);
  near(result.distance_m, 111194.926644559);
  assert.equal(result.distance_kind, 'straight_line');
  near(result.travel_minutes_estimate, 2168.3010695689);
  assert.equal(result.visit_minutes_estimate, 20);
  near(result.total_minutes_estimate, 4363.6021391378);
  near(estimates({ ...request, return_to_start: false }, poi).total_minutes_estimate, 2195.3010695689);
});

test('wheelchair planning uses the disclosed slower speed and does not infer route access', () => {
  const request = syntheticRequest({ latitude: 0, longitude: 0, required_amenities: ['wheelchair'] });
  const result = estimates(request, syntheticPoi({ latitude: 1, longitude: 0 }));
  near(result.travel_minutes_estimate, 3469.28171131024);
  assert.equal(Object.hasOwn(result, 'accessible_route'), false);
});

test('visit duration uses the maximum category duration regardless of ordering', () => {
  const request = syntheticRequest();
  const first = estimates(request, syntheticPoi({ categories: ['park', 'museum', 'cafe'] }));
  const reverse = estimates(request, syntheticPoi({ categories: ['cafe', 'museum', 'park'] }));
  assert.equal(first.visit_minutes_estimate, 45);
  assert.deepEqual(first, reverse);
});

for (const value of ['2026-10-18', '2026-10-18T12:00:00', 'not-a-date', '2026-02-30T12:00:00Z',
  '2025-02-29T12:00:00Z', '2026-13-01T12:00:00Z', '2026-10-18T25:00:00Z', null, 1792324800000]) {
  test(`timestamp rejects ${String(value)}`, () => assert.equal(validInstant(value), false));
}

test('valid timestamps support leap days and explicit timezone offsets', () => {
  for (const value of ['2024-02-29T12:00:00Z', '2026-10-18T17:00:00+05:00', '2026-10-18T12:00:00.123Z']) {
    assert.equal(validInstant(value), true);
  }
});

test('evidence freshness uses the older source timestamp and inclusive threshold', () => {
  const poi = syntheticPoi();
  poi.evidence[0].collected_at = '2026-10-11T12:00:00Z';
  assert.equal(freshEvidence(poi, ['description'], SYNTHETIC_NOW, 7), true);
  poi.evidence[0].collected_at = '2026-10-11T11:59:59Z';
  assert.equal(freshEvidence(poi, ['description'], SYNTHETIC_NOW, 7), false);
  poi.evidence[0].collected_at = '2026-10-18T10:00:00Z';
  poi.evidence[0].source_updated_at = SYNTHETIC_OLD;
  assert.equal(freshEvidence(poi, ['description'], SYNTHETIC_NOW, 7), false);
});

test('missing, empty, and future evidence never establishes freshness', () => {
  const poi = syntheticPoi();
  assert.equal(freshEvidence(poi, [], SYNTHETIC_NOW, 7), false);
  assert.equal(freshEvidence(poi, ['not-found'], SYNTHETIC_NOW, 7), false);
  poi.evidence[0].collected_at = '2026-10-19T12:00:00Z';
  assert.equal(freshEvidence(poi, ['description'], SYNTHETIC_NOW, 7), false);
});

test('hours evaluate arrival and the whole visit in timezone-qualified intervals', () => {
  const request = syntheticRequest();
  const poi = syntheticPoi();
  poi.opening_hours = syntheticHours(poi);
  const candidate = { ...syntheticCandidate(request, poi), travel_minutes_estimate: 10, visit_minutes_estimate: 20 };
  assert.equal(scheduledVisit(request, candidate), 'scheduled');
  poi.opening_hours.intervals[0].end = '2026-10-18T17:29:59+05:00';
  assert.equal(scheduledVisit(request, candidate), 'outside_listed_intervals');
  poi.opening_hours.intervals[0].end = '2026-10-18T17:30:00+05:00';
  assert.equal(scheduledVisit(request, candidate), 'scheduled');
  poi.opening_hours.intervals[0].start = '2026-10-18T17:10:01+05:00';
  assert.equal(scheduledVisit(request, candidate), 'outside_listed_intervals');
});

test('absent, stale, and uninterpretable hours stay unknown', () => {
  const request = syntheticRequest();
  const candidate = syntheticCandidate(request);
  assert.equal(scheduledVisit(request, candidate), 'unknown');
  candidate.poi.opening_hours = syntheticHours(candidate.poi, { intervals: [] });
  assert.equal(scheduledVisit(request, candidate), 'unknown');
  candidate.poi.opening_hours.intervals = [{ start: '2026-10-18T11:00:00Z', end: '2026-10-18T14:00:00Z' }];
  candidate.poi.evidence.find(e => e.id === 'hours').collected_at = SYNTHETIC_OLD;
  assert.equal(scheduledVisit(request, candidate), 'unknown');
});

test('event covers arrival through full visit; future, ended, cancelled, and stale events fail', () => {
  const request = syntheticRequest();
  const poi = syntheticPoi({ categories: ['event'] });
  poi.event = syntheticEvent(poi);
  const candidate = { ...syntheticCandidate(request, poi), travel_minutes_estimate: 10, visit_minutes_estimate: 30 };
  assert.equal(eventFits(request, candidate), true);
  for (const event of [
    { ...poi.event, starts_at: '2026-10-18T12:11:00Z' },
    { ...poi.event, ends_at: '2026-10-18T11:59:00Z' },
    { ...poi.event, ends_at: '2026-10-18T12:39:59Z' },
    { ...poi.event, status: 'cancelled' }, { ...poi.event, status: 'unknown' }, null,
  ]) assert.equal(eventFits(request, { ...candidate, poi: { ...poi, event } }), false);
  poi.event.ends_at = '2026-10-18T12:40:00Z';
  assert.equal(eventFits(request, candidate), true);
  poi.evidence.find(e => e.id === 'event').source_updated_at = SYNTHETIC_OLD;
  assert.equal(eventFits(request, candidate), false);
});
