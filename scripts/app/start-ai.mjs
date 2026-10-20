// Persistent local startup choice. Never creates or resets an allowance, exposes
// a key, or sends a generation request at startup.
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBoundedConfig } from './start-bounded.mjs';
import { createAppServer } from '../../src/server.mjs';

const defaultSettings = fileURLToPath(new URL('../../data/runtime/ai-default.json', import.meta.url));
export async function readAIStartup(filename = defaultSettings) {
  if ((await stat(filename)).size > 4096) throw new Error('INVALID_CONFIG');
  const value = JSON.parse(await readFile(filename, 'utf8'));
  if (!value || Object.keys(value).sort().join(',') !== 'activation_file,env_file,schema_version'
    || value.schema_version !== 1 || typeof value.activation_file !== 'string' || !path.isAbsolute(value.activation_file)
    || typeof value.env_file !== 'string' || !path.isAbsolute(value.env_file)) throw new Error('INVALID_CONFIG');
  return { activationFile: value.activation_file, envFile: value.env_file };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw new Error('INVALID_CONFIG');
    const config = await readBoundedConfig(await readAIStartup());
    const server = createAppServer({ config });
    server.on('error', () => { process.stderr.write('Qadam could not start. Check the local port/configuration.\n'); process.exitCode = 1; });
    server.listen(config.port, '127.0.0.1', () => process.stdout.write(`Qadam AI: http://127.0.0.1:${config.port}\n`));
  } catch {
    process.stderr.write('AI startup configuration is unavailable. See docs/BOUNDED_INTERFACE.md. No local-only mode was substituted.\n');
    process.exitCode = 1;
  }
}
