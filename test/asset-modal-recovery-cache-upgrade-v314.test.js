import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { clearCache, setCache } from '../lib/core/cache.js';
import { ASSET_MODAL_RUNTIME_VERSION, _test, withAssetModalRuntime } from '../lib/analysis/asset-modal-runtime.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

function completeStockPayload(ticker = 'PETR4', price = 31.5) {
  return {
    ok: true,
    status: 'OK',
    stage: 'full',
    mode: 'full',
    fullOnly: true,
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
    profitQuoteChart: { points: [{ period: '2025', primaryValue: 100, secondaryValue: price }] },
    equityEvolutionChart: { points: [{ period: '2025', primaryValue: 100 }] },
    resultsStatement: { rows: [{ label: 'Receita', value: '100' }], tablesByPeriod: {} },
    returns: { rows: [{ label: '12M', value: '10%' }] },
    announcements: { items: [{ title: 'Comunicado' }] }
  };
}

function completeFiiPayload(ticker = 'HGLG11', price = 160.2) {
  return {
    ok: true,
    status: 'OK',
    stage: 'full',
    mode: 'full',
    fullOnly: true,
    ticker,
    assetType: 'FII',
    quoteSummary: { price, priceDisplay: `R$ ${price.toFixed(2).replace('.', ',')}` },
    chart: { points: [{ close: price - 0.4 }, { close: price }] },
    metrics: [{ id: 'dy', value: '8,5%' }],
    comparison: { items: [{ id: 'ifix' }], series: [], seriesByPeriod: {} },
    peerComparison: { rows: [{ ticker: 'XPLG11' }] },
    checklist: { items: [{ id: 'vacancy', passed: true, status: 'PASSED' }] },
    distributions12m: { items: [{ month: '2026-06', value: 1.1 }], months: [] },
    dividendCharts: { events: [{ date: '2026-06-01', value: 1.1 }], yieldSeriesByFrequency: {}, dividendSeriesByFrequency: {} },
    aboutFund: { summary: 'Fundo logístico', sections: [{ title: 'Sobre', paragraphs: ['Fundo logístico'] }], highlights: [] },
    propertyPortfolio: { properties: [{ name: 'Galpão SP' }], states: [] },
    vacancyHistory: { points: [{ period: '2025', value: 3.2 }] },
    patrimonialInfo: { metrics: [{ label: 'P/VP', value: '0,98' }], bars: [] },
    announcements: { items: [{ title: 'Relatório gerencial' }] },
    returns: { rows: [{ label: '12M', value: '9,2%' }] },
    infoSections: [{ title: 'Informações', items: [{ label: 'Segmento', value: 'Logística' }] }],
    historicalIndicators: { rows: [{ label: 'P/VP' }], tablesByPeriod: {} }
  };
}

assert.equal(ASSET_MODAL_RUNTIME_VERSION, '26.asset-modal.runtime.v16-section-complete-skeleton');

const family = 'stock';
const ticker = 'PETR4';
const basePayload = { stage: 'full', surface: 'single_asset_modal_universal' };
const key = _test.modalCacheKey({ family, ticker, payload: basePayload });
const ready = completeStockPayload(ticker, 32.4);
const readyProfile = _test.modalPayloadQualityProfile(ready, family);
assert.equal(readyProfile.completeForDelivery, true, 'fixture precisa representar contrato full completo');

clearCache();
setCache(key, ready, 180_000, 900_000);
let producerCalls = 0;
const startedAt = Date.now();
const upgraded = await withAssetModalRuntime({
  family,
  ticker,
  payload: {
    ...basePayload,
    recovery: 'true',
    resume: 'true',
    requestId: 'recovery-upgrade-1',
    knownCompletenessPercent: '25',
    knownDeepSectionCount: '2',
    knownAvailableSections: 'quote,chart,metrics'
  },
  producer: async () => {
    producerCalls += 1;
    return completeStockPayload(ticker, 33.1);
  }
});
assert.equal(producerCalls, 0, 'recovery deve adotar o full recém-aquecido sem iniciar uma segunda coleta pesada');
assert.ok(Date.now() - startedAt < 250, 'cache aquecido deve voltar imediatamente');
assert.equal(upgraded.quoteSummary.price, 32.4);
assert.equal(upgraded.delivery.cacheStatus, 'RECOVERY_CACHE_COMPLETE');
assert.equal(upgraded.delivery.requestId, 'recovery-upgrade-1');


clearCache();
const fiiFamily = 'fii';
const fiiTicker = 'HGLG11';
const fiiBasePayload = { stage: 'full', surface: 'single_asset_modal_universal' };
const fiiKey = _test.modalCacheKey({ family: fiiFamily, ticker: fiiTicker, payload: fiiBasePayload });
const fiiReady = completeFiiPayload(fiiTicker, 162.7);
assert.equal(_test.modalPayloadQualityProfile(fiiReady, fiiFamily).completeForDelivery, true);
setCache(fiiKey, fiiReady, 180_000, 900_000);
let fiiProducerCalls = 0;
const fiiUpgrade = await withAssetModalRuntime({
  family: fiiFamily,
  ticker: fiiTicker,
  payload: {
    ...fiiBasePayload,
    recovery: 'true',
    requestId: 'fii-recovery-upgrade',
    knownCompletenessPercent: '19',
    knownDeepSectionCount: '1',
    knownAvailableSections: 'quote,chart,metrics'
  },
  producer: async () => {
    fiiProducerCalls += 1;
    return completeFiiPayload(fiiTicker, 165.0);
  }
});
assert.equal(fiiProducerCalls, 0, 'FII também deve reutilizar o full recém-aquecido');
assert.equal(fiiUpgrade.delivery.cacheStatus, 'RECOVERY_CACHE_COMPLETE');
assert.equal(fiiUpgrade.delivery.requestId, 'fii-recovery-upgrade');
assert.equal(fiiUpgrade.quoteSummary.price, 162.7);

