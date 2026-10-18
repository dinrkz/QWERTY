// Subprocess test double only. No real collection, indexing, retrieval, or provider calls occur.
const mode = process.argv[2];
let input = '';
for await (const chunk of process.stdin) input += chunk.toString('utf8');
if (mode === 'echo') process.stdout.write(JSON.stringify({ received: JSON.parse(input), argument: process.argv[3] }));
else if (mode === 'environment') process.stdout.write(JSON.stringify({
  secretKeysPresent: ['OPENAI_API_KEY', 'QADAM_MAP_PUBLIC_KEY', 'QADAM_TEST_PRIVATE_SENTINEL'].filter(key => Object.hasOwn(process.env, key)),
  pythonEncoding: process.env.PYTHONIOENCODING,
}));
else if (mode === 'malformed') process.stdout.write('{invalid');
else if (mode === 'multiple') process.stdout.write('{}\n{}');
else if (mode === 'empty') { /* intentionally empty stdout */ }
else if (mode === 'nonzero') { process.stderr.write('SYNTHETIC_PRIVATE_CHILD_DETAIL'); process.exitCode = 2; }
else if (mode === 'stderr') { process.stderr.write('SYNTHETIC_PRIVATE_CHILD_DETAIL'); process.stdout.write('{"status":"synthetic_child_ok"}'); }
else if (mode === 'oversize') process.stdout.write('x'.repeat(512 * 1024 + 1));
else if (mode === 'timeout') setTimeout(() => process.stdout.write('{}'), 30000);
