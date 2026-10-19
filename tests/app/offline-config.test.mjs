import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readOfflineConfig } from '../../scripts/app/start-offline.mjs';

test('offline launcher has explicit paths and fixed isolated adapter, without secret environment configuration', async t => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'qadam-authored-config-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(tmp)), path.resolve(tmpdir()));
    assert.ok(path.basename(tmp).startsWith('qadam-authored-config-'));
    return rm(tmp, { recursive: true, force: true });
  });
  const snapshot = path.join(tmp, 'a'.repeat(64)); await mkdir(snapshot);
  const annotations = path.join(tmp, 'annotations.json'), binding = path.join(tmp, 'binding.json');
  const filename = path.join(tmp, 'offline-config.json');
  await writeFile(annotations, '{}');
  const manifest = { schema_version: 1, mode: 'offline_evaluation', dataset_kind: 'collected',
    snapshot_id: 'a'.repeat(64), annotations_sha256: 'b'.repeat(64), policy_id: 'c'.repeat(64),
    input_hashes: { pois_sha256: 'd'.repeat(64), quality_sha256: 'e'.repeat(64) },
    demo_eligible: false, external_processing_allowed: false };
  await writeFile(binding, JSON.stringify(manifest));
  // This executable is a placeholder to test configuration only; never spawned.
  const raw = { python: process.execPath, snapshot, annotations, binding, port: 3012 };
  await writeFile(filename, JSON.stringify(raw));
  const config = await readOfflineConfig(filename);
  assert.equal(config.mode, 'offline'); assert.equal(config.port, 3012);
  assert.equal(config.apiKey, ''); assert.equal(config.mapKey, ''); assert.equal(config.model, '');
  assert.deepEqual(config.command.slice(1, 3), ['-I', '-B']);
  assert.ok(config.command[3].endsWith('offline_ui_adapter.py'));
  assert.deepEqual(config.command.slice(-2), ['--mode', 'offline']);
  assert.equal(config.expected.snapshot_id, manifest.snapshot_id);
  for (const change of [{ port: 0 }, { port: '3000' }, { command: ['arbitrary'] }, { apiKey: 'forbidden' }, { python: 'missing-python' }]) {
    await writeFile(filename, JSON.stringify({ ...raw, ...change }));
    await assert.rejects(readOfflineConfig(filename));
  }
  await writeFile(filename, JSON.stringify(raw));
  for (const change of [{ external_processing_allowed: true }, { demo_eligible: true }, { dataset_kind: 'synthetic' },
    { snapshot_id: 'f'.repeat(64) }, { policy_id: '' }]) {
    await writeFile(binding, JSON.stringify({ ...manifest, ...change }));
    await assert.rejects(readOfflineConfig(filename));
  }
});
