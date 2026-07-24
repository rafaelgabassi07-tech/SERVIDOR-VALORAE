import assert from 'node:assert/strict';
import { sanitizeCapturedJson } from '../lib/scrape/json-safety.js';
import { createNetworkJsonCollector } from '../lib/scrape/network-json-capture.js';
import { resolvePublicHost, resetNetworkSafetyStateForTests, _test as networkTest } from '../lib/scrape/network-safety.js';
import { _test as transportTest } from '../lib/http/provider-transport.js';

const sanitized = sanitizeCapturedJson({
  values: ['user@example.com', 'Bearer abcdefghijklmnopqrstuvwxyz', '529.982.247-25', 'public-financial-value'],
});
assert.equal(sanitized.ok, true);
assert.deepEqual(sanitized.data.values, ['public-financial-value']);
assert.equal(sanitized.metrics.personalValuesRemoved, 2);
assert.equal(sanitized.metrics.secretValuesRemoved, 1);

const collector = createNetworkJsonCollector({
  targetUrl: 'https://example.com/',
  maxDocuments: 'invalid',
  maxDocumentBytes: Number.NaN,
  maxTotalBytes: Number.POSITIVE_INFINITY,
  maxPending: 'not-a-number',
  settleTimeoutMs: Number.NaN,
});
const diagnostics = collector.diagnostics();
assert.equal(diagnostics.maxDocuments, 24);
assert.equal(diagnostics.maxDocumentBytes, 512 * 1024);
assert.equal(diagnostics.maxTotalBytes, 2 * 1024 * 1024);
assert.equal(diagnostics.maxPending, 48);
assert.equal(diagnostics.settleTimeoutMs, 1_500);

resetNetworkSafetyStateForTests();
let lookupCalls = 0;
const fakeLookup = async host => {
  lookupCalls += 1;
  return [{ address: `8.8.8.${(lookupCalls % 200) + 1}`, family: 4 }];
};
for (let index = 0; index < 12; index += 1) {
  await resolvePublicHost(`public-${index}.example.com`, { lookup: fakeLookup, maxEntries: Number.NaN, ttlMs: Number.NaN });
}
assert.ok(networkTest.resolutionState.cache.size <= 64);
const first = networkTest.resolutionState.cache.keys().next().value;
await resolvePublicHost(first, { lookup: fakeLookup, maxEntries: 64, ttlMs: 30_000 });
assert.equal([...networkTest.resolutionState.cache.keys()].at(-1), first);

const normalized = transportTest.normalizeRuntimeState({
  pools: null,
  limiters: null,
  providers: null,
  totals: { poolEvictions: undefined, poolCloseErrors: Number.NaN, requests: '7' },
  startedAt: 'invalid',
});
assert.equal(normalized.pools instanceof Map, true);
assert.equal(normalized.limiters instanceof Map, true);
assert.equal(normalized.providers instanceof Map, true);
assert.equal(normalized.totals.poolEvictions, 0);
assert.equal(normalized.totals.poolCloseErrors, 0);
assert.equal(normalized.totals.requests, 7);
assert.ok(normalized.startedAt > 0);

console.log('runtime-limit-normalization-v362 ok');
