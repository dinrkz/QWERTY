import { translate } from './i18n.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('walk-form');
let language = 'ru';
let locationMode = 'simulated';
let scenario = 'walk';
let config = null;
let configState = 'configPending';
let result = null;
let pending = false;
let requestSequence = 0;
let requestController = null;
let map = null;
let markers = [];
let mapState = '';
let mapLoading = false;
let mapScriptPromise = null;
const statuses = new Set(['live_rag', 'retrieval_only', 'no_match', 'needs_clarification', 'error', 'synthetic_test']);
const t = (key) => translate(language, key);
const string = (value) => typeof value === 'string' ? value : '';
const strings = (value) => Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
const roundCoordinate = (value) => Math.round(value * 1000) / 1000;

function element(tag, text = '', className = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function formatNumber(value, digits = 0) {
  if (!Number.isFinite(value)) return t('unknown');
  return new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(value);
}

function minutes(value) {
  return `${formatNumber(value, 1)} ${t('minutes')}`;
}

function distance(value) {
  if (!Number.isFinite(value)) return t('unknown');
  return value >= 1000 ? `${formatNumber(value / 1000, 1)} ${t('kilometres')}` : `${formatNumber(value)} ${t('metres')}`;
}

function date(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return t('unknown');
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'Asia/Almaty' }).format(new Date(value));
}

function eventDate(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return t('unknown');
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Almaty' }).format(new Date(value));
}

function category(value) {
  return t(value === 'event' ? 'category_event' : value);
}

function updateLocationLabel() {
  byId('location-mode').textContent = t(locationMode);
  const hint = document.querySelector('[data-i18n="locationHint"]');
  hint.textContent = t(locationMode === 'simulated' ? 'locationHint' : locationMode === 'device' ? 'deviceHint' : 'manualHint');
}

function translatePage() {
  document.documentElement.lang = language;
  document.title = `Qadam — ${t('city')}`;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const node of document.querySelectorAll('[data-i18n-placeholder]')) node.placeholder = t(node.dataset.i18nPlaceholder);
  for (const node of byId('radius').options) node.textContent = distance(Number(node.value));
  updateLocationLabel();
  byId('connection').textContent = t(configState);
  byId('map-status').textContent = mapState ? t(mapState) : '';
  byId('submit').querySelector('[data-i18n]').textContent = t(pending ? 'searching' : 'submit');
}

function showStatus(status, message = '') {
  const target = byId('result-status');
  target.replaceChildren();
  target.dataset.state = status;
  target.hidden = false;
  target.append(element('strong', t(`status_${status}`), 'status-title'));
  if (message) target.append(element('span', message));
}

function setPending(value) {
  pending = value;
  byId('submit').disabled = value;
  byId('submit').querySelector('[data-i18n]').textContent = t(value ? 'searching' : 'submit');
  byId('recommendations').setAttribute('aria-busy', String(value));
}

function clearResults({ changed = false } = {}) {
  const hadResults = result !== null || pending;
  result = null;
  requestSequence += 1;
  requestController?.abort();
  requestController = null;
  setPending(false);
  byId('recommendations').replaceChildren();
  byId('context').replaceChildren();
  byId('context').hidden = true;
  byId('alternatives-note').hidden = true;
  byId('warnings').replaceChildren();
  byId('warnings').hidden = true;
  byId('result-status').hidden = true;
  byId('empty-state').hidden = false;
  byId('form-error').hidden = true;
  if (changed && hadResults) {
    const target = byId('result-status');
    target.dataset.state = 'needs_clarification';
    target.replaceChildren(element('span', t('staleResults')));
    target.hidden = false;
  }
  updateMapMarkers();
}

