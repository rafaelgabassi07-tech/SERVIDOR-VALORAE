import assert from 'node:assert/strict';
import { clearCache, setCache } from '../lib/core/cache.js';
import { _test as runtimeTest, settleFastModalSource, withAssetModalRuntime } from '../lib/analysis/asset-modal-runtime.js';
import { _test as stockModalTest } from '../lib/analysis/stock-modal-contract.js';
import { _test as fiiModalTest } from '../lib/analysis/fii-modal-contract.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

let sourceCompleted = false;
const slowSource = delay(150).then(() => {
  sourceCompleted = true;
  return { status: 'OK' };
});
const previewStartedAt = Date.now();
const preview = await settleFastModalSource(slowSource, 60, { status: 'SOURCE_WARMING' });
assert.equal(preview.status, 'SOURCE_WARMING', 'fast deve devolver preview sem cancelar a fonte pesada');
assert.ok(Date.now() - previewStartedAt < 140, 'preview deve concluir antes da fonte lenta');
await slowSource;
assert.equal(sourceCompleted, true, 'fonte original deve continuar aquecendo o cache após o preview');

const family = 'stock';
const ticker = 'PETR4';
const cacheBase = { mobile: 'true', surface: 'single_asset_modal_universal' };
const fastRequest = { ...cacheBase, stage: 'fast', requestId: 'request-fast-current' };
const fullRequest = { ...cacheBase, stage: 'full' };
const fastCached = {
  ok: true,
  status: 'PARTIAL',
  stage: 'fast',
  mode: 'fast',
  ticker,
  quoteSummary: { price: 31.2, priceDisplay: 'R$ 31,20' },
  chart: { points: [{ close: 31.0 }, { close: 31.2 }] }
};
const fullCached = {
  ok: true,
  status: 'OK',
  stage: 'full',
  mode: 'full',
  fullOnly: true,
  ticker,
  quoteSummary: { price: 32.8, priceDisplay: 'R$ 32,80' },
  chart: { points: [{ close: 32.1 }, { close: 32.8 }] },
  metrics: [{ id: 'price', value: 'R$ 32,80' }],
  fundamentalIndicators: { items: [{ id: 'pl', value: '5,8' }] },
  historicalIndicators: { rows: [{ label: 'P/L' }], tablesByPeriod: {} },
  checklist: { items: [{ id: 'dy', passed: true, status: 'PASSED' }] },
  companyProfile: { facts: [{ id: 'segment', value: 'Petróleo' }], sections: [] },
  dividendHistory: { events: [{ date: '2026-06-01', value: 1 }], yieldSeriesByFrequency: {}, dividendSeriesByFrequency: {} }
};

clearCache();
setCache(runtimeTest.modalCacheKey({ family, ticker, payload: fastRequest }), fastCached, 180_000, 900_000);
setCache(runtimeTest.modalCacheKey({ family, ticker, payload: fullRequest }), fullCached, 180_000, 900_000);
let cacheProducerCalls = 0;
const preferred = await withAssetModalRuntime({
  family,
  ticker,
  payload: fastRequest,
  producer: async () => {
    cacheProducerCalls += 1;
    return fastCached;
  }
});
assert.equal(cacheProducerCalls, 0, 'cache full completo deve evitar nova captura fast');
assert.equal(preferred.quoteSummary.price, 32.8, 'full completo deve prevalecer sobre fast parcial ainda fresco');
assert.equal(preferred.delivery.requestedStage, 'fast');
assert.equal(preferred.delivery.deliveredStage, 'full');
assert.equal(preferred.delivery.requestId, 'request-fast-current');
assert.equal(preferred.delivery.cacheStatus, 'HIT_FULL_FOR_FAST');

const zeroOnlyPayload = {
  ok: true,
  status: 'OK',
  stage: 'fast',
  quoteSummary: { price: 0, priceDisplay: 'R$ 0,00', variation12mDisplay: '0,00%' },
  metrics: [{ id: 'variation_12m', value: '0,00%', numericValue: 0 }],
  companyProfile: { facts: [{ id: 'quote', value: 'R$ 0,00' }, { id: 'variation_12m', value: '0,00%' }], sections: [] },
  checklist: { status: 'EMPTY', items: [{ id: 'dy', passed: null, status: 'UNKNOWN', valueDisplay: '—' }] },
  chart: { points: [] }
};
assert.equal(runtimeTest.modalPayloadHasUsefulData(zeroOnlyPayload), false, 'zeros sintéticos não podem promover contrato vazio');
assert.equal(runtimeTest.isModalPayloadCacheable(zeroOnlyPayload), false, 'contrato composto só por zeros sintéticos não pode entrar no cache');

