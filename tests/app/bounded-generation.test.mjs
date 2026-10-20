import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBoundedGenerationService } from '../../src/app/bounded-generation.mjs';
import { checkGenerationAuthorization, MAX_ATTEMPTS } from '../../src/app/generation-authorization.mjs';
import { initializeRequestBudget, reserveRequest } from '../../src/app/request-budget.mjs';
import { dispatchOpenAI, MAX_RESPONSE_BYTES, RESPONSES_URL } from '../../src/app/evidence-openai.mjs';
import { expected, input, envelope, normalized, now, model, key, authorization, response, answer, fakeFetch } from './fixtures/bounded-provider.mjs';

const root = fileURLToPath(new URL('../../data/runtime/bounded-generation-tests/', import.meta.url));
async function setup(t, a = authorization()) {
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(path.join(root, 'run-'));
  t.after(async () => { assert.ok(path.resolve(dir).startsWith(path.resolve(root) + path.sep)); await rm(dir, { recursive: true, force: true }); });
  const budgetDirectory = path.join(dir, 'budget');
  const { budget } = checkGenerationAuthorization(a, expected, model, now());
  await initializeRequestBudget(budgetDirectory, budget);
  const service = overrides => createBoundedGenerationService({ expected, retrieve: async req => envelope(req), enabled: true,
    authorization: a, budgetDirectory, apiKey: key, model, now, testFetch: fakeFetch, ...overrides });
  return { dir, budgetDirectory, budget, service, reservations: async () => (await readdir(budgetDirectory)).filter(n => n.endsWith('.reserved.json')) };
}

test('connection is disabled by default and direct transport also requires explicit enablement', async t => {
  const s = await setup(t); let calls = 0, retrievals = 0;
  const service = createBoundedGenerationService({ expected, retrieve: async () => { retrievals++; return envelope(); },
    testFetch: () => { calls++; } });
  const out = await service(input());
  assert.equal(out.generation.failure_code, 'GENERATION_DISABLED');
  assert.equal(out.generation.dispatch_attempts, 0); assert.equal(calls, 0); assert.equal(retrievals, 0);
  assert.deepEqual(await s.reservations(), []);
  await assert.rejects(() => dispatchOpenAI({ fetchImpl: () => { calls++; } }), { code: 'GENERATION_DISABLED' });
  assert.equal(calls, 0);
});
test('provider diagnostics expose only status and known codes, never error body contents', async t => {
  const s = await setup(t);
  for (const code of ['invalid_api_key', 'PRIVATE_ERROR_SENTINEL']) {
    const result = await s.service({ testFetch: async () => new Response(JSON.stringify({ error: {
      code, message: 'PRIVATE_MESSAGE_SENTINEL', request_id: 'PRIVATE_REQUEST_SENTINEL' } }), { status: 401 }) })(input());
    assert.equal(result.generation.provider_http_status, 401);
    assert.equal(result.generation.provider_error_code, code === 'invalid_api_key' ? code : null);
    assert.equal(result.status, 'retrieval_only');
    assert.equal(JSON.stringify(result).includes('PRIVATE_'), false);
  }
});

