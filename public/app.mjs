import { translate } from './i18n.mjs';
import { createReviewUI } from './generation-review.mjs';
import { createOSMController } from './osm-map.mjs';
import { createControlLock } from './control-lock.mjs';
import { createRouteSelection } from './route-selection.mjs';
import { interpretSearch } from './search-intent.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('walk-form');
const lockControls = createControlLock(() => [...form.querySelectorAll('input, select, textarea, [data-scenario]'), byId('language')]);
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
let osmEnabled = false;
let pickingStart = false;
let currentRouteState = null;
const osm = createOSMController({ container: byId('map'), onStatus: mapStatus, onPick: selectMapStart,
  onSelect: id => selectPlace(id), canPick: () => pickingStart && !pending && !review.isSending() });
const statuses = new Set(['live_rag', 'retrieval_only', 'no_match', 'needs_clarification', 'error', 'synthetic_test', 'synthetic_provider_test', 'offline_evaluation']);
const isOffline = () => config?.mode === 'offline';
const usesSavedPlaces = () => ['offline', 'bounded'].includes(config?.mode);
// Availability must not silently change the user's configured AI search path.
const usesAI = () => config?.mode === 'bounded' && config?.generation_configured === true;
const usesIntent = () => usesAI() && config?.interpretation_configured === true;
const t = (key) => translate(language, key);
const string = (value) => typeof value === 'string' ? value : '';
const strings = (value) => Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
const roundCoordinate = (value) => Math.round(value * 1000) / 1000;
const review = createReviewUI({ byId, t, getConfig: () => config, readRequest, renderResult, validResponse, isSearchPending: () => pending });
const routes = createRouteSelection({ getToken: () => config?.preview_token, onChange: renderRouteState,
  draw: geometry => osm.setRoute(geometry), clear: () => osm.clearRoute() });

function renderRouteState(state) {
  currentRouteState = state;
  byId('route-panel').hidden = !state;
  byId('retry-route').hidden = state?.state !== 'error';
  document.querySelector('.route-disclaimer').hidden = state?.state !== 'ready';
  osm.select(state?.card.poi_id ?? null);
  for (const card of byId('recommendations').querySelectorAll('[data-poi-id]')) {
    const selected = card.dataset.poiId === state?.card.poi_id;
    card.classList.toggle('selected', selected);
    for (const button of card.querySelectorAll('[aria-pressed]')) button.setAttribute('aria-pressed', String(selected));
  }
  if (!state) return;
  byId('route-title').textContent = state.card.name;
  byId('route-status').textContent = state.state === 'loading' ? t('routeLoading')
    : state.state === 'error' ? t(state.code === 'ROUTE_BUSY' ? 'routeBusy' : state.code === 'ROUTE_TOO_CLOSE' ? 'routeTooClose' : 'routeFailed')
    : `${distance(state.route.distance_m)} · ${minutes(state.route.duration_minutes)} ${t('walking').toLowerCase()} · ${t('total')}: ${minutes(state.total)}${state.overBudget ? ` — ${t('routeOverBudget')}` : ''}`;
  if (state.state === 'loading' && window.matchMedia('(max-width: 800px)').matches) {
    document.querySelector('.map-panel').scrollIntoView({ behavior: 'auto', block: 'start' });
  }
}
async function selectPlace(id) {
  if (pending || config?.mode !== 'bounded') return;
  const card = result?.recommendations.find(c => c.poi_id === id);
  if (!card) return;
  pickingStart = false; document.querySelector('.map-panel').classList.remove('picking');
  await enableOSM();
  if (!osmEnabled || !result?.recommendations.includes(card)) return;
  await routes.select(card, mapCoordinates(), result.context_used);
}
byId('clear-route').addEventListener('click', () => {
  const id = currentRouteState?.card.poi_id;
  routes.reset();
  const card = [...byId('recommendations').querySelectorAll('[data-poi-id]')].find(node => node.dataset.poiId === id);
  card?.querySelector('.route-select')?.focus();
});
byId('retry-route').addEventListener('click', () => {
  if (currentRouteState?.state === 'error') {
    byId('route-status').focus({ preventScroll: true });
    selectPlace(currentRouteState.card.poi_id);
  }
});
byId('retry-connection').addEventListener('click', async () => {
  await loadConfig();
  if (configState !== 'configError') byId('query').focus();
});

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
  hint.textContent = t(locationMode === 'simulated' ? usesSavedPlaces() && byId('offline-start-point').value ? 'namedStartHint' : 'locationHint' : locationMode === 'device' ? 'deviceHint' : locationMode === 'mapPicked' ? 'mapPickedHint' : 'manualHint');
  byId('offline-start-point').options[0].textContent = t(locationMode === 'mapPicked' ? 'mapPicked' : 'offlineDefault');
}

