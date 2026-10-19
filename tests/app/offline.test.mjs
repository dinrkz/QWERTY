import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createOfflineService, validateOfflineInput, validatePrivateRetrieval, presentOffline } from '../../src/app/offline.mjs';
import { createAppServer } from '../../src/server.mjs';
import { validateRetrieval } from '../../src/shared/validate.mjs';
import { input, normalized, envelope, expected } from './fixtures/private-envelope.mjs';

test('empty keyword search stays local and accepts no extra transport controls', () => {
  assert.equal(validateOfflineInput(input()).query, '—');
  assert.equal(validateOfflineInput(input({ query: '  coffee  ' })).query, 'coffee');
  for (const changes of [{ query: null }, { query: 'x'.repeat(1001) }, { query: ' '.repeat(1001) }, { scenario: 'coffee' }, { mode: 'live' },
    { now: '2026-10-19T00:00:00Z' }, { command: ['evil'] }, { latitude: 0 }]) {
    assert.throws(() => validateOfflineInput(input(changes)));
  }
});

test('private envelope is accepted only by separate validator, not the live validator', () => {
  const e = envelope(), request = normalized();
  assert.equal(validatePrivateRetrieval(e, request, expected).candidates.length, 1);
  assert.throws(() => validateRetrieval(e, request));
});

const mutations = {
  'wrong contract': e => { e.contract = 'app-v1'; },
  'live status': e => { e.status = 'ok'; },
  'permission flag': e => { e.result.external_processing_allowed = true; },
  'demo flag': e => { e.result.demo_eligible = true; },
  'changed binding': e => { e.result.binding_id = 'f'.repeat(64); },
  'changed policy': e => { e.result.policy_id = 'f'.repeat(64); },
  'changed review': e => { e.result.review_id = 'f'.repeat(64); },
  'changed snapshot': e => { e.result.snapshot_id = 'f'.repeat(64); },
  'dataset kind': e => { e.result.dataset_kind = 'collected'; },
  'duplicate IDs': e => { e.result.candidates.push(structuredClone(e.result.candidates[0])); e.result.eligible_count = 2; },
  'future collection': e => { e.result.collected_at = '2030-01-01T00:00:00Z'; },
  'no-match with candidate': e => { e.result.status = 'no_match'; },
  'wrong evidence': e => { e.result.candidates[0].poi.evidence[0].source_version = 'f'.repeat(64); },
  'fabricated URL': e => { e.result.candidates[0].poi.source_url = 'https://example.invalid'; },
  'fabricated amenity': e => { e.result.candidates[0].poi.amenities.quiet = { value: true }; },
  'fabricated hours': e => { e.result.candidates[0].poi.opening_hours = {}; },
  'fabricated access': e => { e.result.candidates[0].poi.access.value = 'public'; },
  'description without evidence': e => { e.result.candidates[0].poi.description = 'Invented'; },
  'unreviewed record': e => { e.result.candidates[0].review_status = 'review'; },
  'review presented as fact': e => { e.result.candidates[0].review.kind = 'source_fact'; },
  'invalid coordinates': e => { e.result.candidates[0].poi.latitude = 0; },
  'incorrect distance': e => { e.result.candidates[0].distance_m = 0; },
  'incorrect time': e => { e.result.candidates[0].total_minutes_estimate = 1; },
  'unsupported event': e => { e.result.candidates[0].poi.categories = ['event']; },
  'mismatched category': e => { e.result.candidates[0].poi.categories = ['museum']; },
  'missing fine categories': e => { e.result.candidates[0].poi.source_categories = []; },
  'invented fine category': e => { e.result.candidates[0].poi.source_categories = ['imaginary']; },
};
for (const [name, mutate] of Object.entries(mutations)) test(`private validation rejects ${name}`, () => {
  const e = envelope(); mutate(e);
  assert.throws(() => validatePrivateRetrieval(e, normalized(), expected), { code: 'DATA_INVALID' });
});

for (const constraints of [{ categories: ['park'] }, { max_distance_m: 50 }, { available_minutes: 5 },
  { available_minutes: 30, return_to_start: true, buffer_minutes: 3 }, { require_open: true }, { events_only: true },
  ...['sockets', 'quiet', 'wheelchair', 'child_friendly'].map(v => ({ required_amenities: [v] }))]) {
  test(`private validator independently enforces ${JSON.stringify(constraints)}`, () => {
    const request = normalized(constraints);
    assert.throws(() => validatePrivateRetrieval(envelope(request), request, expected), { code: 'DATA_INVALID' });
  });
}

