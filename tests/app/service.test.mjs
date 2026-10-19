import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../../src/shared/policy.mjs';
import { createService } from '../../src/app/service.mjs';
import { errorResult, fallbackSelections, present } from '../../src/app/presentation.mjs';
import { SYNTHETIC_NOW, SYNTHETIC_OLD, syntheticInput, syntheticIntent, syntheticRequest,
  syntheticPoi, syntheticCandidate, syntheticRetrieval, syntheticRecommendation, syntheticHours,
  withEvidence } from './fixtures/synthetic.mjs';

// The collected metadata below is simulated to exercise status transitions with mocked providers.
// These tests do not establish live RAG, provider access, or a collected demonstration dataset.
const simulatedCollected = candidates => syntheticRetrieval(candidates, { dataset_kind: 'collected' });

function serviceHarness(overrides = {}) {
  const calls = [];
  const service = createService({ now: () => SYNTHETIC_NOW,
    interpret: async request => { calls.push(['interpret', request]); return syntheticIntent(); },
    retrieve: async request => { calls.push(['retrieve', request]); return simulatedCollected([syntheticCandidate(request)]); },
    generate: async (request, candidates) => { calls.push(['generate', request]);
      return { recommendations: [syntheticRecommendation(candidates[0])] }; },
    ...overrides });
  return { service, calls };
}

test('service interprets before retrieval and generates only after validated retrieval', async () => {
  const { service, calls } = serviceHarness();
  const result = await service(syntheticInput());
  assert.deepEqual(calls.map(([stage]) => stage), ['interpret', 'retrieve', 'generate']);
  assert.equal(calls[1][1].now, SYNTHETIC_NOW);
  assert.deepEqual(calls[1][1].query_terms, []);
  assert.equal(result.status, 'live_rag');
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0].poi_id, 'synthetic:park');
  assert.equal(result.recommendations[0].activity.kind, 'generated_idea');
});

test('invalid input stops before interpretation, retrieval, or generation', async () => {
  const { service, calls } = serviceHarness();
  const result = await service(syntheticInput({ latitude: true }));
  assert.equal(result.status, 'error');
  assert.equal(result.code, 'INVALID_INPUT');
  assert.deepEqual(calls, []);
});

test('clarification stops before retrieval and never produces recommendations', async () => {
  const { service, calls } = serviceHarness({ interpret: async () => syntheticIntent({ clarification_code: 'departure_details' }) });
  const result = await service(syntheticInput());
  assert.equal(result.status, 'needs_clarification');
  assert.equal(result.code, 'NEEDS_CLARIFICATION');
  assert.deepEqual(result.recommendations, []);
  assert.deepEqual(calls, []);
});

test('empty valid retrieval returns no_match without a generation call', async () => {
  const { service, calls } = serviceHarness({ retrieve: async () => simulatedCollected([]) });
  const result = await service(syntheticInput());
  assert.equal(result.status, 'no_match');
  assert.deepEqual(result.recommendations, []);
  assert.deepEqual(calls.map(([stage]) => stage), ['interpret']);
});

test('production rejects synthetic snapshots before generation; test mode cannot label them live_rag', async () => {
  const retrieve = async request => syntheticRetrieval([syntheticCandidate(request)]);
  const denied = serviceHarness({ retrieve });
  const result = await denied.service(syntheticInput());
  assert.equal(result.code, 'DATA_INVALID');
  assert.deepEqual(denied.calls.map(([stage]) => stage), ['interpret']);
  const allowed = serviceHarness({ retrieve, allowSynthetic: true });
  const synthetic = await allowed.service(syntheticInput());
  assert.equal(synthetic.status, 'synthetic_test');
  assert.match(synthetic.message, /Synthetic test data/u);
});

test('corrupt retrieval fails closed without passing candidates to the model', async () => {
  const { service, calls } = serviceHarness({ retrieve: async request => {
    const candidate = syntheticCandidate(request);
    candidate.poi.source_url = 'javascript:alert(1)';
    return simulatedCollected([candidate]);
  } });
  const result = await service(syntheticInput());
  assert.equal(result.code, 'DATA_INVALID');
  assert.deepEqual(calls.map(([stage]) => stage), ['interpret']);
});

for (const code of ['PROVIDER_TIMEOUT', 'PROVIDER_REFUSAL', 'PROVIDER_RATE_LIMIT', 'PROVIDER_UNAVAILABLE']) {
  test(`generation ${code} produces labeled retrieval-only fallback`, async () => {
    const { service } = serviceHarness({ generate: async () => { throw new AppError(code); } });
    const result = await service(syntheticInput());
    assert.equal(result.status, 'retrieval_only');
    assert.match(result.message, /Retrieval only/u);
    assert.equal(result.recommendations[0].activity.kind, 'template_suggestion');
    assert.ok(result.warnings.length >= 1);
  });
}

test('invalid generated facts and non-retrieved IDs fall back to validated source candidates', async () => {
  for (const selection of [syntheticRecommendation(undefined, { poi_id: 'invented:venue' }),
    syntheticRecommendation(undefined, { open_now: true }),
    syntheticRecommendation(undefined, { source_url: 'https://invented.invalid' })]) {
    const { service } = serviceHarness({ generate: async () => ({ recommendations: [selection] }) });
    const result = await service(syntheticInput());
    assert.equal(result.status, 'retrieval_only');
    assert.equal(result.recommendations[0].poi_id, 'synthetic:park');
    assert.equal(JSON.stringify(result).includes('invented:venue'), false);
    assert.equal(JSON.stringify(result).includes('https://invented.invalid'), false);
  }
});

