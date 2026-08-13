import assert from 'node:assert/strict';
import fs from 'node:fs';

const runner = fs.readFileSync('scripts/run-tests.js', 'utf8');
const crossStackRunner = fs.readFileSync('scripts/run-cross-stack-tests.js', 'utf8');
const registry = JSON.parse(fs.readFileSync('config/historical-test-checkpoints.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert.equal(registry.schemaVersion, 1);
assert.ok(Object.keys(registry.tests || {}).length > 0, 'historical checkpoints must be explicit, never inferred silently');
assert.match(runner, /--include-historical/);
assert.match(runner, /historical-test-checkpoints\.json/);
assert.match(runner, /historicalSkipped=/);
assert.match(crossStackRunner, /historical-test-checkpoints\.json/);
assert.match(crossStackRunner, /crossStackOnly/);
assert.match(crossStackRunner, /historicalSkipped=/);
assert.equal(pkg.scripts['test:historical'], 'node scripts/run-tests.js --include-historical');
assert.equal(pkg.scripts['test:cross-stack:historical'], 'node scripts/run-cross-stack-tests.js --include-historical');
for (const file of Object.keys(registry.tests || {})) {
  assert.equal(fs.existsSync(file), true, `historical checkpoint must remain physically available: ${file}`);
}
console.log('current test runner historical isolation v421: ok');
