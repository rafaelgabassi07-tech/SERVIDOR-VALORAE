import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { clearCache, getCache, setCache } from '../lib/core/cache.js';
import { ASSET_MODAL_RUNTIME_VERSION, _test, withAssetModalRuntime } from '../lib/analysis/asset-modal-runtime.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

function completeStockPayload(ticker = 'PETR4', price = 31.5) {
  return {
    ok: true,
    status: 'OK',
    stage: 'full',
    mode: 'full',
    ticker,
    quoteSummary: { price, priceDisplay: `R$ ${price.toFixed(2).replace('.', ',')}` },
    chart: { points: [{ close: price - 0.2 }, { close: price }] },
    metrics: [{ id: 'price', value: `R$ ${price.toFixed(2).replace('.', ',')}` }],
    fundamentalIndicators: { items: [{ id: 'pl', value: '6,2' }] },
    historicalIndicators: { rows: [{ label: 'P/L' }], tablesByPeriod: {} },
    checklist: { items: [{ id: 'dy', passed: true, status: 'PASSED' }] },
    dividendHistory: { events: [{ date: '2026-06-01', value: 1 }], yieldSeriesByFrequency: {}, dividendSeriesByFrequency: {} },
    peerComparison: { rows: [{ ticker: 'PRIO3' }] },
    indexComparison: { items: [{ id: 'ibov' }], series: [], seriesByPeriod: {} },
    companyProfile: { facts: [{ id: 'segment', value: 'Petróleo' }], sections: [] },
    revenueByRegion: { items: [{ label: 'Brasil', value: 100 }] },
    shareholdingPosition: { rows: [{ shareholder: 'Controlador' }] },
    revenueProfitChart: { points: [{ period: '2025', primaryValue: 100 }] },
    resultsStatement: { rows: [{ label: 'Receita', value: '100' }], tablesByPeriod: {} },
    returns: { rows: [{ label: '12M', value: '10%' }] },
    announcements: { items: [{ title: 'Comunicado' }] }
  };
}

function stablePartialStockPayload(ticker = 'PETR4', price = 30.1) {
  const payload = completeStockPayload(ticker, price);
  delete payload.companyProfile;
  delete payload.revenueByRegion;
  delete payload.shareholdingPosition;
  delete payload.revenueProfitChart;
  delete payload.resultsStatement;
  delete payload.returns;
  return payload;
}

assert.equal(ASSET_MODAL_RUNTIME_VERSION, '26.asset-modal.runtime.v15-race-safe-refresh');

const family = 'stock';
const ticker = 'PETR4';
const basePayload = { stage: 'full', surface: 'single_asset_modal_universal' };
const key = _test.modalCacheKey({ family, ticker, payload: basePayload });

// Recovery and forced refresh cannot inherit the outer promise of a normal request.
const normalKey = _test.modalRuntimeCoalesceKey(key, {});
const recoveryKey = _test.modalRuntimeCoalesceKey(key, { recovery: true, requestId: 'recovery-1' });
const refreshKey = _test.modalRuntimeCoalesceKey(key, { forcedRefresh: true, requestId: 'refresh-1' });
assert.equal(normalKey, key);
assert.notEqual(recoveryKey, normalKey);
assert.notEqual(refreshKey, normalKey);
assert.notEqual(recoveryKey, refreshKey);

// A forced refresh must warm the cache instead of bypassing both read and write.
clearCache();
let refreshCalls = 0;
const refreshed = await withAssetModalRuntime({
  family,
  ticker,
  payload: { ...basePayload, refresh: 'true', requestId: 'forced-refresh' },
  producer: async () => {
    refreshCalls += 1;
    return completeStockPayload(ticker, 44.4);
  }
});
assert.equal(refreshCalls, 1);
assert.equal(refreshed.quoteSummary.price, 44.4);
const afterRefresh = await withAssetModalRuntime({
  family,
  ticker,
  payload: { ...basePayload, requestId: 'after-refresh' },
  producer: async () => { throw new Error('forced refresh should have warmed cache'); }
});
assert.equal(afterRefresh.quoteSummary.price, 44.4);
assert.ok(['HIT', 'HIT_FULL_FOR_FAST'].includes(afterRefresh.delivery.cacheStatus));

