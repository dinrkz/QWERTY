import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createGenerationWorkflow } from './app/generation-workflow.mjs';
import { createWalkingRouter } from './app/walking-route.mjs';
import { checkEffectiveGenerationAuthorization as checkGenerationAuthorization } from './app/generation-authorization.mjs';
import { requestBudgetStatus } from './app/request-budget.mjs';
import { createOpenAI } from './app/openai.mjs';
import { createNaturalRecommendation } from './app/walking-intent.mjs';
import { createService } from './app/service.mjs';
import { createOfflineService, validateOfflineInput } from './app/offline.mjs';
import { parseRetrievalCommand, retrieveFromProcess } from './app/retrieval.mjs';
import { errorResult } from './app/presentation.mjs';
import { validateInput } from './shared/validate.mjs';
import { AppError, detectLanguage } from './shared/policy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = new Map([['/', ['index.html','text/html; charset=utf-8']],
  ['/app.mjs', ['app.mjs','text/javascript; charset=utf-8']], ['/i18n.mjs', ['i18n.mjs','text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css','text/css; charset=utf-8']]]);
files.set('/generation-review.mjs', ['generation-review.mjs', 'text/javascript; charset=utf-8']);
files.set('/control-lock.mjs', ['control-lock.mjs', 'text/javascript; charset=utf-8']);
files.set('/osm-map.mjs', ['osm-map.mjs', 'text/javascript; charset=utf-8']);
files.set('/route-selection.mjs', ['route-selection.mjs', 'text/javascript; charset=utf-8']);
files.set('/search-intent.mjs', ['search-intent.mjs', 'text/javascript; charset=utf-8']);
files.set('/vendor/leaflet/leaflet.js', ['vendor/leaflet/leaflet.js', 'text/javascript; charset=utf-8']);
files.set('/vendor/leaflet/leaflet.css', ['vendor/leaflet/leaflet.css', 'text/css; charset=utf-8']);

export function readConfig(env = process.env) {
  const command = parseRetrievalCommand(env.QADAM_RETRIEVAL_COMMAND);
  const port = env.PORT === undefined ? 3000 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_CONFIG');
  const apiKey = env.OPENAI_API_KEY?.trim() || '';
  const model = env.OPENAI_MODEL?.trim() || '';
  const mapKey = env.QADAM_MAP_PUBLIC_KEY?.trim() || '';
  if (mapKey && (mapKey === apiKey || mapKey.startsWith('sk-'))) throw new Error('INVALID_CONFIG');
  return { command, port, apiKey, model, mapKey };
}

async function bodyJson(req) {
  if ((req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') { req.resume(); throw new Error('INVALID_INPUT'); }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      length += chunk.length;
      if (length > 16 * 1024) { tooLarge = true; chunks.length = 0; reject(new Error('INVALID_INPUT')); }
      else if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('INVALID_INPUT')); }
    });
    req.on('aborted', () => reject(new Error('INVALID_INPUT')));
    req.on('error', () => reject(new Error('INVALID_INPUT')));
  });
}

