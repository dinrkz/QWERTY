// Current-search memory only. Selection never invokes the AI endpoint.
export function createRouteSelection({ fetchImpl = fetch, getToken, onChange, draw, clear }) {
  let revision = 0, controller = null, cache = new Map(), selected = null;
  const reset = () => { revision++; controller?.abort(); controller = null; selected = null; cache.clear(); clear(); onChange(null); };
  const select = async (card, start, context) => {
    if (selected === card.poi_id) return;
    controller?.abort(); const version = ++revision; selected = card.poi_id; clear();
    const end = [card.longitude, card.latitude].map(n => Math.round(n * 1000) / 1000);
    const key = JSON.stringify([start, end]);
    onChange({ state: 'loading', card });
    const abort = new AbortController(); controller = abort;
    const timeout = setTimeout(() => abort.abort(), 15000);
    try {
      let value = cache.get(key);
      if (!value) {
        const response = await fetchImpl('/api/route', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Qadam-Preview': getToken() },
          body: JSON.stringify({ start, end }), signal: abort.signal, credentials: 'omit', cache: 'no-store' });
        value = await response.json(); if (!response.ok || value.status !== 'ok') throw new Error(value.code ?? 'ROUTE_UNAVAILABLE');
      }
      if (version !== revision) return;
      if (!Array.isArray(value.geometry) || value.geometry.length < 2 || !Number.isFinite(value.distance_m)
        || !Number.isFinite(value.duration_minutes)) throw new Error('ROUTE_UNAVAILABLE');
      cache.set(key, value); draw(value.geometry);
      const total = value.duration_minutes * (context.return_to_start ? 2 : 1) + card.estimates.visit_minutes + (context.buffer_minutes ?? 0);
      onChange({ state: 'ready', card, route: value, total, overBudget: total > context.available_minutes });
    } catch (error) {
      if (version === revision) { selected = null; onChange({ state: 'error', card, code: ['ROUTE_BUSY', 'ROUTE_TOO_CLOSE'].includes(error.message) ? error.message : 'ROUTE_UNAVAILABLE' }); }
    } finally { clearTimeout(timeout); if (version === revision) controller = null; }
  };
  return { select, reset };
}
