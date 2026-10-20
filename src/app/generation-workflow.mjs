// Local, memory-only preview. No token can initialize a budget or enable a provider.
import { randomUUID } from 'node:crypto';
import { cloneBounded } from './generation-evidence.mjs';
import { createBoundedGenerationService } from './bounded-generation.mjs';
import { errorResult } from './presentation.mjs';

export const PREVIEW_TTL_MS = 120000;
export function createGenerationWorkflow(options) {
  const service = createBoundedGenerationService(options);
  const now = options.now ?? (() => new Date().toISOString());
  let current = null, revision = 0;
  const clear = () => { if (current) clearTimeout(current.timer); current = null; };
  return {
    invalidate() { revision++; clear(); },
    async recommend(input) { revision++; clear(); return service(input); },
    async preview(input) {
      const version = ++revision;
      clear(); // Only one preview is retained, across all tabs.
      const prepared = await service.prepareForReview(input);
      if (version !== revision) return errorResult('INVALID_INPUT');
      if (!prepared.display) return prepared;
      const display = cloneBounded(prepared.display, 128 * 1024);
      display.preview_id = null; display.expires_at = null;
      if (prepared.execute) {
        const token = randomUUID(), expires = Date.parse(now()) + PREVIEW_TTL_MS;
        const timer = setTimeout(clear, PREVIEW_TTL_MS); timer.unref();
        current = { token, expires, execute: prepared.execute, timer };
        display.preview_id = token; display.expires_at = new Date(expires).toISOString();
      }
      return display;
    },
    async generate(body) {
      if (!body || typeof body !== 'object' || Object.keys(body).join(',') !== 'preview_id'
        || typeof body.preview_id !== 'string' || !current || body.preview_id !== current.token
        || Date.parse(now()) >= current.expires) return errorResult('INVALID_INPUT');
      const execute = current.execute;
      revision++; clear(); // Consume synchronously before any await: no replay or double dispatch.
      return execute();
    },
  };
}