function renderContext(context) {
  if (!context || typeof context !== 'object') return;
  const box = byId('context');
  box.replaceChildren(element('strong', t('usedContext')));
  const tags = [t('approximateLocation'), t('walking')];
  if (Number.isFinite(context.available_minutes)) tags.push(`${t('budget')}: ${minutes(context.available_minutes)}`);
  if (Number.isFinite(context.max_distance_m)) tags.push(`${t('maxDistance')}: ${distance(context.max_distance_m)}`);
  if (context.return_to_start) tags.push(t('returnIncluded'));
  if (context.buffer_minutes > 0) tags.push(`${t('bufferIncluded')}: ${minutes(context.buffer_minutes)}`);
  if (context.first_visit) tags.push(t('firstVisitContext'));
  if (context.require_open) tags.push(t('scheduleRequired'));
  if (context.events_only) tags.push(t('eventsRequired'));
  tags.push(...strings(context.categories).map(category));
  for (const key of ['required_amenities', 'preferred_amenities']) {
    const values = strings(context[key]);
    if (values.length) tags.push(`${t(key === 'required_amenities' ? 'required' : 'preferred')}: ${values.map(t).join(', ')}`);
  }
  const interests = strings(context.query_terms);
  if (interests.length) tags.push(`${t('interests')}: ${interests.join(', ')}`);
  const list = element('div', '', 'context-tags');
  for (const tag of tags) list.append(element('span', tag, 'context-tag'));
  box.append(list);
  box.hidden = false;
}

function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function sourceDetails(card) {
  const facts = card.source_facts ?? {};
  const details = element('details', '', 'source-details');
  details.append(element('summary', t('facts')));
  if (facts.description) {
    const description = element('p', string(facts.description));
    if (['ru', 'kk', 'en'].includes(facts.description_language)) description.lang = facts.description_language;
    details.append(description);
  }
  const meta = [];
  if (facts.description_language) meta.push(`${t('sourceLanguage')}: ${string(facts.description_language)}`);
  meta.push(`${t('collected')}: ${date(facts.collected_at)}`);
  details.append(element('p', meta.join(' · '), 'source-meta'));
  details.append(element('p', typeof facts.opening_hours === 'string' && facts.opening_hours ? `${t('hours')}: ${facts.opening_hours}` : t('hoursUnknown')));
  if (Array.isArray(facts.amenities) && facts.amenities.length) {
    const amenities = facts.amenities.filter((item) => item && typeof item.name === 'string').map((item) => `${t(item.name)}: ${t(item.value === true ? 'yes' : item.value === false ? 'no' : 'unknown')}`);
    if (amenities.length) details.append(element('p', `${t('amenities')}: ${amenities.join('; ')}.`));
  }
  if (facts.event && typeof facts.event === 'object') {
    const state = facts.event.status === 'scheduled' ? 'eventScheduled' : facts.event.status === 'cancelled' ? 'eventCancelled' : 'unknown';
    details.append(element('p', `${t('event')}: ${eventDate(facts.event.starts_at)} — ${eventDate(facts.event.ends_at)} (UTC+5); ${t(state)}.`));
  }
  const sources = element('ul', '', 'source-links');
  for (const source of Array.isArray(card.sources) ? card.sources : []) {
    if (!source || typeof source !== 'object') continue;
    const url = safeSourceUrl(source.url);
    if (!url) continue;
    const item = element('li');
    const link = element('a', string(source.attribution) || new URL(url).hostname);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    item.append(link, element('span', ` · ${t('collected')}: ${date(source.collected_at)}. ${source.source_updated_at ? `${t('sourceUpdated')}: ${date(source.source_updated_at)}` : t('updateUnknown')}`, 'source-meta'));
    sources.append(item);
  }
  details.append(sources);
  return details;
}