function translatePage() {
  document.documentElement.lang = language;
  document.title = `Qadam — ${t('city')}`;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const node of document.querySelectorAll('[data-i18n-placeholder]')) node.placeholder = t(node.dataset.i18nPlaceholder);
  document.querySelector('.discovery-sidebar').setAttribute('aria-label', t('searchRegion'));
  byId('retry-connection').hidden = configState !== 'configError';
  updateInputContext();
  for (const node of byId('radius').options) node.textContent = distance(Number(node.value));
  updateLocationLabel();
  byId('connection').textContent = t(configState);
  byId('map-status').textContent = mapState ? t(mapState) : '';
  byId('submit').querySelector('[data-i18n]').textContent = t(pending ? 'searching' : usesAI() ? 'aiSubmit' : usesSavedPlaces() ? 'localSubmit' : 'submit');
  byId('submit').disabled = pending || !config;
  byId('locate').disabled = !config || usesSavedPlaces();
  byId('locate').hidden = usesSavedPlaces();
  byId('enable-map').disabled = !config || isOffline() || mapLoading;
  byId('enable-map').hidden = isOffline();
  byId('query').required = !usesSavedPlaces();
  byId('offline-start').hidden = !usesSavedPlaces();
  byId('pick-start-map').hidden = config?.mode !== 'bounded';
  byId('pick-start-map').disabled = pending || mapLoading;
  byId('map-pick-controls').hidden = config?.mode !== 'bounded' || !osmEnabled;
  byId('map-pick-controls').hidden ||= !pickingStart;
  byId('map-placeholder').hidden = osmEnabled;
  document.querySelector('[data-i18n="routePrivacy"]').hidden = config?.mode !== 'bounded';
  byId('clear-route').setAttribute('aria-label', t('closeRoute'));
  byId('use-map-center').disabled = pending;
  byId('first-visit-hint').hidden = !usesSavedPlaces() || !byId('first-visit').checked;
  byId('first-visit-hint').textContent = t(config?.mode === 'bounded' ? 'boundedFirstVisit' : 'offlineFirstVisit');
  document.querySelector('[data-i18n="emptyCopy"]').textContent = t(usesIntent() ? 'intentEmpty' : 'emptyCopy').replace('{action}', t(usesAI() ? 'aiSubmit' : usesSavedPlaces() ? 'localSubmit' : 'submit'));
  if (usesSavedPlaces()) {
    for (const [key, replacement] of Object.entries({ queryLabel: 'searchTitle', queryHint: 'offlineQueryHint',
      privacyBody: 'offlinePrivacy', privacySummary: 'offlineSummary', mapPrivacy: 'offlineMap' })) {
      document.querySelector(`[data-i18n="${key}"]`).textContent = t(replacement);
    }
    byId('query').placeholder = t('mapQueryPlaceholder');
    document.querySelector('[data-i18n="queryHint"]').textContent = t('mapQueryHint');
  }
  if (config?.mode === 'bounded') {
    byId('map-title').textContent = t('city');
    byId('connection').textContent = configState === 'configError' ? t('configError') : t(`ai_${config.ai?.state ?? 'disabled'}`)
      + (config.ai?.state === 'ready' ? ` · ${t('aiRequestsLeft')}: ${config.ai.remaining}` : '');
    document.querySelector('[data-i18n="submitNote"]').textContent = t(usesAI() ? 'aiSubmitDisclosure' : 'submitNote');
    byId('map').setAttribute('aria-label', 'OpenStreetMap');
    byId('map-provider').textContent = 'OpenStreetMap';
    byId('enable-map').textContent = t(osmEnabled ? 'osmDisable' : 'osmEnable');
    document.querySelector('[data-i18n="privacyBody"]').textContent = t(config.generation_configured ? 'livePrivacy' : 'boundedPrivacy');
    document.querySelector('[data-i18n="privacySummary"]').textContent = t(config.generation_configured ? 'liveSummary' : 'boundedSummary');
    document.querySelector('[data-i18n="mapPrivacy"]').textContent = t('boundedMap');
    if (usesIntent()) {
      byId('query').placeholder = t('intentPlaceholder');
      document.querySelector('[data-i18n="queryHint"]').textContent = t('intentHint');
      document.querySelector('[data-i18n="submitNote"]').textContent = t('intentDisclosure');
      document.querySelector('[data-i18n="privacyBody"]').textContent = t('intentPrivacy');
      document.querySelector('[data-i18n="privacySummary"]').textContent = t('intentDisclosure');
    }
  }
  review.refresh();
}