test('one minimized request follows validation and flushed reservation, with honest synthetic labels', async t => {
  const s = await setup(t); let calls = 0; let payload;
  const raw = input({ query: 'PRIVATE_QUERY_SENTINEL', latitude: 51.100123, longitude: 71.400789 });
  const source = envelope(normalized(raw)), before = structuredClone(source);
  const out = await s.service({ retrieve: async () => source, testFetch: async (url, options) => {
    calls++;
    assert.equal(url, RESPONSES_URL); assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal); assert.equal(options.headers.Authorization, `Bearer ${key}`);
    const reservation = JSON.parse(await readFile(path.join(s.budgetDirectory, '1.reserved.json'), 'utf8'));
    assert.equal(reservation.attempt, 1);
    payload = JSON.parse(options.body);
    assert.deepEqual(Object.keys(payload).sort(), ['input', 'instructions', 'max_output_tokens', 'model', 'store', 'text']);
    assert.equal(payload.store, false); assert.equal(payload.max_output_tokens, 1800);
    assert.equal(payload.text.format.strict, true); assert.equal(payload.text.format.schema.additionalProperties, false);
    assert.equal(payload.tools, undefined);
    const packet = JSON.parse(payload.input[0].content);
    assert.deepEqual(Object.keys(packet).sort(), ['candidates', 'context', 'contract']);
    assert.equal(packet.contract, 'qadam-openai-evidence-v1');
    assert.equal(packet.mode, undefined); assert.equal(packet.external_processing_allowed, undefined);
    for (const forbidden of ['PRIVATE_QUERY_SENTINEL', '51.100123', '71.400789', 'synthetic:one', expected.snapshot_id, 'Authored synthetic review', key]) {
      assert.equal(options.body.includes(forbidden), false, forbidden);
    }
    return response(answer(packet));
  } })(raw);
  assert.equal(calls, 1); assert.equal(out.status, 'synthetic_provider_test');
  assert.equal(out.generation.external_requests, 0); assert.equal(out.generation.dispatch_attempts, 1);
  assert.equal(out.dataset.demo_eligible, false); assert.equal(out.dataset.external_processing_allowed, false);
  assert.equal(out.recommendations[0].activity.kind, 'template_suggestion'); assert.deepEqual(source, before);
  const outcome = JSON.parse(await readFile(path.join(s.budgetDirectory, '1.outcome.json'), 'utf8'));
  assert.deepEqual(outcome.usage, { input_tokens: 200, output_tokens: 50, total_tokens: 250 });
  const ledger = (await Promise.all((await readdir(s.budgetDirectory)).map(f => readFile(path.join(s.budgetDirectory, f), 'utf8')))).join('');
  for (const v of [key, source.result.candidates[0].poi.name, 'PRIVATE_QUERY_SENTINEL', 'synthetic:one', '51.100123', expected.snapshot_id]) assert.equal(ledger.includes(v), false);
});

test('attempt cap persists across service recreation and cannot be enlarged', async t => {
  const s = await setup(t); let calls = 0;
  for (let i = 1; i <= 3; i++) {
    const result = await s.service({ testFetch: (...args) => { calls++; return fakeFetch(...args); } })(input());
    assert.equal(result.status, 'synthetic_provider_test'); assert.equal(result.generation.attempt, i);
  }
  const stopped = await s.service({ testFetch: () => { calls++; } })(input());
  assert.equal(stopped.generation.failure_code, 'BUDGET_EXHAUSTED'); assert.equal(calls, 3);
  assert.equal((await s.reservations()).length, 3);
  await assert.rejects(() => initializeRequestBudget(s.budgetDirectory, s.budget), { code: 'BUDGET_INVALID' });
  await assert.rejects(() => reserveRequest(s.budgetDirectory, { ...s.budget, max_attempts: 4 }), { code: 'BUDGET_INVALID' });
});

test('concurrent service instances allow only one in-flight dispatch', async t => {
  const s = await setup(t); let release, entered;
  const arrived = new Promise(resolve => { entered = resolve; });
  const first = s.service({ testFetch: async (url, options) => { entered(); await new Promise(resolve => { release = resolve; }); return fakeFetch(url, options); } })(input());
  await arrived;
  const blocked = await Promise.all(Array.from({ length: 12 }, () => s.service()(input())));
  assert.ok(blocked.every(r => r.generation.failure_code === 'BUDGET_BUSY' && r.generation.dispatch_attempts === 0));
  release(); assert.equal((await first).status, 'synthetic_provider_test');
  assert.equal((await s.reservations()).length, 1);
});

test('explicit interactive allowance permits a fourth call and preserves its cap across restart', async t => {
  const original = authorization();
  assert.equal(checkGenerationAuthorization({ ...original, limits: { ...original.limits, max_attempts: 100 } }, expected, model, now()).budget.max_attempts, 100);
  const s = await setup(t, { ...original, limits: { ...original.limits, max_attempts: 4 } });
  let calls = 0;
  const options = { testFetch: (...args) => { calls++; return fakeFetch(...args); } };
  for (let i = 0; i < 4; i++) assert.equal((await s.service(options)(input())).status, 'synthetic_provider_test');
  assert.equal((await s.service(options)(input())).generation.failure_code, 'BUDGET_EXHAUSTED');
  assert.equal(calls, 4); assert.equal((await s.reservations()).length, 4);
  await assert.rejects(reserveRequest(s.budgetDirectory, { ...s.budget, max_attempts: 100 }), { code: 'BUDGET_INVALID' });
});

