import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import { clearCache, setCache } from '../lib/core/cache.js';
import { ASSET_MODAL_RUNTIME_VERSION, _test as runtime, withAssetModalRuntime } from '../lib/analysis/asset-modal-runtime.js';
import { _test as stockModal } from '../lib/analysis/stock-modal-contract.js';
import { _test as fiiModal } from '../lib/analysis/fii-modal-contract.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

function fullStock(ticker = 'LATE3', includePeer = true) {
  return {
    ok: true,
    status: 'OK',
    stage: 'full',
    mode: 'full',
    fullOnly: true,
    ticker,
    quoteSummary: { price: 25, priceDisplay: 'R$ 25,00' },
    chart: { points: [{ close: 24 }, { close: 25 }] },
    metrics: [{ id: 'price', value: 'R$ 25,00' }],
    fundamentalIndicators: { items: [{ id: 'pl', value: '8,0' }] },
    historicalIndicators: { rows: [{ label: 'P/L' }], tablesByPeriod: {} },
    revenueProfitChart: { points: [{ period: '2025', primaryValue: 100 }] },
    profitQuoteChart: { points: [{ period: '2025', primaryValue: 100, secondaryValue: 25 }] },
    equityEvolutionChart: { points: [{ period: '2025', primaryValue: 500 }] },
    checklist: { items: [{ id: 'dy', passed: true, status: 'PASSED' }] },
    dividendHistory: { events: [{ date: '2026-06-01', value: 1 }], yieldSeriesByFrequency: {}, dividendSeriesByFrequency: {} },
    dividendRadar: { status: 'OK', months: [{ month: 6, activePayment: true, paymentCount: 1 }] },
    payoutChart: { points: [{ period: '2025', value: 45 }] },
    ...(includePeer ? { peerComparison: { rows: [{ ticker: 'PAIR3' }] } } : {}),
    indexComparison: { items: [{ id: 'ibov' }], series: [], seriesByPeriod: {} },
    companyProfile: { facts: [{ id: 'segment', value: 'Indústria' }], sections: [] },
    companyData: { facts: [{ id: 'country', value: 'Brasil' }], companyPapers: [], fractionalPapers: [] },
    companyInformation: { facts: [{ id: 'listing', value: 'B3' }], groups: [] },
    revenueByRegion: { items: [{ label: 'Brasil', value: 100 }] },
    revenueByBusiness: { items: [{ label: 'Principal', value: 100 }] },
    shareholdingPosition: { rows: [{ shareholder: 'Mercado' }] },
    resultsStatement: { rows: [{ label: 'Receita', value: '100' }], tablesByPeriod: {} },
    balanceSheetStatement: { rows: [{ label: 'Patrimônio', value: '500' }], tablesByPeriod: {} },
    announcements: { items: [{ title: 'Comunicado' }] },
    returns: { rows: [{ label: '12M', value: '10%' }] }
  };
}

function fullFii(ticker = 'LATE11', includeVacancy = true) {
  return {
    ok: true,
    status: 'OK',
    stage: 'full',
    mode: 'full',
    fullOnly: true,
    ticker,
    assetType: 'FII',
    quoteSummary: { price: 100, priceDisplay: 'R$ 100,00' },
    chart: { points: [{ close: 99 }, { close: 100 }] },
    metrics: [{ id: 'dy', value: '9,0%' }],
    comparison: { items: [{ id: 'ifix' }], series: [], seriesByPeriod: {} },
    peerComparison: { rows: [{ ticker, patrimonialValue: 100000000, patrimonialValueDisplay: 'R$ 100 mi' }, { ticker: 'PAIR11', patrimonialValue: 90000000, patrimonialValueDisplay: 'R$ 90 mi' }] },
    checklist: { items: [{ id: 'vacancy', passed: true, status: 'PASSED' }] },
    distributions12m: { items: [{ month: '2026-06', value: 1 }], months: [] },
    dividendCharts: { events: [{ date: '2026-06-01', value: 1 }], yieldSeriesByFrequency: {}, dividendSeriesByFrequency: {} },
    aboutFund: { summary: 'Fundo logístico', sections: [{ title: 'Sobre', paragraphs: ['Logística'] }], highlights: [] },
    propertyPortfolio: { properties: [{ name: 'Galpão' }], states: [{ state: 'SP', count: 1 }] },
    ...(includeVacancy ? { vacancyHistory: { points: [{ period: '2025', value: 3 }] } } : {}),
    patrimonialInfo: { metrics: [{ label: 'P/VP', value: '0,98' }], bars: [] },
    announcements: { items: [{ title: 'Relatório gerencial' }] },
    returns: { rows: [{ label: '12M', value: '9%' }] },
    infoSections: [{ title: 'Informações', items: [{ label: 'Segmento', value: 'Logística' }] }],
    historicalIndicators: { rows: [{ label: 'P/VP' }], tablesByPeriod: {} }
  };
}

