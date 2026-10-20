// Operator setup only, after approval to send typed requests to OpenAI.
// Adds a capability to the existing activation; never creates/reset budgets.
import { readFile, writeFile } from 'node:fs/promises';
import { readAIStartup } from './start-ai.mjs';
import { readBoundedConfig } from './start-bounded.mjs';

try {
  if (process.argv.slice(2).join(' ') !== '--enable-text-interpretation') throw Error();
  const settings = await readAIStartup();
  await readBoundedConfig(settings);
  const activation = JSON.parse(await readFile(settings.activationFile, 'utf8'));
  activation.interpretation_enabled = true;
  await writeFile(settings.activationFile, JSON.stringify(activation, null, 2) + '\n');
  process.stdout.write('Text interpretation enabled. Restart the AI server. Existing allowance is unchanged.\n');
} catch {
  process.stderr.write('Could not enable text interpretation. Check the existing AI configuration locally.\n');
  process.exitCode = 1;
}
