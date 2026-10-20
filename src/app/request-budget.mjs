// Immutable attempt slots: no refunds, automatic creation during requests or stale-lock recovery.
import { open, mkdir, lstat, readdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { AppError } from '../shared/policy.mjs';
import { MAX_ATTEMPTS, MAX_OUTPUT_TOKENS, MAX_TIMEOUT_MS } from './generation-authorization.mjs';

const fail = (code = 'BUDGET_INVALID') => { throw new AppError(code); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const OUTCOMES = ['selected', 'invalid_output', 'refusal', 'http_error', 'unknown', 'provider_error'];
export const MAX_REVIEWED_TIMEOUT_MS = 60000;
function spec(value) {
  if (!value || typeof value !== 'object' || Object.keys(value).sort().join(',') !== 'authorization_hash,max_attempts,max_output_tokens,schema_version,timeout_ms'
    || value.schema_version !== 1 || typeof value.authorization_hash !== 'string' || !/^[a-f0-9]{64}$/.test(value.authorization_hash)
    || !Number.isInteger(value.max_attempts) || value.max_attempts < 1 || value.max_attempts > MAX_ATTEMPTS
    || !Number.isInteger(value.max_output_tokens) || value.max_output_tokens < 128 || value.max_output_tokens > MAX_OUTPUT_TOKENS
    || !Number.isInteger(value.timeout_ms) || value.timeout_ms < 10 || value.timeout_ms > MAX_TIMEOUT_MS) fail();
  return { schema_version: 1, authorization_hash: value.authorization_hash, max_attempts: value.max_attempts,
    max_output_tokens: value.max_output_tokens, timeout_ms: value.timeout_ms };
}
async function regular(filename) {
  const info = await lstat(filename);
  if (!info.isFile() || info.isSymbolicLink()) fail();
  return info;
}
async function directoryCheck(directory) {
  if (!path.isAbsolute(directory)) fail();
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) fail();
}
async function exclusiveJson(filename, data) {
  const handle = await open(filename, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(data) + '\n'); await handle.sync(); }
  finally { await handle.close(); }
}
const hashFile = async file => createHash('sha256').update(await readFile(file)).digest('hex');
async function validReviewReservation(directory, attempt) {
  const file = path.join(directory, `${attempt}.reserved.json`);
  if ((await regular(file)).size > 4096) fail();
  const reservation = JSON.parse(await readFile(file, 'utf8'));
  if (Object.keys(reservation).sort().join(',') !== 'attempt,reserved_at'
    || reservation.attempt !== attempt || !Number.isFinite(Date.parse(reservation.reserved_at))) fail();
}
async function readState(directory, expected, reviewing = null) {
  await directoryCheck(directory);
  const file = path.join(directory, 'manifest.json');
  if ((await regular(file)).size > 4096) fail();
  const actual = spec(JSON.parse(await readFile(file, 'utf8')));
  if (!same(actual, expected)) fail();
  const names = await readdir(directory);
  const slots = new Set();
  let timeoutMs = expected.timeout_ms;
  for (const name of names) {
    await regular(path.join(directory, name));
    if (name === 'manifest.json' || name === 'active.lock') continue;
    const match = /^(\d+)\.(reserved|outcome|review)\.json$/.exec(name);
    if (!match || Number(match[1]) < 1 || Number(match[1]) > expected.max_attempts) fail();
    if (match[2] === 'reserved') slots.add(Number(match[1]));
    else if (!names.includes(`${match[1]}.reserved.json`)) fail();
  }
  // Empty/truncated reservation files still consume a slot. Gaps indicate manual alteration.
  for (let i = 1; i <= slots.size; i++) if (!slots.has(i)) fail();
  for (const attempt of slots) {
    const outcomePath = path.join(directory, `${attempt}.outcome.json`);
    // Called only after acquiring our lock, before creating this request's slot.
    // Any older incomplete/uncertain reservation must stop the run.
    if (!names.includes(`${attempt}.outcome.json`)) fail();
    if ((await regular(outcomePath)).size > 4096) fail();
    const outcome = JSON.parse(await readFile(outcomePath, 'utf8'));
    if (outcome?.attempt !== attempt || !OUTCOMES.includes(outcome.outcome) || typeof outcome.uncertain !== 'boolean') fail();
    const reviewName = `${attempt}.review.json`;
    if (names.includes(reviewName)) {
      await validReviewReservation(directory, attempt);
      const file = path.join(directory, reviewName);
      if (!outcome.uncertain || (await regular(file)).size > 4096) fail();
      const review = JSON.parse(await readFile(file, 'utf8'));
      const keys = Object.keys(review).filter(k => k !== 'transport_timeout_ms').sort().join(',');
      if (keys !== 'acknowledge_remote_unknown,attempt,authorization_hash,outcome_sha256,reservation_sha256,reviewed_at'
        || review.attempt !== attempt || review.authorization_hash !== expected.authorization_hash || review.acknowledge_remote_unknown !== true
        || !Number.isFinite(Date.parse(review.reviewed_at)) || review.reservation_sha256 !== await hashFile(path.join(directory, `${attempt}.reserved.json`))
        || review.outcome_sha256 !== await hashFile(outcomePath)) fail();
      if (Object.hasOwn(review, 'transport_timeout_ms')) {
        if (!Number.isInteger(review.transport_timeout_ms) || review.transport_timeout_ms < expected.timeout_ms
          || review.transport_timeout_ms > MAX_REVIEWED_TIMEOUT_MS) fail();
        timeoutMs = Math.max(timeoutMs, review.transport_timeout_ms);
      }
    } else if (outcome.uncertain && reviewing !== attempt) fail();
  }
  return { used: slots.size, locked: names.includes('active.lock'), timeoutMs };
}

