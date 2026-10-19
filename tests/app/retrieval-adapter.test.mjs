import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseRetrievalCommand, retrieveFromProcess } from '../../src/app/retrieval.mjs';
import { syntheticRequest } from './fixtures/synthetic.mjs';

const child = fileURLToPath(new URL('./fixtures/synthetic-retrieval-child.mjs', import.meta.url));
const command = mode => [process.execPath, child, mode];
const rejects = (run, code) => assert.rejects(run, { name: 'AppError', code });

test('retrieval configuration is an argument array, not shell text', () => {
  assert.equal(parseRetrievalCommand(''), null);
  assert.equal(parseRetrievalCommand(undefined), null);
  assert.deepEqual(parseRetrievalCommand('["python","-m","qadam_data"]'), ['python', '-m', 'qadam_data']);
  for (const value of ['python -m qadam_data', '{}', '[]', '[" "]', '["node",4]',
    '["node","bad\\nargument"]', '["node","bad\\u0000argument"]', JSON.stringify(Array(21).fill('x'))]) {
    assert.throws(() => parseRetrievalCommand(value), { name: 'AppError', code: 'INVALID_CONFIG' });
  }
});

test('adapter writes one JSON request to stdin, fixes the limit, and passes shell metacharacters literally', async () => {
  const request = syntheticRequest({ query: 'Серуендеу рядом', limit: 999 });
  const argument = '& echo MUST_NOT_EXECUTE | > "not a shell"';
  const result = await retrieveFromProcess(request, { command: [...command('echo'), argument] });
  assert.deepEqual(result.received, { ...request, limit: 10 });
  assert.equal(result.argument, argument);
});

test('child environment excludes provider credentials and unrelated parent values', async t => {
  const keys = ['OPENAI_API_KEY', 'QADAM_MAP_PUBLIC_KEY', 'QADAM_TEST_PRIVATE_SENTINEL'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.after(() => { for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  } });
  for (const key of keys) process.env[key] = 'synthetic-not-a-secret';
  const result = await retrieveFromProcess(syntheticRequest(), { command: command('environment') });
  assert.deepEqual(result.secretKeysPresent, []);
  assert.equal(result.pythonEncoding, 'utf-8');
});

test('stderr is discarded without contaminating JSON or public errors', async () => {
  assert.deepEqual(await retrieveFromProcess(syntheticRequest(), { command: command('stderr') }), { status: 'synthetic_child_ok' });
  await rejects(() => retrieveFromProcess(syntheticRequest(), { command: command('nonzero') }), 'DATA_UNAVAILABLE');
});

for (const mode of ['malformed', 'multiple', 'empty', 'oversize']) {
  test(`retrieval ${mode} stdout fails as DATA_INVALID`, async () =>
    rejects(() => retrieveFromProcess(syntheticRequest(), { command: command(mode) }), 'DATA_INVALID'));
}

test('missing or nonexistent retrieval process returns DATA_UNAVAILABLE', async () => {
  await rejects(() => retrieveFromProcess(syntheticRequest()), 'DATA_UNAVAILABLE');
  await rejects(() => retrieveFromProcess(syntheticRequest(), { command: ['qadam-synthetic-no-such-executable'] }), 'DATA_UNAVAILABLE');
});

test('retrieval deadline kills a stalled process and returns RETRIEVAL_TIMEOUT', async () => {
  await rejects(() => retrieveFromProcess(syntheticRequest(), { command: command('timeout'), timeoutMs: 100 }), 'RETRIEVAL_TIMEOUT');
});