// A richer stale snapshot upgrades the open modal immediately and remains retryable while
// the producer refreshes it in the background.
clearCache();
setCache(key, completeStockPayload(ticker, 41.0), 1, 60_000);
await sleep(8);
assert.equal(getCache(key, { allowStale: true })?.status, 'STALE');
let staleProducerCalls = 0;
const staleStartedAt = Date.now();
const staleUpgrade = await withAssetModalRuntime({
  family,
  ticker,
  payload: {
    ...basePayload,
    recovery: 'true',
    requestId: 'stale-recovery',
    knownCompletenessPercent: '20',
    knownDeepSectionCount: '1',
    knownAvailableSections: 'quote,chart,metrics'
  },
  producer: async () => {
    staleProducerCalls += 1;
    await sleep(25);
    return completeStockPayload(ticker, 42.0);
  }
});
assert.ok(Date.now() - staleStartedAt < 250);
assert.equal(staleUpgrade.quoteSummary.price, 41.0);
assert.equal(staleUpgrade.delivery.cacheStatus, 'RECOVERY_STALE_UPGRADE');
assert.equal(staleUpgrade.delivery.isFinal, false);
assert.equal(staleUpgrade.delivery.retryable, true);
assert.equal(staleProducerCalls, 1);
await sleep(55);
const afterStaleWarm = await withAssetModalRuntime({
  family,
  ticker,
  payload: { ...basePayload, requestId: 'after-stale-warm' },
  producer: async () => { throw new Error('background producer should have warmed cache'); }
});
assert.equal(afterStaleWarm.quoteSummary.price, 42.0);

// A later, lower-quality response cannot downgrade a complete cache snapshot.
clearCache();
const rich = completeStockPayload(ticker, 50.0);
setCache(key, rich, 180_000, 900_000);
const poorer = stablePartialStockPayload(ticker, 49.0);
assert.equal(_test.modalPayloadQualityProfile(poorer, family).stableForCache, true);
assert.equal(_test.modalPayloadQualityProfile(poorer, family).completeForDelivery, false);
const promoted = _test.promoteModalCache({
  key,
  fresh: poorer,
  family,
  ttlMs: 180_000,
  staleMs: 900_000,
  payload: basePayload
});
assert.equal(promoted, false);
assert.equal(getCache(key, { allowStale: true }).value.quoteSummary.price, 50.0);

const apkUniversal = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeUniversalAssetModalService.kt');
const apkLegacy = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyAssetModalService.kt');
const apkQuality = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeAssetModalQuality.kt');
const apkMerge = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalMergePolicy.kt');
if (apkUniversal && apkLegacy && apkQuality && apkMerge) {
  assert.ok(apkUniversal.includes('APK_MEMORY_RECOVERY_STALE_UPGRADE'));
  assert.ok(apkUniversal.includes('val latestFallback = findUniversalModalCache'));
  assert.ok(apkUniversal.includes('asRecoveryStaleUniversalUpgrade'));
  assert.ok(apkUniversal.includes('shouldPromoteUniversalModalCacheOver'));
  assert.ok(apkUniversal.includes('shouldPromoteStockModalCacheOver'));
  assert.ok(apkUniversal.includes('shouldPromoteFiiModalCacheOver'));
  assert.ok(apkLegacy.includes('findStockModalCache'));
  assert.ok(apkLegacy.includes('findFiiModalCache'));
  assert.ok(apkLegacy.includes('refreshed.shouldPromoteStockModalCacheOver(contract)'));
  assert.ok(apkLegacy.includes('refreshed.shouldPromoteFiiModalCacheOver(contract)'));
  assert.ok(apkQuality.includes('ValoraeAssetModalCachePromotionScore'));
  assert.ok(apkQuality.includes('actualStockCacheSections'));
  assert.ok(apkQuality.includes('actualFiiCacheSections'));
  assert.equal((apkQuality.match(/setOf\("PARTIAL", "ERROR", "EMPTY"\)/g) || []).length, 2);
  assert.ok(apkMerge.includes('preferUseful'));
  assert.ok(apkMerge.includes('hasUsefulDividendCharts'));
  assert.ok(!apkMerge.includes('preferNonDefault'));
}

console.log('asset-modal-race-safe-refresh-v315 ok');