// Explicit operator review only. Never invoked by recommendation/preview paths.
export async function reviewedRequestTimeout(directory, specification) {
  return (await readState(directory, spec(specification))).timeoutMs;
}
export async function requestBudgetStatus(directory, specification) {
  try {
    const expected = spec(specification), state = await readState(directory, expected);
    return { state: state.locked ? 'blocked' : state.used >= expected.max_attempts ? 'exhausted' : 'ready',
      remaining: Math.max(0, expected.max_attempts - state.used), max_attempts: expected.max_attempts };
  } catch { return { state: 'blocked', remaining: null, max_attempts: null }; }
}

// A completed local caller does not prove remote completion: the attempt stays unknown/spent.
export async function reviewUncertainRequest(directory, specification, { attempt, acknowledgeUnknown, transportTimeoutMs } = {}) {
  const expected = spec(specification);
  if (acknowledgeUnknown !== true || !Number.isInteger(attempt)) fail();
  if (transportTimeoutMs !== undefined && (!Number.isInteger(transportTimeoutMs)
    || transportTimeoutMs < expected.timeout_ms || transportTimeoutMs > MAX_REVIEWED_TIMEOUT_MS)) fail();
  try {
    const state = await readState(directory, expected, attempt);
    const outcomeFile = path.join(directory, `${attempt}.outcome.json`);
    const outcome = JSON.parse(await readFile(outcomeFile, 'utf8'));
    if (!state.locked || state.used !== attempt || outcome.uncertain !== true || outcome.outcome !== 'unknown') fail();
    await validReviewReservation(directory, attempt);
    await exclusiveJson(path.join(directory, `${attempt}.review.json`), { attempt,
      authorization_hash: expected.authorization_hash, acknowledge_remote_unknown: true, reviewed_at: new Date().toISOString(),
      ...(transportTimeoutMs === undefined ? {} : { transport_timeout_ms: transportTimeoutMs }),
      reservation_sha256: await hashFile(path.join(directory, `${attempt}.reserved.json`)), outcome_sha256: await hashFile(outcomeFile) });
    // A replay fails exclusive creation above and cannot remove a newer caller's lock.
    await unlink(path.join(directory, 'active.lock'));
    return { attempts_used: state.used, attempts_remaining: expected.max_attempts - state.used, previous_outcome: 'unknown' };
  } catch { fail(); }
}

export async function initializeRequestBudget(directory, specification) {
  const expected = spec(specification);
  if (!path.isAbsolute(directory)) fail();
  try {
    await mkdir(directory); // Existing directory, including an interrupted init, is never reset.
    await exclusiveJson(path.join(directory, 'manifest.json'), expected);
  } catch { fail(); }
}

export async function reserveRequest(directory, specification) {
  const expected = spec(specification);
  let lockOwned = false, reserved = false;
  try {
    await directoryCheck(directory);
    // Lock before scanning mutable files: another process may be finishing a slot.
    await exclusiveJson(path.join(directory, 'active.lock'), { schema_version: 1 });
    lockOwned = true;
    const state = await readState(directory, expected);
    if (state.used >= expected.max_attempts) fail('BUDGET_EXHAUSTED');
    const attempt = state.used + 1;
    // Mark uncertain reservation failures conservatively: never release the lock.
    reserved = true;
    await exclusiveJson(path.join(directory, `${attempt}.reserved.json`), { attempt, reserved_at: new Date().toISOString() });
    let finished = false;
    return { attempt, timeoutMs: state.timeoutMs, async finish({ outcome, usage = null, uncertain = false }) {
      if (finished) fail();
      finished = true;
      if (!OUTCOMES.includes(outcome) || typeof uncertain !== 'boolean') fail();
      if (usage !== null && (!usage || Object.keys(usage).sort().join(',') !== 'input_tokens,output_tokens,total_tokens'
        || Object.values(usage).some(v => !Number.isInteger(v) || v < 0 || v > 10000000))) fail();
      try {
        await exclusiveJson(path.join(directory, `${attempt}.outcome.json`), {
          attempt, finished_at: new Date().toISOString(), outcome, usage, uncertain });
        if (!uncertain) await unlink(path.join(directory, 'active.lock'));
      } catch { fail(); } // A write failure keeps the run locked and the attempt spent.
    } };
  } catch (error) {
    if (lockOwned && !reserved) { try { await unlink(path.join(directory, 'active.lock')); } catch {} }
    if (error instanceof AppError) throw error;
    if (error.code === 'EEXIST') fail('BUDGET_BUSY');
    fail();
  }
}
