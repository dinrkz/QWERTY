import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkGenerationAuthorization, checkEffectiveGenerationAuthorization } from '../../src/app/generation-authorization.mjs';
import { initializeRequestBudget, reserveRequest, requestBudgetStatus } from '../../src/app/request-budget.mjs';
import { createNaturalRecommendation } from '../../src/app/walking-intent.mjs';
import { createBoundedGenerationService } from '../../src/app/bounded-generation.mjs';
import { expected, input, envelope, model, key, now, authorization, response, fakeFetch } from './fixtures/bounded-provider.mjs';

const target = 'gpt-6-luna', a = authorization(); // Only fake transport; no live provider access.
const original = checkGenerationAuthorization(a, expected, model, now());
const approval = () => ({ schema_version: 1, authorization_hash: original.budget.authorization_hash,
  from_model: model, to_model: target, operator_approved: true, approved_at: now(), expires_at: a.expires_at });

test('explicit model change returns the identical original authorization and budget', () => {
  assert.deepEqual(checkEffectiveGenerationAuthorization(a, expected, model, now()), original);
  assert.deepEqual(checkEffectiveGenerationAuthorization(a, expected, target, now(), approval()), original);
  assert.throws(() => checkEffectiveGenerationAuthorization(a, expected, target, now()), { code: 'PROCESSING_NOT_AUTHORIZED' });
});
test('mismatched, expanded, future or expired model approvals fail closed', () => {
  for (const patch of [{ authorization_hash: 'f'.repeat(64) }, { from_model: target }, { to_model: model },
    { operator_approved: false }, { approved_at: '2026-10-19T01:00:00Z' }, { expires_at: now() },
    { expires_at: '2026-10-21T00:00:00Z' }, { limits: { max_attempts: 100 } }]) {
    assert.throws(() => checkEffectiveGenerationAuthorization(a, expected, target, now(), { ...approval(), ...patch }),
      { code: 'PROCESSING_NOT_AUTHORIZED' });
  }
});
test('both AI stages use the new model with original slots, lock and exhaustion', async t => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'qadam-model-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const dir = path.join(parent, 'budget');
  await initializeRequestBudget(dir, original.budget);
  const first = await reserveRequest(dir, original.budget);
  await first.finish({ outcome: 'selected' });
  const before = new Map(await Promise.all((await readdir(dir)).map(async name => [name, await readFile(path.join(dir, name), 'utf8')])));
  let calls = 0;
  const override = approval();
  const options = { enabled: true, interpretationEnabled: true, authorization: a, expected, model: target, modelOverride: override,
    apiKey: key, budgetDirectory: dir, now, retrieve: async req => envelope(req), testFetch: (url, opts) => {
      calls++;
      const body = JSON.parse(opts.body);
      assert.equal(body.model, target);
      assert.deepEqual(body.reasoning, { effort: 'none' });
      if (body.text.format.name === 'qadam_walking_intent') return response({ start: 'current', categories: ['cafe'],
        available_minutes: 90, required_amenities: null, require_open: null, events_only: null,
        first_visit: null, return_to_start: null, buffer_minutes: null, clarification: null });
      return fakeFetch(url, opts);
    } };
  const recommend = createNaturalRecommendation(options, createBoundedGenerationService(options));
  override.to_model = 'changed-after-construction'; // Each service snapshots the local approval.
  const result = await recommend(input({ query: 'Coffee for 90 minutes' }));
  assert.equal(result.status, 'synthetic_provider_test');
  assert.equal(result.generation.attempt, 3);
  assert.equal(calls, 2);
  for (const [name, content] of before) assert.equal(await readFile(path.join(dir, name), 'utf8'), content);
  assert.equal((await requestBudgetStatus(dir, original.budget)).remaining, 0);
  await recommend(input({ query: 'Coffee again' }));
  assert.equal(calls, 2);
});
