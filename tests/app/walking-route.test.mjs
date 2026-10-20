import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWalkingRouter, decodeRouteShape, validateRouteResponse, ROUTE_URL } from '../../src/app/walking-route.mjs';
import { createRouteSelection } from '../../public/route-selection.mjs';
const start = [71.43, 51.128], end = [71.433, 51.13];
function encode(points) {
  let previous = [0, 0], output = '';
  for (const [lon, lat] of points) {
    const next = [Math.round(lat * 1e6), Math.round(lon * 1e6)];
    for (let i = 0; i < 2; i++) { const d = next[i] - previous[i]; let v = d < 0 ? -d * 2 - 1 : d * 2;
      while (v >= 32) { output += String.fromCharCode((v % 32 | 32) + 63); v = Math.floor(v / 32); }
      output += String.fromCharCode(v + 63); } previous = next;
  }
  return output;
}
const response = () => ({ trip: { status: 0, units: 'kilometers', summary: { length: .7, time: 630 }, legs: [{ shape: encode([start, [71.432, 51.129], end]) }] } });
test('pedestrian relay sends only rounded endpoints to the fixed provider and validates returned geometry', async () => {
  let calls = 0;
  const route = createWalkingRouter({ fetchImpl: async (url, options) => {
    calls++; assert.equal(url, ROUTE_URL); assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body);
    assert.equal(body.costing, 'pedestrian'); assert.deepEqual(body.locations, [{ lat: 51.128, lon: 71.43 }, { lat: 51.13, lon: 71.433 }]);
    assert.equal(body.costing_options.pedestrian.walking_speed, 4);
    assert.deepEqual(Object.keys(body).sort(), ['alternates','costing','costing_options','directions_type','locations','units']);
    return new Response(JSON.stringify(response()));
  } });
  const out = await route({ start: [71.43012, 51.12821], end });
  assert.equal(calls, 1); assert.equal(out.status, 'ok'); assert.equal(out.distance_m, 700); assert.equal(out.duration_minutes, 10.5);
  assert.deepEqual(out.geometry[0], start); assert.deepEqual(out.geometry.at(-1), end);
});
test('invalid/extra input fields and coincident points never dispatch', async () => {
  let calls = 0; const route = createWalkingRouter({ fetchImpl: () => { calls++; throw Error(); } });
  for (const body of [null, {}, { start, end, query: 'SECRET' }, { start: [0, 0], end }, { start, end: start }]) assert.equal((await route(body)).status, 'error');
  assert.equal(calls, 0);
});
test('router caps concurrency/frequency and never retries provider failure', async () => {
  let time = 0, release, calls = 0, signal;
  const route = createWalkingRouter({ now: () => time, fetchImpl: (_url, options) => { signal = options.signal; calls++; return new Promise(r => { release = r; }); } });
  const first = route({ start, end }); assert.equal((await route({ start, end })).code, 'ROUTE_BUSY');
  release(new Response('{}', { status: 503 })); assert.equal((await first).code, 'ROUTE_UNAVAILABLE');
  assert.equal(signal.aborted, true);
  time = 1000; assert.equal((await route({ start, end })).code, 'ROUTE_BUSY'); assert.equal(calls, 1);
});
test('malformed, ferry, outlying or unrelated paths are rejected', () => {
  for (const shape of ['', '?', '~~~~~~~', encode([[0,0], [1,1]])]) assert.throws(() => decodeRouteShape(shape));
  const ferry = response(); ferry.trip.summary.has_ferry = true; assert.throws(() => validateRouteResponse(ferry, start, end));
  const wrong = response(); wrong.trip.legs[0].shape = encode([[71.6,51.2], [71.61,51.21]]); assert.throws(() => validateRouteResponse(wrong, start, end));
});
test('route response size and provider timeout are bounded', async () => {
  const large = createWalkingRouter({ fetchImpl: async () => new Response('x'.repeat(512*1024+1)) });
  assert.equal((await large({ start, end })).code, 'ROUTE_UNAVAILABLE');
  const timeout = createWalkingRouter({ timeoutMs: 10, fetchImpl: (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Error()))) });
  assert.equal((await timeout({ start, end })).code, 'ROUTE_UNAVAILABLE');
});
const card = id => ({ poi_id: id, longitude: end[0], latitude: end[1], estimates: { visit_minutes: 20 } });
const context = { available_minutes: 30, return_to_start: true, buffer_minutes: 5 };
const routeResult = { status: 'ok', geometry: [start, end], distance_m: 700, duration_minutes: 10.5 };
test('selecting a suggestion requests routing only, caches a pair, and flags the actual route budget', async () => {
  let calls = 0; const states = [], drawings = [];
  const ui = createRouteSelection({ getToken: () => 'csrf', clear() {}, onChange: s => states.push(s), draw: g => drawings.push(g),
    fetchImpl: async (url, options) => { calls++; assert.equal(url, '/api/route'); assert.deepEqual(JSON.parse(options.body), { start, end }); return new Response(JSON.stringify(routeResult)); } });
  await ui.select(card('a'), start, context); await ui.select(card('a'), start, context);
  await ui.select(card('b'), start, context);
  assert.equal(calls, 1); assert.equal(drawings.length, 2); assert.equal(states.at(-1).total, 46); assert.equal(states.at(-1).overBudget, true);
});
test('new selection/reset ignores late responses and failed selection allows an explicit retry', async () => {
  let release; const drawn = [], states = [];
  const ui = createRouteSelection({ getToken: () => '', clear() {}, onChange: s => states.push(s), draw: g => drawn.push(g),
    fetchImpl: () => new Promise(r => { release = r; }) });
  const old = ui.select(card('a'), start, context); ui.reset(); release(new Response(JSON.stringify(routeResult))); await old;
  assert.equal(drawn.length, 0); assert.equal(states.at(-1), null);
  const failed = ui.select(card('a'), start, context); release(new Response(JSON.stringify({ status: 'error', code: 'ROUTE_BUSY' }), { status: 503 })); await failed;
  assert.equal(states.at(-1).state, 'error');
  const retry = ui.select(card('a'), start, context); release(new Response(JSON.stringify(routeResult))); await retry;
  assert.equal(states.at(-1).state, 'ready');
});
