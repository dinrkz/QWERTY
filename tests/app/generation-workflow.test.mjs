import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGenerationWorkflow, PREVIEW_TTL_MS } from '../../src/app/generation-workflow.mjs';
import { createAppServer } from '../../src/server.mjs';
import { initializeRequestBudget } from '../../src/app/request-budget.mjs';
import { checkGenerationAuthorization } from '../../src/app/generation-authorization.mjs';
import { readBoundedConfig } from '../../scripts/app/start-bounded.mjs';
import { expected, input, envelope, now, model, key, authorization, fakeFetch } from './fixtures/bounded-provider.mjs';

const root = fileURLToPath(new URL('../../data/runtime/workflow-tests/', import.meta.url));
async function setup(t, overrides = {}) {
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(path.join(root, 'synthetic-')), budgetDirectory = path.join(directory, 'budget');
  t.after(async () => { assert.equal(path.dirname(directory), path.resolve(root)); await rm(directory, { recursive: true, force: true }); });
  const approval = authorization(), { budget } = checkGenerationAuthorization(approval, expected, model, now());
  await initializeRequestBudget(budgetDirectory, budget);
  const options = { retrieve: async req => envelope(req), expected, enabled: true, authorization: approval,
    budgetDirectory, model, apiKey: key, now, testFetch: fakeFetch, ...overrides };
  const workflow = createGenerationWorkflow(options); t.after(() => workflow.invalidate());
  return { directory, budgetDirectory, options, workflow,
    count: async () => (await readdir(budgetDirectory)).filter(n => n.endsWith('.reserved.json')).length };
}

test('disabled preview needs no key/auth/budget and contains only proposed basic fields', async t => {
  const s = await setup(t, { enabled: false, authorization: null, apiKey: '', model: '', budgetDirectory: null,
    testFetch: () => { throw new Error('MUST_NOT_DISPATCH'); } });
  const p = await s.workflow.preview(input({ query: 'PRIVATE_QUERY_SENTINEL' }));
  assert.equal(p.status, 'generation_preview'); assert.equal(p.ready, false); assert.equal(p.preview_id, null);
  assert.equal(p.request_body, null); assert.equal(p.packet.candidates[0].description, null);
  for (const v of ['PRIVATE_QUERY_SENTINEL', 'synthetic:one', key, expected.snapshot_id, s.directory]) assert.equal(JSON.stringify(p).includes(v), false);
  assert.equal(await s.count(), 0);
  assert.equal((await s.workflow.generate({ preview_id: 'invented' })).status, 'error');
});

test('exact displayed body is dispatched once without retrieval after preview', async t => {
  let calls = 0, retrievals = 0, sent;
  const s = await setup(t, { retrieve: async req => { retrievals++; return envelope(req); },
    testFetch: (...args) => { calls++; sent = args[1].body; return fakeFetch(...args); } });
  const p = await s.workflow.preview(input());
  assert.equal(p.ready, true); assert.equal(calls, 0); assert.equal(await s.count(), 0);
  assert.deepEqual(JSON.parse(p.request_body), p.request);
  const displayed = p.request_body; p.packet.candidates[0].name = 'MUTATED_CLIENT'; p.request_body = 'changed';
  const results = await Promise.all([s.workflow.generate({ preview_id: p.preview_id }), s.workflow.generate({ preview_id: p.preview_id })]);
  assert.equal(results.filter(r => r.status === 'synthetic_provider_test').length, 1);
  assert.equal(calls, 1); assert.equal(retrievals, 1); assert.equal(sent, displayed);
  assert.equal((await s.workflow.generate({ preview_id: p.preview_id })).status, 'error');
  assert.equal(await s.count(), 1);
});

test('new preview, invalidation, restart and expired preview cannot reuse earlier tokens', async t => {
  let instant = Date.parse(now());
  const s = await setup(t, { now: () => new Date(instant).toISOString() });
  const first = await s.workflow.preview(input()), second = await s.workflow.preview(input({ language: 'kk' }));
  assert.equal((await s.workflow.generate({ preview_id: first.preview_id })).status, 'error');
  s.workflow.invalidate(); assert.equal((await s.workflow.generate({ preview_id: second.preview_id })).status, 'error');
  const third = await s.workflow.preview(input());
  const restarted = createGenerationWorkflow(s.options); t.after(() => restarted.invalidate());
  assert.equal((await restarted.generate({ preview_id: third.preview_id })).status, 'error');
  instant += PREVIEW_TTL_MS;
  assert.equal((await s.workflow.generate({ preview_id: third.preview_id })).status, 'error');
  assert.equal(await s.count(), 0);
});