test('interpretation and retrieval failures do not masquerade as fallback or live success', async () => {
  for (const stage of ['interpret', 'retrieve']) {
    const code = stage === 'interpret' ? 'PROVIDER_TIMEOUT' : 'DATA_UNAVAILABLE';
    const { service } = serviceHarness({ [stage]: async () => { throw new AppError(code); } });
    const result = await service(syntheticInput());
    assert.equal(result.status, 'error');
    assert.equal(result.code, code);
    assert.deepEqual(result.recommendations, []);
  }
});

test('unexpected exceptions reveal neither internal details nor user coordinates', async () => {
  const { service } = serviceHarness({ retrieve: async () => { throw new Error('SYNTHETIC_PRIVATE_DETAIL 51.123456'); } });
  const result = await service(syntheticInput({ latitude: 51.123456 }));
  assert.equal(result.code, 'INTERNAL_ERROR');
  assert.equal(JSON.stringify(result).includes('SYNTHETIC_PRIVATE_DETAIL'), false);
  assert.equal(JSON.stringify(result).includes('51.123456'), false);
});

test('presentation separates source facts, estimates, generated ideas, provenance, and unknowns', () => {
  const request = syntheticRequest({ latitude: 51.123456, longitude: 71.456789,
    query: 'PRIVATE_RAW_QUERY', required_amenities: ['wheelchair'], preferred_amenities: ['quiet'],
    return_to_start: true, buffer_minutes: 7 });
  const candidate = syntheticCandidate(request);
  const retrieval = simulatedCollected([candidate]);
  const result = present(request, retrieval, { recommendations: [syntheticRecommendation(candidate)] }, 'live_rag');
  const card = result.recommendations[0];
  assert.equal(card.source_facts.description, candidate.poi.description);
  assert.equal(card.source_facts.description_language, 'en');
  assert.equal(card.source_facts.opening_hours, null);
  assert.equal(card.sources[0].url, candidate.poi.source_url);
  assert.equal(card.sources[0].collected_at, candidate.poi.collected_at);
  assert.equal(card.activity.kind, 'generated_idea');
  assert.equal(card.estimates.distance_kind, 'straight_line');
  assert.ok(card.estimates.return_minutes > 0);
  assert.equal(card.estimates.buffer_minutes, 7);
  assert.ok(card.caveats.some(value => /unconfirmed/u.test(value)));
  assert.ok(card.caveats.some(value => /availability.*unknown/u.test(value)));
  assert.ok(card.caveats.some(value => /accessible route/u.test(value)));
  assert.ok(card.caveats.some(value => /quiet/u.test(value)));
  assert.equal(Object.hasOwn(result.context_used, 'latitude'), false);
  assert.equal(Object.hasOwn(result.context_used, 'query'), false);
  assert.equal(JSON.stringify(result).includes('51.123456'), false);
  assert.equal(JSON.stringify(result).includes('PRIVATE_RAW_QUERY'), false);
});

test('stale amenity evidence is displayed as unknown while supported schedule remains conditional', () => {
  const request = syntheticRequest();
  const poi = syntheticPoi();
  poi.amenities.quiet = { value: true, evidence_ids: withEvidence(poi, 'quiet', { source_updated_at: SYNTHETIC_OLD }) };
  poi.opening_hours = syntheticHours(poi);
  const candidate = syntheticCandidate(request, poi);
  const card = present(request, simulatedCollected([candidate]),
    { recommendations: [syntheticRecommendation(candidate)] }, 'live_rag').recommendations[0];
  assert.deepEqual(card.source_facts.amenities, [{ name: 'quiet', value: null }]);
  assert.ok(card.caveats.some(value => /actual opening is not guaranteed/u.test(value)));
  assert.ok(card.sources.some(source => source.attribution.endsWith('hours')));
});

test('fallback has at most three source-based selections without fabricated evidence or free text', () => {
  const request = syntheticRequest();
  const candidates = Array.from({ length: 4 }, (_, i) => syntheticCandidate(request, syntheticPoi({ id: `synthetic:${i}` })));
  const selections = fallbackSelections(request, candidates).recommendations;
  assert.equal(selections.length, 3);
  assert.deepEqual(selections.map(s => s.poi_id), ['synthetic:0', 'synthetic:1', 'synthetic:2']);
  assert.ok(selections.every(s => s.evidence_ids[0] === 'description'));
});

test('error messages support RU, KK, EN and reject prototype names as language choices', () => {
  for (const language of ['ru', 'kk', 'en']) {
    const result = errorResult('INVALID_INPUT', language);
    assert.equal(result.language, language);
    assert.equal(typeof result.message, 'string');
    assert.ok(result.message.length > 0);
  }
  for (const language of ['constructor', '__proto__', 'prototype', 'toString', 'unknown']) {
    const result = errorResult('INVALID_INPUT', language);
    assert.equal(result.language, 'ru');
    assert.equal(result.message, errorResult('INVALID_INPUT', 'ru').message);
  }
  assert.equal(errorResult('SYNTHETIC_PRIVATE_CODE').code, 'INTERNAL_ERROR');
});
