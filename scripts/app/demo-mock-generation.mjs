// Authored synthetic demonstration only. Does not read configuration or data files.
import './offline-network-guard.mjs';
import { createMockGenerationService } from '../../src/app/mock-generation.mjs';
import { expected, input, envelope, normalized } from '../../tests/app/fixtures/private-envelope.mjs';

if (process.argv.length !== 2) {
  process.stderr.write('This synthetic demo takes no arguments.\n');
  process.exitCode = 1;
} else {
  const service = createMockGenerationService({ expected, now: () => normalized().now, retrieve: async req => envelope(req) });
  const result = await service(input());
  if (result.status !== 'mock_generation') { process.stderr.write('SYNTHETIC_MOCK_DEMO_FAILED\n'); process.exitCode = 1; }
  else process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
