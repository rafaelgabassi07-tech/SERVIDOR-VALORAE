import assert from 'node:assert/strict';
import {
  getProviderHealthSnapshot,
  providerHealthSharedStateStats,
  recordProviderResult,
  resetProviderHealth,
} from '../lib/resilience/circuit-breaker.js';
import { _test as syncTest } from '../routes/sync.js';
import { RELEASE } from '../lib/core/release.js';

assert.equal(RELEASE.ecosystemContract, 'valorae-ecosystem-2026.08.05.03-p403');
assert.ok(RELEASE.compatibleEcosystemContracts.includes('valorae-ecosystem-2026.08.05.02-p402'));
resetProviderHealth();
for (let index = 0; index < 120; index += 1) {
  recordProviderResult(`unknown-${index}.example`, false, { status: 503, retryable: true });
}
const health = getProviderHealthSnapshot();
const healthStats = providerHealthSharedStateStats();
assert.ok(Object.keys(health).length <= healthStats.maxProviderEntries);
assert.ok(healthStats.providerEntries <= healthStats.maxProviderEntries);
assert.doesNotThrow(() => resetProviderHealth('unknown-119.example'));
assert.doesNotThrow(() => resetProviderHealth());

const future = new Date(Date.now() + 30_000).toUTCString();
const retryDate = syncTest.retryAfterMs({ headers: { get: name => name === 'retry-after' ? future : null } });
assert.ok(retryDate >= 0 && retryDate <= 31_000, retryDate);
assert.equal(syncTest.retryAfterMs({ headers: { get: () => '7' } }), 7_000);

const previousLimit = process.env.VALORAE_SYNC_MAX_RESPONSE_BYTES;
process.env.VALORAE_SYNC_MAX_RESPONSE_BYTES = '65536';
await assert.rejects(
  () => syncTest.readBoundedResponseText({
    headers: { get: name => name === 'content-length' ? '70000' : null },
    text: async () => 'never',
  }),
  error => error?.code === 'SUPABASE_RESPONSE_TOO_LARGE' && error?.retryable === false,
);
if (previousLimit === undefined) delete process.env.VALORAE_SYNC_MAX_RESPONSE_BYTES;
else process.env.VALORAE_SYNC_MAX_RESPONSE_BYTES = previousLimit;

console.log('ECOSYSTEM_RESILIENCE_V412_OK');