export function createAppServer({ config = readConfig(), recommend, testRetrieve, testRouteFetch } = {}) {
  const offline = config.mode === 'offline';
  const bounded = config.mode === 'bounded';
  const saved = offline || bounded;
  if (testRetrieve && (!bounded || config.expected?.dataset_kind !== 'synthetic')) throw new AppError('DATA_INVALID');
  const retrieve = testRetrieve ?? (request => retrieveFromProcess(request, { command: config.command, cwd: root }));
  // The offline branch does not construct a provider or enter interpretation or
  // generation. Private envelopes never pass through the live RAG validator.
  const service = recommend ?? (saved ? createOfflineService({ retrieve, expected: config.expected })
    : createService({ ...createOpenAI({ apiKey: config.apiKey, model: config.model }), retrieve }));
  const workflow = bounded ? createGenerationWorkflow({ ...config.generation, retrieve, expected: config.expected }) : null;
  const naturalRecommend = bounded && config.generation?.interpretationEnabled === true
    ? createNaturalRecommendation({ ...config.generation, expected: config.expected }, input => workflow.recommend(input)) : null;
  const previewToken = bounded ? randomUUID() : null;
  const walkingRoute = bounded ? createWalkingRouter(testRouteFetch ? { fetchImpl: testRouteFetch } : {}) : null;
  let inFlight = 0;
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', saved ? 'geolocation=()' : 'geolocation=(self)');
    res.setHeader('Content-Security-Policy', bounded
      ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; worker-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
      : offline
      ? "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; worker-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
      : "default-src 'self'; script-src 'self' https://mapgl.2gis.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.2gis.com https://*.2gis.ru; connect-src 'self' https://*.2gis.com https://*.2gis.ru; worker-src blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const json = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    try {
      const allowedHosts = new Set([`127.0.0.1:${server.address()?.port}`, `localhost:${server.address()?.port}`]);
      if (!allowedHosts.has(req.headers.host)) { json(errorResult('INVALID_INPUT'), 403); return; }
      const target = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === 'GET' && target.pathname === '/api/config') {
        let ai = { state: 'disabled', remaining: 0, max_attempts: 0 };
        if (bounded && config.generation?.enabled === true) {
          try {
            const { budget } = checkGenerationAuthorization(config.generation.authorization, config.expected, config.generation.model,
              config.generation.now?.() ?? new Date().toISOString(), config.generation.modelOverride ?? null);
            ai = await requestBudgetStatus(config.generation.budgetDirectory, budget);
          } catch { ai = { state: 'expired', remaining: 0, max_attempts: 0 }; }
        }
        json(bounded ? { mode: 'bounded', map_public_key: '', generation_configured: config.generation?.enabled === true,
          generation_model: config.generation?.enabled === true ? config.generation.model : null,
          interpretation_configured: Boolean(naturalRecommend),
          retrieval_configured: Boolean(config.command || testRetrieve), preview_token: previewToken, ai }
          : offline ? { mode: 'offline', map_public_key: '', generation_configured: false, retrieval_configured: Boolean(config.command) }
          : { map_public_key: config.mapKey, generation_configured: Boolean(config.apiKey && config.model), retrieval_configured: Boolean(config.command) }); return;
      }
      if (req.method === 'GET' && files.has(target.pathname)) {
        const [name, mime] = files.get(target.pathname);
        const bytes = await readFile(path.join(root, 'public', name));
        res.writeHead(200, { 'Content-Type': mime }); res.end(bytes); return;
      }
      const generationRoute = bounded && ['/api/generation/preview', '/api/generation/confirm', '/api/recommend-ai', '/api/route'].includes(target.pathname);
      if (req.method !== 'POST' || (target.pathname !== '/api/recommend' && !generationRoute)) { json(errorResult('INVALID_INPUT'), 404); return; }
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) { json(errorResult('INVALID_INPUT'), 403); return; }
      if (generationRoute && (req.headers.origin !== `http://${req.headers.host}` || req.headers['x-qadam-preview'] !== previewToken)) {
        json(errorResult('INVALID_INPUT'), 403); return;
      }
      if (inFlight >= 2) { json(errorResult('BUSY'), 429); return; }
      inFlight++;
      try {
        let body;
        try { body = await bodyJson(req); } catch { json(errorResult('INVALID_INPUT'), 400); return; }
        if (generationRoute) {
          if (target.pathname === '/api/route') { const result = await walkingRoute(body); json(result, result.status === 'ok' ? 200 : result.code === 'ROUTE_INVALID' ? 400 : 503); return; }
          if (target.pathname === '/api/recommend-ai') workflow.invalidate();
          const result = await (target.pathname === '/api/recommend-ai' ? (naturalRecommend ?? workflow.recommend)(body)
            : target.pathname.endsWith('/preview') ? workflow.preview(body) : workflow.generate(body));
          json(result, result.status === 'error' ? 400 : 200); return;
        }
        let validated;
        try { validated = (saved ? validateOfflineInput : validateInput)(body); } catch (error) {
          json(errorResult(error instanceof AppError ? error.code : 'INVALID_INPUT',
            detectLanguage(typeof body?.query === 'string' ? body.query : '', body?.language)), 400); return;
        }
        // Preflight avoids a paid interpretation request when data is not configured.
        const result = !config.command && !recommend && !testRetrieve ? errorResult('DATA_UNAVAILABLE', validated.language)
          : !saved && (!config.apiKey || !config.model) && !recommend ? errorResult('PROVIDER_NOT_CONFIGURED', validated.language)
          : await service(body);
        json(result, result.status === 'error' ? 400 : 200);
      } finally { inFlight--; }
    } catch { json(errorResult('INTERNAL_ERROR'), 500); }
  });
  server.requestTimeout = 45000;
  server.headersTimeout = 10000;
  server.on('close', () => workflow?.invalidate());
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = readConfig();
    const server = createAppServer({ config });
    server.on('error', () => { process.stderr.write('Qadam could not start. Check the port/configuration.\n'); process.exitCode = 1; });
    server.listen(config.port, '127.0.0.1', () => process.stdout.write(`Qadam: http://127.0.0.1:${config.port}\n`));
  } catch { process.stderr.write('Invalid local configuration. Check .env.local without sharing its contents.\n'); process.exitCode = 1; }
}
