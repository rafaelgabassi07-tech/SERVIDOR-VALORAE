import assert from 'node:assert/strict';
import { withAssetModalRuntime, _test } from '../lib/analysis/asset-modal-runtime.js';

assert.equal(_test.assetModalDeadlineMs({ timeoutMs: 10 }), 0);
assert.equal(_test.assetModalDeadlineMs({ routeDeadlineMs: 20000 }), 0);
assert.equal(_test.assetModalDeadlineMs({}), 0);

const payload = await withAssetModalRuntime({
  family: 'stock',
  ticker: 'PETR4',
  payload: { refresh: true, timeoutMs: 1500, _ts: Date.now() },
  producer: async () => ({ ok: true, status: 'OK', ticker: 'PETR4', quoteSummary: { price: 30.1, priceDisplay: 'R$ 30,10' } })
});

assert.equal(payload.ok, true);
assert.equal(payload.status, 'OK');
assert.equal(payload.ticker, 'PETR4');
assert.equal(payload.diagnostics.modalRuntime.cacheStatus, 'BYPASS');
assert.equal(payload.diagnostics.modalRuntime.version, '26.asset-modal.runtime.v5-full-only');
assert.equal(payload.diagnostics.modalDeadline, undefined);

console.log('asset-modal-runtime-full-only-v297 ok');
