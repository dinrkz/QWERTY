// Member 3 acceptance regressions. Authored user requests; no POIs or providers.
// These assert intended behavior, not the currently observed defects.
// See docs/MEMBER_3_QA_REPORT.md for IDs, failures and owner handoffs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interpretSearch } from '../../public/search-intent.mjs';

test('AT-02 control: supported coffee category and duration remain usable', () => {
  const intent = interpretSearch('coffee for 30 minutes');
  assert.notEqual(intent.clarification, true);
  assert.deepEqual(intent.categories, ['cafe']);
  assert.equal(intent.minutes, 30);
});

test('AT-03 control: explicit mandatory amenities remain hard requirements', () => {
  const intent = interpretSearch('coffee with required sockets and quiet');
  assert.notEqual(intent.clarification, true);
  assert.deepEqual(new Set(intent.amenities), new Set(['sockets', 'quiet']));
});

test('AT-02 control: unsupported English distance asks for clarification', () => {
  assert.equal(interpretSearch('coffee within 500 meters').clarification, true);
});

test('QA-02 / AT-03: optional amenities must not become mandatory filters', () => {
  const intent = interpretSearch('Quiet coffee preferred, sockets optional');
  // Clarification is acceptable for this deliberately small vocabulary.
  // amenities currently feeds the mandatory checkboxes in readRequest().
  assert.ok(intent.clarification === true || !(intent.amenities ?? []).some(
    amenity => ['quiet', 'sockets'].includes(amenity)
  ), 'Optional wishes were promoted to mandatory quiet/socket constraints');
});

for (const request of [
  'кофе в 500 метров',
  'кофе в 500 метрах',
  'кофе в радиусе 500 м',
  'кофе в радиусе 1 км',
]) {
  test(`QA-03 / AT-02: clarify unsupported textual radius: ${request}`, () => {
    // The current UI applies radius only from its structured control.
    assert.equal(interpretSearch(request).clarification, true,
      'A written radius must not silently leave the broader form radius active');
  });
}

for (const request of ['first visit: museum', 'впервые в Астане, хочу в музей']) {
  test(`QA-04 / AT-14: first-visit context coexists with one category: ${request}`, () => {
    const intent = interpretSearch(request);
    assert.notEqual(intent.clarification, true, 'There is only one requested place category');
    assert.deepEqual(intent.categories, ['museum']);
    assert.equal(intent.firstVisit, true);
  });
}

for (const [request, maximum] of [
  ['I only have time for a 15-minute walk', 15],
  ['coffee in 30-45 min', 45],
]) {
  test(`QA-05 / AT-08: respect or clarify the written time limit: ${request}`, () => {
    const intent = interpretSearch(request);
    assert.ok(intent.clarification === true || (
      Number.isInteger(intent.minutes) && intent.minutes >= 5 && intent.minutes <= maximum
    ), 'The written time limit was dropped instead of enforced or clarified');
  });
}

for (const request of ['I don’t want coffee', 'Avoid coffee; I want a walk']) {
  test(`QA-06 / AT-02: do not recommend the excluded category: ${request}`, () => {
    const intent = interpretSearch(request);
    // Clarification or an enforced category selection excluding cafes is safe.
    assert.ok(intent.clarification === true || (
      Array.isArray(intent.categories) && intent.categories.length > 0
      && !intent.categories.includes('cafe') && intent.scenario !== 'coffee'
    ), 'Exclusion must be respected or clarified instead of selecting coffee');
  });
}
