// Explicit operator smoke test. One simulated outing, up to two counted calls.
// Writes only aggregate evidence; never keys, request bodies or place records.
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { readAIStartup } from './start-ai.mjs';
import { readBoundedConfig } from './start-bounded.mjs';
const url = 'http://127.0.0.1:3003';
try {
  if (process.argv.slice(2).join(' ') !== '--run') throw Error();
  const config = await readBoundedConfig(await readAIStartup());
  const before = await (await fetch(`${url}/api/config`)).json();
  if (before.generation_model !== config.generation.model || !before.interpretation_configured
    || before.ai.state !== 'ready' || before.ai.remaining < 2) throw Error();
  const started = Date.now();
  const response = await fetch(`${url}/api/recommend-ai`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: url, 'X-Qadam-Preview': before.preview_token },
    body: JSON.stringify({ query: 'Я рядом с Байтереком, хочу выпить кофе, у меня 45 минут',
      language: 'ru', latitude: 51.089, longitude: 71.405, categories: ['park','landmark'],
      available_minutes: 60, travel_mode: 'walking', max_distance_m: 3000 }),
    signal: AbortSignal.timeout(145000) });
  const result = await response.json(), elapsed_ms = Date.now() - started;
  const after = await (await fetch(`${url}/api/config`)).json();
  const report = { checked_at: new Date().toISOString(), model: before.generation_model,
    elapsed_ms, status: result.status, recommendations: result.recommendations?.length ?? 0,
    interpreted_correctly: result.understood?.start === 'bayterek' && result.understood?.available_minutes === 45
      && JSON.stringify(result.understood?.categories) === '["cafe"]',
    estimates_fit: result.recommendations?.every(c => c.estimates.total_minutes <= 45) ?? false,
    requests_used: before.ai.remaining - after.ai.remaining, remaining: after.ai.remaining };
  await writeFile(new URL(`../../data/runtime/model-smoke-${randomUUID()}.json`, import.meta.url),
    JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  process.stdout.write(JSON.stringify(report) + '\n');
  if (result.status !== 'live_rag' || !report.interpreted_correctly || !report.estimates_fit) process.exitCode = 1;
} catch {
  process.stderr.write('Live check stopped. Do not retry automatically; inspect existing accounting locally.\n');
  process.exitCode = 1;
}
