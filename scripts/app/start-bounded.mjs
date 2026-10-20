import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { readOfflineConfig } from './start-offline.mjs';
import { createAppServer } from '../../src/server.mjs';
import { checkEffectiveGenerationAuthorization as checkGenerationAuthorization } from '../../src/app/generation-authorization.mjs';

async function jsonFile(filename, max) {
  if ((await stat(filename)).size > max) throw new Error('INVALID_CONFIG');
  return JSON.parse(await readFile(filename, 'utf8'));
}

// Default path never accesses credentials, authorization or budget files.
export async function readBoundedConfig({ offlineConfig, port = 3003, activationFile, envFile, env = process.env } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_CONFIG');
  const offline = await readOfflineConfig(offlineConfig);
  const config = { ...offline, mode: 'bounded', port, generation: { enabled: false } };
  if (activationFile === undefined) return config;
  const activation = await jsonFile(activationFile, 4096);
  if (!activation || Object.keys(activation).filter(k => !['interpretation_enabled','model_override_file'].includes(k)).sort().join(',') !== 'authorization_file,budget_directory,enabled,model'
    || (activation.interpretation_enabled !== undefined && typeof activation.interpretation_enabled !== 'boolean')
    || activation.enabled !== true || typeof activation.model !== 'string' || !activation.model.trim()
    || typeof activation.authorization_file !== 'string' || !path.isAbsolute(activation.authorization_file)
    || typeof activation.budget_directory !== 'string' || !path.isAbsolute(activation.budget_directory)) throw new Error('INVALID_CONFIG');
  const authorization = await jsonFile(activation.authorization_file, 64 * 1024);
  if (activation.model_override_file !== undefined && (typeof activation.model_override_file !== 'string'
    || !path.isAbsolute(activation.model_override_file))) throw new Error('INVALID_CONFIG');
  const modelOverride = activation.model_override_file === undefined ? null : await jsonFile(activation.model_override_file, 4096);
  checkGenerationAuthorization(authorization, offline.expected, activation.model, new Date().toISOString(), modelOverride);
  const credentialEnv = envFile ? parseEnv(await readFile(envFile, 'utf8')) : env;
  const apiKey = typeof credentialEnv.OPENAI_API_KEY === 'string' ? credentialEnv.OPENAI_API_KEY.trim() : '';
  if (typeof apiKey !== 'string' || !apiKey.trim() || /[\r\n\u0000]/u.test(apiKey)) throw new Error('INVALID_CONFIG');
  // No initialization or repair here; the connector validates accounting before dispatch.
  config.generation = { enabled: true, model: activation.model, modelOverride, apiKey,
    interpretationEnabled: activation.interpretation_enabled === true,
    authorization, budgetDirectory: activation.budget_directory };
  return config;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = {}, args = process.argv.slice(2);
    const keys = { '--config': 'offlineConfig', '--port': 'port', '--activate': 'activationFile', '--env-file': 'envFile' };
    for (let i = 0; i < args.length; i += 2) {
      const key = keys[args[i]];
      if (!key || !args[i + 1] || Object.hasOwn(options, key)) throw new Error('INVALID_CONFIG');
      options[key] = key === 'port' ? Number(args[i + 1]) : path.resolve(args[i + 1]);
    }
    const config = await readBoundedConfig(options);
    const server = createAppServer({ config });
    server.on('error', () => { process.stderr.write('Qadam could not start. Check the local port/configuration.\n'); process.exitCode = 1; });
    server.listen(config.port, '127.0.0.1', () => process.stdout.write(`Qadam evidence preview: http://127.0.0.1:${config.port} (generation ${config.generation.enabled ? 'enabled' : 'disabled'})\n`));
  } catch {
    process.stderr.write('Invalid bounded configuration. See docs/BOUNDED_INTERFACE.md.\n'); process.exitCode = 1;
  }
}
