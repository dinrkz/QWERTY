import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveWalkingIntent, createWalkingInterpreter, createNaturalRecommendation } from '../../src/app/walking-intent.mjs';
import { createBoundedGenerationService } from '../../src/app/bounded-generation.mjs';
import { checkGenerationAuthorization } from '../../src/app/generation-authorization.mjs';
import { initializeRequestBudget } from '../../src/app/request-budget.mjs';
import { expected, input, envelope, model, key, now, authorization, response, fakeFetch } from './fixtures/bounded-provider.mjs';

const intent = changes => ({ start: 'mega', categories: ['park','landmark'], available_minutes: 20,
  required_amenities: null, require_open: null, events_only: null, first_visit: null, return_to_start: null,
  buffer_minutes: null, clarification: null, ...changes });
async function setup(t, testFetch) {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'qadam-intent-'));
  const dir = path.join(parent, 'budget');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const a = authorization();
  await initializeRequestBudget(dir, checkGenerationAuthorization(a, expected, model, now()).budget);
  return { dir, options: { enabled: true, interpretationEnabled: true, authorization: a, expected, model, apiKey: key,
    budgetDirectory: dir, now, testFetch }, slots: async () => (await readdir(dir)).filter(f => f.endsWith('.reserved.json')).length };
}
test('explicit Mega and 20 minutes override old map coordinates and 450 minutes', () => {
  const resolved = resolveWalkingIntent(input({ available_minutes: 450, latitude: 51.2, longitude: 71.5 }), intent());
  assert.equal(resolved.input.available_minutes, 20);
  assert.equal(resolved.input.latitude, 51.089); assert.equal(resolved.input.longitude, 71.405);
  assert.equal(resolved.input.query, '');
  assert.equal(resolveWalkingIntent(input({ available_minutes: 20 }), intent({ available_minutes: 90 })).input.available_minutes, 90);
});
test('unknown/ambiguous starts and unsupported constraints clarify instead of using previous start', () => {
  assert.deepEqual(resolveWalkingIntent(input(), intent({ start: 'unknown' })), { clarification: 'location' });
  assert.deepEqual(resolveWalkingIntent(input(), intent({ clarification: 'unsupported' })), { clarification: 'unsupported' });
  assert.throws(() => resolveWalkingIntent(input(), intent({ start: 'invented' })), { code: 'INVALID_MODEL_OUTPUT' });
  assert.throws(() => resolveWalkingIntent(input(), { ...intent(), latitude: 51 }), { code: 'INVALID_MODEL_OUTPUT' });
});
test('omitted fields use explicit settings; parsed fields never mutate settings for later queries', () => {
  const raw = input({ available_minutes: 45, required_amenities: ['sockets'] });
  const before = structuredClone(raw);
  const a = resolveWalkingIntent(raw, intent({ start: 'current', available_minutes: null, required_amenities: [] }));
  assert.equal(a.input.available_minutes, 45); assert.deepEqual(a.input.required_amenities, []);
  assert.deepEqual(raw, before);
  assert.deepEqual(resolveWalkingIntent(raw, intent({ required_amenities: null })).input.required_amenities, ['sockets']);
});
test('malformed output and infeasible duration cannot reach retrieval', () => {
  for (const changes of [{ available_minutes: 20.5 }, { available_minutes: 999 }, { return_to_start: 'yes' },
    { required_amenities: ['wifi'] }, { categories: ['park','park'] }]) {
    assert.throws(() => resolveWalkingIntent(input(), intent(changes)), { code: 'INVALID_MODEL_OUTPUT' });
  }
  assert.equal(resolveWalkingIntent(input(), intent({ available_minutes: 2 })).clarification, 'time');
  assert.equal(resolveWalkingIntent(input(), intent({ buffer_minutes: 30 })).clarification, 'time');
});
test('interpretation is separately enabled and never dispatches when disabled', async t => {
  let calls = 0;
  const s = await setup(t, () => { calls++; });
  await assert.rejects(createWalkingInterpreter({ ...s.options, interpretationEnabled: false })(input()), { code: 'GENERATION_DISABLED' });
  assert.equal(calls, 0); assert.equal(await s.slots(), 0);
});
test('empty input uses manual settings without reserving an interpretation attempt', async t => {
  let calls = 0;
  const s = await setup(t, () => { calls++; });
  const out = await createWalkingInterpreter(s.options)(input({ query: '  ' }));
  assert.equal(out.understood.start, 'current'); assert.equal(calls, 0); assert.equal(await s.slots(), 0);
});
test('prompt is minimized and each failed or successful call stays counted without retries', async t => {
  let calls = 0;
  const s = await setup(t, async (_url, options) => {
    calls++;
    const body = JSON.parse(options.body), packet = JSON.parse(body.input[0].content);
    assert.equal(body.store, false);
    assert.deepEqual(Object.keys(packet).sort(), ['language','query']);
    assert.equal(options.body.includes('51.123456'), false);
    assert.equal(packet.query.includes('PRIVATE_QUERY_MARKER'), true);
    assert.equal(await s.slots(), calls);
    if (calls === 1) return new Response('{}', { status: 503 });
    return response(intent());
  });
  const interpret = createWalkingInterpreter(s.options);
  await assert.rejects(interpret(input({ query: 'PRIVATE_QUERY_MARKER near Mega 51.123456' })));
  await interpret(input({ query: 'PRIVATE_QUERY_MARKER near Mega 51.123456' }));
  assert.equal(calls, 2); assert.equal(await s.slots(), 2);
  const ledger = (await Promise.all((await readdir(s.dir)).map(f => readFile(path.join(s.dir, f), 'utf8')))).join('');
  assert.equal(ledger.includes('PRIVATE_QUERY_MARKER'), false);
  assert.equal(ledger.includes(key), false);
});
test('clarification stops after interpretation, without retrieval or a second call', async t => {
  const s = await setup(t, async () => response(intent({ start: 'unknown', clarification: 'location' })));
  let retrievals = 0;
  const out = await createNaturalRecommendation(s.options, () => { retrievals++; })(input({ language: 'en', query: 'Start near an unknown place' }));
  assert.equal(out.status, 'needs_clarification'); assert.equal(retrievals, 0); assert.equal(await s.slots(), 1);
  assert.match(out.message, /Where are you starting/);
});
test('interpretation and grounded selection share the existing finite allowance', async t => {
  let calls = 0;
  const s = await setup(t, async (url, options) => {
    calls++;
    if (JSON.parse(options.body).text.format.name === 'qadam_walking_intent') {
      return response(intent({ start: 'current', categories: ['cafe'], available_minutes: 90 }));
    }
    return fakeFetch(url, options);
  });
  const grounded = createBoundedGenerationService({ ...s.options, retrieve: async r => envelope(r) });
  const recommend = createNaturalRecommendation(s.options, grounded);
  const out = await recommend(input({ query: 'Coffee for 90 minutes' }));
  assert.equal(out.status, 'synthetic_provider_test');
  assert.equal(out.understood.available_minutes, 90);
  assert.equal(await s.slots(), 2); assert.equal(calls, 2);
  await recommend(input({ query: 'Coffee for 90 minutes' }));
  assert.equal(await s.slots(), 3); assert.equal(calls, 3);
});
test('interpreted request with no eligible places spends only interpretation and describes generation accurately', async t => {
  const s = await setup(t, async () => response(intent()));
  const grounded = createBoundedGenerationService({ ...s.options, retrieve: async r => {
    const e = envelope(r);
    Object.assign(e.result, { candidates: [], status: 'no_match', eligible_count: 0 });
    return e;
  } });
  const out = await createNaturalRecommendation(s.options, grounded)(input({ language: 'en', query: 'Walk near Mega for 20 minutes' }));
  assert.equal(out.status, 'no_match');
  assert.equal(out.understood.available_minutes, 20);
  assert.equal(await s.slots(), 1);
  assert.match(out.message, /No recommendation-generation request/);
  assert.doesNotMatch(out.message, /No AI request was made/);
});
