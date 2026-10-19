// Real local integration, aggregate output only. Never prints POIs or requests.
import './offline-network-guard.mjs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { readOfflineConfig } from './start-offline.mjs';
import { createAppServer } from '../../src/server.mjs';

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

let server;
try {
  const config = await readOfflineConfig(process.argv[2]);
  const arg = key => config.command[config.command.indexOf(key) + 1];
  const before = { snapshot: await fingerprints(arg('--snapshot')), annotations: await sha(arg('--annotations')),
    binding: await sha(arg('--binding')), accounting: await accountingHashes() };
  server = createAppServer({ config });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${url}/api/config`);
  const publicConfig = await response.json();
  check(publicConfig.mode === 'offline' && !publicConfig.generation_configured && !publicConfig.map_public_key, 'CONFIG_BOUNDARY');
  check(!response.headers.get('content-security-policy').includes('https:'), 'CSP_BOUNDARY');
  const counts = [];
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
        counts.push(result.recommendations.length);
      }
    }
  }
  const after = { snapshot: await fingerprints(arg('--snapshot')), annotations: await sha(arg('--annotations')),
    binding: await sha(arg('--binding')), accounting: await accountingHashes() };
  check(JSON.stringify(before) === JSON.stringify(after), 'INPUTS_CHANGED');
  process.stdout.write(JSON.stringify({ cases: counts.length, cases_with_results: counts.filter(Boolean).length,
    cases_without_results: counts.filter(n => !n).length,
    source_review_binding_accounting_files_unchanged: Object.keys(before.snapshot).length + 2 + Object.keys(before.accounting).length,
    external_requests: 0 }) + '\n');
} catch (error) {
  // Only explicitly authored verification codes may leave this process.
  const codes = ['CONFIG_BOUNDARY', 'CSP_BOUNDARY', 'OFFLINE_RESULT_FAILED', 'DATA_BOUNDARY', 'PRIVACY_BOUNDARY',
    'UNKNOWN_CONSTRAINT', 'CARD_LIMIT', 'PRESENTATION_BOUNDARY', 'UNKNOWN_FACT', 'INPUTS_CHANGED'];
  process.stderr.write((codes.includes(error.message) ? error.message : 'OFFLINE_VERIFICATION_FAILED') + '\n');
  process.exitCode = 1;
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
