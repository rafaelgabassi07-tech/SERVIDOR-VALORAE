import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { clearCache } from '../lib/core/cache.js';
import { ASSET_MODAL_RUNTIME_VERSION, _test, withAssetModalRuntime } from '../lib/analysis/asset-modal-runtime.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

function richStockPayload(ticker = 'PETR4', price = 31.5) {
  return {
    ok: true,
    status: 'OK',
    stage: 'full',
    mode: 'full',
    fullOnly: true,
    ticker,
    quoteSummary: { price, priceDisplay: `R$ ${price.toFixed(2).replace('.', ',')}` },
    chart: { points: [{ close: price - 0.4 }, { close: price }] },
    metrics: [{ id: 'price', value: `R$ ${price.toFixed(2).replace('.', ',')}` }],
    fundamentalIndicators: { items: [{ id: 'pl', value: '6,2' }] },
    historicalIndicators: { rows: [{ label: 'P/L' }], tablesByPeriod: {} },
  revenueProfitChart: { points: [{ period: '2025', primaryValue: 100 }] },
  profitQuoteChart: { points: [{ period: '2025', primaryValue: 100, secondaryValue: 31.5 }] },
  equityEvolutionChart: { points: [{ period: '2025', primaryValue: 100 }] },
    checklist: { items: [{ id: 'dy', passed: true, status: 'PASSED' }] },
    dividendHistory: { events: [{ date: '2026-06-01', value: 1 }], yieldSeriesByFrequency: {}, dividendSeriesByFrequency: {} },
    companyProfile: { facts: [{ id: 'segment', value: 'Petróleo' }], sections: [] },
    revenueByRegion: { items: [{ label: 'Brasil', value: 100 }] },
    returns: { rows: [{ label: '12M', value: '10%' }] },
    resultsStatement: { rows: [{ label: 'Receita', value: '100' }], tablesByPeriod: {} },
    balanceSheetStatement: { rows: [], tablesByPeriod: {} }
  };
}

assert.equal(ASSET_MODAL_RUNTIME_VERSION, '26.asset-modal.runtime.v16-section-complete-skeleton');

const basicFull = {
  ok: true,
  status: 'OK',
  stage: 'full',
  mode: 'full',
  ticker: 'BASIC3',
  quoteSummary: { price: 10, priceDisplay: 'R$ 10,00' },
  chart: { points: [{ close: 9.8 }, { close: 10 }] },
  metrics: [{ id: 'price', value: 'R$ 10,00' }]
};
const basicProfile = _test.modalPayloadQualityProfile(basicFull, 'stock');
assert.equal(basicProfile.qualityTier, 'basic');
assert.equal(basicProfile.stableForCache, false);
assert.equal(_test.isModalPayloadCacheable(basicFull, 'stock'), false, 'full básico não deve bloquear novas recuperações');
const basicDelivery = _test.buildModalDelivery(basicFull, { family: 'stock', requestedMode: 'full', mode: 'full' });
assert.equal(basicDelivery.isFinal, false);
assert.equal(basicDelivery.retryable, true);

const rich = richStockPayload();
const richProfile = _test.modalPayloadQualityProfile(rich, 'stock');
assert.equal(richProfile.stableForCache, true);
assert.ok(richProfile.deepSectionCount >= richProfile.minimumDeepSections);
assert.equal(_test.isModalPayloadCacheable(rich, 'stock'), true);

clearCache();
let calls = 0;
const seeded = await withAssetModalRuntime({
  family: 'stock',
  ticker: 'RECOV3',
  payload: { stage: 'full', surface: 'recovery-quality-test' },
  producer: async () => {
    calls += 1;
    return richStockPayload('RECOV3', 20);
  }
});
assert.equal(seeded.quoteSummary.price, 20);
const recovered = await withAssetModalRuntime({
  family: 'stock',
  ticker: 'RECOV3',
  payload: { stage: 'full', surface: 'recovery-quality-test', recovery: 'true', resume: 'true' },
  producer: async () => {
    calls += 1;
    return richStockPayload('RECOV3', 21);
  }
});
assert.equal(calls, 2, 'recovery deve ignorar cache full antigo e buscar o contrato em andamento/novo');
assert.equal(recovered.quoteSummary.price, 21);
assert.match(recovered.diagnostics.modalRuntime.cacheStatus, /^RECOVERY_/);

clearCache();
let joinedCalls = 0;
const sharedProducer = async () => {
  joinedCalls += 1;
  await sleep(80);
  return richStockPayload('JOIN3', 22);
};
const [normalResult, recoveryResult] = await Promise.all([
  withAssetModalRuntime({ family: 'stock', ticker: 'JOIN3', payload: { stage: 'full', surface: 'join-quality-test' }, producer: sharedProducer }),
  withAssetModalRuntime({ family: 'stock', ticker: 'JOIN3', payload: { stage: 'full', surface: 'join-quality-test', recovery: 'true' }, producer: sharedProducer })
]);
assert.equal(joinedCalls, 1, 'recovery concorrente deve compartilhar o producer profundo');
assert.equal(normalResult.quoteSummary.price, 22);
assert.equal(recoveryResult.quoteSummary.price, 22);

const stockSource = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
assert.ok(stockSource.includes('const stockIndexComparisonTask = fastMode'));
assert.ok(stockSource.includes('settleFastModalSource(\n      stockIndexComparisonPromise'), 'comparação com índices não pode bloquear indefinidamente o full principal');

const loaderKt = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalProgressiveLoader.kt');
const qualityKt = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeAssetModalQuality.kt');
const universalKt = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeUniversalAssetModalService.kt');
const analysisKt = readSiblingApkFile('app/src/main/java/com/example/ui/AnalysisDiscoveryUi.kt');
const dividendsKt = readSiblingApkFile('app/src/main/java/com/example/ui/DividendsEvolutionModalComponents.kt');
if (loaderKt && qualityKt && universalKt && analysisKt && dividendsKt) {
  assert.ok(loaderKt.includes('longArrayOf(450L, 1_100L, 2_300L)'));
  assert.ok(loaderKt.includes('recovery = true'));
  assert.ok(qualityKt.includes('completeness < StockModalStableCachePercent'));
  assert.ok(qualityKt.includes('StockModalStableCachePercent = 62'));
  assert.ok(!qualityKt.includes('(delivery.isFinal && !delivery.retryable)'), 'proxy antigo não pode promover full pobre por isFinal isolado');
  assert.ok(universalKt.includes('if (!recovery)') && universalKt.includes('put("resume", recovery.toString())'));
  assert.ok(!analysisKt.includes('LaunchedEffect(group.title, normalizedLocalQuery, sortMode)'));
  assert.ok(analysisKt.includes('LaunchedEffect(filteredItems.size)'));
  assert.ok(analysisKt.includes('contentType = { _, _ -> "analysis_discovery_asset_row" }'));
  assert.ok(dividendsKt.includes('Modifier.weight(1.18f)'));
  assert.ok(dividendsKt.includes('padding(start = 4.dp, end = 20.dp)'));
  assert.ok(dividendsKt.includes('"Classes"'));
}

console.log('asset-modal-stability-analysis-filter-v309 ok');
