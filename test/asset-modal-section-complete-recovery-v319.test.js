import assert from 'node:assert/strict';
import fs from 'node:fs';
import { clearCache } from '../lib/core/cache.js';
import { _test as runtime } from '../lib/analysis/asset-modal-runtime.js';
import { _test as stock } from '../lib/analysis/stock-modal-contract.js';
import { _test as fii } from '../lib/analysis/fii-modal-contract.js';

const criticalStock = {
  assetType: 'ACAO',
  status: 'OK',
  stage: 'full',
  quoteSummary: { price: 32.5, priceDisplay: 'R$ 32,50' },
  chart: { points: [{ close: 32 }, { close: 32.5 }] },
  metrics: [{ value: 'R$ 32,50' }],
  fundamentalIndicators: { items: [{ value: '7,2' }] },
  historicalIndicators: { rows: [{ label: 'P/L', values: { 2025: '7,2' } }] },
  revenueProfitChart: { points: [{ year: 2025, netIncome: 10 }] },
  profitQuoteChart: { points: [{ year: 2025, quote: 32.5, netIncome: 10 }] },
  equityEvolutionChart: { points: [{ year: 2025, netWorth: 100 }] },
  checklist: { items: [{ passed: true }] },
  returns: { rows: [{ label: '12M' }] },
  companyProfile: { facts: [{ value: 'Energia' }] },
  companyData: { facts: [{ value: 'Brasil' }] },
  companyInformation: { facts: [{ value: 'Listada' }] },
  resultsStatement: { rows: [{ label: 'Receita' }] },
  balanceSheetStatement: { rows: [{ label: 'Patrimônio' }] }
};

const incomplete = structuredClone(criticalStock);
incomplete.profitQuoteChart = { points: [] };
assert.equal(runtime.isModalPayloadCacheable(incomplete, 'stock'), false, 'cache full não pode aceitar lucro x cotação ausente');
assert.deepEqual(runtime.modalPayloadQualityProfile(incomplete, 'stock').missingCriticalSections, ['profitQuoteChart']);
assert.equal(runtime.isModalPayloadCacheable(criticalStock, 'stock'), true, 'contrato com todas as seções críticas deve ser cacheável');

const delivery = runtime.buildModalDelivery(incomplete, {
  family: 'stock',
  requestedMode: 'full',
  mode: 'full',
  requestPayload: { requiredSections: 'profitQuoteChart' },
  requestId: 'cp351-target'
});
assert.deepEqual(delivery.requiredSections, ['profitQuoteChart']);
assert.deepEqual(delivery.missingRequiredSections, ['profitQuoteChart']);
assert.equal(delivery.isFinal, false);
assert.equal(delivery.retryable, true);

clearCache();
const key = 'cp351:PETR4:full';
runtime.promoteModalSectionSnapshot({
  key,
  family: 'stock',
  fresh: {
    ticker: 'PETR4',
    quoteSummary: { price: 30 },
    historicalIndicators: { rows: [{ label: 'P/L' }] },
    revenueProfitChart: { points: [{ year: 2024, netIncome: 9 }] }
  },
  ttlMs: 1000,
  staleMs: 1000
});
runtime.promoteModalSectionSnapshot({
  key,
  family: 'stock',
  fresh: { ticker: 'PETR4', profitQuoteChart: { points: [{ year: 2024, quote: 30, netIncome: 9 }] } },
  ttlMs: 1000,
  staleMs: 1000
});
runtime.promoteModalSectionSnapshot({
  key,
  family: 'stock',
  fresh: { ticker: 'PETR4', equityEvolutionChart: { points: [{ year: 2024, netWorth: 100 }] } },
  ttlMs: 1000,
  staleMs: 1000
});
const accumulated = runtime.mergeModalRuntimeSnapshots({ key, family: 'stock', primary: null });
assert.equal(accumulated.historicalIndicators.rows.length, 1);
assert.equal(accumulated.revenueProfitChart.points.length, 1);
assert.equal(accumulated.profitQuoteChart.points.length, 1);
assert.equal(accumulated.equityEvolutionChart.points.length, 1);

const target = stock.stockSectionRecoveryTargets({ recovery: true, knownMissingSections: 'profitQuoteChart' });
assert.equal(target.targeted, true);
assert.deepEqual([...target.sections], ['profitQuoteChart']);
assert.equal(stock.stockApiKeyNeededForTargets('lucroCotacao', target), true);
assert.equal(stock.stockApiKeyNeededForTargets('revenueGeography', target), false);

const fallbackProfitQuote = stock.buildStockProfitQuoteChartPayload({
  ticker: 'PETR4',
  canonical: {},
  revenueProfitChart: {
    points: [
      { year: 2023, label: '2023', netIncome: 100 },
      { year: 2024, label: '2024', netIncome: 120 }
    ]
  },
  quoteHistory: {
    points: [
      { date: '2023-12-28T00:00:00.000Z', adjClose: 30 },
      { date: '2024-12-30T00:00:00.000Z', adjClose: 37 }
    ]
  }
});
assert.equal(fallbackProfitQuote.points.length, 2);
assert.match(fallbackProfitQuote.source, /Yahoo Finance histórico/);
assert.equal(fallbackProfitQuote.diagnostics.fallbackUsed, true);

assert.equal(fii.extractFiiIdFromJson({ data: { ticker: 'HGLG11', fiiId: 1234 } }, 'HGLG11'), '1234');
assert.equal(fii.extractFiiIdFromJson({ data: [{ symbol: 'MXRF11', id: 77 }] }, 'MXRF11'), '77');
const fiiTarget = fii.fiiSectionRecoveryTargets({ recovery: 'true', knownMissingSections: 'historicalIndicators' });
assert.deepEqual([...fiiTarget.sections], ['historicalIndicators']);

const stockSource = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
const fiiSource = fs.readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');
assert.ok(stockSource.includes("strategy: target.targeted ? 'requested_sections_only_v319'"));
assert.ok(stockSource.includes('Investidor10 resultados + Yahoo Finance histórico'));
assert.ok(fiiSource.includes('resolveInvestidor10FiiId'));
assert.ok(fiiSource.includes('historical_indicators_empty'));

console.log('asset-modal-section-complete-recovery-v319 ok');