test('offline presentation preserves unknown facts and metadata, hides user text and coordinate fields', () => {
  const request = normalized({ query: 'SYNTHETIC_PRIVATE_PROMPT', latitude: 51.100123, longitude: 71.400789 });
  const result = presentOffline(request, validatePrivateRetrieval(envelope(request), request, expected));
  assert.equal(result.status, 'offline_evaluation');
  assert.equal(result.dataset.demo_eligible, false);
  assert.equal(result.recommendations[0].source_facts.description, null);
  assert.equal(result.recommendations[0].sources[0].url, null);
  assert.equal(result.recommendations[0].activity.kind, 'template_suggestion');
  assert.equal(result.recommendations[0].review.kind, 'analyst_judgment_not_source_fact');
  for (const secret of ['SYNTHETIC_PRIVATE_PROMPT', '51.100123', '71.400789']) assert.equal(JSON.stringify(result).includes(secret), false);
  assert.ok(result.warnings.some(v => v.includes('Synthetic')));
});

test('per-place uncertainty survives presentation and displayed time components add up', () => {
  const request = normalized({ return_to_start: true, buffer_minutes: 3 });
  const e = envelope(request);
  e.result.candidates[0].uncertainty_codes = ['coffee_point_seating_unknown', 'area_point_not_entrance'];
  const card = presentOffline(request, validatePrivateRetrieval(e, request, expected)).recommendations[0];
  assert.deepEqual(card.uncertainty_codes, e.result.candidates[0].uncertainty_codes);
  assert.ok(card.caveats.some(v => v.includes('seating')));
  assert.ok(card.caveats.some(v => v.includes('entrance')));
  const x = card.estimates;
  assert.ok(Math.abs(x.total_minutes - x.travel_minutes - x.return_minutes - x.visit_minutes - x.buffer_minutes) < 0.0001);
});

test('empty offline results are explicit and localized, without invention', async () => {
  for (const language of ['en', 'ru', 'kk']) {
    const service = createOfflineService({ expected, now: () => normalized().now, retrieve: async () => {
      const e = envelope(); Object.assign(e.result, { status: 'no_match', candidates: [], eligible_count: 0 }); return e;
    } });
    const r = await service(input({ language, require_open: true }));
    assert.equal(r.status, 'offline_evaluation'); assert.equal(r.language, language);
    assert.deepEqual(r.recommendations, []); assert.ok(r.message.length > 40);
  }
});

test('service returns bounded typed errors without private exception details', async () => {
  for (const retrieve of [async () => { throw new Error('PRIVATE_PATH_OR_RECORD'); }, async () => ({ status: 'error', code: 'DATA_UNAVAILABLE' })]) {
    const r = await createOfflineService({ retrieve, expected })(input());
    assert.equal(r.status, 'error'); assert.equal(JSON.stringify(r).includes('PRIVATE_PATH_OR_RECORD'), false);
  }
});

test('offline HTTP uses no credentials, denies external browser resources and never serves snapshot files', async t => {
  const server = createAppServer({ config: { mode: 'offline', command: ['not-executed'], expected,
    apiKey: 'synthetic-secret', model: 'synthetic-model', mapKey: 'synthetic-map' },
  recommend: createOfflineService({ expected, now: () => normalized().now, retrieve: async req => envelope(req) }) });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const configResponse = await fetch(`${url}/api/config`);
  assert.deepEqual(await configResponse.json(), { mode: 'offline', map_public_key: '', generation_configured: false, retrieval_configured: true });
  assert.equal(configResponse.headers.get('permissions-policy'), 'geolocation=()');
  const csp = configResponse.headers.get('content-security-policy');
  assert.equal(csp.includes('https:'), false); assert.ok(csp.includes("connect-src 'self'"));
  for (const path of ['/data/private/pois.jsonl', '/data/runtime/offline-app.json', '/.env']) assert.equal((await fetch(url + path)).status, 404);
  const result = await fetch(`${url}/api/recommend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input()) });
  assert.equal(result.status, 200); assert.equal((await result.json()).status, 'offline_evaluation');
});