function showStatus(status, message = '') {
  const target = byId('result-status');
  target.replaceChildren();
  target.dataset.state = status;
  target.hidden = false;
  target.append(element('strong', t(`status_${status}`), 'status-title'));
  if (message) target.append(element('span', message));
  if (status === 'error') { target.focus({ preventScroll: true }); target.scrollIntoView({ behavior: 'auto', block: 'nearest' }); }
}

function setPending(value) {
  pending = value;
  review.refresh();
  byId('submit').disabled = value || !config;
  byId('submit').querySelector('[data-i18n]').textContent = t(value ? 'searching' : usesAI() ? 'aiSubmit' : usesSavedPlaces() ? 'localSubmit' : 'submit');
  byId('recommendations').setAttribute('aria-busy', String(value));
  if (!value || usesAI()) lockControls(value);
  byId('pick-start-map').disabled = value || mapLoading;
  byId('use-map-center').disabled = value;
}

function clearResults({ changed = false } = {}) {
  document.querySelector('.discovery-sidebar').classList.remove('has-results', 'show-settings');
  routes.reset();
  review.clear();
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
  byId('understood-context').hidden = true;
  updateInputContext();
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
    if (usesSavedPlaces()) {
      sources.append(element('li', `${string(source.attribution)} · ID: ${string(source.source_id)}`),
        element('li', `${t('sourceVersion')}: ${string(source.source_version)}`, 'source-meta'));
      continue;
    }
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
  if (card.activity?.kind === 'generated_selection_template') details.append(element('p', t('templateExplanation'), 'source-meta'));
  if (card.estimates?.assumptions) details.append(element('p', card.estimates.assumptions, 'source-meta'));
  if (usesSavedPlaces()) {
    if (strings(facts.source_rubrics).length) details.append(element('p', `${t('sourceRubrics')}: ${facts.source_rubrics.join('; ')}`));
    if (strings(facts.source_categories).length) details.append(element('p', `${t('reviewCategories')}: ${facts.source_categories.join(', ')}`));
    if (facts.source_schedule_comment) details.append(element('p', `${t('scheduleComment')}: ${facts.source_schedule_comment}`));
    if (card.review) {
      details.append(element('p', t('offlineReview'), 'card-section-label'), element('p', string(card.review.reason)));
      for (const caveat of strings(card.review.caveats)) details.append(element('p', caveat));
      details.append(element('p', strings(card.uncertainty_codes).join(' · '), 'source-meta'));
    }
  }
  return details;
}

function renderCard(card, index, status) {
  const article = element('article', '', 'recommendation panel');
  const heading = element('div', '', 'card-top');
  const number = element('span', String(index + 1).padStart(2, '0'), 'card-number');
  number.setAttribute('aria-hidden', 'true');
  const titleArea = element('div');
  const title = element('h3', string(card.name));
  article.dataset.poiId = card.poi_id;
  if (config?.mode === 'bounded') {
    const select = element('button', string(card.name), 'place-select');
    select.type = 'button'; select.setAttribute('aria-pressed', 'false'); select.setAttribute('aria-controls', 'map');
    select.addEventListener('click', () => selectPlace(card.poi_id)); title.replaceChildren(select);
  }
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
  } else if (usesSavedPlaces()) article.append(element('p', t('descriptionMissing'), 'source-excerpt'));
  article.append(element('p', t('why'), 'card-section-label'));
  const why = element('ul', '', 'why-list');
  for (const reason of strings(card.why)) why.append(element('li', reason));
  article.append(why);
  const activity = element('div', '', 'activity-box');
  const generated = status === 'live_rag' && card.activity?.kind === 'generated_idea';
  activity.append(element('p', t(status === 'live_rag' && card.activity?.kind === 'generated_selection_template'
    ? 'selectedTemplate' : generated ? 'generatedIdea' : 'templateIdea'), 'card-section-label'), element('p', string(card.activity?.text)));
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
  article.append(estimateGrid, element('p', `${total.join(' · ')}. ${t('estimate')}.`, 'estimate-note'), sourceDetails(card));
  const caveats = strings(card.caveats);
  if (caveats.length) {
    const list = element('ul', '', 'caveats');
    for (const caveat of caveats) list.append(element('li', caveat));
    article.append(list);
  }
  if (config?.mode === 'bounded') {
    const route = element('button', `↗  ${t('walkingRoute')}`, 'route-select');
    route.type = 'button'; route.setAttribute('aria-pressed', 'false'); route.setAttribute('aria-controls', 'map');
    route.addEventListener('click', () => selectPlace(card.poi_id)); article.append(route);
  }
  return article;
}

