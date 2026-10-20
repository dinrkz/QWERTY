import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readAIStartup } from '../../scripts/app/start-ai.mjs';

test('saved AI startup reads path choices without accessing secrets or resetting files', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'qadam-ai-startup-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'settings.json');
  const settings = { schema_version: 1, activation_file: path.join(directory, 'not-opened.json'), env_file: path.join(directory, 'not-read.env') };
  await writeFile(filename, JSON.stringify(settings));
  const before = await readFile(filename, 'utf8');
  assert.deepEqual(await readAIStartup(filename), { activationFile: settings.activation_file, envFile: settings.env_file });
  assert.equal(await readFile(filename, 'utf8'), before);
  for (const invalid of [{}, { ...settings, activation_file: 'relative.json' }, { ...settings, enabled: true }]) {
    await writeFile(filename, JSON.stringify(invalid)); await assert.rejects(readAIStartup(filename));
  }
  await assert.rejects(readAIStartup(path.join(directory, 'missing.json')));
});
