import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createOpenAI } from './app/openai.mjs';
import { createService } from './app/service.mjs';
import { parseRetrievalCommand, retrieveFromProcess } from './app/retrieval.mjs';
import { errorResult } from './app/presentation.mjs';
import { validateInput } from './shared/validate.mjs';
import { AppError, detectLanguage } from './shared/policy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = new Map([['/', ['index.html','text/html; charset=utf-8']],
  ['/app.mjs', ['app.mjs','text/javascript; charset=utf-8']], ['/i18n.mjs', ['i18n.mjs','text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css','text/css; charset=utf-8']]]);

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

export function createAppServer({ config = readConfig(), recommend } = {}) {
  const provider = createOpenAI({ apiKey: config.apiKey, model: config.model });
  const service = recommend ?? createService({ ...provider,
    retrieve: request => retrieveFromProcess(request, { command: config.command, cwd: root }) });
  let inFlight = 0;
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(self)');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://mapgl.2gis.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.2gis.com https://*.2gis.ru; connect-src 'self' https://*.2gis.com https://*.2gis.ru; worker-src blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const json = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    try {
      const allowedHosts = new Set([`127.0.0.1:${server.address()?.port}`, `localhost:${server.address()?.port}`]);
      if (!allowedHosts.has(req.headers.host)) { json(errorResult('INVALID_INPUT'), 403); return; }
      const target = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === 'GET' && target.pathname === '/api/config') {
        json({ map_public_key: config.mapKey, generation_configured: Boolean(config.apiKey && config.model), retrieval_configured: Boolean(config.command) }); return;
      }
      if (req.method === 'GET' && files.has(target.pathname)) {
        const [name, mime] = files.get(target.pathname);
        const bytes = await readFile(path.join(root, 'public', name));
        res.writeHead(200, { 'Content-Type': mime }); res.end(bytes); return;
      }
      if (req.method !== 'POST' || target.pathname !== '/api/recommend') { json(errorResult('INVALID_INPUT'), 404); return; }
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) { json(errorResult('INVALID_INPUT'), 403); return; }
      if (inFlight >= 2) { json(errorResult('BUSY'), 429); return; }
      inFlight++;
      try {
        let body;
        try { body = await bodyJson(req); } catch { json(errorResult('INVALID_INPUT'), 400); return; }
        let validated;
        try { validated = validateInput(body); } catch (error) {
          json(errorResult(error instanceof AppError ? error.code : 'INVALID_INPUT',
            detectLanguage(typeof body?.query === 'string' ? body.query : '', body?.language)), 400); return;
        }
        // Preflight avoids a paid interpretation request when data is not configured.
        const result = !config.command && !recommend ? errorResult('DATA_UNAVAILABLE', validated.language)
          : (!config.apiKey || !config.model) && !recommend ? errorResult('PROVIDER_NOT_CONFIGURED', validated.language)
          : await service(body);
        json(result, result.status === 'error' ? 400 : 200);
      } finally { inFlight--; }
    } catch { json(errorResult('INTERNAL_ERROR'), 500); }
  });
  server.requestTimeout = 45000;
  server.headersTimeout = 10000;
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
