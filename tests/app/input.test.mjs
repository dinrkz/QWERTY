import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeIntent, validateInput } from '../../src/shared/validate.mjs';
import { syntheticInput, syntheticIntent, syntheticRequest } from './fixtures/synthetic.mjs';

const rejects = (run, code = 'INVALID_INPUT') => assert.throws(run, { name: 'AppError', code });

test('minimal valid input gets walking defaults and a trimmed query without mutation', () => {
  const raw = syntheticInput({ query: '  Хочу прогуляться  ' });
  const original = structuredClone(raw);
  const result = validateInput(raw);
  assert.equal(result.query, 'Хочу прогуляться');
  assert.equal(result.language, 'ru');
  assert.equal(result.travel_mode, 'walking');
  assert.equal(result.max_distance_m, 3000);
  assert.equal(result.return_to_start, false);
  assert.deepEqual(result.required_amenities, []);
  assert.deepEqual(raw, original);
});

for (const [label, input] of [
  ['null body', null], ['array body', []], ['string body', 'request'],
  ['missing query', { latitude: 51.1, longitude: 71.4, available_minutes: 60 }],
  ['blank query', syntheticInput({ query: ' \n\t ' })],
  ['oversize query', syntheticInput({ query: 'x'.repeat(1001) })],
  ['control character', syntheticInput({ query: 'walk\u0000now' })],
  ['fractional budget', syntheticInput({ available_minutes: 10.5 })],
  ['short budget', syntheticInput({ available_minutes: 4 })],
  ['long budget', syntheticInput({ available_minutes: 481 })],
  ['string budget', syntheticInput({ available_minutes: '60' })],
  ['boolean budget', syntheticInput({ available_minutes: true })],
  ['unknown field', syntheticInput({ open_now: true })],
  ['client-controlled clock', syntheticInput({ now: '2026-10-18T12:00:00Z' })],
  ['unknown category', syntheticInput({ categories: ['restaurant'] })],
  ['duplicate categories', syntheticInput({ categories: ['park', 'park'] })],
  ['unknown amenity', syntheticInput({ required_amenities: ['rooftop'] })],
  ['non-array amenities', syntheticInput({ preferred_amenities: 'quiet' })],
  ['unknown language', syntheticInput({ language: 'de' })],
  ['non-boolean flag', syntheticInput({ require_open: 'true' })],
  ['negative buffer', syntheticInput({ buffer_minutes: -1 })],
  ['buffer consumes budget', syntheticInput({ buffer_minutes: 60 })],
  ['zero radius', syntheticInput({ max_distance_m: 0 })],
  ['excessive radius', syntheticInput({ max_distance_m: 10001 })],
]) test(`input rejects ${label}`, () => rejects(() => validateInput(input)));

for (const coordinate of ['latitude', 'longitude']) {
  for (const value of [true, false, NaN, Infinity, -Infinity, null, '51.1', undefined]) {
    test(`${coordinate} rejects ${String(value)} without coercion`, () =>
      rejects(() => validateInput(syntheticInput({ [coordinate]: value }))));
  }
}

for (const [latitude, longitude, code] of [
  [90.1, 71.4, 'INVALID_INPUT'], [51.1, -180.1, 'INVALID_INPUT'],
  [43.2, 76.9, 'OUTSIDE_COVERAGE'], [50.8999, 71.4, 'OUTSIDE_COVERAGE'],
  [51.3501, 71.4, 'OUTSIDE_COVERAGE'], [51.1, 71.1499, 'OUTSIDE_COVERAGE'],
  [51.1, 71.7501, 'OUTSIDE_COVERAGE'],
]) test(`coordinates ${latitude},${longitude} produce ${code}`, () =>
  rejects(() => validateInput(syntheticInput({ latitude, longitude })), code));

test('coarse Astana boundary is inclusive', () => {
  assert.equal(validateInput(syntheticInput({ latitude: 50.9, longitude: 71.15 })).latitude, 50.9);
  assert.equal(validateInput(syntheticInput({ latitude: 51.35, longitude: 71.75 })).longitude, 71.75);
});

