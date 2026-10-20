// Authored synthetic evidence and a fake HTTP responder. Never reads private data.
import { expected, input, envelope, normalized } from './private-envelope.mjs';
export { expected, input, envelope, normalized };
export const now = () => '2026-10-19T00:00:00Z';
export const model = 'synthetic-model';
export const key = 'synthetic-provider-key-not-a-secret';
export function authorization(changes = {}) {
  return { schema_version: 1, provider: 'openai', purpose: 'walking_recommendations', model,
    expected: { ...expected }, records: [{ id: 'synthetic:one', source_version: 'e'.repeat(64) }],
    fields: ['name', 'categories', 'estimates', 'description'], expires_at: '2026-10-20T00:00:00Z',
    decision: { operator_approved: true, source_use_basis: 'Authored synthetic fixture for offline tests only' },
    limits: { max_attempts: 3, max_output_tokens: 1800, timeout_ms: 1000 }, ...changes };
}
export function answer(packet) {
  const c = packet.candidates[0];
  return { recommendations: [{ candidate_alias: c.alias,
    evidence_refs: c.evidence.filter(e => ['name', 'categories', 'estimates'].includes(e.field)).map(e => e.ref),
    reason_codes: ['nearby', 'fits_time'], activity_code: c.allowed_activity_codes[0] }] };
}
export function response(value, usage = { input_tokens: 200, output_tokens: 50, total_tokens: 250 }) {
  return new Response(JSON.stringify({ status: 'completed', output: [
    { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }
  ], usage }));
}
export function fakeFetch(_url, options) {
  return response(answer(JSON.parse(JSON.parse(options.body).input[0].content)));
}