test('a lower one-attempt authorization stays exhausted even if configuration is enlarged', async t => {
  const a = authorization({ limits: { max_attempts: 1, max_output_tokens: 128, timeout_ms: 1000 } });
  const s = await setup(t, a); let calls = 0;
  const service = s.service({ testFetch: (...args) => { calls++; return fakeFetch(...args); } });
  assert.equal((await service(input())).status, 'synthetic_provider_test');
  assert.equal((await service(input())).generation.failure_code, 'BUDGET_EXHAUSTED');
  assert.equal((await s.service({ authorization: authorization() })(input())).generation.failure_code, 'BUDGET_INVALID');
  assert.equal(calls, 1); assert.equal((await s.reservations()).length, 1);
});

test('expiry during retrieval or after reservation prevents dispatch without refunding a reserved slot', async t => {
  for (const expireAtCall of [3, 4]) {
    const s = await setup(t); let ticks = 0, calls = 0;
    const result = await s.service({ now: () => ++ticks >= expireAtCall ? '2026-10-20T00:00:00Z' : now(),
      testFetch: () => { calls++; } })(input());
    assert.equal(result.generation.failure_code, 'PROCESSING_NOT_AUTHORIZED');
    assert.equal(result.generation.dispatch_attempts, 0); assert.equal(calls, 0);
    assert.equal(result.generation.reserved_attempts, expireAtCall === 4 ? 1 : 0);
    assert.equal((await s.reservations()).length, expireAtCall === 4 ? 1 : 0);
  }
});

test('independent child processes sharing one budget cannot exceed three attempts', async t => {
  const s = await setup(t);
  const fixture = fileURLToPath(new URL('./fixtures/budget-race.mjs', import.meta.url));
  const child = () => new Promise((resolve, reject) => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => ['PATH','SYSTEMROOT','WINDIR','PATHEXT','TEMP','TMP'].includes(k.toUpperCase())));
    const processChild = spawn(process.execPath, [fixture, s.budgetDirectory, JSON.stringify(s.budget)], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    processChild.stdout.on('data', chunk => { output += chunk; });
    processChild.on('error', reject); processChild.on('close', code => code ? reject(new Error('CHILD_FAILED')) : resolve(JSON.parse(output)));
  });
  const result = await Promise.all(Array.from({ length: 12 }, child));
  assert.ok(result.every(v => v.attempt || ['BUDGET_BUSY','BUDGET_EXHAUSTED'].includes(v.code)));
  const numbers = result.filter(v => v.attempt).map(v => v.attempt);
  assert.equal(new Set(numbers).size, numbers.length); assert.ok(numbers.length <= 3);
  for (let i = numbers.length; i < 3; i++) assert.ok((await child()).attempt);
  assert.equal((await child()).code, 'BUDGET_EXHAUSTED'); assert.equal((await s.reservations()).length, 3);
});

const invalidAuth = {
  'missing authorization': () => null,
  'expired authorization': a => ({ ...a, expires_at: now() }),
  'no operator decision': a => ({ ...a, decision: { ...a.decision, operator_approved: false } }),
  'no source use basis': a => ({ ...a, decision: { ...a.decision, source_use_basis: '' } }),
  'changed model': a => ({ ...a, model: 'different' }),
  'wrong provider': a => ({ ...a, provider: 'different' }),
  'wrong purpose': a => ({ ...a, purpose: 'different' }),
  'changed pins': a => ({ ...a, expected: { ...a.expected, review_id: 'f'.repeat(64) } }),
  'changed record version': a => ({ ...a, records: [{ ...a.records[0], source_version: 'f'.repeat(64) }] }),
  'unapproved record': a => ({ ...a, records: [{ ...a.records[0], id: 'synthetic:other' }] }),
  'extra allowed field': a => ({ ...a, fields: [...a.fields, 'coordinates'] }),
  'attempt limit over hard cap': a => ({ ...a, limits: { ...a.limits, max_attempts: MAX_ATTEMPTS + 1 } }),
  'token limit over hard cap': a => ({ ...a, limits: { ...a.limits, max_output_tokens: 1801 } }),
  'timeout over hard cap': a => ({ ...a, limits: { ...a.limits, timeout_ms: 60001 } }),
};
for (const [label, alter] of Object.entries(invalidAuth)) test(`zero attempts for ${label}`, async t => {
  const s = await setup(t); let calls = 0;
  const out = await s.service({ authorization: alter(authorization()), testFetch: () => { calls++; } })(input());
  assert.equal(out.generation.failure_code, 'PROCESSING_NOT_AUTHORIZED'); assert.equal(calls, 0);
  assert.deepEqual(await s.reservations(), []);
});

