import { spawn } from 'node:child_process';
import { AppError } from '../shared/policy.mjs';

export function parseRetrievalCommand(value) {
  if (!value?.trim()) return null;
  try {
    const command = JSON.parse(value);
    if (!Array.isArray(command) || command.length < 1 || command.length > 20
      || command.some(part => typeof part !== 'string' || !part.trim() || /[\r\n\u0000]/u.test(part))) throw new Error();
    return command;
  } catch { throw new AppError('INVALID_CONFIG'); }
}

// This is a transport adapter, not a second search/filter implementation.
export function retrieveFromProcess(request, { command, timeoutMs = 8000, cwd = process.cwd() } = {}) {
  if (!command) return Promise.reject(new AppError('DATA_UNAVAILABLE'));
  return new Promise((resolve, reject) => {
    const env = { PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' };
    for (const key of ['PATH','Path','SystemRoot','WINDIR','PATHEXT','LANG','TEMP','TMP']) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    let child;
    try { child = spawn(command[0], command.slice(1), { cwd, env, shell: false, windowsHide: true, stdio: ['pipe','pipe','ignore'] }); }
    catch { reject(new AppError('DATA_UNAVAILABLE')); return; }
    let settled = false;
    let size = 0;
    const chunks = [];
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) { child.kill(); reject(error); } else resolve(result);
    };
    const timer = setTimeout(() => finish(new AppError('RETRIEVAL_TIMEOUT')), timeoutMs);
    child.on('error', () => finish(new AppError('DATA_UNAVAILABLE')));
    child.stdin.on('error', () => finish(new AppError('DATA_UNAVAILABLE')));
    child.stdout.on('data', chunk => {
      size += chunk.length;
      if (size > 512 * 1024) finish(new AppError('DATA_INVALID'));
      else chunks.push(chunk);
    });
    child.on('close', code => {
      if (settled) return;
      if (code !== 0) { finish(new AppError('DATA_UNAVAILABLE')); return; }
      try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { finish(new AppError('DATA_INVALID')); }
    });
    child.stdin.end(JSON.stringify({ ...request, limit: 10 }));
  });
}
