import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOpenAI, providerContext, redactCoordinateText } from '../../src/app/openai.mjs';
import { syntheticIntent, syntheticRequest, syntheticCandidate, syntheticRecommendation } from './fixtures/synthetic.mjs';

// All provider traffic is intercepted. This key is an explicit synthetic sentinel, never a credential.
const CONFIG = { apiKey: 'synthetic-provider-key-not-a-secret', model: 'synthetic-model' };
const response = value => new Response(JSON.stringify({ status: 'completed', output: [
  { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }
] }), { status: 200 });
const rejects = (run, code) => assert.rejects(run, { name: 'AppError', code });

function capturedProvider(value) {
  const calls = [];
  return { calls, provider: createOpenAI({ ...CONFIG, fetchImpl: async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return response(value);
  } }) };
}

test('interpretation uses Responses strict schema, store:false, and no coordinate fields', async () => {
  const request = syntheticRequest({ latitude: 51.123456, longitude: 71.456789,
    query: 'Walk near 51.123456, 71.456789; quiet coffee please.' });
  const { provider, calls } = capturedProvider(syntheticIntent());
  assert.deepEqual(await provider.interpret(request), syntheticIntent());
  assert.equal(calls.length, 1);
  const { url, options, body } = calls[0];
  assert.equal(url, 'https://api.openai.com/v1/responses');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Authorization, `Bearer ${CONFIG.apiKey}`);
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(body.model, CONFIG.model);
  assert.equal(body.store, false);
  assert.equal(body.text.format.type, 'json_schema');
  assert.equal(body.text.format.strict, true);
  assert.equal(body.text.format.schema.additionalProperties, false);
  assert.deepEqual(body.text.format.schema.required.sort(), Object.keys(body.text.format.schema.properties).sort());
  assert.equal(body.input.length, 1);
  const input = JSON.parse(body.input[0].content);
  assert.equal(input.query, 'Walk near [coordinate omitted], [coordinate omitted]; quiet coffee please.');
  assert.equal(input.form_constraints.required_amenities.length, 0);
  assert.equal(options.body.includes('51.123456'), false);
  assert.equal(options.body.includes('71.456789'), false);
  assert.equal(Object.hasOwn(input.form_constraints, 'latitude'), false);
  assert.equal(Object.hasOwn(input.form_constraints, 'longitude'), false);
  assert.equal(Object.hasOwn(body, 'tools'), false);
});

test('generation includes bounded public facts and allowed choices without raw query or user coordinates', async () => {
  const request = syntheticRequest({ latitude: 51.123456, longitude: 71.456789,
    query: 'PRIVATE_RAW_QUERY_SENTINEL', query_terms: ['park', '51.123456'] });
  const candidate = syntheticCandidate(request);
  const answer = { recommendations: [syntheticRecommendation(candidate)] };
  const { provider, calls } = capturedProvider(answer);
  assert.deepEqual(await provider.generate(request, [candidate]), answer);
  const { body, options } = calls[0];
  const input = JSON.parse(body.input[0].content);
  assert.deepEqual(input.interests, ['park', '[coordinate omitted]']);
  assert.equal(input.candidates[0].id, candidate.poi.id);
  assert.equal(input.candidates[0].description, candidate.poi.description);
  assert.deepEqual(input.candidates[0].description_evidence_ids, ['description']);
  assert.deepEqual(input.candidates[0].allowed_reason_codes, ['nearby', 'fits_time']);
  assert.deepEqual(input.candidates[0].allowed_activity_codes, ['stroll', 'observe']);
  assert.equal(Object.hasOwn(input.candidates[0], 'latitude'), false);
  assert.equal(Object.hasOwn(input.candidates[0], 'source_url'), false);
  assert.equal(Object.hasOwn(input.context, 'latitude'), false);
  assert.equal(options.body.includes('PRIVATE_RAW_QUERY_SENTINEL'), false);
  assert.equal(options.body.includes('51.123456'), false);
  assert.equal(options.body.includes('71.456789'), false);
  assert.equal(body.text.format.schema.properties.recommendations.items.additionalProperties, false);
  assert.equal(body.store, false);
});