test('authorization expires after preview and before reservation with zero attempts', async t => {
  let instant = '2026-10-19T23:59:30Z';
  const s = await setup(t, { now: () => instant });
  const p = await s.workflow.preview(input()); assert.equal(p.ready, true);
  instant = '2026-10-20T00:00:01Z';
  const out = await s.workflow.generate({ preview_id: p.preview_id });
  assert.equal(out.generation.failure_code, 'PROCESSING_NOT_AUTHORIZED'); assert.equal(await s.count(), 0);
});

test('late preview completion cannot replace the newest preview', async t => {
  let release, calls = 0;
  const s = await setup(t, { retrieve: async req => { if (++calls === 1) await new Promise(r => { release = r; }); return envelope(req); } });
  const old = s.workflow.preview(input());
  const newest = await s.workflow.preview(input()); release();
  assert.equal((await old).status, 'error');
  assert.equal((await s.workflow.generate({ preview_id: newest.preview_id })).status, 'synthetic_provider_test');
});

test('empty/invalid inputs and arbitrary confirmation configuration reserve nothing', async t => {
  const s = await setup(t);
  for (const value of [{ enabled: true }, { model: 'choose-model' }, { budgetDirectory: '/tmp' }]) {
    assert.equal((await s.workflow.preview(input(value))).status, 'error');
  }
  const p = await s.workflow.preview(input());
  assert.equal((await s.workflow.generate({ preview_id: p.preview_id, enabled: true })).status, 'error');
  assert.equal(await s.count(), 0);
  const empty = createGenerationWorkflow({ ...s.options, retrieve: async req => { const e = envelope(req); Object.assign(e.result, { candidates: [], status: 'no_match', eligible_count: 0 }); return e; } });
  t.after(() => empty.invalidate()); assert.equal((await empty.preview(input())).status, 'no_match');
});

test('budget remains authoritative across repeated previews and confirmations', async t => {
  let calls = 0; const s = await setup(t, { testFetch: (...args) => { calls++; return fakeFetch(...args); } });
  for (let i = 0; i < 4; i++) {
    const p = await s.workflow.preview(input());
    const r = await s.workflow.generate({ preview_id: p.preview_id });
    assert.equal(i < 3 ? r.status : r.generation.failure_code, i < 3 ? 'synthetic_provider_test' : 'BUDGET_EXHAUSTED');
  }
  assert.equal(calls, 3); assert.equal(await s.count(), 3);
});

async function serverFor(t, s, mode = 'bounded') {
  const server = createAppServer({ config: { mode, expected, command: ['synthetic-not-executed'],
    generation: s.options }, ...(mode === 'bounded' ? { testRetrieve: s.options.retrieve } : { recommend: async () => ({ status: 'error', recommendations: [] }) }) });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { const done = once(server, 'close'); server.close(); server.closeAllConnections(); await done; });
  const url = `http://127.0.0.1:${server.address().port}`, res = await fetch(`${url}/api/config`), config = await res.json();
  const post = (route, body, headers = {}) => fetch(`${url}${route}`, { method: 'POST', headers: {
    'Content-Type': 'application/json', Origin: url, 'X-Qadam-Preview': config.preview_token, ...headers }, body: JSON.stringify(body) });
  return { url, config, post, res };
}