test('no-match, invalid data, missing key/model and oversized evidence make zero attempts', async t => {
  const s = await setup(t);
  const empty = envelope(); Object.assign(empty.result, { status: 'no_match', candidates: [], eligible_count: 0 });
  const huge = envelope(); const p = huge.result.candidates[0].poi;
  Object.assign(p, { description: 'x'.repeat(4001), description_kind: 'source', description_evidence_ids: [`source:${p.source_version}`] });
  p.evidence[0].source_fields.push('source_description');
  for (const overrides of [{ retrieve: async () => empty }, { retrieve: async () => ({}) }, { retrieve: async () => huge }, { apiKey: '' }, { model: '' }]) {
    let calls = 0;
    const out = await s.service({ ...overrides, testFetch: () => { calls++; } })(input());
    assert.equal(calls, 0); assert.equal(out.generation.reserved_attempts, 0);
  }
  assert.deepEqual(await s.reservations(), []);
});

test('excluded descriptions are not disclosed and cannot justify generated reasons', async t => {
  const a = authorization({ fields: ['name', 'categories', 'estimates'] }), s = await setup(t, a);
  const e = envelope(normalized({ first_visit: true })), p = e.result.candidates[0].poi;
  Object.assign(p, { description: 'PRIVATE_DESCRIPTION_SENTINEL', description_kind: 'source', description_evidence_ids: [`source:${p.source_version}`] });
  p.evidence[0].source_fields.push('source_description');
  const out = await s.service({ retrieve: async () => e, testFetch: (_url, options) => {
    assert.equal(options.body.includes('PRIVATE_DESCRIPTION_SENTINEL'), false);
    const packet = JSON.parse(JSON.parse(options.body).input[0].content), r = answer(packet);
    r.recommendations[0].reason_codes = ['first_visit'];
    r.recommendations[0].evidence_refs.push(`${packet.candidates[0].alias}:description`);
    return response(r);
  } })(input({ first_visit: true }));
  assert.equal(out.status, 'retrieval_only'); assert.equal(out.generation.failure_code, 'INVALID_MODEL_OUTPUT');
});

const failures = {
  'HTTP 429': () => new Response('PRIVATE_PROVIDER_SENTINEL', { status: 429 }),
  'HTTP 401': () => new Response('PRIVATE_PROVIDER_SENTINEL', { status: 401 }),
  'HTTP 500': () => new Response('PRIVATE_PROVIDER_SENTINEL', { status: 500 }),
  'redirect status': () => new Response('', { status: 302 }),
  'already redirected': () => { const r = response({}); Object.defineProperty(r, 'redirected', { value: true }); return r; },
  'refusal': () => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'PRIVATE_PROVIDER_SENTINEL' }] }] })),
  'incomplete response': () => new Response(JSON.stringify({ status: 'incomplete', output: [] })),
  'invalid JSON': () => new Response('PRIVATE_PROVIDER_SENTINEL'),
  'oversized response': () => new Response('x'.repeat(MAX_RESPONSE_BYTES + 1)),
  'extra factual prose': (_url, options) => { const out = answer(JSON.parse(JSON.parse(options.body).input[0].content)); out.recommendations[0].why = 'Open and quiet'; return response(out); },
  'invented alias': () => response({ recommendations: [{ candidate_alias: 'invented', evidence_refs: [], reason_codes: ['nearby'], activity_code: 'observe' }] }),
};
for (const [label, fake] of Object.entries(failures)) test(`${label} consumes one attempt, never retries and returns labeled fallback`, async t => {
  const s = await setup(t); let calls = 0;
  const out = await s.service({ testFetch: (...args) => { calls++; return fake(...args); } })(input());
  assert.equal(calls, 1); assert.equal((await s.reservations()).length, 1);
  assert.equal(out.status, 'retrieval_only'); assert.equal(out.recommendations[0].activity.kind, 'template_suggestion');
  assert.equal(JSON.stringify(out).includes('PRIVATE_PROVIDER_SENTINEL'), false);
});