function renderCard(card, index, status) {
  const article = element('article', '', 'recommendation panel');
  const heading = element('div', '', 'card-top');
  const number = element('span', String(index + 1).padStart(2, '0'), 'card-number');
  number.setAttribute('aria-hidden', 'true');
  const titleArea = element('div');
  const title = element('h3', string(card.name));
  title.id = `place-${index}`;
  article.setAttribute('aria-labelledby', title.id);
  titleArea.append(title, element('p', strings(card.source_facts?.categories).map(category).join(' · '), 'category-line'));
  heading.append(number, titleArea);
  article.append(heading);
  const description = string(card.source_facts?.description);
  if (description) {
    const excerpt = element('p', description.length > 220 ? `${description.slice(0, 217)}…` : description, 'source-excerpt');
    if (['ru', 'kk', 'en'].includes(card.source_facts.description_language)) excerpt.lang = card.source_facts.description_language;
    article.append(element('p', t('facts'), 'card-section-label'), excerpt);
  }
  article.append(element('p', t('why'), 'card-section-label'));
  const why = element('ul', '', 'why-list');
  for (const reason of strings(card.why)) why.append(element('li', reason));
  article.append(why);
  const activity = element('div', '', 'activity-box');
  const generated = status === 'live_rag' && card.activity?.kind === 'generated_idea';
  activity.append(element('p', t(generated ? 'generatedIdea' : 'templateIdea'), 'card-section-label'), element('p', string(card.activity?.text)));
  article.append(activity);
  const estimates = card.estimates ?? {};
  const estimateGrid = element('div', '', 'estimate-grid');
  for (const [value, label] of [[distance(estimates.distance_m), 'distance'], [minutes(estimates.travel_minutes), 'outward'], [minutes(estimates.visit_minutes), 'visit']]) {
    const metric = element('div');
    metric.append(element('span', value, 'estimate-value'), element('span', t(label), 'estimate-label'));
    estimateGrid.append(metric);
  }
  const total = [`${t('total')}: ${minutes(estimates.total_minutes)}`];
  if (estimates.return_minutes > 0) total.push(`${t('returnTime')}: ${minutes(estimates.return_minutes)}`);
  if (estimates.buffer_minutes > 0) total.push(`${t('bufferIncluded')}: ${minutes(estimates.buffer_minutes)}`);
  article.append(estimateGrid, element('p', `${total.join(' · ')}. ${t('estimate')}. ${string(estimates.assumptions)}`, 'estimate-note'), sourceDetails(card));
  const caveats = strings(card.caveats);
  if (caveats.length) {
    const list = element('ul', '', 'caveats');
    for (const caveat of caveats) list.append(element('li', caveat));
    article.append(list);
  }
  return article;
}

function validResponse(value) {
  if (!value || !statuses.has(value.status) || !Array.isArray(value.recommendations) || value.recommendations.length > 3) return false;
  if (!['live_rag', 'retrieval_only', 'synthetic_test'].includes(value.status) && value.recommendations.length) return false;
  if (value.status === 'live_rag' && !value.recommendations.length) return false;
  return value.recommendations.every((card) => card && typeof card.name === 'string' && typeof card.poi_id === 'string' && Array.isArray(card.why) && card.activity && typeof card.activity.text === 'string' && card.source_facts && card.estimates && Array.isArray(card.sources) && card.sources.length > 0);
}

function renderResult(value) {
  result = value;
  byId('empty-state').hidden = true;
  showStatus(value.status, string(value.message));
  renderContext(value.context_used);
  byId('alternatives-note').hidden = value.recommendations.length === 0;
  const container = byId('recommendations');
  container.replaceChildren();
  container.lang = ['ru', 'kk', 'en'].includes(value.language) ? value.language : language;
  value.recommendations.forEach((card, index) => container.append(renderCard(card, index, value.status)));
  const warnings = strings(value.warnings);
  byId('warnings').replaceChildren(...warnings.map((warning) => element('li', warning)));
  byId('warnings').hidden = warnings.length === 0;
  updateMapMarkers();
  byId('result-status').focus({ preventScroll: true });
  byId('result-status').scrollIntoView({ behavior: 'auto', block: 'nearest' });
}

