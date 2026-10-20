// Exercises the active HTTP -> workflow -> bounded-service error boundary.
// Existing authored synthetic fixtures only. No live key, dataset or allowance.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createAppServer } from '../../src/server.mjs';
import { AppError } from '../../src/shared/policy.mjs';
import {
  expected, input, now, model, key, authorization,
} from '../app/fixtures/bounded-provider.mjs';

async function start(t, retrieve) {
  let dispatches = 0;
  const server = createAppServer({
    config: {
      mode: 'bounded',
      expected,
      generation: {
        enabled: true, authorization: authorization(), apiKey: key, model, now,
        testFetch: async () => {
          dispatches++;
          throw new Error('Acceptance error cases must stop before provider dispatch');
        },
      },
    },
    testRetrieve: retrieve,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    assert.equal(dispatches, 0, 'No synthetic or real provider dispatch is allowed');
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  const config = await (await fetch(`${url}/api/config`)).json();
  return async body => {
    const response = await fetch(`${url}/api/recommend-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', Origin: url,
        'X-Qadam-Preview': config.preview_token,
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
}

test('QA-08 / AT-09: invalid English input keeps its language through the AI endpoint', async t => {
  let retrievals = 0;
  const post = await start(t, async () => { retrievals++; throw new Error('Not expected'); });
  const result = await post(input({ latitude: 999, query: 'coffee', language: 'en' }));
  assert.equal(result.status, 400);
  assert.equal(result.body.code, 'INVALID_INPUT');
  assert.equal(retrievals, 0);
  assert.equal(result.body.generation.dispatch_attempts, 0);
  assert.equal(result.body.language, 'en');
});

test('QA-09 / AT-09: a retrieval timeout retains its actionable error code', async t => {
  let retrievals = 0;
  const post = await start(t, async () => {
    retrievals++;
    throw new AppError('RETRIEVAL_TIMEOUT');
  });
  const result = await post(input({ query: 'coffee', language: 'en' }));
  assert.equal(result.status, 400);
  assert.equal(retrievals, 1);
  assert.equal(result.body.status, 'error');
  assert.equal(result.body.generation.dispatch_attempts, 0);
  assert.equal(result.body.code, 'RETRIEVAL_TIMEOUT');
  assert.equal(result.body.generation.failure_code, 'RETRIEVAL_TIMEOUT');
});
