// Preview data is transient DOM/memory only. This module never contacts a provider.
export function createReviewUI({ byId, t, getConfig, readRequest, renderResult, validResponse, isSearchPending = () => false, fetchImpl = fetch }) {
  let token = null, sequence = 0, loading = false, confirming = false, controller = null, expiry;
  const notice = text => { byId('generation-notice').textContent = text; };
  const refresh = () => {
    byId('generation-review').hidden = getConfig()?.mode !== 'bounded' || getConfig()?.generation_configured === true;
    byId('preview-generation').disabled = isSearchPending() || loading || confirming || !getConfig();
    byId('confirm-generation').disabled = isSearchPending() || !token || confirming || !byId('generation-consent').checked;
  };
  function clear() {
    sequence++; token = null; loading = false; clearTimeout(expiry);
    controller?.abort(); controller = null;
    byId('generation-consent').checked = false;
    byId('generation-payload').textContent = '';
    byId('generation-payload-details').hidden = true;
    notice(confirming ? t('generationMayCount') : ''); refresh();
  }
  const post = (route, body, signal) => fetchImpl(route, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Qadam-Preview': getConfig().preview_token },
    body: JSON.stringify(body), signal, cache: 'no-store', credentials: 'omit' });
  byId('generation-consent').addEventListener('change', refresh);
  byId('preview-generation').addEventListener('click', async () => {
    if (getConfig()?.mode !== 'bounded' || isSearchPending() || loading || confirming) return;
    clear(); const version = sequence;
    let request;
    try { request = readRequest(); } catch { notice(t('invalidInput')); return; }
    loading = true; refresh(); notice(t('previewLoading'));
    const abort = new AbortController(); controller = abort;
    const timeout = setTimeout(() => abort.abort(), 15000);
    try {
      const response = await post('/api/generation/preview', request, abort.signal);
      const value = await response.json();
      if (version !== sequence) return;
      if (!response.ok || value.status !== 'generation_preview') {
        notice(t(value.status === 'no_match' ? 'previewEmpty' : 'previewFailed')); return;
      }
      if (!value.packet || value.packet.contract !== 'qadam-openai-evidence-v1' || typeof value.ready !== 'boolean') throw new Error('INVALID_PREVIEW');
      byId('generation-payload').textContent = value.request_body ?? JSON.stringify(value.packet, null, 2);
      byId('generation-payload-details').hidden = false;
      if (value.ready && typeof value.preview_id === 'string' && typeof value.request_body === 'string'
        && Number.isFinite(Date.parse(value.expires_at)) && Date.parse(value.expires_at) > Date.now()) {
        token = value.preview_id;
        notice(t('previewReady'));
        expiry = setTimeout(() => { token = null; notice(t('previewExpired')); refresh(); }, Math.min(120000, Date.parse(value.expires_at) - Date.now()));
      } else notice(t('previewDisabled'));
    } catch { if (version === sequence) notice(t('previewFailed')); }
    finally { clearTimeout(timeout); if (version === sequence) { loading = false; controller = null; refresh(); } }
  });
  byId('confirm-generation').addEventListener('click', async () => {
    if (!token || isSearchPending() || confirming || !byId('generation-consent').checked || getConfig()?.mode !== 'bounded') return;
    const preview_id = token, version = sequence;
    token = null; confirming = true; clearTimeout(expiry); refresh(); notice(t('generationSending'));
    // Allow the explicit reviewed 60-second provider deadline plus local work.
    const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 70000);
    try {
      const response = await post('/api/generation/confirm', { preview_id }, abort.signal);
      const value = await response.json();
      if (version !== sequence) return;
      if (!validResponse(value) || (!response.ok && value.status !== 'error')) throw new Error('INVALID_RESULT');
      renderResult(value);
      notice(t(value.generation?.dispatch_attempts ? 'generationCounted' : 'generationBlocked'));
    } catch { if (version === sequence) notice(t('generationMayCount')); }
    finally { clearTimeout(timeout); confirming = false; refresh(); }
  });
  return { clear, refresh, isSending: () => confirming };
}
