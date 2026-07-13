import assert from 'node:assert/strict';
import fs from 'node:fs';
import { _test as runtimeTest, withAssetModalRuntime } from '../lib/analysis/asset-modal-runtime.js';
import { clearCache, setCache } from '../lib/core/cache.js';
import { _test as stockModalTest } from '../lib/analysis/stock-modal-contract.js';
import { _test as fiiModalTest } from '../lib/analysis/fii-modal-contract.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const apkHttp = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const apkService = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyAssetModalService.kt');
const apkLoader = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalProgressiveLoader.kt');
const apkParser = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyAssetModalParsers.kt');
const apkFallback = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalFallbackPolicy.kt');
const fiiContract = fs.readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');

if (apkHttp && apkService && apkLoader && apkParser && apkFallback) {
  assert.ok(apkHttp.includes('suspend fun executeJsonGetCancellable'), 'APK deve possuir GET cancelável para modais');
  assert.ok(apkHttp.includes('continuation.invokeOnCancellation { call.cancel() }'), 'cancelamento da coroutine deve cancelar OkHttp');
  assert.ok(apkService.includes('executeJsonGetCancellable("/api/v1/asset/fii-modal"'), 'FII deve usar transporte cancelável');
  assert.ok(apkService.includes('executeJsonGetCancellable("/api/v1/asset/stock-modal"'), 'Ação deve usar transporte cancelável');
  assert.ok(apkLoader.includes('val fastDeferred = async'), 'fast deve iniciar em tarefa própria');
  assert.ok(apkLoader.includes('val fullDeferred = async'), 'full deve iniciar em tarefa própria');
  assert.ok(apkLoader.includes('select<Pair<SingleAssetModalLoadStage'), 'primeira resposta útil deve vencer');
  assert.ok(apkLoader.includes('delay(280L)'), 'full deve ter apenas escalonamento curto, sem aguardar o fast terminar');
  assert.ok(apkParser.includes('toAssetModalDelivery'), 'APK deve interpretar metadados do contrato progressivo v2');
  assert.ok(apkFallback.includes('deliveryQualityScore'), 'troca fast/full deve comparar completude antes de substituir conteúdo útil');
  assert.ok(apkFallback.includes('fullState.deliveryQualityScore() >= fastState.deliveryQualityScore()'), 'full parcial não deve substituir fast mais completo');
  assert.ok(apkLoader.includes('needsControlledFullRecovery()') && apkLoader.includes('recoverFullContractWhileOpen'), 'full incompleto deve manter o fast e continuar a recuperação enquanto o modal está aberto');
}
assert.ok(fiiContract.includes('stage,\n    mode: stage,\n    fullOnly: !fastMode'), 'FII deve expor stage/mode explicitamente como Ação');
assert.equal(runtimeTest.assetModalDeadlineMs({ stage: 'full', timeoutMs: 12000 }), 12000, 'full deve ter deadline defensivo alinhado ao orçamento');
assert.equal(runtimeTest.assetModalDeadlineMs({ stage: 'full', timeoutMs: 18000 }), 12500, 'full deve terminar antes do teto serverless');
assert.equal(stockModalTest.normalizeStockModalStage({ stage: 'full' }), 'full');
assert.equal(fiiModalTest.normalizeFiiModalStage({ stage: 'full' }), 'full');
assert.ok(fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8').includes(': Math.min(12500, Math.max(7000, timeoutMs))'), 'contrato de ação deve declarar deadline full explicitamente');
assert.ok(fiiContract.includes(': Math.min(12500, Math.max(7000, timeoutMs))'), 'contrato de FII deve declarar deadline full explicitamente');

const fastFii = { stage: 'fast', range: '1M', interval: '1d', mobile: 'true', surface: 'single_asset_modal_fii' };
const fullFii = { stage: 'full', range: '1Y', interval: '1d', mobile: 'true', surface: 'single_asset_modal_fii' };
assert.equal(
  runtimeTest.modalCrossStageCacheKey({ family: 'fii', ticker: 'MXRF11', payload: fastFii }),
  runtimeTest.modalCacheKey({ family: 'fii', ticker: 'MXRF11', payload: fullFii }),
  'cache full de FII deve ser reutilizável pelo fast mesmo com períodos internos diferentes'
);

const fastDelivery = runtimeTest.buildModalDelivery({
  ok: true,
  status: 'OK',
  stage: 'fast',
  quoteSummary: { price: 10, priceDisplay: 'R$ 10,00' },
  chart: { points: [{ close: 9.9 }, { close: 10 }] },
  metrics: [{ id: 'price', value: 'R$ 10,00' }]
}, { family: 'fii', requestedMode: 'fast', mode: 'fast', cacheStatus: 'MISS', requestId: 'req-fast' });
assert.equal(fastDelivery.requestedStage, 'fast');
assert.equal(fastDelivery.deliveredStage, 'fast');
assert.equal(fastDelivery.isFinal, false);
assert.ok(fastDelivery.availableSections.includes('quote'));
assert.ok(fastDelivery.deferredSections.length > 0);

const fullForFastDelivery = runtimeTest.buildModalDelivery({
  ok: true,
  status: 'OK',
  stage: 'full',
  quoteSummary: { price: 10, priceDisplay: 'R$ 10,00' },
  chart: { points: [{ close: 9.9 }, { close: 10 }] },
  metrics: [{ id: 'price', value: 'R$ 10,00' }],
  checklist: { items: [{ id: 'quality', passed: true, status: 'PASSED' }] },
  vacancyHistory: { points: [{ period: '2026-06', value: 5 }] },
  announcements: { items: [{ title: 'Relatório gerencial' }] },
  infoSections: [{ id: 'manager', items: [{ label: 'Gestor', value: 'Teste' }] }],
  comparison: { items: [{ id: 'ifix', value: '7%' }], series: [{ code: 'MXRF11', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 1 }] }, { code: 'IFIX', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 0.7 }] }], seriesByPeriod: {} },
  peerComparison: { rows: [{ ticker: 'HGLG11', value: '8%', patrimonialValue: 5000000000, patrimonialValueDisplay: 'R$ 5 bi' }] },
  aboutFund: { summary: 'Fundo', sections: [{ title: 'Sobre', paragraphs: ['Fundo'] }], highlights: [] },
  distributions12m: { items: [{ month: '2026-06', value: 0.1 }], months: [] },
  dividendCharts: { events: [{ date: '2026-06-01', value: 0.1 }], yieldSeriesByFrequency: {}, dividendSeriesByFrequency: {} },
  propertyPortfolio: { properties: [{ name: 'Imóvel' }], states: [] },
  patrimonialInfo: { metrics: [{ id: 'vp', value: 'R$ 10,10' }], bars: [] },
  historicalIndicators: { rows: [{ label: 'P/VP', values: { Atual: '0,95', 2025: '0,92' } }], tablesByPeriod: {} },
  returns: { rows: [{ label: '12M', value: '8%' }] }
}, { family: 'fii', requestedMode: 'fast', mode: 'full', cacheStatus: 'HIT_FULL_FOR_FAST', requestId: 'req-cache' });
assert.equal(fullForFastDelivery.requestedStage, 'fast');
assert.equal(fullForFastDelivery.deliveredStage, 'full');
assert.equal(fullForFastDelivery.isFinal, true);
assert.equal(fullForFastDelivery.cacheStatus, 'HIT_FULL_FOR_FAST');

