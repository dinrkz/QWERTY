import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir, e.name)) : path.join(dir, e.name)))).flat();
}
let count = 0;
for (const dir of ['src', 'public', 'scripts/app', 'tests/app']) {
  for (const file of await files(dir)) {
    if (!file.endsWith('.mjs')) continue;
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) { process.stderr.write(`Syntax check failed: ${file}\n`); process.exitCode = 1; }
    count++;
  }
}
if (!process.exitCode) process.stdout.write(`Syntax checked ${count} JavaScript modules. No separate compiler or bundler is used.\n`);
