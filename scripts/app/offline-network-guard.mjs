// Verification guard: permit loopback HTTP, block provider fetch/HTTPS calls.
import https from 'node:https';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('External fetch forbidden during offline verification');
  }
  return originalFetch(input, options);
};
https.request = https.get = () => { throw new Error('HTTPS forbidden during offline verification'); };