clearCache();
const cachedFull = {
  ok: true,
  status: 'OK',
  stage: 'full',
  mode: 'full',
  ticker: 'MXRF11',
  quoteSummary: { price: 10, priceDisplay: 'R$ 10,00' },
  chart: { points: [{ close: 9.9 }, { close: 10 }] },
  metrics: [{ id: 'price', value: 'R$ 10,00' }],
  checklist: { items: [{ id: 'quality', passed: true, status: 'PASSED' }] },
  vacancyHistory: { points: [{ period: '2026-06', value: 5 }] },
  announcements: { items: [{ title: 'Relatório gerencial' }] },
  infoSections: [{ id: 'manager', items: [{ label: 'Gestor', value: 'Teste' }] }],
  aboutFund: { summary: 'Fundo imobiliário', sections: [{ title: 'Sobre', paragraphs: ['Fundo'] }], highlights: [] },
  distributions12m: { items: [{ month: '2026-06', value: 0.1 }], months: [] },
  dividendCharts: { events: [{ date: '2026-06-01', value: 0.1 }], yieldSeriesByFrequency: {}, dividendSeriesByFrequency: {} },
  patrimonialInfo: { metrics: [{ id: 'vp', value: 'R$ 10,10' }], bars: [] },
  comparison: { items: [{ id: 'ifix', value: '7%' }], series: [{ code: 'MXRF11', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 1 }] }, { code: 'IFIX', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 0.7 }] }], seriesByPeriod: {} },
  peerComparison: { rows: [{ ticker: 'HGLG11', value: '8%', patrimonialValue: 5000000000, patrimonialValueDisplay: 'R$ 5 bi' }] },
  propertyPortfolio: { properties: [{ name: 'Imóvel' }], states: [] },
  historicalIndicators: { rows: [{ label: 'P/VP', values: { Atual: '0,95', 2025: '0,92' } }], tablesByPeriod: {} },
  returns: { rows: [{ label: '12M', value: '8,2%' }] }
};
setCache(runtimeTest.modalCacheKey({ family: 'fii', ticker: 'MXRF11', payload: fullFii }), cachedFull, 180000, 900000);
let producerCalls = 0;
const reused = await withAssetModalRuntime({
  family: 'fii',
  ticker: 'MXRF11',
  payload: { ...fastFii, requestId: 'android-fast-1' },
  producer: async () => {
    producerCalls += 1;
    return { ok: true, status: 'OK' };
  }
});
assert.equal(producerCalls, 0, 'fast não deve consultar fontes quando existe full fresco equivalente');
assert.equal(reused.delivery.requestedStage, 'fast');
assert.equal(reused.delivery.deliveredStage, 'full');
assert.equal(reused.delivery.isFinal, true);
assert.equal(reused.delivery.requestId, 'android-fast-1');

console.log('asset-modal-delivery-cancellation-v303 ok');