function validResponse(value) {
  if (!value || !statuses.has(value.status) || !Array.isArray(value.recommendations) || value.recommendations.length > 3) return false;
  if (!['live_rag', 'retrieval_only', 'synthetic_test', 'synthetic_provider_test', 'offline_evaluation'].includes(value.status) && value.recommendations.length) return false;
  if (value.status === 'offline_evaluation' && (!usesSavedPlaces() || value.dataset?.demo_eligible !== false
    || value.dataset?.external_processing_allowed !== false)) return false;
  if (isOffline() && !['offline_evaluation', 'error', 'needs_clarification'].includes(value.status)) return false;
  if (config?.mode === 'bounded' && !['error','needs_clarification'].includes(value.status) && (value.dataset?.demo_eligible !== false
    || value.dataset?.external_processing_allowed !== false)) return false;
  if (value.status === 'synthetic_provider_test' && config?.mode !== 'bounded') return false;
  if (value.status === 'live_rag' && !value.recommendations.length) return false;
  return value.recommendations.every((card) => card && typeof card.name === 'string' && typeof card.poi_id === 'string' && Array.isArray(card.why) && card.activity && typeof card.activity.text === 'string' && card.source_facts && card.estimates && Array.isArray(card.sources) && card.sources.length > 0);
}

function renderResult(value) {
  routes.reset();
  result = value;
  if (value.understood) {
    const u = value.understood;
    const start = t(({ mega: 'offlineMega', bayterek: 'offlineBayterek', zhetysu: 'offlineZhetysu' })[u.start] ?? 'selectedStart');
    byId('understood-context').textContent = `${t('understood')}: ${start} · ${strings(u.categories).map(category).join(', ')} · ${minutes(u.available_minutes)}${u.time_from_text ? '' : ` (${t('settingsTime')})`}`;
    byId('understood-context').hidden = false;
  }
  document.querySelector('.discovery-sidebar').classList.toggle('has-results', value.recommendations.length > 0);
  byId('empty-state').hidden = true;
  showStatus(value.status, config?.mode === 'bounded' && value.status === 'offline_evaluation'
    ? t('boundedSavedResults') : string(value.message));
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
  byId(value.understood ? 'understood-context' : 'result-status').scrollIntoView({ behavior: 'auto', block: 'start' });
}

function readRequest() {
  const latitude = byId('latitude').valueAsNumber;
  const longitude = byId('longitude').valueAsNumber;
  let available = byId('minutes').valueAsNumber;
  const buffer = byId('buffer').valueAsNumber;
  const query = byId('query').value.trim();
  const intent = usesSavedPlaces() && !usesIntent() ? interpretSearch(query) : {};
  if (intent.clarification) throw new Error(t('searchClarify'));
  if (intent.scenario) {
    scenario = intent.scenario;
    for (const button of document.querySelectorAll('[data-scenario]')) {
      const active = button.dataset.scenario === scenario;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    }
  }
  if (intent.minutes) { available = intent.minutes; byId('minutes').value = String(available); }
  for (const control of form.querySelectorAll('[name="required_amenities"]')) if (intent.amenities?.includes(control.value)) control.checked = true;
  if (intent.open) byId('require-open').checked = true;
  if (intent.firstVisit) byId('first-visit').checked = true;
  if ((!query && !usesSavedPlaces()) || query.length > 1000 || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || !Number.isInteger(available) || available < 5 || available > 480) throw new Error(t('invalidInput'));
  if (!Number.isInteger(buffer) || buffer < 0 || buffer >= available) throw new Error(t('bufferInvalid'));
  byId('latitude').value = roundCoordinate(latitude).toFixed(3);
  byId('longitude').value = roundCoordinate(longitude).toFixed(3);
  return {
    latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude), query,
    available_minutes: available, language, travel_mode: 'walking',
    categories: intent.categories ?? (scenario === 'coffee' ? ['cafe'] : scenario === 'discover' ? ['park', 'museum', 'landmark'] : usesSavedPlaces() ? ['park', 'landmark'] : []),
    required_amenities: [...form.querySelectorAll('[name="required_amenities"]:checked')].map((node) => node.value),
    preferred_amenities: [], max_distance_m: Number(byId('radius').value),
    return_to_start: byId('return').checked, buffer_minutes: buffer,
    require_open: byId('require-open').checked, events_only: byId('events-only').checked,
    first_visit: byId('first-visit').checked,
  };
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (pending || review.isSending()) return;
  let body;
  try { body = readRequest(); } catch (error) {
    byId('form-error').textContent = error.message;
    byId('form-error').hidden = false;
    byId('form-error').focus();
    return;
  }
  clearResults();
  const sequence = ++requestSequence;
  const controller = new AbortController();
  requestController = controller;
  const timeout = setTimeout(() => controller.abort(), usesIntent() ? 145000 : 75000);
  setPending(true);
  byId('empty-state').hidden = true;
  byId('result-status').replaceChildren(element('span', t('searching'), 'loading'));
  byId('result-status').dataset.state = 'loading';
  byId('result-status').hidden = false;
  try {
    const response = await fetch(usesAI() ? '/api/recommend-ai' : '/api/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json',
      ...(usesAI() ? { 'X-Qadam-Preview': config.preview_token } : {}) }, body: JSON.stringify(body), signal: controller.signal, cache: 'no-store', credentials: 'omit' });
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
      if (config?.mode === 'bounded') await loadConfig();
      if (sequence === requestSequence) setPending(false);
    }
  }
});

