// Public walking-route relay. No POI names, IDs, query, credentials or logging.
export const ROUTE_URL = 'https://valhalla1.openstreetmap.de/route';
const point = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)
  && p[0] >= 71.15 && p[0] <= 71.75 && p[1] >= 50.9 && p[1] <= 51.35;
const bad = () => { throw new Error('ROUTE_INVALID'); };
export function decodeRouteShape(encoded) {
  if (typeof encoded !== 'string' || !encoded.length || encoded.length > 180000) bad();
  let cursor = 0, lat = 0, lon = 0; const points = [];
  const component = () => {
    let result = 0, shift = 0, byte;
    do {
      if (cursor >= encoded.length || shift > 30) bad();
      byte = encoded.charCodeAt(cursor++) - 63;
      if (byte < 0 || byte > 63) bad();
      result += (byte & 31) * 2 ** shift; shift += 5;
    } while (byte >= 32);
    return result % 2 ? -(Math.floor(result / 2) + 1) : result / 2;
  };
  while (cursor < encoded.length) {
    lat += component(); lon += component();
    const p = [lon / 1e6, lat / 1e6]; if (!point(p) || points.length >= 20000) bad(); points.push(p);
  }
  if (points.length < 2) bad(); return points;
}
export function validateRouteResponse(value, start, end) {
  const trip = value?.trip, summary = trip?.summary;
  if (!trip || trip.status !== 0 || trip.units !== 'kilometers' || !Array.isArray(trip.legs) || trip.legs.length !== 1
    || !summary || summary.has_ferry === true || trip.legs[0].summary?.has_ferry === true
    || !Number.isFinite(summary.length) || summary.length <= 0 || summary.length > 30
    || !Number.isFinite(summary.time) || summary.time <= 0 || summary.time > 12 * 3600) bad();
  const geometry = decodeRouteShape(trip.legs[0].shape);
  // Never display a path snapped to an unrelated part of the city (about 400 m max).
  const close = (a, b) => Math.hypot((a[0] - b[0]) * 70000, (a[1] - b[1]) * 111000) <= 400;
  if (!close(geometry[0], start) || !close(geometry.at(-1), end)) bad();
  return { status: 'ok', provider: 'FOSSGIS / Valhalla', mode: 'walking', geometry,
    distance_m: Math.round(summary.length * 1000), duration_minutes: Math.round(summary.time / 6) / 10 };
}
async function readLimited(response) {
  if (!response.body) bad();
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length;
    if (size > 512 * 1024) { await reader.cancel(); bad(); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function createWalkingRouter({ fetchImpl = fetch, now = Date.now, timeoutMs = 12000 } = {}) {
  let active = false, previousStart = -Infinity;
  return async raw => {
    if (!raw || Object.keys(raw).sort().join(',') !== 'end,start' || !point(raw.start) || !point(raw.end)) return { status: 'error', code: 'ROUTE_INVALID' };
    if (active || now() - previousStart < 1100) return { status: 'error', code: 'ROUTE_BUSY' };
    const round = p => p.map(n => Math.round(n * 1000) / 1000);
    const start = round(raw.start), end = round(raw.end);
    if (start[0] === end[0] && start[1] === end[1]) return { status: 'error', code: 'ROUTE_TOO_CLOSE' };
    active = true; previousStart = now();
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(ROUTE_URL, { method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'qadam-hackathon-local', Accept: 'application/json' },
        body: JSON.stringify({ locations: [start, end].map(([lon, lat]) => ({ lat, lon })), costing: 'pedestrian',
          costing_options: { pedestrian: { walking_speed: 4, use_ferry: 0 } }, units: 'kilometers', directions_type: 'none', alternates: 0 }) });
      if (!response.ok) throw new Error('ROUTE_UNAVAILABLE');
      return validateRouteResponse(await readLimited(response), start, end);
    } catch { return { status: 'error', code: 'ROUTE_UNAVAILABLE' }; }
    finally { controller.abort(); clearTimeout(timer); active = false; }
  };
}