assert.equal(ASSET_MODAL_RUNTIME_VERSION, '26.asset-modal.runtime.v17-late-arrival-settlement');

const firstStock = fullStock('LATE3', false);
const firstStockDelivery = runtime.buildModalDelivery(firstStock, { family: 'stock', requestedMode: 'full', mode: 'full', requestId: 'late-stock-first' });
assert.equal(firstStockDelivery.isFinal, true, 'contrato crítico de Ação deve permanecer utilizável');
assert.equal(firstStockDelivery.retryable, false, 'seção opcional não vira requisito crítico');
assert.equal(firstStockDelivery.settlementPending, true, 'full final com seção lenta ausente deve manter settlement');
assert.deepEqual(firstStockDelivery.settlementSections, ['peerComparison']);
assert.equal(firstStockDelivery.settlementAttemptAfterMs, 850);

const firstFii = fullFii('LATE11', false);
const firstFiiDelivery = runtime.buildModalDelivery(firstFii, { family: 'fii', requestedMode: 'full', mode: 'full', requestId: 'late-fii-first' });
assert.equal(firstFiiDelivery.isFinal, true);
assert.equal(firstFiiDelivery.settlementPending, true);
assert.deepEqual(firstFiiDelivery.settlementSections, ['vacancyHistory']);

const stockTargets = stockModal.stockSectionRecoveryTargets({
  recovery: true,
  knownMissingSections: 'peerComparison,company,financialStatements,dividends'
});
assert.deepEqual([...stockTargets.sections], ['peerComparison', 'company', 'financialStatements', 'dividends']);
const stockBaseTargets = stockModal.stockSectionRecoveryTargets({ recovery: true, knownMissingSections: 'quote,chart,metrics' });
assert.deepEqual([...stockBaseTargets.sections], ['quote', 'chart', 'metrics']);
assert.equal(stockModal.stockApiKeyNeededForTargets('balanceSheetTable', stockTargets), true);
assert.equal(stockModal.stockApiKeyNeededForTargets('payoutHistorico', stockTargets), true);
assert.equal(stockModal.stockApiKeyNeededForTargets('historicoIndicadores', stockTargets), false);

const fiiTargets = fiiModal.fiiSectionRecoveryTargets({
  recovery: true,
  knownMissingSections: 'vacancyHistory,aboutFund,propertyPortfolio'
});
assert.deepEqual([...fiiTargets.sections], ['vacancyHistory', 'aboutFund', 'propertyPortfolio']);
const fiiBaseTargets = fiiModal.fiiSectionRecoveryTargets({ recovery: true, knownMissingSections: 'quote,chart,metrics' });
assert.deepEqual([...fiiBaseTargets.sections], ['quote', 'chart', 'metrics']);

// Reproduz o defeito real: o cache possui o mesmo full "final" incompleto. Ele não pode mais
// ser aceito como upgrade apenas por completeForDelivery; a recuperação deve chamar o producer.
clearCache();
const stockPayload = { stage: 'full', surface: 'single_asset_modal_universal' };
const stockKey = runtime.modalCacheKey({ family: 'stock', ticker: 'LATE3', payload: stockPayload });
setCache(stockKey, firstStock, 180_000, 900_000);
const sameStockUpgrade = runtime.recoveryCacheUpgrade(firstStock, 'stock', {
  knownCompletenessPercent: firstStockDelivery.completenessPercent,
  knownDeepSectionCount: firstStockDelivery.deepSectionCount,
  knownAvailableSections: firstStockDelivery.availableSections.join(','),
  knownMissingSections: firstStockDelivery.settlementSections.join(',')
});
assert.equal(sameStockUpgrade.upgraded, false, 'cache idêntico não pode encerrar a recuperação de chegada tardia');