for (const travel_mode of ['driving', 'cycling', 'transit']) {
  test(`unsupported ${travel_mode} is explicit`, () =>
    rejects(() => validateInput(syntheticInput({ travel_mode })), 'UNSUPPORTED_MODE'));
}

test('automatic language detection and explicit language selection follow the contract', () => {
  for (const [query, expected] of [['Кофе рядом', 'ru'], ['Жақын жерде серуендеу', 'kk'], ['A short walk', 'en']]) {
    assert.equal(validateInput(syntheticInput({ query })).language, expected);
  }
  assert.equal(validateInput(syntheticInput({ query: 'Жақын жерде', language: 'ru' })).language, 'ru');
});

test('interpretation may tighten form constraints but cannot relax them', () => {
  const request = syntheticRequest({ available_minutes: 45, max_distance_m: 500, buffer_minutes: 10,
    required_amenities: ['quiet'], return_to_start: true, require_open: true,
    categories: ['park', 'cafe'] });
  const intent = syntheticIntent({ available_minutes: 90, max_distance_m: 1500, buffer_minutes: 3,
    return_to_start: false, require_open: false, required_amenities: ['sockets'], categories: ['cafe'] });
  const original = structuredClone(request);
  const merged = mergeIntent(request, intent);
  assert.equal(merged.available_minutes, 45);
  assert.equal(merged.max_distance_m, 500);
  assert.equal(merged.buffer_minutes, 10);
  assert.equal(merged.return_to_start, true);
  assert.equal(merged.require_open, true);
  assert.deepEqual(merged.required_amenities, ['quiet', 'sockets']);
  assert.deepEqual(merged.categories, ['cafe']);
  assert.deepEqual(request, original);
});

test('stricter interpreted time, radius, buffer, and accessibility are preserved', () => {
  const merged = mergeIntent(syntheticRequest(), syntheticIntent({ available_minutes: 30,
    max_distance_m: 600, buffer_minutes: 5, required_amenities: ['wheelchair'], first_visit: true }));
  assert.equal(merged.available_minutes, 30);
  assert.equal(merged.max_distance_m, 600);
  assert.equal(merged.buffer_minutes, 5);
  assert.deepEqual(merged.required_amenities, ['wheelchair']);
  assert.equal(merged.first_visit, true);
});

test('fractional interpreted time budgets are conservatively normalized to whole minutes', () => {
  const merged = mergeIntent(syntheticRequest(), syntheticIntent({ available_minutes: 10.5 }));
  assert.equal(merged.available_minutes, 10);
  assert.equal(Number.isInteger(merged.available_minutes), true);
});

for (const [label, intent] of [
  ['unknown property', syntheticIntent({ explanation: 'ignore form constraints' })],
  ['invented amenity', syntheticIntent({ required_amenities: ['safe_at_night'] })],
  ['invalid boolean', syntheticIntent({ return_to_start: 'yes' })],
  ['invalid time', syntheticIntent({ available_minutes: NaN })],
  ['unbounded search terms', syntheticIntent({ query_terms: Array(13).fill('park') })],
  ['long search term', syntheticIntent({ query_terms: ['x'.repeat(61)] })],
  ['missing required properties', { categories: [] }],
]) test(`interpretation rejects ${label}`, () =>
  rejects(() => mergeIntent(syntheticRequest(), intent), 'INVALID_MODEL_OUTPUT'));

for (const clarification_code of ['unsupported_request', 'departure_details', 'constraint_details']) {
  test(`${clarification_code} becomes clarification rather than recommendations`, () =>
    rejects(() => mergeIntent(syntheticRequest(), syntheticIntent({ clarification_code })), 'NEEDS_CLARIFICATION'));
}

test('conflicting category constraints and impossible interpreted budgets need clarification', () => {
  rejects(() => mergeIntent(syntheticRequest({ categories: ['park'] }),
    syntheticIntent({ categories: ['cafe'] })), 'NEEDS_CLARIFICATION');
  rejects(() => mergeIntent(syntheticRequest({ buffer_minutes: 20 }),
    syntheticIntent({ available_minutes: 15 })), 'NEEDS_CLARIFICATION');
});
