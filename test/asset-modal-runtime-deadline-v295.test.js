import assert from 'node:assert/strict';
import { withAssetModalRuntime, _test } from '../lib/analysis/asset-modal-runtime.js';

assert.equal(_test.assetModalDeadlineMs({ timeoutMs: 10 }), 7000);
assert.equal(_test.assetModalDeadlineMs({ routeDeadlineMs: 20000 }), 12500);
assert.equal(_test.assetModalDeadlineMs({}), 12000);
assert.equal(_test.assetModalDeadlineMs({ stage: 'fast', timeoutMs: 9000 }), 4500);
assert.equal(_test.normalizeModalCacheMode({ stage: 'fast' }), 'fast');

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
assert.equal(payload.diagnostics.modalRuntime.version, '26.asset-modal.runtime.v7-delivery-contract-cancellable');
assert.equal(payload.diagnostics.modalDeadline, undefined);

const fullTimeout = _test.modalTimeoutPayload({ family: 'stock', ticker: 'PETR4', stage: 'full', deadlineMs: 12000, elapsedMs: 12001 });
assert.equal(fullTimeout.status, 'PARTIAL');
assert.equal(fullTimeout.stage, 'full');
assert.equal(fullTimeout.fullOnly, true);
assert.equal(fullTimeout.progressive, true);

console.log('asset-modal-runtime-deadline-v303 ok');
