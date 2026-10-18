import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createAppServer, readConfig } from '../../src/server.mjs';
import { errorResult } from '../../src/app/presentation.mjs';
import { syntheticInput } from './fixtures/synthetic.mjs';

const syntheticConfig = overrides => ({ apiKey: 'synthetic-provider-key-not-a-secret', model: 'synthetic-model',
  mapKey: 'synthetic-public-map-key', command: ['synthetic-not-executed'], port: 3000, ...overrides });

async function startServer(t, options = {}) {
  const server = createAppServer({ config: syntheticConfig(), recommend: async () => ({ status: 'synthetic_test', recommendations: [] }), ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closed;
  });
  return { url: `http://127.0.0.1:${server.address().port}`, server };
}

const post = (url, body, options = {}) => fetch(`${url}/api/recommend`, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...options.headers }, body: JSON.stringify(body) });

test('configuration distinguishes public map key from backend credentials and validates ports', () => {
  const config = readConfig({ OPENAI_API_KEY: ' synthetic-private ', OPENAI_MODEL: ' synthetic-model ',
    QADAM_MAP_PUBLIC_KEY: ' public-map ', QADAM_RETRIEVAL_COMMAND: '["python","-m","qadam_data"]' });
  assert.equal(config.apiKey, 'synthetic-private');
  assert.equal(config.port, 3000);
  assert.deepEqual(config.command, ['python', '-m', 'qadam_data']);
  for (const env of [{ PORT: '0' }, { PORT: '65536' }, { PORT: '1.5' }, { PORT: 'NaN' },
    { OPENAI_API_KEY: 'same', QADAM_MAP_PUBLIC_KEY: 'same' }, { QADAM_MAP_PUBLIC_KEY: 'sk-synthetic' }]) {
    assert.throws(() => readConfig(env), /INVALID_CONFIG/u);
  }
});

test('public configuration has only approved fields and never backend secrets', async t => {
  const { url } = await startServer(t);
  const response = await fetch(`${url}/api/config`);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(body), { map_public_key: 'synthetic-public-map-key', generation_configured: true, retrieval_configured: true });
  assert.equal(body.includes('synthetic-provider-key-not-a-secret'), false);
  assert.equal(body.includes('synthetic-model'), false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('set-cookie'), null);
});

test('static allowlist refuses env, source, Git, fixture and traversal paths', async t => {
  const { url } = await startServer(t);
  for (const pathname of ['/.env', '/.env.local', '/.git/config', '/src/server.mjs',
    '/tests/app/fixtures/synthetic.mjs', '/public/../../.env', '/%2e%2e/.env', '/missing']) {
    const response = await fetch(`${url}${pathname}`);
    assert.equal(response.status, 404, pathname);
    assert.equal((await response.json()).code, 'INVALID_INPUT');
  }
});

test('only designated public files are served successfully', async t => {
  const { url } = await startServer(t);
  for (const [pathname, mime] of [['/', 'text/html'], ['/app.mjs', 'text/javascript'],
    ['/i18n.mjs', 'text/javascript'], ['/styles.css', 'text/css']]) {
    const response = await fetch(`${url}${pathname}`);
    assert.equal(response.status, 200, pathname);
    assert.ok(response.headers.get('content-type').startsWith(mime));
    assert.ok((await response.text()).length > 0);
  }
});

test('malformed JSON, wrong content type and oversized bodies stop before the service', async t => {
  let calls = 0;
  const { url } = await startServer(t, { recommend: async () => { calls++; return { status: 'synthetic_test' }; } });
  for (const [body, contentType] of [['{broken', 'application/json'], ['{}', 'text/plain'],
    [JSON.stringify({ query: 'x'.repeat(16 * 1024) }), 'application/json']]) {
    const response = await fetch(`${url}/api/recommend`, { method: 'POST', headers: { 'Content-Type': contentType }, body });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'INVALID_INPUT');
  }
  assert.equal(calls, 0);
});

test('foreign origin and Host are refused before service execution', async t => {
  let calls = 0;
  const { url } = await startServer(t, { recommend: async () => { calls++; return { status: 'synthetic_test' }; } });
  const foreign = await post(url, syntheticInput(), { headers: { Origin: 'https://foreign.invalid' } });
  assert.equal(foreign.status, 403);
  // The fetch implementation rewrites Host; use the raw HTTP client to exercise this boundary.
  const foreignHostStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(`${url}/api/config`, { headers: { Host: 'foreign.invalid' } }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject);
    request.end();
  });
  assert.equal(foreignHostStatus, 403);
  assert.equal(calls, 0);
  const sameOrigin = await post(url, syntheticInput(), { headers: { Origin: url } });
  assert.equal(sameOrigin.status, 200);
  assert.equal(calls, 1);
});

test('unconfigured data/provider returns typed errors without remote work', async t => {
  for (const [config, code] of [[syntheticConfig({ command: null }), 'DATA_UNAVAILABLE'],
    [syntheticConfig({ apiKey: '' }), 'PROVIDER_NOT_CONFIGURED']]) {
    const { url } = await startServer(t, { config, recommend: undefined });
    const response = await post(url, syntheticInput());
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, code);
  }
});

test('null request body is INVALID_INPUT even when retrieval is not configured', async t => {
  const { url } = await startServer(t, { config: syntheticConfig({ command: null }), recommend: undefined });
  const response = await post(url, null);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'INVALID_INPUT');
});

test('malformed language names always produce a safe localized server error', async t => {
  const { url } = await startServer(t, { config: syntheticConfig({ command: null }), recommend: undefined });
  for (const language of ['constructor', '__proto__', 'toString']) {
    const response = await post(url, syntheticInput({ language }));
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.language, 'ru');
    assert.equal(typeof body.message, 'string');
    assert.ok(body.message.length > 0);
  }
});

test('unexpected service exceptions return a generic error without details', async t => {
  const { url } = await startServer(t, { recommend: async () => { throw new Error('SYNTHETIC_PRIVATE_SERVICE_DETAIL'); } });
  const response = await post(url, syntheticInput());
  const body = await response.text();
  assert.equal(response.status, 500);
  assert.equal(JSON.parse(body).code, 'INTERNAL_ERROR');
  assert.equal(body.includes('SYNTHETIC_PRIVATE_SERVICE_DETAIL'), false);
});

test('two in-flight requests are allowed, a third is busy, and capacity recovers', async t => {
  let started = 0;
  let release;
  let bothStarted;
  const gate = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { bothStarted = resolve; });
  const { url } = await startServer(t, { recommend: async () => {
    started++;
    if (started === 2) bothStarted();
    await gate;
    return { status: 'synthetic_test', recommendations: [] };
  } });
  t.after(() => release());
  const first = post(url, syntheticInput());
  const second = post(url, syntheticInput());
  await ready;
  const third = await post(url, syntheticInput());
  assert.equal(third.status, 429);
  assert.equal((await third.json()).code, 'BUSY');
  release();
  assert.equal((await first).status, 200);
  assert.equal((await second).status, 200);
  assert.equal((await post(url, syntheticInput())).status, 200);
});

test('typed service errors use 400 and clarification remains a normal response', async t => {
  for (const [code, status] of [['INVALID_INPUT', 400], ['NEEDS_CLARIFICATION', 200]]) {
    const { url } = await startServer(t, { recommend: async () => errorResult(code, 'en') });
    const response = await post(url, syntheticInput());
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
  }
});