test('bounded HTTP flow stays local for search/preview, uses exact token once and hides configuration', async t => {
  const s = await setup(t), h = await serverFor(t, s);
  assert.deepEqual(Object.keys(h.config).sort(), ['ai', 'generation_configured', 'map_public_key', 'mode', 'preview_token', 'retrieval_configured']);
  assert.equal(h.config.generation_configured, true); assert.equal(h.config.ai.state, 'ready');
  assert.equal(h.res.headers.get('cache-control'), 'no-store'); assert.equal(h.res.headers.get('permissions-policy'), 'geolocation=()');
  const csp = h.res.headers.get('content-security-policy');
  assert.ok(csp.includes("img-src 'self' data: https://tile.openstreetmap.org"));
  assert.ok(csp.includes("script-src 'self';")); assert.ok(csp.includes("connect-src 'self';"));
  assert.equal(csp.includes('2gis'), false);
  const entry = await fetch(`${h.url}/app.mjs`);
  assert.equal(entry.status, 200);
  for (const [, module] of (await entry.text()).matchAll(/from '\.\/([^']+)'/g)) {
    const asset = await fetch(`${h.url}/${module}`);
    assert.equal(asset.status, 200, `Browser dependency ${module} must be served`);
    assert.ok(asset.headers.get('content-type').startsWith('text/javascript'));
  }
  const local = await h.post('/api/recommend', input()); assert.equal((await local.json()).status, 'offline_evaluation');
  const response = await h.post('/api/generation/preview', input()), p = await response.json();
  assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(p.ready, true); assert.equal(await s.count(), 0);
  const generated = await h.post('/api/generation/confirm', { preview_id: p.preview_id });
  assert.equal((await generated.json()).status, 'synthetic_provider_test');
  assert.equal((await h.post('/api/generation/confirm', { preview_id: p.preview_id })).status, 400);
  assert.equal(await s.count(), 1);
});
test('main AI endpoint retrieves and generates once per click, reports exhaustion and never resets allowance', async t => {
  let calls = 0;
  const s = await setup(t, { testFetch: (...args) => { calls++; return fakeFetch(...args); } }), h = await serverFor(t, s);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await (await h.post('/api/recommend-ai', input())).json();
    assert.equal(result.status, 'synthetic_provider_test'); assert.equal(result.generation.attempt, attempt);
    const config = await (await fetch(`${h.url}/api/config`)).json();
    assert.equal(config.ai.remaining, 3 - attempt); assert.equal(config.ai.state, attempt === 3 ? 'exhausted' : 'ready');
  }
  const blocked = await (await h.post('/api/recommend-ai', input())).json();
  assert.equal(blocked.generation.failure_code, 'BUDGET_EXHAUSTED'); assert.equal(calls, 3);
  assert.equal((await (await h.post('/api/recommend', input())).json()).status, 'offline_evaluation');
  assert.equal(calls, 3);
});

test('preview and confirmation reject missing/foreign origin, token, host, wrong types and oversize bodies', async t => {
  const s = await setup(t), h = await serverFor(t, s);
  for (const route of ['/api/generation/preview', '/api/generation/confirm', '/api/recommend-ai', '/api/route']) {
    for (const headers of [{ Origin: '' }, { Origin: 'http://evil.example' }, { 'X-Qadam-Preview': '' }]) {
      assert.equal((await h.post(route, input(), headers)).status, 403, JSON.stringify(headers));
    }
    const hostileHost = await new Promise((resolve, reject) => {
      const req = httpRequest(`${h.url}${route}`, { method: 'POST', headers: { Host: 'evil.example',
        Origin: h.url, 'X-Qadam-Preview': h.config.preview_token, 'Content-Type': 'application/json' } }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end(JSON.stringify(input()));
    });
    assert.equal(hostileHost, 403);
    assert.equal((await h.post(route, input(), { 'Content-Type': 'text/plain' })).status, 400);
    assert.equal((await h.post(route, { text: 'x'.repeat(17000) })).status, 400);
    assert.equal((await fetch(`${h.url}${route}`)).status, 404);
  }
  assert.equal(await s.count(), 0);
});

test('offline and legacy modes reject all generation-review routes', async t => {
  const s = await setup(t);
  for (const mode of ['offline', 'legacy']) {
    const h = await serverFor(t, s, mode);
    assert.equal((await h.post('/api/generation/preview', input())).status, 404);
    assert.equal((await h.post('/api/generation/confirm', { preview_id: 'fake' })).status, 404);
    assert.equal((await h.post('/api/route', { start: [71.43, 51.128], end: [71.44, 51.13] })).status, 404);
  }
});

test('default launcher ignores credential environment and does not initialize a live ledger', async t => {
  const s = await setup(t), snapshot = path.join(s.directory, 'a'.repeat(64)); await mkdir(snapshot);
  const annotations = path.join(s.directory, 'annotations.json'), binding = path.join(s.directory, 'binding.json'), offlineConfig = path.join(s.directory, 'offline.json');
  await writeFile(annotations, '{}');
  await writeFile(binding, JSON.stringify({ schema_version: 1, mode: 'offline_evaluation', dataset_kind: 'collected', snapshot_id: 'a'.repeat(64),
    annotations_sha256: 'b'.repeat(64), policy_id: 'c'.repeat(64), input_hashes: { pois_sha256: 'd'.repeat(64), quality_sha256: 'e'.repeat(64) },
    demo_eligible: false, external_processing_allowed: false }));
  await writeFile(offlineConfig, JSON.stringify({ python: process.execPath, snapshot, annotations, binding }));
  const config = await readBoundedConfig({ offlineConfig, envFile: path.join(s.directory, 'missing.env'), env: new Proxy({}, { get() { throw new Error('NO_SECRET_READ'); } }) });
  assert.equal(config.port, 3003); assert.equal(config.mode, 'bounded'); assert.deepEqual(config.generation, { enabled: false });
  assert.equal(config.apiKey, ''); assert.equal(await s.count(), 0);
  await assert.rejects(readBoundedConfig({ offlineConfig, port: 0 }));
});
