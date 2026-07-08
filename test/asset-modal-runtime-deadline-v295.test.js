import assert from 'node:assert/strict';
import { withAssetModalRuntime, _test } from '../lib/analysis/asset-modal-runtime.js';

assert.equal(_test.assetModalDeadlineMs({ timeoutMs: 10 }), 1500);
assert.equal(_test.assetModalDeadlineMs({ routeDeadlineMs: 20000 }), 15000);
assert.equal(_test.assetModalDeadlineMs({}), 0);

const startedAt = Date.now();
const payload = await withAssetModalRuntime({
  family: 'stock',
  ticker: 'PETR4',
  payload: { refresh: true, timeoutMs: 1500, _ts: Date.now() },
  producer: () => new Promise(resolve => setTimeout(() => resolve({ ok: true, status: 'OK', ticker: 'PETR4' }), 5000))
});

assert.equal(payload.ok, false);
assert.equal(payload.partial, true);
assert.equal(payload.status, 'PARTIAL');
assert.equal(payload.ticker, 'PETR4');
assert.equal(payload.diagnostics.modalRuntime.cacheStatus, 'BYPASS_DEADLINE');
assert.equal(payload.diagnostics.modalDeadline.timeout, true);
assert.ok(Date.now() - startedAt < 3500);

console.log('asset-modal-runtime-deadline-v295 ok');