const stockUnknownCriterion = stockModalTest.deriveStockChecklistStatusFromInvestidor10({
  criterionId: 'dividends_5y_above_5',
  fundamentalIndicators: { items: [{ id: 'dividend_yield', numericValue: null, value: '—' }] }
});
assert.equal(stockUnknownCriterion.passed, null, 'checklist de ação não pode transformar indicador ausente em zero/reprovação');
const emptyStockFacts = stockModalTest.extractStockChecklistCompanyFacts('');
assert.equal(emptyStockFacts.dailyLiquidity, null);
assert.equal(emptyStockFacts.userRating, null);

const fiiUnknownChecklist = fiiModalTest.ensureFiiBuyHoldChecklist({
  ticker: 'MXRF11',
  quickMetrics: { dailyLiquidity: null },
  dividendCharts: { averageDy5y: null }
});
assert.equal(fiiUnknownChecklist.status, 'EMPTY', 'checklist de FII sem métricas resolvidas deve permanecer vazio');
assert.ok(fiiUnknownChecklist.items.every(item => item.passed === null && item.valueDisplay === '—'));

clearCache();
let coalescedProducerCalls = 0;
const sharedProducer = async () => {
  coalescedProducerCalls += 1;
  await delay(40);
  return fastCached;
};
const [first, second] = await Promise.all([
  withAssetModalRuntime({ family, ticker, payload: { ...fastRequest, refresh: 'true', requestId: 'request-a' }, producer: sharedProducer }),
  withAssetModalRuntime({ family, ticker, payload: { ...fastRequest, refresh: 'true', requestId: 'request-b' }, producer: sharedProducer })
]);
assert.equal(coalescedProducerCalls, 1, 'requisições equivalentes devem continuar coalescidas');
assert.equal(first.delivery.requestId, 'request-a', 'primeiro consumidor deve manter seu requestId');
assert.equal(second.delivery.requestId, 'request-b', 'consumidor coalescido não pode herdar requestId de outra chamada');
assert.equal(first.requestId, 'request-a');
assert.equal(second.requestId, 'request-b');

const apkCatalog = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyEndpointCatalog.kt');
const apkUniversal = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeUniversalAssetModalService.kt');
const apkHttp = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const apkQuality = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeAssetModalQuality.kt');
if (apkCatalog && apkUniversal && apkHttp && apkQuality) {
  assert.ok(apkCatalog.includes('ProxyEndpointStatus("/api/v1/asset/modal"'), 'diagnóstico do APK deve testar o gateway realmente consumido');
  assert.ok(apkUniversal.includes('APK_MEMORY_HIT') && apkUniversal.includes('requestId = requestId'), 'cache universal do APK deve recontextualizar cada solicitação');
  assert.ok(apkUniversal.includes('.firstOrNull()') && !apkUniversal.includes('.maxByOrNull { it.storedAtMs }'), 'APK deve priorizar full útil sobre preview fast mais recente');
  assert.ok(apkHttp.includes('call.timeout().timeout(requestTimeoutMs, TimeUnit.MILLISECONDS)'), 'APK deve aplicar timeout na Call compartilhando o OkHttpClient');
  assert.ok(!apkHttp.includes('.newBuilder()\n            .callTimeout(requestTimeoutMs'), 'APK não deve construir um OkHttpClient por GET do modal');
  assert.ok(apkQuality.includes('historicalIndicators.tablesByPeriod.isNotEmpty()'), 'quality gate FII deve aceitar histórico tabular igual ao Proxy');
  assert.ok(apkQuality.includes('shareholdingPosition.rows.isNotEmpty()'), 'quality gate de ação deve reconhecer seções profundas entregues pelo Proxy');
  assert.ok(apkQuality.includes('"0,00%"') && apkQuality.includes('value.isFinite() && value != 0.0'), 'APK deve rejeitar contrato vazio disfarçado por zeros sintéticos');
}

console.log('asset-modal-fast-cache-context-v305 ok');