for (const [label, fake] of [
  ['network throw', () => { throw new Error('PRIVATE_NETWORK_SENTINEL'); }],
  ['fetch ignoring abort', () => new Promise(() => {})],
  ['body ignoring abort', () => new Response(new ReadableStream({ start() {} }))],
  ['body read failure after headers', () => new Response(new ReadableStream({ start(c) { c.error(new Error('PRIVATE_NETWORK_SENTINEL')); } }))],
  ['body read failure after partial data', () => new Response(new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode('{"status":')); }, pull(c) { c.error(new Error('PRIVATE_NETWORK_SENTINEL')); }
  }))],
  ['response exceeding the byte limit', () => new Response('x'.repeat(MAX_RESPONSE_BYTES + 1))],
]) test(`${label} stays counted and locks the run against uncertain duplicate work`, async t => {
  const a = authorization({ limits: { max_attempts: 3, max_output_tokens: 128, timeout_ms: 20 } }), s = await setup(t, a); let calls = 0;
  const out = await s.service({ testFetch: (...args) => { calls++; return fake(...args); } })(input());
  assert.equal(out.status, 'retrieval_only'); assert.equal(calls, 1); assert.equal((await s.reservations()).length, 1);
  const later = await s.service()(input());
  assert.equal(later.generation.failure_code, 'BUDGET_BUSY');
  const outcome = JSON.parse(await readFile(path.join(s.budgetDirectory, '1.outcome.json'), 'utf8'));
  assert.equal(outcome.uncertain, true); assert.equal(outcome.outcome, 'unknown');
  assert.equal(JSON.stringify(out).includes('PRIVATE_NETWORK_SENTINEL'), false);
});

test('missing, corrupt, mismatched or interrupted budget never dispatches or resets itself', async t => {
  for (const change of [
    async s => { await writeFile(path.join(s.budgetDirectory, 'manifest.json'), '{}'); },
    async s => { await writeFile(path.join(s.budgetDirectory, 'manifest.json'), JSON.stringify({ ...s.budget, authorization_hash: 'f'.repeat(64) })); },
    async s => { await writeFile(path.join(s.budgetDirectory, 'active.lock'), ''); },
    async s => { await writeFile(path.join(s.budgetDirectory, '1.reserved.json'), ''); },
    async s => { await writeFile(path.join(s.budgetDirectory, 'unexpected.txt'), ''); },
  ]) {
    const s = await setup(t); await change(s); let calls = 0;
    const out = await s.service({ testFetch: () => { calls++; } })(input());
    assert.equal(calls, 0); assert.ok(['BUDGET_INVALID', 'BUDGET_BUSY'].includes(out.generation.failure_code));
  }
  const s = await setup(t);
  const out = await s.service({ budgetDirectory: path.join(s.dir, 'missing') })(input());
  assert.equal(out.generation.failure_code, 'BUDGET_INVALID');
});

test('outcome write failure keeps the attempt spent and blocks further requests', async t => {
  const s = await setup(t);
  const out = await s.service({ testFetch: async (...args) => {
    await writeFile(path.join(s.budgetDirectory, '1.outcome.json'), 'INTERRUPTED_WRITE');
    return fakeFetch(...args);
  } })(input());
  assert.equal(out.status, 'retrieval_only'); assert.equal(out.generation.failure_code, 'BUDGET_INVALID');
  assert.equal((await s.reservations()).length, 1);
  const stopped = await s.service()(input()); assert.equal(stopped.generation.dispatch_attempts, 0);
});

test('caller mutations cannot change pinned authorization and synthetic transport never accepts collected data', async t => {
  const a = authorization(), s = await setup(t, a), pins = { ...expected };
  const service = s.service({ authorization: a, expected: pins });
  a.records[0].id = 'synthetic:other'; pins.snapshot_id = 'f'.repeat(64);
  assert.equal((await service(input())).status, 'synthetic_provider_test');
  assert.throws(() => createBoundedGenerationService({ expected: { ...expected, dataset_kind: 'collected' },
    retrieve: async () => envelope(), testFetch: fakeFetch }), { code: 'DATA_INVALID' });
  assert.equal((await s.service({ testFetch: undefined })(input())).generation.failure_code, 'PROCESSING_NOT_AUTHORIZED');
});

test('client input cannot enable generation or alter model, budget, authorization or clock', async t => {
  const s = await setup(t); let calls = 0;
  for (const value of [{ enabled: true }, { model }, { budgetDirectory: s.budgetDirectory }, { authorization: authorization() }, { now: now() }]) {
    assert.equal((await s.service({ testFetch: () => { calls++; } })(input(value))).status, 'error');
  }
  assert.equal(calls, 0); assert.deepEqual(await s.reservations(), []);
});