let stockProducerCalls = 0;
const recoveredStock = await withAssetModalRuntime({
  family: 'stock',
  ticker: 'LATE3',
  payload: {
    ...stockPayload,
    recovery: 'true',
    requestId: 'late-stock-recovery',
    knownCompletenessPercent: String(firstStockDelivery.completenessPercent),
    knownDeepSectionCount: String(firstStockDelivery.deepSectionCount),
    knownAvailableSections: firstStockDelivery.availableSections.join(','),
    knownMissingSections: firstStockDelivery.settlementSections.join(',')
  },
  producer: async () => {
    stockProducerCalls += 1;
    await sleep(35);
    return fullStock('LATE3', true);
  }
});
assert.equal(stockProducerCalls, 1, 'Ação deve reconsultar a seção lenta no mesmo modal');
assert.equal(recoveredStock.peerComparison.rows[0].ticker, 'PAIR3');
assert.equal(recoveredStock.delivery.settlementPending, false);
assert.equal(recoveredStock.delivery.requestId, 'late-stock-recovery');

clearCache();
const fiiPayload = { stage: 'full', surface: 'single_asset_modal_universal' };
const fiiKey = runtime.modalCacheKey({ family: 'fii', ticker: 'LATE11', payload: fiiPayload });
setCache(fiiKey, firstFii, 180_000, 900_000);
let fiiProducerCalls = 0;
const recoveredFii = await withAssetModalRuntime({
  family: 'fii',
  ticker: 'LATE11',
  payload: {
    ...fiiPayload,
    recovery: 'true',
    requestId: 'late-fii-recovery',
    knownCompletenessPercent: String(firstFiiDelivery.completenessPercent),
    knownDeepSectionCount: String(firstFiiDelivery.deepSectionCount),
    knownAvailableSections: firstFiiDelivery.availableSections.join(','),
    knownMissingSections: firstFiiDelivery.settlementSections.join(',')
  },
  producer: async () => {
    fiiProducerCalls += 1;
    await sleep(35);
    return fullFii('LATE11', true);
  }
});
assert.equal(fiiProducerCalls, 1, 'FII deve reconsultar a seção lenta no mesmo modal');
assert.equal(recoveredFii.vacancyHistory.points.length, 1);
assert.equal(recoveredFii.delivery.settlementPending, false);

const model = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeAssetModalDelivery.kt');
const parser = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyAssetModalParsers.kt');
const loader = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalProgressiveLoader.kt');
const service = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeUniversalAssetModalService.kt');
const merge = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalMergePolicy.kt');
if (model && parser && loader && service && merge) {
  assert.match(model, /val settlementPending: Boolean = false/);
  assert.match(model, /val settlementSections: List<String> = emptyList\(\)/);
  assert.match(parser, /inferredSettlementSections/);
  assert.match(parser, /optBoolean\("settlementPending", false\)/);
  assert.match(loader, /AssetModalLateArrivalSettlementDelaysMs = longArrayOf\(850L, 2_100L\)/);
  assert.match(loader, /needsLateArrivalSettlement\(\)/);
  assert.match(loader, /criticalMissing \+ settlementMissing/);
  assert.doesNotMatch(service, /if \(delivery\.isFinal \|\| delivery\.completeForDelivery == true\) return true/);
  assert.match(service, /knownMissing\.any \{ it in deliveredSections \}/);
  assert.match(merge, /explicitSettlementSections\.ifEmpty/);
  assert.match(merge, /full\.settlementPending \|\| fast\.settlementPending/);
}

const stockSource = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
const fiiSource = fs.readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');
assert.match(stockSource, /STOCK_RECOVERABLE_SECTIONS/);
assert.match(stockSource, /wantsChecklist/);
assert.match(fiiSource, /FII_RECOVERABLE_SECTIONS/);
assert.match(fiiSource, /recoveryTarget\.sections\.has\('vacancyHistory'\)/);

console.log('asset-modal-late-arrival-settlement-v322 ok');
