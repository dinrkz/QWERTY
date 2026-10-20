// Child-process fixture: local disk reservation only, no provider transport.
import { reserveRequest } from '../../../src/app/request-budget.mjs';
try {
  const slot = await reserveRequest(process.argv[2], JSON.parse(process.argv[3]));
  await new Promise(resolve => setTimeout(resolve, 50));
  await slot.finish({ outcome: 'selected' });
  process.stdout.write(JSON.stringify({ attempt: slot.attempt }));
} catch (e) {
  process.stdout.write(JSON.stringify({ code: ['BUDGET_BUSY', 'BUDGET_EXHAUSTED'].includes(e.code) ? e.code : 'FAILED' }));
}
