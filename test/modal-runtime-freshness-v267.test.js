import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { clearCache } from '../lib/core/cache.js';
import { ASSET_MODAL_RUNTIME_VERSION, withAssetModalRuntime, _test } from '../lib/analysis/asset-modal-runtime.js';

clearCache();
assert.equal(ASSET_MODAL_RUNTIME_VERSION, '26.asset-modal.runtime.v8-fast-preview-context-cache');
assert.notEqual(
  _test.modalCacheKey({ family: 'stock', ticker: 'PETR4', payload: { surface: 'modal' } }),
  _test.modalCacheKey({ family: 'fii', ticker: 'PETR4', payload: { surface: 'modal' } }),
  'famílias de Ação/FII precisam ter cache separado'
);
assert.equal(_test.isModalPayloadCacheable({ ok: false, status: 'ERROR' }), false);
assert.equal(_test.isModalPayloadCacheable({ ok: true, status: 'EMPTY' }), false);
assert.equal(_test.isModalPayloadCacheable({ ok: true, status: 'NOT_STOCK' }), true);

let calls = 0;
const first = await withAssetModalRuntime({
  family: 'stock',
  ticker: 'V267A',
  payload: { surface: 'runtime-test' },
  ttlMs: 1000,
  staleMs: 1000,
  producer: async () => ({ ok: true, status: 'OK', ticker: 'V267A', value: ++calls, updatedAt: '2026-07-06T00:00:00.000Z', quoteSummary: { price: 10.5, priceDisplay: 'R$ 10,50' } })
});
assert.equal(first.value, 1);
assert.equal(first.diagnostics.modalRuntime.cacheStatus, 'MISS');
assert.equal(first.diagnostics.modalRuntime.version, '26.asset-modal.runtime.v8-fast-preview-context-cache');
assert.equal(first.diagnostics.modalRuntime.mode, 'full');
assert.equal('key' in first.diagnostics.modalRuntime, false, 'diagnóstico público não deve expor chave interna de cache');

const second = await withAssetModalRuntime({
  family: 'stock',
  ticker: 'V267A',
  payload: { surface: 'runtime-test' },
  producer: async () => ({ ok: true, status: 'OK', ticker: 'V267A', value: ++calls, quoteSummary: { price: 10.5, priceDisplay: 'R$ 10,50' } })
});
assert.equal(second.value, 1);
assert.equal(second.diagnostics.modalRuntime.cacheStatus, 'HIT');
assert.equal(calls, 1, 'HIT fresco não deve recomputar produtor');

const bypass = await withAssetModalRuntime({
  family: 'stock',
  ticker: 'V267A',
  payload: { surface: 'runtime-test', refresh: 'true' },
  producer: async () => ({ ok: true, status: 'OK', ticker: 'V267A', value: ++calls, quoteSummary: { price: 10.5, priceDisplay: 'R$ 10,50' } })
});
assert.equal(bypass.value, 2);
assert.equal(bypass.diagnostics.modalRuntime.cacheStatus, 'BYPASS');

clearCache();
let staleCalls = 0;
await withAssetModalRuntime({
  family: 'fii',
  ticker: 'V267B',
  payload: { surface: 'runtime-stale-test' },
  ttlMs: 1,
  staleMs: 1000,
  producer: async () => ({ ok: true, status: 'OK', ticker: 'V267B', value: ++staleCalls, updatedAt: '2026-07-06T00:00:01.000Z', quoteSummary: { price: 99.9, priceDisplay: 'R$ 99,90' } })
});
await sleep(5);
const staleFallback = await withAssetModalRuntime({
  family: 'fii',
  ticker: 'V267B',
  payload: { surface: 'runtime-stale-test' },
  ttlMs: 1,
  staleMs: 1000,
  producer: async () => {
    staleCalls += 1;
    throw new Error('fonte indisponível no teste');
  }
});
assert.equal(staleFallback.value, 1);
assert.equal(staleFallback.diagnostics.modalRuntime.cacheStatus, 'STALE_FALLBACK');
assert.match(staleFallback.diagnostics.modalRuntime.fallbackReason, /fonte indisponível/);
assert.equal(staleCalls, 2, 'runtime deve tentar renovar antes de usar stale como fallback');

console.log('modal-runtime-freshness-v267 ok');
