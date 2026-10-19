import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createAppServer } from '../../src/server.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const hex = v => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const canonical = v => Array.isArray(v) ? v.map(canonical) : v !== null && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;

async function jsonFile(filename) {
  if ((await stat(filename)).size > 16384) throw new Error('INVALID_CONFIG');
  return JSON.parse(await readFile(filename, 'utf8'));
}

// Explicit local configuration, never .env or .env.local. Paths are trusted
// operator configuration; the browser cannot choose a file or executable.
export async function readOfflineConfig(filename = path.join(root, 'data/runtime/offline-app.json')) {
  const raw = await jsonFile(filename);
  if (!raw || Array.isArray(raw) || typeof raw !== 'object'
    || Object.keys(raw).some(k => !['python', 'snapshot', 'annotations', 'binding', 'port'].includes(k))) throw new Error('INVALID_CONFIG');
  const resolve = key => {
    if (typeof raw[key] !== 'string' || !raw[key].trim() || /[\r\n\u0000]/u.test(raw[key])) throw new Error('INVALID_CONFIG');
    return path.resolve(root, raw[key]);
  };
  const python = resolve('python'), snapshot = resolve('snapshot'), annotations = resolve('annotations'), binding = resolve('binding');
  for (const file of [python, annotations, binding]) if (!(await stat(file)).isFile()) throw new Error('INVALID_CONFIG');
  if (!(await stat(snapshot)).isDirectory()) throw new Error('INVALID_CONFIG');
  const port = raw.port ?? 3000;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_CONFIG');
  const manifest = await jsonFile(binding);
  if (manifest.schema_version !== 1 || manifest.mode !== 'offline_evaluation' || manifest.dataset_kind !== 'collected'
    || manifest.demo_eligible !== false || manifest.external_processing_allowed !== false
    || !hex(manifest.snapshot_id) || path.basename(snapshot) !== manifest.snapshot_id
    || !hex(manifest.annotations_sha256) || !hex(manifest.policy_id)
    || !hex(manifest.input_hashes?.pois_sha256) || !hex(manifest.input_hashes?.quality_sha256)) throw new Error('INVALID_CONFIG');
  return { mode: 'offline', port, apiKey: '', model: '', mapKey: '',
    command: [python, '-I', '-B', path.join(root, 'scripts/data/offline_ui_adapter.py'),
      '--snapshot', snapshot, '--annotations', annotations, '--binding', binding, '--mode', 'offline'],
    expected: { dataset_kind: manifest.dataset_kind, snapshot_id: manifest.snapshot_id,
      review_id: manifest.annotations_sha256, policy_id: manifest.policy_id,
      binding_id: createHash('sha256').update(JSON.stringify(canonical(manifest))).digest('hex') } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--config')) throw new Error('INVALID_CONFIG');
    const config = await readOfflineConfig(args[1] ? path.resolve(args[1]) : undefined);
    const server = createAppServer({ config });
    server.on('error', () => { process.stderr.write('Offline Qadam could not start. Check the local port.\n'); process.exitCode = 1; });
    server.listen(config.port, '127.0.0.1', () => process.stdout.write(`Offline Qadam: http://127.0.0.1:${config.port}\n`));
  } catch {
    process.stderr.write('Offline configuration is missing or invalid. See docs/OFFLINE_INTERFACE.md. No provider requests were made.\n');
    process.exitCode = 1;
  }
}
