// Deliberately unmounted local test flow. Never constructs an OpenAI adapter.
import { AppError } from '../shared/policy.mjs';
import { validateOfflineInput } from './offline.mjs';
import { errorResult } from './presentation.mjs';
import { cloneBounded, createEvidenceSession } from './generation-evidence.mjs';

// A deterministic test double, not an AI recommendation or relevance benchmark.
export function selectForLocalMock(packet) {
  return { recommendations: packet.candidates.slice(0, 3).map(c => ({ candidate_alias: c.alias,
    evidence_refs: c.evidence.filter(e => ['name', 'categories', 'estimates'].includes(e.field)).map(e => e.ref),
    reason_codes: ['nearby', 'fits_time'], activity_code: c.allowed_activity_codes[0] })) };
}

export function createMockGenerationService({ retrieve, expected, mock, now = () => new Date().toISOString(), timeoutMs = 1000 }) {
  // Injected callbacks are trusted test code, not a sandbox. Never hand collected
  // records to an arbitrary injected callable; those use only the built-in mock.
  const pins = cloneBounded(expected, 2048);
  if (typeof retrieve !== 'function' || !['synthetic', 'collected'].includes(pins?.dataset_kind)
    || (mock !== undefined && (pins.dataset_kind !== 'synthetic' || typeof mock !== 'function'))
    || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000) throw new AppError('DATA_INVALID');
  const generate = mock ?? selectForLocalMock;
  return async raw => {
    let input;
    try {
      input = validateOfflineInput(cloneBounded(raw, 16 * 1024));
      const timestamp = now();
      const retrievalRequest = { ...input, now: timestamp, query_terms: [], limit: 10 };
      const envelope = await retrieve(cloneBounded(retrievalRequest, 16 * 1024));
      const session = createEvidenceSession({ input, envelope, expected: pins, now: timestamp });
      if (!session.packet.candidates.length) return session.noMatch();
      let timer;
      try {
        const output = await Promise.race([
          Promise.resolve().then(() => generate(session.packet)),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new AppError('MOCK_TIMEOUT')), timeoutMs); }),
        ]);
        return session.complete(output);
      } catch (error) {
        return session.fallback(error instanceof AppError ? error.code : 'MOCK_FAILURE');
      } finally { clearTimeout(timer); }
    } catch (error) {
      return errorResult(error instanceof AppError ? error.code : 'DATA_INVALID', input?.language);
    }
  };
}