test('provider context uses an allowlist rather than copying arbitrary request fields', () => {
  const request = syntheticRequest({ secret: 'SYNTHETIC_SECRET', query: 'private query', now: 'private context' });
  const context = providerContext(request);
  for (const field of ['latitude', 'longitude', 'query', 'now', 'secret']) assert.equal(Object.hasOwn(context, field), false);
  assert.equal(context.available_minutes, 60);
  assert.equal(context.travel_mode, 'walking');
});

test('coordinate text minimization supports signs and decimal commas', () => {
  assert.equal(redactCoordinateText('Here -51.12345 +71,4567 and 60 minutes'),
    'Here [coordinate omitted] [coordinate omitted] and 60 minutes');
});

test('unconfigured provider stops before fetch', async () => {
  for (const overrides of [{ apiKey: '' }, { model: '' }]) {
    let calls = 0;
    const provider = createOpenAI({ ...CONFIG, ...overrides, fetchImpl: async () => { calls++; return response({}); } });
    await rejects(() => provider.interpret(syntheticRequest()), 'PROVIDER_NOT_CONFIGURED');
    assert.equal(calls, 0);
  }
});

for (const [status, code] of [[429, 'PROVIDER_RATE_LIMIT'], [401, 'PROVIDER_UNAVAILABLE'],
  [403, 'PROVIDER_UNAVAILABLE'], [500, 'PROVIDER_UNAVAILABLE']]) {
  test(`provider HTTP ${status} is a typed error without remote body disclosure`, async () => {
    const provider = createOpenAI({ ...CONFIG,
      fetchImpl: async () => new Response('SYNTHETIC_PRIVATE_PROVIDER_DETAIL', { status }) });
    await rejects(() => provider.interpret(syntheticRequest()), code);
  });
}

for (const [label, payload, code] of [
  ['incomplete status', { status: 'incomplete', output: [] }, 'INVALID_MODEL_OUTPUT'],
  ['missing output', { status: 'completed' }, 'INVALID_MODEL_OUTPUT'],
  ['refusal', { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] }, 'PROVIDER_REFUSAL'],
  ['multiple text blocks', { status: 'completed', output: [{ type: 'message', content: [
    { type: 'output_text', text: '{}' }, { type: 'output_text', text: '{}' }] }] }, 'INVALID_MODEL_OUTPUT'],
  ['non-JSON text', { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'not JSON' }] }] }, 'INVALID_MODEL_OUTPUT'],
  ['missing text blocks', { status: 'completed', output: [] }, 'INVALID_MODEL_OUTPUT'],
]) test(`provider rejects ${label}`, async () => {
  const provider = createOpenAI({ ...CONFIG, fetchImpl: async () => new Response(JSON.stringify(payload)) });
  await rejects(() => provider.interpret(syntheticRequest()), code);
});

test('malformed, missing, and oversized response bodies cannot be accepted', async () => {
  for (const body of ['not JSON', null, 'x'.repeat(256 * 1024 + 1)]) {
    const provider = createOpenAI({ ...CONFIG, fetchImpl: async () => new Response(body) });
    await rejects(() => provider.interpret(syntheticRequest()), 'INVALID_MODEL_OUTPUT');
  }
});

test('transport failures become typed provider errors', async () => {
  const provider = createOpenAI({ ...CONFIG, fetchImpl: async () => { throw new Error('SYNTHETIC_PRIVATE_NETWORK_DETAIL'); } });
  await rejects(() => provider.interpret(syntheticRequest()), 'PROVIDER_UNAVAILABLE');
});

test('provider timeout aborts the outstanding fetch and reports PROVIDER_TIMEOUT', async () => {
  let aborted = false;
  const provider = createOpenAI({ ...CONFIG, timeoutMs: 10, fetchImpl: async (_url, { signal }) =>
    new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
      aborted = true;
      reject(new DOMException('Aborted synthetic request', 'AbortError'));
    }, { once: true })) });
  await rejects(() => provider.interpret(syntheticRequest()), 'PROVIDER_TIMEOUT');
  assert.equal(aborted, true);
});

test('provider deadline includes a stalled response body', async () => {
  const provider = createOpenAI({ ...CONFIG, timeoutMs: 10, fetchImpl: async (_url, { signal }) =>
    new Response(new ReadableStream({ start(controller) {
      signal.addEventListener('abort', () => controller.error(new DOMException('Aborted body', 'AbortError')), { once: true });
    } })) });
  await rejects(() => provider.interpret(syntheticRequest()), 'PROVIDER_TIMEOUT');
});