form.addEventListener('invalid', event => {
  document.querySelector('.discovery-sidebar').classList.add('show-settings');
  for (let parent = event.target.parentElement; parent && parent !== form; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') parent.open = true;
  }
}, true);
form.addEventListener('input', (event) => {
  if (event.target.id === 'first-visit') byId('first-visit-hint').hidden = !usesSavedPlaces() || !event.target.checked;
  if (event.target.id === 'latitude' || event.target.id === 'longitude') {
    locationMode = 'manual';
    byId('offline-start-point').value = '';
    updateLocationLabel();
    byId('location-status').textContent = '';
  }
  clearResults({ changed: true });
});

for (const button of document.querySelectorAll('[data-scenario]')) {
  button.setAttribute('aria-pressed', String(button.dataset.scenario === scenario));
  button.addEventListener('click', () => {
    if (button.dataset.scenario === scenario) return;
    const previousDefault = scenario === 'discover' ? '90' : scenario === 'coffee' ? '45' : '60';
    const useDefaultTime = byId('minutes').value === previousDefault;
    scenario = button.dataset.scenario;
    for (const other of document.querySelectorAll('[data-scenario]')) {
      other.classList.toggle('active', other === button);
      other.setAttribute('aria-pressed', String(other === button));
    }
    if (!usesIntent()) byId('query').value = usesSavedPlaces() ? '' : t(`sample_${scenario}`);
    byId('first-visit').checked = scenario === 'discover';
    byId('first-visit-hint').hidden = !usesSavedPlaces() || scenario !== 'discover';
    if (useDefaultTime) byId('minutes').value = scenario === 'discover' ? '90' : scenario === 'coffee' ? '45' : '60';
    clearResults({ changed: true });
  });
}

byId('language').addEventListener('change', () => {
  const previousSample = t(`sample_${scenario}`);
  language = byId('language').value;
  if (!usesSavedPlaces() && byId('query').value === previousSample) byId('query').value = t(`sample_${scenario}`);
  translatePage();
  clearResults({ changed: true });
  byId('location-status').textContent = '';
  if (map) map.setLanguage(language);
});

byId('locate').addEventListener('click', () => {
  if (!config || usesSavedPlaces()) return;
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
  byId('retry-connection').disabled = true;
  const initial = !config;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('/api/config', { cache: 'no-store', credentials: 'omit', signal: controller.signal });
    if (!response.ok) throw new Error('Config unavailable');
    const value = await response.json();
    if (typeof value.generation_configured !== 'boolean' || typeof value.retrieval_configured !== 'boolean') throw new Error('Config invalid');
    const firstLoad = !config;
    config = value;
    if (firstLoad) {
      byId('manual-location').open = !usesSavedPlaces();
      if (usesSavedPlaces()) {
        byId('offline-start-point').value = '51.089,71.405';
        byId('latitude').value = '51.089'; byId('longitude').value = '71.405';
      }
    }
    configState = !config.retrieval_configured ? 'configMissingData' : config.mode === 'bounded' ? 'configBounded' : usesSavedPlaces() ? 'configOffline' : !config.generation_configured ? 'configMissingAI' : 'configReady';
    if (usesSavedPlaces() && byId('query').value === t(`sample_${scenario}`)) byId('query').value = '';
  } catch { configState = 'configError'; } finally {
    clearTimeout(timeout);
    byId('retry-connection').disabled = false;
    translatePage();
  }
  if (initial && config?.mode === 'bounded') await enableOSM();
}

