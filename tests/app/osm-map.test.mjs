import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOSMController, mapStartPoint, TILE_URL } from '../../public/osm-map.mjs';
function fixture(options = {}) {
  const state = { loads: 0, removed: 0, fits: 0, points: [], tips: [], markerOptions: [], options: null, handlers: {} }, container = { hidden: true };
  const map = { on(name, fn) { state.handlers[name] = fn; }, getCenter() { return { lat: 51.12789, lng: 71.43012 }; }, setView() { return this; }, fitBounds() { state.fits++; }, remove() { state.removed++; } };
  const L = { map: () => map, layerGroup: () => ({ addTo() { return this; }, clearLayers() { state.points = []; } }),
    tileLayer(url, options) { assert.equal(url, TILE_URL); state.options = options; return { on() {}, addTo() {} }; },
    circleMarker(point, options) { state.points.push(point); state.markerOptions.push(options); return { addTo() { return this; }, bindTooltip(node) { state.tips.push(node); return this; } }; } };
  return { state, container, L, controller: createOSMController({ container, onStatus() {},
    load: async () => { state.loads++; return L; }, textNode: value => ({ textContent: value }), ...options }) };
}
test('OSM loads only on explicit enable; markers use local text and invalid coordinates are dropped', async () => {
  const f = fixture();
  f.controller.update([71.43, 51.128], []); assert.equal(f.state.loads, 0);
  await f.controller.enable([71.43, 51.128], []);
  f.controller.update([71.43, 51.128], [{ latitude: 51.13, longitude: 71.44, name: '<img onerror=alert(1)>' }, { latitude: 100, longitude: 0 }]);
  assert.equal(f.state.loads, 1); assert.equal(f.state.points.length, 2);
  assert.equal(f.state.tips[0].textContent, '1. <img onerror=alert(1)>');
  assert.equal(f.state.options.referrerPolicy, 'origin'); assert.ok(f.state.options.attribution.includes('OpenStreetMap'));
  f.controller.disable(); assert.equal(f.container.hidden, true); assert.equal(f.state.removed, 1);
});
test('disabling during library load prevents creation of a map or tile requests', async () => {
  let release, mapCalls = 0;
  const c = createOSMController({ container: { hidden: true }, onStatus() {}, load: () => new Promise(r => { release = r; }) });
  const pending = c.enable([71.4, 51.1], []); c.disable();
  release({ map() { mapCalls++; } }); assert.equal(await pending, false); assert.equal(mapCalls, 0);
});

test('map click and keyboard centre select approximate starts without resetting viewport; busy and stale maps cannot pick', async () => {
  let busy = false; const picks = [], notices = [];
  const f = fixture({ canPick: () => !busy, onStatus: v => notices.push(v), onPick: v => { picks.push(v); f.controller.update(v, []); } });
  f.controller.pickCenter(); assert.equal(picks.length, 0);
  await f.controller.enable([71.43, 51.128], []);
  const fitCount = f.state.fits;
  f.state.handlers.click({ latlng: { lat: 51.101234, lng: 71.405678 } });
  assert.deepEqual(picks[0], [71.406, 51.101]); assert.equal(f.state.fits, fitCount);
  f.controller.pickCenter(); assert.deepEqual(picks[1], [71.43, 51.128]);
  f.state.handlers.click({ latlng: { lat: 49, lng: 71 } });
  assert.equal(picks.length, 2); assert.equal(notices.at(-1), 'mapOutside');
  busy = true; f.controller.pickCenter(); assert.equal(picks.length, 2);
  busy = false; f.controller.disable(); f.state.handlers.click({ latlng: { lat: 51.1, lng: 71.4 } });
  assert.equal(picks.length, 2);
  assert.ok(f.state.markerOptions.every(o => o.bubblingMouseEvents === false));
});

test('map start validation rejects malformed and out-of-coverage picks without inventing a point', () => {
  for (const p of [null, {}, { lat: NaN, lng: 71.4 }, { lat: 51.1, lng: Infinity }, { lat: 50.89, lng: 71.4 }, { lat: 51.1, lng: 71.76 }]) assert.equal(mapStartPoint(p), null);
});

test('numbered pins select the matching suggestion and route framing fits a small map', async () => {
  const pins = [], selections = [], frames = [], paths = [], removed = [];
  const map = { on() {}, setView() { return this; }, fitBounds(points, options) { frames.push(options); },
    removeLayer(value) { removed.push(value); }, remove() {} };
  const group = { addTo() { return this; }, clearLayers() {} };
  const L = { map: () => map, layerGroup: () => group, divIcon: options => options,
    tileLayer: () => ({ on() {}, addTo() {} }), circleMarker: () => ({ addTo() {} }),
    marker: (point, options) => { const pin = { point, options, addTo() { return this; }, bindTooltip(node) { this.tip = node; return this; },
      on(name, fn) { this.click = fn; }, setIcon(value) { this.options.icon = value; } }; pins.push(pin); return pin; },
    polyline: (points, options) => { const line = { points, options, addTo() { return this; }, getBounds: () => points }; paths.push(line); return line; } };
  const c = createOSMController({ container: { clientWidth: 390, clientHeight: 205 }, load: async () => L,
    onStatus() {}, onSelect: id => selections.push(id), textNode: value => ({ textContent: value }) });
  await c.enable([71.43, 51.128], [{ poi_id: 'one', latitude: 51.13, longitude: 71.44, name: '<script>bad</script>' }]);
  pins[0].click(); assert.deepEqual(selections, ['one']); assert.equal(pins[0].options.bubblingMouseEvents, false);
  assert.equal(pins[0].tip.textContent, '1. <script>bad</script>'); assert.equal(pins[0].options.icon.html.includes('script'), false);
  c.select('one'); assert.match(pins[0].options.icon.className, /selected/);
  c.setRoute([[71.43,51.128], [71.44,51.13]]);
  assert.deepEqual(paths[0].points, [[51.128,71.43], [51.13,71.44]]);
  assert.ok(frames.at(-1).paddingTopLeft[1] + frames.at(-1).paddingBottomRight[1] < 205 / 2);
  c.update([71.43,51.128], []); assert.deepEqual(removed, [paths[0]]);
});
