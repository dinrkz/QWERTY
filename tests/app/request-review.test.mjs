import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeRequestBudget, reserveRequest, reviewUncertainRequest } from '../../src/app/request-budget.mjs';
const root = fileURLToPath(new URL('../../data/runtime/request-review-tests/', import.meta.url));
const spec = { schema_version: 1, authorization_hash: 'a'.repeat(64), max_attempts: 3, max_output_tokens: 1800, timeout_ms: 15000 };
async function setup(t) {
  await mkdir(root, { recursive: true }); const folder = await mkdtemp(path.join(root, 'synthetic-')), dir = path.join(folder, 'budget');
  t.after(async () => { assert.equal(path.dirname(folder), path.resolve(root)); await rm(folder, { recursive: true, force: true }); });
  await initializeRequestBudget(dir, spec); const r = await reserveRequest(dir, spec); await r.finish({ outcome: 'unknown', uncertain: true }); return dir;
}
test('explicit uncertainty review keeps original bytes and spent slot, never refunds or enlarges cap', async t => {
  const dir = await setup(t), before = await readFile(path.join(dir, '1.outcome.json'), 'utf8');
  await assert.rejects(reserveRequest(dir, spec), { code: 'BUDGET_BUSY' });
  const review = await reviewUncertainRequest(dir, spec, { attempt: 1, acknowledgeUnknown: true });
  assert.deepEqual(review, { attempts_used: 1, attempts_remaining: 2, previous_outcome: 'unknown' });
  assert.equal(await readFile(path.join(dir, '1.outcome.json'), 'utf8'), before);
  const second = await reserveRequest(dir, spec); assert.equal(second.attempt, 2);
  await assert.rejects(reviewUncertainRequest(dir, spec, { attempt: 1, acknowledgeUnknown: true }));
  await assert.rejects(reserveRequest(dir, spec), { code: 'BUDGET_BUSY' }); // replay did not remove the new lock
  await second.finish({ outcome: 'selected' }); const third = await reserveRequest(dir, spec); await third.finish({ outcome: 'selected' });
  await assert.rejects(reserveRequest(dir, spec), { code: 'BUDGET_EXHAUSTED' });
});
test('review requires acknowledgment, matching authorization, latest slot and unchanged outcome evidence', async t => {
  const dir = await setup(t);
  for (const args of [{ attempt: 1 }, { attempt: 2, acknowledgeUnknown: true }]) await assert.rejects(reviewUncertainRequest(dir, spec, args));
  await assert.rejects(reviewUncertainRequest(dir, { ...spec, authorization_hash: 'b'.repeat(64) }, { attempt: 1, acknowledgeUnknown: true }));
  await reviewUncertainRequest(dir, spec, { attempt: 1, acknowledgeUnknown: true });
  await writeFile(path.join(dir, '1.outcome.json'), (await readFile(path.join(dir, '1.outcome.json'), 'utf8')) + ' ');
  await assert.rejects(reserveRequest(dir, spec), { code: 'BUDGET_INVALID' });
});
test('review cannot unlock a truncated or corrupted reservation', async t => {
  for (const value of ['', '{', JSON.stringify({ attempt: 2, reserved_at: new Date().toISOString() })]) {
    const dir = await setup(t);
    await writeFile(path.join(dir, '1.reserved.json'), value);
    await assert.rejects(reviewUncertainRequest(dir, spec, { attempt: 1, acknowledgeUnknown: true }));
    await assert.rejects(reserveRequest(dir, spec), { code: 'BUDGET_BUSY' });
  }
});
test('explicit timeout extension preserves authorization, slots and cap across restart', async t => {
  const dir = await setup(t), manifest = await readFile(path.join(dir, 'manifest.json'), 'utf8');
  for (const transportTimeoutMs of [14999, 60001, '60000']) {
    await assert.rejects(reviewUncertainRequest(dir, spec, { attempt: 1, acknowledgeUnknown: true, transportTimeoutMs }));
  }
  await reviewUncertainRequest(dir, spec, { attempt: 1, acknowledgeUnknown: true });
  const second = await reserveRequest(dir, spec); assert.equal(second.timeoutMs, 15000);
  await second.finish({ outcome: 'unknown', uncertain: true });
  const firstReview = await readFile(path.join(dir, '1.review.json'), 'utf8');
  await reviewUncertainRequest(dir, spec, { attempt: 2, acknowledgeUnknown: true, transportTimeoutMs: 60000 });
  const third = await reserveRequest(dir, spec);
  assert.equal(third.timeoutMs, 60000); assert.equal(third.attempt, 3);
  assert.equal(await readFile(path.join(dir, 'manifest.json'), 'utf8'), manifest);
  assert.equal(await readFile(path.join(dir, '1.review.json'), 'utf8'), firstReview);
  await third.finish({ outcome: 'selected' });
  await assert.rejects(reserveRequest(dir, spec), { code: 'BUDGET_EXHAUSTED' });
});
