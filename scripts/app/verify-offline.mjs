// Real local integration, aggregate output only. Never prints POIs or requests.
import './offline-network-guard.mjs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { readOfflineConfig } from './start-offline.mjs';
import { createAppServer } from '../../src/server.mjs';
import { createMockGenerationService } from '../../src/app/mock-generation.mjs';
import { retrieveFromProcess } from '../../src/app/retrieval.mjs';

const check = (value, code) => { if (!value) throw new Error(code); };
const sha = async filename => createHash('sha256').update(await readFile(filename)).digest('hex');
const root = fileURLToPath(new URL('../../', import.meta.url));
async function accountingHashes() {
  const result = {};
  for (const relative of ['data/runtime/2gis-probe-v1/ledger.jsonl', 'data/runtime/2gis-collection/ledger.jsonl',
    'data/runtime/2gis-collection/current.json', 'data/private/walking-review-final/review.json']) {
    try { result[relative] = await sha(path.join(root, relative)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return result;
}
async function fingerprints(folder) {
  const result = {};
  for (const name of (await readdir(folder)).sort()) {
    const file = path.join(folder, name);
    if ((await stat(file)).isFile()) result[name] = await sha(file);
  }
  return result;
}

let server, stage = 'CONFIG';
try {
  const args = process.argv.slice(2);
  const withMock = args[0] === '--with-mock-generation';
  if (withMock) args.shift();
  check(args.length <= 1 && !args[0]?.startsWith('--'), 'INVALID_ARGUMENTS');
  const config = await readOfflineConfig(args[0]);
  const mockRecommend = withMock ? createMockGenerationService({ expected: config.expected,
    retrieve: request => retrieveFromProcess(request, { command: config.command, cwd: root }) }) : null;
  let mockCases = 0, mockSelections = 0;
  const arg = key => config.command[config.command.indexOf(key) + 1];
  stage = 'FINGERPRINT_BEFORE';
  const before = { snapshot: await fingerprints(arg('--snapshot')), annotations: await sha(arg('--annotations')),
    binding: await sha(arg('--binding')), accounting: await accountingHashes() };
  server = createAppServer({ config });
  stage = 'SERVER';
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${url}/api/config`);
  stage = 'CONFIG_RESPONSE';
  const publicConfig = await response.json();
  check(publicConfig.mode === 'offline' && !publicConfig.generation_configured && !publicConfig.map_public_key, 'CONFIG_BOUNDARY');
  check(!response.headers.get('content-security-policy').includes('https:'), 'CSP_BOUNDARY');
  const counts = [];
  stage = 'SCENARIOS';
  // Rounded simulated anchors from the reviewed collection plan; no device data.
  for (const [latitude, longitude] of [[51.128, 71.430], [51.089, 71.405], [51.136, 71.439]]) {
    for (const [categories, available_minutes] of [[['park', 'landmark'], 60], [['park', 'museum', 'landmark'], 90], [['cafe'], 45]]) {
      const body = { latitude, longitude, query: '', available_minutes, language: 'en', categories, max_distance_m: 3000 };
      for (const filters of [{}, { require_open: true }, { required_amenities: ['sockets'] }, { events_only: true },
        { return_to_start: true, buffer_minutes: 10 }]) {
        const res = await fetch(`${url}/api/recommend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, ...filters }) });
        const result = await res.json();
        check(res.ok && result.status === 'offline_evaluation', 'OFFLINE_RESULT_FAILED');
        check(result.dataset.demo_eligible === false && result.dataset.external_processing_allowed === false, 'DATA_BOUNDARY');
        check(result.context_used.latitude === undefined && result.context_used.query === undefined, 'PRIVACY_BOUNDARY');
        if (filters.require_open || filters.required_amenities || filters.events_only) check(result.recommendations.length === 0, 'UNKNOWN_CONSTRAINT');
        check(result.recommendations.length <= 3, 'CARD_LIMIT');
        for (const card of result.recommendations) {
          check(card.activity.kind === 'template_suggestion' && card.sources.every(s => s.url === null), 'PRESENTATION_BOUNDARY');
          check(card.source_facts.opening_hours === null && card.source_facts.event === null, 'UNKNOWN_FACT');
        }
        if (mockRecommend) {
          // Local function call, deliberately not mounted on the application server.
          const mocked = await mockRecommend({ ...body, ...filters });
          check(mocked.status === (result.recommendations.length ? 'mock_generation' : 'mock_no_match'), 'MOCK_VERIFICATION_FAILED');
          check(mocked.generation.provider_calls === 0 && mocked.dataset.external_processing_allowed === false
            && mocked.dataset.demo_eligible === false, 'MOCK_BOUNDARY_FAILED');
          check(mocked.recommendations.length === result.recommendations.length, 'MOCK_VERIFICATION_FAILED');
          const original = new Map(result.recommendations.map(c => [c.poi_id, c]));
          for (const card of mocked.recommendations) {
            check(original.has(card.poi_id) && card.activity.kind === 'mock_template_suggestion', 'MOCK_BOUNDARY_FAILED');
            check(card.selection_evidence.every(e => e.source_version === original.get(card.poi_id).sources[0].source_version), 'MOCK_BOUNDARY_FAILED');
          }
          mockCases++; mockSelections += mocked.generation.mock_calls;
        }
        counts.push(result.recommendations.length);
      }
    }
  }
  stage = 'FINGERPRINT_AFTER';
  const after = { snapshot: await fingerprints(arg('--snapshot')), annotations: await sha(arg('--annotations')),
    binding: await sha(arg('--binding')), accounting: await accountingHashes() };
  check(JSON.stringify(before) === JSON.stringify(after), 'INPUTS_CHANGED');
  process.stdout.write(JSON.stringify({ cases: counts.length, cases_with_results: counts.filter(Boolean).length,
    cases_without_results: counts.filter(n => !n).length,
    source_review_binding_accounting_files_unchanged: Object.keys(before.snapshot).length + 2 + Object.keys(before.accounting).length,
    ...(withMock ? { mock_cases: mockCases, local_mock_calls: mockSelections } : {}), external_requests: 0 }) + '\n');
} catch (error) {
  // Only explicitly authored verification codes may leave this process.
  const codes = ['CONFIG_BOUNDARY', 'CSP_BOUNDARY', 'OFFLINE_RESULT_FAILED', 'DATA_BOUNDARY', 'PRIVACY_BOUNDARY',
    'UNKNOWN_CONSTRAINT', 'CARD_LIMIT', 'PRESENTATION_BOUNDARY', 'UNKNOWN_FACT', 'INPUTS_CHANGED',
    'INVALID_ARGUMENTS', 'MOCK_VERIFICATION_FAILED', 'MOCK_BOUNDARY_FAILED'];
  process.stderr.write((codes.includes(error.message) ? error.message : `OFFLINE_VERIFICATION_FAILED:${stage}`) + '\n');
  process.exitCode = 1;
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
