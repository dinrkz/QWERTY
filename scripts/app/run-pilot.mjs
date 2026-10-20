// Explicit pilot operations. No retries, raw provider output or credential logging.
import { readFile, mkdir, readdir, stat, open } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readOfflineConfig } from './start-offline.mjs';
import { readBoundedConfig } from './start-bounded.mjs';
import { retrieveFromProcess } from '../../src/app/retrieval.mjs';
import { validateOfflineInput } from '../../src/app/offline.mjs';
import { createEvidenceSession } from '../../src/app/generation-evidence.mjs';
import { checkGenerationAuthorization, checkEffectiveGenerationAuthorization, MAX_ATTEMPTS } from '../../src/app/generation-authorization.mjs';
import { initializeRequestBudget, requestBudgetStatus, reviewUncertainRequest } from '../../src/app/request-budget.mjs';
import { createGenerationWorkflow } from '../../src/app/generation-workflow.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const runtime = path.join(root, 'data/runtime');
const hash = value => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const base = { query: '', language: 'ru', travel_mode: 'walking', max_distance_m: 3000 };
export const PILOT_SCENARIOS = [
  { id: 'coffee', input: { ...base, latitude: 51.128, longitude: 71.430, categories: ['cafe'], available_minutes: 45 } },
  { id: 'walk', input: { ...base, latitude: 51.089, longitude: 71.405, categories: ['park', 'landmark'], available_minutes: 60 } },
  { id: 'first_visit', input: { ...base, latitude: 51.128, longitude: 71.430, categories: ['park', 'museum', 'landmark'], available_minutes: 90, first_visit: true } },
];
async function json(filename, max = 65536) {
  if ((await stat(filename)).size > max) throw new Error('PILOT_INVALID');
  return JSON.parse(await readFile(filename, 'utf8'));
}
async function save(filename, value) {
  const handle = await open(filename, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(value, null, 2) + '\n'); await handle.sync(); }
  finally { await handle.close(); }
}
export async function fingerprints(config) {
  const arg = key => config.command[config.command.indexOf(key) + 1];
  const snapshot = arg('--snapshot'), result = {};
  for (const name of await readdir(snapshot)) {
    const file = path.join(snapshot, name); if ((await stat(file)).isFile()) result[`snapshot/${name}`] = hash(await readFile(file));
  }
  for (const [label, file] of [['annotations', arg('--annotations')], ['binding', arg('--binding')],
    ['probe', path.join(runtime, '2gis-probe-v1/ledger.jsonl')], ['collector', path.join(runtime, '2gis-collection/ledger.jsonl')],
    ['collector_current', path.join(runtime, '2gis-collection/current.json')], ['review', path.join(root, 'data/private/walking-review-final/review.json')]]) {
    try { result[label] = hash(await readFile(file)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return result;
}
export async function preparePilot(directory, model, history = {}, policy = {}) {
  const maxAttempts = policy.maxAttempts ?? 3, validityHours = policy.validityHours ?? 6;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS
    || !Number.isInteger(validityHours) || validityHours < 1 || validityHours > 720) throw new Error('PILOT_INVALID');
  if (typeof model !== 'string' || !/^[a-zA-Z0-9._-]{1,100}$/.test(model)) throw new Error('PILOT_INVALID');
  const config = await readOfflineConfig(), records = new Map(), scenarios = [];
  const before = await fingerprints(config);
  for (const scenario of PILOT_SCENARIOS) {
    const input = validateOfflineInput(scenario.input), timestamp = now();
    const envelope = await retrieveFromProcess({ ...input, now: timestamp, query_terms: [], limit: 10 }, { command: config.command, cwd: root });
    const session = createEvidenceSession({ input, envelope, expected: config.expected, now: timestamp });
    for (const c of envelope.result.candidates.slice(0, 5)) records.set(c.poi.id, { id: c.poi.id, source_version: c.poi.source_version });
    scenarios.push({ ...scenario, eligible_count: envelope.result.eligible_count,
      projected_count: session.packet.candidates.length, descriptions_present: session.packet.candidates.filter(c => c.description !== null).length });
  }
  if (!records.size) throw new Error('PILOT_NO_CANDIDATES');
  if (history.scope === 'reviewed_candidates') {
    // Local retrieval above validates snapshot/review/binding hashes. This local
    // allowlist adds only reviewed candidates; outbound packets still contain <=5.
    const annotations = await json(config.command[config.command.indexOf('--annotations') + 1], 2 * 1024 * 1024);
    for (const item of annotations.assessments) if (item.status === 'candidate') {
      records.set(item.id, { id: item.id, source_version: item.source_version });
    }
  }
  const authorization = { schema_version: 1, provider: 'openai', purpose: 'walking_recommendations', model, expected: config.expected,
    records: [...records.values()], fields: ['name', 'categories', 'estimates', 'description'],
    expires_at: new Date(Date.now() + validityHours * 3600000).toISOString(),
    decision: { operator_approved: true, source_use_basis: 'User explicitly authorized real OpenAI use for this private project on 2026-10-19. This records that operator decision; 2GIS AI-processing and redistribution rights remain unverified. Only selected evidence, no public dataset release.' },
    limits: { max_attempts: maxAttempts, max_output_tokens: 1800, timeout_ms: 60000 } };
  if (policy.persistentAI) authorization.decision.source_use_basis = 'User requested always-enabled AI for the private interactive interface on 2026-10-19. This successor preserves earlier attempts and permits up to 100 additional selected-evidence calls, one per deliberate search. Source processing and redistribution rights remain unverified; no dataset publication.';
  const { budget } = checkGenerationAuthorization(authorization, config.expected, model, now());
  if (JSON.stringify(before) !== JSON.stringify(await fingerprints(config))) throw new Error('INPUTS_CHANGED');
  await mkdir(directory); // Never overwrite or reset another pilot.
  const authorization_file = path.join(directory, 'authorization.json'), budget_directory = path.join(directory, 'budget');
  await save(authorization_file, authorization);
  await initializeRequestBudget(budget_directory, budget);
  await save(path.join(directory, 'activation.json'), { enabled: true, model, authorization_file, budget_directory });
  await save(path.join(directory, 'plan.json'), { ...history, prepared_at: now(), model, scenarios, fingerprints: before });
  return { status: 'prepared', model, max_attempts: maxAttempts, expires_at: authorization.expires_at, authorized_records: records.size, scenarios: scenarios.map(({ id, projected_count, descriptions_present }) => ({ id, projected_count, descriptions_present })), external_requests: 0 };
}

export async function prepareInterface(directory, previousDirectory, interactive = false, persistentAI = false) {
  const prior = path.resolve(previousDirectory);
  if (!prior.startsWith(runtime + path.sep)) throw new Error('PILOT_INVALID');
  const plan = await json(path.join(prior, 'plan.json'));
  const manifestFile = path.join(prior, 'budget/manifest.json');
  const config = await readOfflineConfig();
  const previousAuth = await json(path.join(prior, 'authorization.json'));
  const { budget } = checkGenerationAuthorization(previousAuth, config.expected, plan.model, plan.prepared_at);
  const state = await requestBudgetStatus(path.join(prior, 'budget'), budget);
  if (state.state !== 'exhausted' || !Number.isSafeInteger(plan.prior_attempts ?? 0) || (plan.prior_attempts ?? 0) < 0
    || JSON.stringify(plan.fingerprints) !== JSON.stringify(await fingerprints(config))) throw new Error('PILOT_INVALID');
  const priorAttempts = (plan.prior_attempts ?? 0) + budget.max_attempts;
  const maxAttempts = persistentAI ? MAX_ATTEMPTS : 3;
  if (!Number.isSafeInteger(priorAttempts + maxAttempts)) throw new Error('PILOT_INVALID');
  const result = await preparePilot(directory, plan.model, { prior_attempts: priorAttempts, previous_pilot: prior,
    scope: interactive ? 'reviewed_candidates' : 'scenario_candidates',
    previous_manifest_sha256: hash(await readFile(manifestFile)), ai_default: persistentAI },
    persistentAI ? { maxAttempts, validityHours: 720, persistentAI: true } : {});
  return { ...result, prior_attempts: priorAttempts, total_ceiling: priorAttempts + maxAttempts };
}

export async function runPilot(directory, scenarioId) {
  const plan = await json(path.join(directory, 'plan.json'));
  const scenario = plan.scenarios.find(s => s.id === scenarioId);
  if (!scenario || !scenario.projected_count) throw new Error('PILOT_INVALID');
  // Read the key into this process only; never print it or forward other .env values.
  const localEnv = parseEnv(await readFile(path.join(root, '.env'), 'utf8'));
  const config = await readBoundedConfig({ activationFile: path.join(directory, 'activation.json'), env: { OPENAI_API_KEY: localEnv.OPENAI_API_KEY } });
  if (JSON.stringify(plan.fingerprints) !== JSON.stringify(await fingerprints(config))) throw new Error('INPUTS_CHANGED');
  const workflow = createGenerationWorkflow({ ...config.generation, expected: config.expected,
    retrieve: request => retrieveFromProcess(request, { command: config.command, cwd: root }) });
  try {
    const preview = await workflow.preview(scenario.input);
    if (!preview.ready || !preview.preview_id) throw new Error('PILOT_NOT_READY');
    await save(path.join(directory, `${scenarioId}.started.json`), { started_at: now(), body_sha256: hash(preview.request_body) });
    const started = Date.now();
    const result = await workflow.generate({ preview_id: preview.preview_id });
    const unchanged = JSON.stringify(plan.fingerprints) === JSON.stringify(await fingerprints(config));
    const usageFile = result.generation?.attempt ? path.join(config.generation.budgetDirectory, `${result.generation.attempt}.outcome.json`) : null;
    const outcome = usageFile ? await json(usageFile) : null;
    const names = await readdir(config.generation.budgetDirectory), reserved = names.filter(n => n.endsWith('.reserved.json')).length;
    const report = { scenario: scenarioId, finished_at: now(), model: config.generation.model, status: result.status,
      recommendations: result.recommendations.length, generation: result.generation, usage: outcome?.usage ?? null,
      elapsed_ms: Date.now() - started, attempts_used: reserved, attempts_remaining: config.generation.authorization.limits.max_attempts - reserved,
      prior_attempts: plan.prior_attempts ?? 0, total_attempts_used: (plan.prior_attempts ?? 0) + reserved,
      transport_timeout_ms: preview.limits.timeout_ms,
      locked: names.includes('active.lock'), unchanged_files: unchanged ? Object.keys(plan.fingerprints).length : 0,
      estimates_fit: result.recommendations.every(c => c.estimates.total_minutes <= scenario.input.available_minutes),
      unique_ids: new Set(result.recommendations.map(c => c.poi_id)).size === result.recommendations.length,
      templates_labeled: result.recommendations.every(c => c.activity.kind === (result.status === 'live_rag' ? 'generated_selection_template' : 'template_suggestion')),
      two_gis_requests: 0 };
    report.verification_passed = unchanged && report.estimates_fit && report.unique_ids && report.templates_labeled;
    await save(path.join(directory, `${scenarioId}.report.json`), report);
    return report;
  } finally { workflow.invalidate(); }
}

// A separately approved ONE-request diagnostic after an exhausted prior run.
// Copies its reviewed scope; never changes or resets any original ledger.
export async function prepareDiagnostic(directory, priorDirectory) {
  const prior = path.resolve(priorDirectory);
  if (!prior.startsWith(runtime + path.sep)) throw new Error('PILOT_INVALID');
  const config = await readOfflineConfig(), previous = await json(path.join(prior, 'plan.json'));
  const previousAuth = await json(path.join(prior, 'authorization.json'));
  const manifest = await json(path.join(prior, 'budget/manifest.json'));
  const names = await readdir(path.join(prior, 'budget'));
  const originalBudget = checkGenerationAuthorization(previousAuth, config.expected, previous.model, previous.prepared_at).budget;
  const priorAttempts = (previous.prior_attempts ?? 0) + originalBudget.max_attempts;
  if (manifest.authorization_hash !== originalBudget.authorization_hash || manifest.max_attempts !== originalBudget.max_attempts
    || names.includes('active.lock') || names.filter(n => n.endsWith('.reserved.json')).length !== originalBudget.max_attempts
    || names.filter(n => n.endsWith('.outcome.json')).length !== originalBudget.max_attempts) throw new Error('PILOT_INVALID');
  if (JSON.stringify(previous.fingerprints) !== JSON.stringify(await fingerprints(config))) throw new Error('INPUTS_CHANGED');
  const authorization = { ...previousAuth, expires_at: new Date(Date.now() + 3600000).toISOString(),
    decision: { operator_approved: true, source_use_basis: `User approved one additional selected-data first-visit diagnostic request on 2026-10-19 after updating the local API key. ${priorAttempts} earlier attempts remain counted. Private source-use rights remain unverified.` },
    limits: { max_attempts: 1, max_output_tokens: 1800, timeout_ms: 60000 } };
  const { budget } = checkGenerationAuthorization(authorization, config.expected, previous.model, now());
  await mkdir(directory);
  const authorization_file = path.join(directory, 'authorization.json'), budget_directory = path.join(directory, 'budget');
  await save(authorization_file, authorization); await initializeRequestBudget(budget_directory, budget);
  await save(path.join(directory, 'activation.json'), { enabled: true, model: previous.model, authorization_file, budget_directory });
  await save(path.join(directory, 'plan.json'), { ...previous, prepared_at: now(), prior_attempts: priorAttempts,
    previous_pilot: prior, previous_manifest_sha256: hash(await readFile(path.join(prior, 'budget/manifest.json'))),
    scenarios: previous.scenarios.filter(s => s.id === 'first_visit') });
  return { status: 'prepared', max_attempts: 1, prior_attempts: priorAttempts, total_ceiling: priorAttempts + 1, timeout_ms: 60000, external_requests: 0 };
}

// Run only after the sole local caller has exited. This agent review acknowledges
// unknown remote completion; it is neither a refund nor a new human approval.
export async function reviewPilot(directory, attempt, transportTimeoutMs) {
  const config = await readOfflineConfig();
  const activation = await json(path.join(directory, 'activation.json'));
  if (activation.budget_directory !== path.join(directory, 'budget')
    || activation.authorization_file !== path.join(directory, 'authorization.json')) throw new Error('PILOT_INVALID');
  const authorization = await json(activation.authorization_file);
  const override = activation.model_override_file === undefined ? null : await json(activation.model_override_file);
  const { budget } = checkEffectiveGenerationAuthorization(authorization, config.expected, activation.model, now(), override);
  return reviewUncertainRequest(activation.budget_directory, budget, { attempt, acknowledgeUnknown: true, transportTimeoutMs });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [operation, folder, value, ...extra] = process.argv.slice(2), directory = path.resolve(folder ?? '');
    const timeout = operation === 'review' && extra.length === 2 && extra[0] === '--timeout-ms' ? Number(extra[1]) : undefined;
    if (extra.length && timeout === undefined || !directory.startsWith(runtime + path.sep) || !value || !['prepare', 'prepare-interface', 'prepare-interactive', 'prepare-ai-default', 'prepare-diagnostic', 'run', 'review'].includes(operation)) throw new Error('PILOT_INVALID');
    const report = await (operation === 'prepare' ? preparePilot(directory, value)
      : ['prepare-interface', 'prepare-interactive', 'prepare-ai-default'].includes(operation) ? prepareInterface(directory, value, operation !== 'prepare-interface', operation === 'prepare-ai-default')
      : operation === 'prepare-diagnostic' ? prepareDiagnostic(directory, value)
      : operation === 'review' ? reviewPilot(directory, Number(value), timeout) : runPilot(directory, value));
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (operation === 'run' && (report.status !== 'live_rag' || !report.verification_passed)) process.exitCode = 1;
  } catch { process.stderr.write('PILOT_STOPPED. Inspect the private ledger; do not retry or delete it.\n'); process.exitCode = 1; }
}
