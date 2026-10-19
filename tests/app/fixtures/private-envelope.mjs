// Entirely authored test data. No provider records or private snapshot IDs.
import { estimates } from '../../../src/shared/policy.mjs';
import { validateOfflineInput } from '../../../src/app/offline.mjs';

export const expected = { dataset_kind: 'synthetic', snapshot_id: 'a'.repeat(64), review_id: 'b'.repeat(64),
  binding_id: 'c'.repeat(64), policy_id: 'd'.repeat(64) };
export const input = (changes = {}) => ({ latitude: 51.1, longitude: 71.4, query: '', available_minutes: 60, language: 'en', ...changes });
export const normalized = (changes = {}) => ({ ...validateOfflineInput(input(changes)), now: '2026-10-19T00:00:00Z', query_terms: [], limit: 10 });

export function envelope(request = normalized()) {
  const version = 'e'.repeat(64), collected = '2026-10-18T00:00:00Z';
  const p = { id: 'synthetic:one', source_id: 'one', name: 'Synthetic coffee stop <not markup>',
    latitude: 51.101, longitude: 71.4, categories: ['cafe'], source_categories: ['coffeehouse'],
    source_rubrics: [{ id: '162', name: 'Synthetic rubric' }], source_schedule_comment: null,
    description: null, description_kind: null, description_language: null,
    source_url: null, reuse_terms: null, source_updated_at: null, collected_at: collected,
    attribution: 'Synthetic test fixture', source_version: version, demo_eligible: false, tags: [],
    evidence: [{ id: `source:${version}`, source_version: version, source_fields: ['name', 'coordinates', 'source_rubrics'], collected_at: collected }],
    description_evidence_ids: [], amenities: {}, opening_hours: null, event: null,
    access: { value: 'unknown', evidence_ids: [] }, operating_status: { value: 'unknown', evidence_ids: [] } };
  return { status: 'offline_evaluation', contract: 'qadam-private-retrieval-v1', result: {
    ...expected, status: 'ok', collected_at: collected, demo_eligible: false, external_processing_allowed: false,
    candidates: [{ poi: p, ...estimates(request, p), review_status: 'candidate',
      review: { kind: 'analyst_judgment_not_source_fact', reason: 'Authored synthetic review', caveats: ['Synthetic review caveat'] },
      uncertainty_codes: ['description_missing'], ranking_factors: { supported_preference_count: 0, lexical_match_count: 0 } }],
    eligible_count: 1, warnings: ['Synthetic fixture'], reason_codes: [] } };
}