function readRequest() {
  const latitude = byId('latitude').valueAsNumber;
  const longitude = byId('longitude').valueAsNumber;
  const available = byId('minutes').valueAsNumber;
  const buffer = byId('buffer').valueAsNumber;
  const query = byId('query').value.trim();
  if (!query || query.length > 1000 || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || !Number.isInteger(available) || available < 5 || available > 480) throw new Error(t('invalidInput'));
  if (!Number.isInteger(buffer) || buffer < 0 || buffer >= available) throw new Error(t('bufferInvalid'));
  byId('latitude').value = roundCoordinate(latitude).toFixed(3);
  byId('longitude').value = roundCoordinate(longitude).toFixed(3);
  return {
    latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude), query,
    available_minutes: available, language, travel_mode: 'walking',
    categories: scenario === 'coffee' ? ['cafe'] : scenario === 'discover' ? ['park', 'museum', 'landmark'] : [],
    required_amenities: [...form.querySelectorAll('[name="required_amenities"]:checked')].map((node) => node.value),
    preferred_amenities: [], max_distance_m: Number(byId('radius').value),
    return_to_start: byId('return').checked, buffer_minutes: buffer,
    require_open: byId('require-open').checked, events_only: byId('events-only').checked,
    first_visit: byId('first-visit').checked,
  };
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  let body;
  try { body = readRequest(); } catch (error) {
    byId('form-error').textContent = error.message;
    byId('form-error').hidden = false;
    return;
  }
  clearResults();
  const sequence = ++requestSequence;
  const controller = new AbortController();
  requestController = controller;
  const timeout = setTimeout(() => controller.abort(), 65000);
  setPending(true);
  byId('empty-state').hidden = true;
  byId('result-status').replaceChildren(element('span', t('searching'), 'loading'));
  byId('result-status').dataset.state = 'loading';
  byId('result-status').hidden = false;
  try {
    const response = await fetch('/api/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), signal: controller.signal, cache: 'no-store', credentials: 'omit' });
    const value = await response.json();
    if (sequence !== requestSequence) return;
    if (!validResponse(value) || (!response.ok && value.status !== 'error')) {
      showStatus('error', t('malformedResponse'));
      return;
    }
    renderResult(value);
  } catch {
    if (sequence === requestSequence) showStatus('error', t('networkError'));
  } finally {
    clearTimeout(timeout);
    if (sequence === requestSequence) {
      requestController = null;
      setPending(false);
    }
  }
});

form.addEventListener('input', (event) => {
  if (event.target.id === 'latitude' || event.target.id === 'longitude') {
    locationMode = 'manual';
    updateLocationLabel();
    byId('location-status').textContent = '';
  }
  clearResults({ changed: true });
});

for (const button of document.querySelectorAll('[data-scenario]')) {
  button.setAttribute('aria-pressed', String(button.dataset.scenario === scenario));
  button.addEventListener('click', () => {
    scenario = button.dataset.scenario;
    for (const other of document.querySelectorAll('[data-scenario]')) {
      other.classList.toggle('active', other === button);
      other.setAttribute('aria-pressed', String(other === button));
    }
    byId('query').value = t(`sample_${scenario}`);
    byId('first-visit').checked = scenario === 'discover';
    byId('minutes').value = scenario === 'discover' ? '90' : scenario === 'coffee' ? '45' : '60';
    clearResults({ changed: true });
  });
}

byId('language').addEventListener('change', () => {
  const previousSample = t(`sample_${scenario}`);
  language = byId('language').value;
  if (byId('query').value === previousSample) byId('query').value = t(`sample_${scenario}`);
  translatePage();
  clearResults({ changed: true });
  byId('location-status').textContent = '';
  if (map) map.setLanguage(language);
});

