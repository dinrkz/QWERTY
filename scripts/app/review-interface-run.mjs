// Read-only aggregate accounting and source-integrity check. Never loads a key or calls a provider.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprints } from './run-pilot.mjs';
import { readOfflineConfig } from './start-offline.mjs';
const root = fileURLToPath(new URL('../../data/runtime/', import.meta.url));
try {
  const directory = path.resolve(process.argv[2] ?? '');
  if (!directory.startsWith(root)) throw new Error('OUTSIDE_RUNTIME');
  const json = async name => JSON.parse(await readFile(path.join(directory, name), 'utf8'));
  const plan = await json('plan.json'), manifest = await json('budget/manifest.json');
  const names = await readdir(path.join(directory, 'budget'));
  const reserved = names.filter(n => /^\d+\.reserved\.json$/.test(n)).length;
  const outcomes = await Promise.all(names.filter(n => /^\d+\.outcome\.json$/.test(n)).map(n => json(`budget/${n}`)));
  const current = await fingerprints(await readOfflineConfig());
  const unchanged = JSON.stringify(current) === JSON.stringify(plan.fingerprints);
  process.stdout.write(JSON.stringify({ attempts_used: reserved, remaining: manifest.max_attempts - reserved,
    prior_attempts: plan.prior_attempts ?? 0, total_attempts: (plan.prior_attempts ?? 0) + reserved,
    outcomes: outcomes.map(o => ({ attempt: o.attempt, outcome: o.outcome, uncertain: o.uncertain, usage: o.usage ?? null })),
    reported_tokens: outcomes.reduce((sum, o) => sum + (o.usage?.total_tokens ?? 0), 0),
    original_files_unchanged: unchanged, original_file_count: Object.keys(current).length,
    locked: names.includes('active.lock'), external_requests: 0 }, null, 2) + '\n');
  if (!unchanged) process.exitCode = 1;
} catch { process.stderr.write('Unable to verify the local run. No request was sent.\n'); process.exitCode = 1; }
