import assert from 'node:assert/strict';
import {
  _test,
  resetProviderTransportForTests,
  setUndiciPoolConstructorForTests,
} from '../lib/http/provider-transport.js';
import { resolveProviderTransportProfile } from '../lib/http/provider-transport-profile.js';

const previous = process.env.VALORAE_HTTP_MAX_POOLS;
process.env.VALORAE_HTTP_MAX_POOLS = '4';
let closes = 0;
class FakePool {
  constructor(origin) { this.origin = origin; }
  async close() { closes += 1; }
}
setUndiciPoolConstructorForTests(FakePool);
await resetProviderTransportForTests();
setUndiciPoolConstructorForTests(FakePool);
const profile = resolveProviderTransportProfile('https://example.com', { provider: 'generic' });
for (let index = 0; index < 7; index += 1) {
  _test.dispatcherFor(`https://host-${index}.example.com/data`, profile);
}
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(_test.runtime.pools.size, 4);
assert.equal(_test.runtime.totals.poolEvictions, 3);
assert.equal(closes, 3);
assert.equal(_test.maxPoolEntries(), 4);
await resetProviderTransportForTests();
if (previous === undefined) delete process.env.VALORAE_HTTP_MAX_POOLS;
else process.env.VALORAE_HTTP_MAX_POOLS = previous;
console.log('http-provider-pool-bound-v362 ok');
