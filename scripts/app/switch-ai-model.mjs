// Explicit operator action. Preserves the authorization and every budget file.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { readAIStartup } from './start-ai.mjs';
import { readBoundedConfig } from './start-bounded.mjs';
import { checkEffectiveGenerationAuthorization } from '../../src/app/generation-authorization.mjs';
import { requestBudgetStatus } from '../../src/app/request-budget.mjs';

try {
  const [flag, target, ...extra] = process.argv.slice(2);
  if (flag !== '--model' || !/^[a-zA-Z0-9._-]{1,100}$/.test(target ?? '') || extra.length) throw Error();
  const settings = await readAIStartup(), config = await readBoundedConfig(settings);
  const g = config.generation, instant = new Date().toISOString();
  const original = checkEffectiveGenerationAuthorization(g.authorization, config.expected, g.model, instant, g.modelOverride);
  const state = await requestBudgetStatus(g.budgetDirectory, original.budget);
  if (state.state !== 'ready') throw Error();
  const override = { schema_version: 1, authorization_hash: original.budget.authorization_hash,
    from_model: g.authorization.model, to_model: target, operator_approved: true,
    approved_at: instant, expires_at: g.authorization.expires_at };
  checkEffectiveGenerationAuthorization(g.authorization, config.expected, target, instant, override);
  const activation = JSON.parse(await readFile(settings.activationFile, 'utf8'));
  const id = randomUUID(), file = path.join(path.dirname(settings.activationFile), `model-change-${id}.json`);
  await writeFile(file, JSON.stringify(override, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  activation.model = target;
  activation.model_override_file = file;
  const temporary = `${settings.activationFile}.${id}.tmp`;
  await writeFile(temporary, JSON.stringify(activation, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await rename(temporary, settings.activationFile);
  process.stdout.write(JSON.stringify({ model: target, remaining: state.remaining, max_attempts: state.max_attempts,
    budget_unchanged: true, external_requests: 0, restart_required: true }) + '\n');
} catch {
  process.stderr.write('Model switch failed. Check the existing activation and idle budget locally. No allowance was created.\n');
  process.exitCode = 1;
}
