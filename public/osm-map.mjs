// Markers render locally; viewport tiles go to OSM after enable().
// Selection callbacks use the separate route relay; this module draws its geometry.
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
let library;
async function loadLeaflet() {
  if (globalThis.L) return globalThis.L;
  if (!library) library = new Promise((resolve, reject) => {
    const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/vendor/leaflet/leaflet.css';
    const script = document.createElement('script'); script.src = '/vendor/leaflet/leaflet.js';
    script.onload = () => globalThis.L ? resolve(globalThis.L) : reject(new Error('MAP_UNAVAILABLE'));
    script.onerror = () => reject(new Error('MAP_UNAVAILABLE'));
    document.head.append(style, script);
  }).catch(error => { library = null; throw error; });
  return library;
}
const validPoint = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
export function mapStartPoint(point) {
  if (!point || !validPoint(point.lat, point.lng) || point.lat < 50.9 || point.lat > 51.35 || point.lng < 71.15 || point.lng > 71.75) return null;
  return [Math.round(point.lng * 1000) / 1000, Math.round(point.lat * 1000) / 1000];
}
export function createOSMController({ container, onStatus, onPick = () => {}, onSelect = () => {}, canPick = () => true, load = loadLeaflet, textNode = value => {
  const node = document.createElement('span'); node.textContent = value; return node;
} }) {
  let map = null, group = null, L = null, sequence = 0, latest = null, picking = false, route = null, observer = null, selected = null;
  const pins = new Map();
  const icon = (index, active) => L.divIcon({ className: `poi-pin${active ? ' selected' : ''}`, iconSize: [32, 37], iconAnchor: [16, 33],
    html: `<span><b>${index + 1}</b></span>` });
  const clearRoute = () => { if (map && route) map.removeLayer(route); route = null; };
  const select = id => { selected = id; for (const [key, { marker, index }] of pins) {
    if (L.divIcon) marker.setIcon(icon(index, key === id));
    else marker.setStyle?.({ color: key === id ? '#255946' : '#a75631', radius: key === id ? 10 : 7 });
  } };
  const pick = point => {
    if (!map || !canPick()) return;
    const selected = mapStartPoint(point);
    if (!selected) { onStatus('mapOutside'); return; }
    picking = true;
    try { onPick(selected); }
    finally { picking = false; }
  };
  const update = (start, cards = []) => {
    latest = { start, cards };
    if (!map || !validPoint(start[1], start[0])) return;
    group.clearLayers(); pins.clear(); clearRoute(); const points = [[start[1], start[0]]];
    L.circleMarker(points[0], { radius: 8, color: '#21584b', fillOpacity: 1, bubblingMouseEvents: false }).addTo(group);
    cards.forEach((card, index) => {
      if (!validPoint(card.latitude, card.longitude)) return;
      const point = [card.latitude, card.longitude]; points.push(point);
      const marker = L.divIcon ? L.marker(point, { icon: icon(index, selected === card.poi_id), bubblingMouseEvents: false,
        keyboard: true, title: `${index + 1}. ${typeof card.name === 'string' ? card.name : ''}` })
        : L.circleMarker(point, { radius: 7, color: '#a75631', fillOpacity: 0.85, bubblingMouseEvents: false });
      marker.bindTooltip(textNode(`${index + 1}. ${typeof card.name === 'string' ? card.name : ''}`)).addTo(group);
      marker.on?.('click', () => onSelect(card.poi_id)); pins.set(card.poi_id, { marker, index });
    });
    if (!picking) map.fitBounds(points, { padding: [30, 30], maxZoom: 15 });
  };
  return {
    update,
    select, clearRoute,
    setRoute(coordinates) { if (!map) return; clearRoute();
      route = L.polyline(coordinates.map(([lon, lat]) => [lat, lon]), { color: '#28764e', weight: 6, opacity: .95, interactive: false }).addTo(map);
      const height = container.clientHeight || 600, width = container.clientWidth || 800;
      map.fitBounds(route.getBounds(), { paddingTopLeft: [Math.min(60, width * .1), Math.min(160, height * .25)],
        paddingBottomRight: [Math.min(40, width * .1), Math.min(100, height * .2)], maxZoom: 16 });
    },
    pickCenter() { if (map) pick(map.getCenter()); },
    async enable(start, cards) {
      const version = ++sequence; onStatus('mapLoading');
      L = await load(); if (version !== sequence) return false;
      observer?.disconnect(); map?.remove(); route = null; container.hidden = false;
      map = L.map(container, { minZoom: 10, maxZoom: 18 }).setView([start[1], start[0]], 14);
      map.on('click', event => { if (version === sequence) pick(event.latlng); });
      const tiles = L.tileLayer(TILE_URL, { maxZoom: 18, referrerPolicy: 'origin', updateWhenIdle: true, keepBuffer: 1,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>' });
      tiles.on('tileerror', () => { if (version === sequence) onStatus('osmError'); });
      tiles.addTo(map); group = L.layerGroup().addTo(map);
      if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(() => map?.invalidateSize({ pan: false })); observer.observe(container); }
      map.invalidateSize?.({ pan: false });
      update(latest?.start ?? start, latest?.cards ?? cards); onStatus('mapReady'); return true;
    },
    disable() { sequence++; observer?.disconnect(); observer = null; map?.remove(); map = null; group = null; route = null; pins.clear(); container.hidden = true; },
  };
}
