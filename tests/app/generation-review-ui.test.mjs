import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReviewUI } from '../../public/generation-review.mjs';

function fixture(t, fetchImpl, options = {}) {
  const nodes = new Map();
  const byId = id => {
    if (!nodes.has(id)) nodes.set(id, { textContent: '', hidden: false, disabled: false, checked: false,
      handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; } });
    return nodes.get(id);
  };
  const rendered = [];
  const ui = createReviewUI({ byId, t: k => k, getConfig: () => ({ mode: 'bounded', preview_token: 'synthetic-csrf' }),
    readRequest: () => ({ query: 'synthetic' }), renderResult: v => rendered.push(v), validResponse: v => Boolean(v.status), fetchImpl, ...options });
  t.after(() => ui.clear());
  return { ui, byId, rendered, click: id => byId(id).handlers.click(),
    consent() { byId('generation-consent').checked = true; byId('generation-consent').handlers.change(); } };
}
const preview = changes => ({ status: 'generation_preview', ready: true, packet: { contract: 'qadam-openai-evidence-v1' },
  request_body: '{"name":"<img src=x onerror=alert(1)>"}', preview_id: 'synthetic-token',
  expires_at: new Date(Date.now() + 60000).toISOString(), ...changes });
const response = value => ({ ok: true, json: async () => value });

test('pending local search blocks preview and confirmation so an old search cannot overwrite generation', async t => {
  let pending = true, calls = 0;
  const f = fixture(t, async () => { calls++; return response(preview()); }, { isSearchPending: () => pending });
  f.ui.refresh(); assert.equal(f.byId('preview-generation').disabled, true);
  await f.click('preview-generation'); assert.equal(calls, 0);
  pending = false; await f.click('preview-generation'); f.consent();
  pending = true; f.ui.refresh(); await f.click('confirm-generation');
  assert.equal(f.byId('confirm-generation').disabled, true); assert.equal(calls, 1);
});

test('preview displays plain text; sending requires consent and consumes token before duplicate clicks', async t => {
  let calls = 0, release;
  const f = fixture(t, async (_url, options) => {
    calls++;
    assert.equal(options.headers['X-Qadam-Preview'], 'synthetic-csrf');
    if (calls === 1) return response(preview());
    assert.deepEqual(JSON.parse(options.body), { preview_id: 'synthetic-token' });
    await new Promise(r => { release = r; });
    return response({ status: 'synthetic_provider_test', generation: { dispatch_attempts: 1 } });
  });
  await f.click('preview-generation');
  assert.equal(f.byId('generation-payload').textContent, preview().request_body);
  await f.click('confirm-generation'); assert.equal(calls, 1);
  f.consent(); const sent = f.click('confirm-generation');
  await f.click('confirm-generation'); assert.equal(calls, 2);
  release(); await sent; assert.equal(f.rendered.length, 1);
  await f.click('confirm-generation'); assert.equal(calls, 2);
});

test('form changes discard preview and ignore late preview responses', async t => {
  let release, calls = 0;
  const f = fixture(t, async () => { calls++; return new Promise(r => { release = () => r(response(preview())); }); });
  const pending = f.click('preview-generation'); f.ui.clear(); release(); await pending;
  assert.equal(f.byId('generation-payload').textContent, '');
  f.consent(); await f.click('confirm-generation'); assert.equal(calls, 1);
});

test('disabled and expired previews never allow confirmation', async t => {
  for (const changes of [{ ready: false, preview_id: null, request_body: null }, { expires_at: '2000-01-01T00:00:00Z' }]) {
    let calls = 0; const f = fixture(t, async () => { calls++; return response(preview(changes)); });
    await f.click('preview-generation'); f.consent(); await f.click('confirm-generation');
    assert.equal(calls, 1); assert.equal(f.byId('confirm-generation').disabled, true);
  }
});

test('failed confirmation is never retried and explains uncertain accounting', async t => {
  let calls = 0;
  const f = fixture(t, async () => { if (++calls === 1) return response(preview()); throw new Error('NETWORK'); });
  await f.click('preview-generation'); f.consent(); await f.click('confirm-generation');
  await f.click('confirm-generation'); assert.equal(calls, 2);
  assert.equal(f.byId('generation-notice').textContent, 'generationMayCount');
});

test('changing inputs during confirmation does not render stale results or enable another send', async t => {
  let calls = 0, release;
  const f = fixture(t, async () => ++calls === 1 ? response(preview()) : new Promise(r => { release = r; }));
  await f.click('preview-generation'); f.consent(); const pending = f.click('confirm-generation');
  f.ui.clear(); await f.click('preview-generation'); assert.equal(calls, 2);
  release(response({ status: 'synthetic_provider_test', generation: { dispatch_attempts: 1 } })); await pending;
  assert.equal(f.rendered.length, 0); assert.equal(f.byId('confirm-generation').disabled, true);
});
test('confirmation can display success after the old browser deadline', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0, release, signal;
  const f = fixture(t, async (_url, options) => {
    if (++calls === 1) return response(preview());
    signal = options.signal;
    return new Promise(r => { release = r; });
  });
  await f.click('preview-generation'); f.consent(); const pending = f.click('confirm-generation');
  t.mock.timers.tick(61000); assert.equal(signal.aborted, false);
  release(response({ status: 'synthetic_provider_test', generation: { dispatch_attempts: 1 } }));
  await pending; assert.equal(f.rendered.length, 1); assert.equal(calls, 2);
});
