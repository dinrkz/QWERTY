import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interpretSearch } from '../../public/search-intent.mjs';
test('common requests resolve categories and time locally in RU/KK/EN', () => {
  for (const q of ['Хочу кофе, 30 минут', 'coffee 30 minutes', 'кофе 30 минут']) {
    const i = interpretSearch(q); assert.equal(i.scenario, 'coffee'); assert.deepEqual(i.categories, ['cafe']); assert.equal(i.minutes, 30);
  }
  assert.deepEqual(interpretSearch('саябақта серуен').categories, ['park']);
  assert.deepEqual(interpretSearch('I want a museum').categories, ['museum']);
  assert.equal(interpretSearch('walk for 1 hour').minutes, 60);
});
test('negated, conflicting, unsupported and ambiguous requests ask for clarification', () => {
  for (const q of ['no sockets needed', 'не хочу кофе', 'coffee or museum', 'airport before flight', 'taxi to museum', 'coffee for 30 minutes or 1 hour', 'walk 1.5 hours', 'кофе 30-45 минут', 'coffee in 1000 minutes', 'coffee within 500 m', 'халяльное кафе на 45 минут', 'cafe with Wi-Fi']) assert.equal(interpretSearch(q).clarification, true, q);
});
test('recognized amenities are explicit and blank/name text keeps existing filters', () => {
  assert.deepEqual(interpretSearch('quiet coffee with sockets').amenities, ['sockets','quiet']);
  assert.equal(interpretSearch('coffee open now').open, true);
  assert.equal(interpretSearch('').categories, undefined); assert.equal(interpretSearch('Synthetic Venue').categories, undefined);
});
