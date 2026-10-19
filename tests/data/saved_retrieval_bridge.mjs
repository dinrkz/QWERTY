// Offline consumer test against member 2's actual, unmodified local modules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';

const forbidden = () => { throw new Error('NETWORK_FORBIDDEN'); };
globalThis.fetch = forbidden;
http.request = http.get = https.request = https.get = forbidden;
net.connect = net.createConnection = net.Socket.prototype.connect = forbidden;
syncBuiltinESMExports();

const [appRoot, configPath] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const moduleAt = relative => import(pathToFileURL(path.join(appRoot, relative)).href);
const { retrieveFromProcess } = await moduleAt('src/app/retrieval.mjs');
const { validateInput, validateRetrieval } = await moduleAt('src/shared/validate.mjs');
const { estimates } = await moduleAt('src/shared/policy.mjs');
const request = { ...validateInput(config.request), now: config.now, query_terms: [] };
const call = (command, changes = {}) => retrieveFromProcess({ ...request, ...changes }, { command, cwd: config.cwd });
let checks = 0;
const result = await call(config.command);
assert.equal(validateRetrieval(result, request).dataset_kind, 'synthetic'); checks++;
assert.equal(result.status, 'ok'); checks++;
assert.equal(result.candidates.length, 1); checks++;
const firstVisit = await call(config.command, { first_visit: true });
assert.equal(validateRetrieval(firstVisit, { ...request, first_visit: true }).status, 'ok'); checks++;
for (const changes of [{ required_amenities: ['sockets'] }, { require_open: true }, { events_only: true },
  { available_minutes: 5 }, { categories: ['museum'] }]) {
  const empty = await call(config.command, changes);
  assert.equal(validateRetrieval(empty, { ...request, ...changes }).status, 'no_match'); checks++;
}
for (const [changes, code] of [[{ latitude: true }, 'INVALID_INPUT'], [{ travel_mode: 'driving' }, 'UNSUPPORTED_MODE']]) {
  const error = await call(config.command, changes);
  assert.deepEqual(error, { status: 'error', code });
  assert.throws(() => validateRetrieval(error, request), { code }); checks++;
}
const missing = await call(config.missing_command);
assert.deepEqual(missing, { status: 'error', code: 'DATA_UNAVAILABLE' }); checks++;
const invalid = await call(config.invalid_command);
assert.deepEqual(invalid, { status: 'error', code: 'DATA_INVALID' }); checks++;
const blocked = await call(config.collected_command);
assert.deepEqual(blocked, { status: 'error', code: 'DATA_UNAVAILABLE' }); checks++;
const offline = await call([...config.collected_command, '--mode', 'offline']);
assert.equal(offline.status, 'offline_evaluation');
assert.equal(offline.result.candidates.length, 1);
assert.throws(() => validateRetrieval(offline, request), { code: 'DATA_INVALID' }); checks++;
for (const item of config.estimate_cases) {
  const expected = estimates(item.request, item.poi);
  for (const [key, value] of Object.entries(expected)) {
    if (typeof value === 'number') assert.ok(Math.abs(item.python[key] - value) < 1e-7, key);
    else assert.equal(item.python[key], value);
  }
  checks++;
}
console.log(JSON.stringify({ status: 'passed', bridge_checks: checks,
  estimate_cases: config.estimate_cases.length, network_requests: 0, data: 'authored synthetic fixtures only' }));