function mapStatus(key) {
  mapState = key;
  byId('map-status').textContent = t(key);
}

function selectMapStart([longitude, latitude]) {
  if (pending) return;
  byId('latitude').value = latitude.toFixed(3);
  byId('longitude').value = longitude.toFixed(3);
  byId('offline-start-point').value = '';
  locationMode = 'mapPicked';
  pickingStart = false; document.querySelector('.map-panel').classList.remove('picking');
  clearResults({ changed: true });
  updateLocationLabel();
  byId('location-status').textContent = `${t('mapPicked')}: ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
  mapStatus('mapStartSelected');
  translatePage();
  byId('query').focus({ preventScroll: true });
}

async function enableOSM() {
  if (mapLoading || osmEnabled) return;
  mapLoading = true; translatePage();
  try { osmEnabled = await osm.enable(mapCoordinates(), result?.recommendations ?? []); }
  catch { osm.disable(); mapStatus('osmError'); }
  finally { mapLoading = false; translatePage(); }
}

byId('pick-start-map').addEventListener('click', async () => {
  if (pending || config?.mode !== 'bounded') return;
  await enableOSM();
  if (!osmEnabled) return;
  pickingStart = true; document.querySelector('.map-panel').classList.add('picking'); mapStatus('mapPickHelp'); translatePage();
  const target = byId(osmEnabled ? 'map' : 'map-status');
  target.scrollIntoView({ behavior: 'auto', block: 'center' }); target.focus({ preventScroll: true });
});
byId('use-map-center').addEventListener('click', () => { if (!pending) osm.pickCenter(); });
byId('search-settings').addEventListener('toggle', () => {
  document.querySelector('.discovery-sidebar').classList.toggle('show-settings', byId('search-settings').open);
});
byId('back-to-search').addEventListener('click', () => {
  pickingStart = false; document.querySelector('.map-panel').classList.remove('picking'); translatePage();
  byId('submit').scrollIntoView({ behavior: 'auto', block: 'center' }); byId('submit').focus({ preventScroll: true });
});

function mapCoordinates() {
  if (result?.understood && Number.isFinite(result.understood.latitude) && Number.isFinite(result.understood.longitude)) {
    return [roundCoordinate(result.understood.longitude), roundCoordinate(result.understood.latitude)];
  }
  const latitude = byId('latitude').valueAsNumber;
  const longitude = byId('longitude').valueAsNumber;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [71.4, 51.1];
  return [roundCoordinate(longitude), roundCoordinate(latitude)];
}

function updateInputContext() {
  const preset = byId('offline-start-point');
  const name = preset.value ? preset.selectedOptions[0].textContent : t('selectedStart');
  byId('input-context').textContent = `${t('unlessSpecified')}: ${name} · ${minutes(byId('minutes').valueAsNumber)}`;
}

function updateMapMarkers() {
  if (config?.mode === 'bounded') { osm.update(mapCoordinates(), result?.recommendations ?? []); return; }
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
  if (!config || usesSavedPlaces()) return Promise.reject(new Error('Map disabled'));
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
  if (config?.mode === 'bounded') {
    if (mapLoading) return;
    if (osmEnabled) { routes.reset(); osm.disable(); osmEnabled = false; pickingStart = false; mapState = ''; translatePage(); return; }
    await enableOSM();
    return;
  }
  if (!config || usesSavedPlaces()) return;
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

byId('offline-start-point').addEventListener('change', () => {
  if (!usesSavedPlaces()) return;
  if (!byId('offline-start-point').value) { byId('manual-location').open = true; return; }
  const point = byId('offline-start-point').value.split(',').map(Number);
  if (point.length !== 2 || !point.every(Number.isFinite)) return;
  byId('latitude').value = point[0].toFixed(3);
  byId('longitude').value = point[1].toFixed(3);
  locationMode = 'simulated';
  updateLocationLabel();
  clearResults({ changed: true });
});

translatePage();
byId('query').value = t('sample_walk');
await loadConfig();