byId('locate').addEventListener('click', () => {
  if (!navigator.geolocation) {
    byId('location-status').textContent = t('locationUnavailable');
    return;
  }
  byId('locate').disabled = true;
  byId('location-status').textContent = t('locating');
  navigator.geolocation.getCurrentPosition((position) => {
    byId('latitude').value = roundCoordinate(position.coords.latitude).toFixed(3);
    byId('longitude').value = roundCoordinate(position.coords.longitude).toFixed(3);
    locationMode = 'device';
    clearResults({ changed: true });
    updateLocationLabel();
    byId('location-status').textContent = t('locationReady');
    byId('locate').disabled = false;
  }, () => {
    byId('location-status').textContent = t('locationUnavailable');
    byId('locate').disabled = false;
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
});

async function loadConfig() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('/api/config', { cache: 'no-store', credentials: 'omit', signal: controller.signal });
    if (!response.ok) throw new Error('Config unavailable');
    const value = await response.json();
    if (typeof value.generation_configured !== 'boolean' || typeof value.retrieval_configured !== 'boolean') throw new Error('Config invalid');
    config = value;
    configState = !config.retrieval_configured ? 'configMissingData' : !config.generation_configured ? 'configMissingAI' : 'configReady';
  } catch { configState = 'configError'; } finally {
    clearTimeout(timeout);
    byId('connection').textContent = t(configState);
  }
}

function mapStatus(key) {
  mapState = key;
  byId('map-status').textContent = t(key);
}

function mapCoordinates() {
  const latitude = byId('latitude').valueAsNumber;
  const longitude = byId('longitude').valueAsNumber;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [71.4, 51.1];
  return [roundCoordinate(longitude), roundCoordinate(latitude)];
}

function updateMapMarkers() {
  if (!map || !globalThis.mapgl) return;
  try {
    for (const marker of markers) marker.destroy();
    markers = [];
    const start = mapCoordinates();
    markers.push(new globalThis.mapgl.Marker(map, { coordinates: start }));
    for (const card of result?.recommendations ?? []) {
      if (Number.isFinite(card.latitude) && Number.isFinite(card.longitude)) markers.push(new globalThis.mapgl.Marker(map, { coordinates: [card.longitude, card.latitude] }));
    }
    map.setCenter(start);
  } catch { mapStatus('mapError'); }
}

function loadMapScript() {
  if (globalThis.mapgl) return Promise.resolve();
  if (mapScriptPromise) return mapScriptPromise;
  mapScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => fail(), 12000);
    function fail() {
      clearTimeout(timeout);
      script.remove();
      mapScriptPromise = null;
      reject(new Error('Map library unavailable'));
    }
    script.src = 'https://mapgl.2gis.com/api/js/v1';
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.addEventListener('load', () => {
      clearTimeout(timeout);
      if (globalThis.mapgl) resolve(); else fail();
    }, { once: true });
    script.addEventListener('error', fail, { once: true });
    document.head.append(script);
  });
  return mapScriptPromise;
}

byId('enable-map').addEventListener('click', async () => {
  if (mapLoading) return;
  mapLoading = true;
  byId('enable-map').disabled = true;
  mapStatus('mapLoading');
  try {
    if (!config) await loadConfig();
    if (!config || typeof config.map_public_key !== 'string' || !config.map_public_key.trim()) {
      mapStatus('mapMissing');
      return;
    }
    await loadMapScript();
    if (map) {
      map.destroy();
      map = null;
      markers = [];
    }
    byId('map').hidden = false;
    map = new globalThis.mapgl.Map('map', { key: config.map_public_key, center: mapCoordinates(), zoom: 14, lang: language });
    const currentMap = map;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Map loading timeout')), 15000);
      currentMap.on('styleload', () => { clearTimeout(timeout); resolve(); });
      currentMap.on('error', () => {
        clearTimeout(timeout);
        mapStatus('mapError');
        byId('enable-map').hidden = false;
        reject(new Error('Map loading failed'));
      });
    });
    updateMapMarkers();
    mapStatus('mapReady');
    byId('enable-map').hidden = true;
  } catch {
    mapStatus('mapError');
    if (map) map.destroy();
    map = null;
    markers = [];
    byId('map').hidden = true;
  } finally {
    mapLoading = false;
    byId('enable-map').disabled = false;
  }
});

translatePage();
byId('query').value = t('sample_walk');
await loadConfig();
