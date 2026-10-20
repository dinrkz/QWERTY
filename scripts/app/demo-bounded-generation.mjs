// Authored synthetic demonstration. No environment/configuration/key/private-data reads.
import './offline-network-guard.mjs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBoundedGenerationService } from '../../src/app/bounded-generation.mjs';
import { checkGenerationAuthorization } from '../../src/app/generation-authorization.mjs';
import { initializeRequestBudget } from '../../src/app/request-budget.mjs';
import { expected, input, envelope, now, model, key, authorization, fakeFetch } from '../../tests/app/fixtures/bounded-provider.mjs';

if (process.argv.length !== 2) {
  process.stderr.write('This synthetic demo takes no arguments.\n');
  process.exitCode = 1;
} else {
  try {
    const root = fileURLToPath(new URL('../../data/runtime/bounded-generation-demo/', import.meta.url));
    await mkdir(root, { recursive: true });
    const directory = await mkdtemp(path.join(root, 'synthetic-'));
    const budgetDirectory = path.join(directory, 'budget');
    const approval = authorization();
    const { budget } = checkGenerationAuthorization(approval, expected, model, now());
    await initializeRequestBudget(budgetDirectory, budget);
    let calls = 0;
    const service = createBoundedGenerationService({ expected, retrieve: async req => envelope(req), enabled: true,
      authorization: approval, budgetDirectory, model, apiKey: key, now,
      testFetch: (...args) => { calls++; return fakeFetch(...args); } });
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await service(input()));
    if (calls !== 3 || results.slice(0, 3).some(r => r.status !== 'synthetic_provider_test')
      || results[3].generation.failure_code !== 'BUDGET_EXHAUSTED'
      || results.some(r => r.generation.external_requests !== 0)) throw new Error('SYNTHETIC_DEMO_FAILED');
    process.stdout.write(JSON.stringify({ mode: 'synthetic_provider_test', successful: 3,
      fourth_request: 'BUDGET_EXHAUSTED', external_requests: 0,
      synthetic_ledger: path.relative(fileURLToPath(new URL('../../', import.meta.url)), budgetDirectory) }, null, 2) + '\n');
  } catch {
    process.stderr.write('SYNTHETIC_BOUNDED_DEMO_FAILED\n');
    process.exitCode = 1;
  }
}