const upgradeCheck = _test.recoveryCacheUpgrade(ready, family, {
  knownCompletenessPercent: 25,
  knownDeepSectionCount: 2,
  knownAvailableSections: 'quote,chart,metrics'
});
assert.equal(upgradeCheck.upgraded, true);
assert.ok(upgradeCheck.newSections.includes('fundamentalIndicators'));


clearCache();
const partial = completeStockPayload(ticker, 32.8);
delete partial.companyProfile;
delete partial.revenueByRegion;
delete partial.shareholdingPosition;
delete partial.dividendHistory;
delete partial.peerComparison;
delete partial.resultsStatement;
delete partial.returns;
const partialProfile = _test.modalPayloadQualityProfile(partial, family);
assert.equal(partialProfile.stableForCache, true, 'fixture parcial precisa ser estável para cache');
assert.equal(partialProfile.completeForDelivery, false, 'fixture parcial não pode encerrar a entrega');
setCache(key, partial, 180_000, 900_000);
let backgroundCalls = 0;
const partialStartedAt = Date.now();
const partialUpgrade = await withAssetModalRuntime({
  family,
  ticker,
  payload: {
    ...basePayload,
    recovery: 'true',
    requestId: 'recovery-partial-upgrade',
    knownCompletenessPercent: '20',
    knownDeepSectionCount: '1',
    knownAvailableSections: 'quote,chart,metrics'
  },
  producer: async () => {
    backgroundCalls += 1;
    await sleep(35);
    return completeStockPayload(ticker, 35.1);
  }
});
assert.equal(partialUpgrade.delivery.cacheStatus, 'RECOVERY_CACHE_UPGRADE');
assert.equal(partialUpgrade.quoteSummary.price, 32.8);
assert.equal(backgroundCalls, 1, 'upgrade parcial deve manter um producer profundo em segundo plano');
assert.ok(Date.now() - partialStartedAt < 250, 'upgrade parcial não deve bloquear a resposta no producer profundo');
await sleep(70);
const warmedAfterPartial = await withAssetModalRuntime({
  family,
  ticker,
  payload: { ...basePayload, requestId: 'after-partial-warm' },
  producer: async () => { throw new Error('cache completo deveria evitar nova coleta'); }
});
assert.equal(warmedAfterPartial.quoteSummary.price, 35.1, 'producer em segundo plano precisa aquecer o cache full');
assert.equal(warmedAfterPartial.delivery.requestId, 'after-partial-warm');

clearCache();
setCache(key, ready, 180_000, 900_000);
let noContextCalls = 0;
const refreshed = await withAssetModalRuntime({
  family,
  ticker,
  payload: { ...basePayload, recovery: 'true', requestId: 'legacy-recovery' },
  producer: async () => {
    noContextCalls += 1;
    return completeStockPayload(ticker, 34.2);
  }
});
assert.equal(noContextCalls, 1, 'clientes antigos sem contexto mantêm a revalidação forte anterior');
assert.equal(refreshed.quoteSummary.price, 34.2);

const apkUniversal = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeUniversalAssetModalService.kt');
const apkLoader = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalProgressiveLoader.kt');
const apkUi = readSiblingApkFile('app/src/main/java/com/example/ui/AssetDetailsModalUi.kt');
if (apkUniversal && apkLoader && apkUi) {
  assert.ok(apkUniversal.includes('put("knownCompletenessPercent"'));
  assert.ok(apkUniversal.includes('put("knownDeepSectionCount"'));
  assert.ok(apkUniversal.includes('put("knownAvailableSections"'));
  assert.ok(apkUniversal.includes('recovery -> "15000"'));
  assert.ok(apkUniversal.includes('put("requiredSections"'));
  assert.ok(apkUniversal.includes('put("knownMissingSections"'));
  assert.ok(apkUniversal.includes('put("sectionRecovery", "true")'));
  assert.ok(apkUniversal.includes('if (recovery && recoveryContext != null)'));
  assert.ok(apkUniversal.includes('isUniversalRecoveryUpgrade'));
  assert.ok(apkUniversal.includes('APK_MEMORY_RECOVERY_UPGRADE'));
  assert.ok(apkUniversal.includes('contract.hasUsefulStockModalData()'));
  assert.ok(apkUniversal.includes('contract.hasUsefulFiiModalData()'));
  assert.ok(apkLoader.includes('recoveryContext = best.recoveryContextOrNull()'));
  assert.ok(apkUi.includes('AssetModalRetryDetailsPill'));
  assert.ok(apkUi.includes('StockShareholdingPositionSection(position = contract.shareholdingPosition)'));
}

await sleep(5);
console.log('asset-modal-race-safe-refresh-v315 ok');
