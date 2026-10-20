import { createHash } from 'node:crypto';
import { AppError, validInstant } from '../shared/policy.mjs';
import { cloneBounded } from './generation-evidence.mjs';

// Historical manifests retain their own smaller caps; this never replenishes them.
export const MAX_ATTEMPTS = 100;
export const MAX_OUTPUT_TOKENS = 1800;
export const MAX_TIMEOUT_MS = 60000;
const deny = () => { throw new AppError('PROCESSING_NOT_AUTHORIZED'); };
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const hex = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const text = (v, max) => typeof v === 'string' && v.trim() && v.length <= max && !/[\u0000-\u001f]/u.test(v);
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;

// This validates a recorded operator decision, not the truth of source-use rights.
export function checkGenerationAuthorization(value, expected, model, now) {
  let a;
  try { a = cloneBounded(value, 64 * 1024); } catch { deny(); }
  if (!exact(a, ['schema_version', 'provider', 'purpose', 'model', 'expected', 'records', 'fields', 'expires_at', 'decision', 'limits'])
    || a.schema_version !== 1 || a.provider !== 'openai' || a.purpose !== 'walking_recommendations'
    || !text(a.model, 100) || a.model !== model || !validInstant(now) || !validInstant(a.expires_at)
    || Date.parse(a.expires_at) <= Date.parse(now)
    || !exact(a.expected, ['dataset_kind', 'snapshot_id', 'review_id', 'binding_id', 'policy_id'])
    || !['collected', 'synthetic'].includes(a.expected.dataset_kind)
    || Object.keys(a.expected).some(k => a.expected[k] !== expected?.[k])
    || ['snapshot_id', 'review_id', 'binding_id', 'policy_id'].some(k => !hex(a.expected[k]))
    || !exact(a.decision, ['operator_approved', 'source_use_basis']) || a.decision.operator_approved !== true
    || !text(a.decision.source_use_basis, 1000)
    || !Array.isArray(a.records) || !a.records.length || a.records.length > 100
    || !Array.isArray(a.fields) || a.fields.length < 3 || a.fields.length > 4
    || new Set(a.fields).size !== a.fields.length
    || a.fields.some(k => !['name', 'categories', 'estimates', 'description'].includes(k))
    || ['name', 'categories', 'estimates'].some(k => !a.fields.includes(k))
    || !exact(a.limits, ['max_attempts', 'max_output_tokens', 'timeout_ms'])) deny();
  const prefix = a.expected.dataset_kind === 'collected' ? '2gis:' : 'synthetic:';
  const seen = new Set();
  for (const r of a.records) {
    if (!exact(r, ['id', 'source_version']) || !text(r.id, 522) || !r.id.startsWith(prefix)
      || r.id.length <= prefix.length || !hex(r.source_version) || seen.has(r.id)) deny();
    seen.add(r.id);
  }
  const l = a.limits;
  if (!Number.isInteger(l.max_attempts) || l.max_attempts < 1 || l.max_attempts > MAX_ATTEMPTS
    || !Number.isInteger(l.max_output_tokens) || l.max_output_tokens < 128 || l.max_output_tokens > MAX_OUTPUT_TOKENS
    || !Number.isInteger(l.timeout_ms) || l.timeout_ms < 10 || l.timeout_ms > MAX_TIMEOUT_MS) deny();
  const authorization_hash = createHash('sha256').update(JSON.stringify(canonical(a))).digest('hex');
  return { authorization: a, budget: { schema_version: 1, authorization_hash, ...l } };
}

export function authorizedPacket(session, envelope, authorization) {
  const selected = envelope.result.candidates.slice(0, 5);
  if (selected.some(c => !authorization.records.some(r => r.id === c.poi.id && r.source_version === c.poi.source_version))) deny();
  return projectOpenAIEvidence(session, authorization.fields.includes('description'));
}

export function projectOpenAIEvidence(session, descriptions = false) {
  // A separate outgoing contract. Never change the historical mock packet/flags.
  return cloneBounded({ contract: 'qadam-openai-evidence-v1',
    context: session.packet.context,
    candidates: session.packet.candidates.map(c => ({ alias: c.alias, name: c.name,
      description: descriptions ? c.description : null, description_language: descriptions ? c.description_language : null,
      categories: c.categories, fine_categories: c.fine_categories, category_kind: c.category_kind,
      estimates: c.estimates, unknowns: c.unknowns,
      evidence: c.evidence.filter(e => descriptions || e.field !== 'description'),
      allowed_reason_codes: c.allowed_reason_codes.filter(r => descriptions || r !== 'first_visit'),
      allowed_activity_codes: c.allowed_activity_codes })) }, 24 * 1024);
}

export function validateAuthorizedSelection(output, packet) {
  // The session validator checks exact shape and all source/evidence semantics.
  // This additional check restricts it to the fields actually disclosed.
  for (const r of output.recommendations) {
    const c = packet.candidates.find(c => c.alias === r.candidate_alias);
    if (!c || r.evidence_refs.some(ref => !c.evidence.some(e => e.ref === ref))
      || r.reason_codes.some(code => !c.allowed_reason_codes.includes(code))) throw new AppError('INVALID_MODEL_OUTPUT');
  }
}
