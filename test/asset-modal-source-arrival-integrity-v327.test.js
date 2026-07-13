import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/asset-modal-runtime.js';

const emptyKeyedTables = {
  '5y': { columns: ['Atual', '2025'], rows: [] },
  '10y': { columns: ['Atual', '2025'], rows: [{ label: 'P/L', values: { Atual: '—', 2025: '—' } }] }
};
assert.equal(_test.hasRenderableTableMap(emptyKeyedTables), false, 'chaves sem linhas úteis não podem simular histórico recebido');
assert.equal(_test.hasRenderableTableMap({ '5y': { rows: [{ label: 'P/L', values: { Atual: '7,20', 2025: '8,10' } }] } }), true);

const emptyKeyedSeries = {
  '1y': [{ code: 'IBOV', points: [] }],
  '5y': [{ code: 'IBOV', points: [{ timestamp: 1, value: 0 }] }]
};
assert.equal(_test.hasRealSeriesByPeriod(emptyKeyedSeries), false, 'índice sem ao menos dois pontos reais deve ficar indisponível');
assert.equal(_test.hasRealSeriesByPeriod({
  '1y': [{ code: 'IBOV', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 2.4 }] }]
}), true);

const deceptiveStock = {
  assetType: 'ACAO',
  quoteSummary: { price: 30, priceDisplay: 'R$ 30,00' },
  historicalIndicators: { status: 'EMPTY', rows: [], tablesByPeriod: emptyKeyedTables },
  indexComparison: { status: 'OK', items: [{ code: 'IBOV', returnPercent: 8 }], series: [], seriesByPeriod: emptyKeyedSeries },
  announcements: { status: 'EMPTY', items: [], diagnostics: { reason: 'source_warming' } }
};
const deceptiveStockSections = new Map(_test.stockModalSections(deceptiveStock));
assert.equal(deceptiveStockSections.get('historicalIndicators'), false);
assert.equal(deceptiveStockSections.get('indexComparison'), false, 'cards-resumo não substituem a série temporal do gráfico');
const deceptiveDelivery = _test.buildModalDelivery(deceptiveStock, { family: 'stock', mode: 'full', requestedMode: 'full' });
assert.equal(deceptiveDelivery.sectionStates.historicalIndicators, 'EMPTY_UNCONFIRMED');
assert.equal(deceptiveDelivery.sectionStates.indexComparison, 'MISSING');
assert.equal(deceptiveDelivery.sectionStates.announcements, 'DEFERRED');
assert.ok(deceptiveDelivery.missingRequiredSections.includes('historicalIndicators'));
assert.ok(deceptiveDelivery.missingRequiredSections.includes('indexComparison'));
assert.ok(deceptiveDelivery.missingRequiredSections.includes('announcements'));

const stockWithConfirmedNoAnnouncements = {
  ...deceptiveStock,
  historicalIndicators: { status: 'OK', rows: [{ label: 'P/L', values: { Atual: '7,20', 2025: '8,10' } }], tablesByPeriod: {} },
  indexComparison: {
    status: 'OK',
    series: [
      { code: 'PETR4', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 1.2 }] },
      { code: 'IBOV', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 2.4 }] }
    ],
    seriesByPeriod: {}
  },
  announcements: { status: 'EMPTY', items: [], source: 'Investidor10', diagnostics: { reason: 'section_not_found', found: false } }
};
const confirmedArrival = _test.modalSectionArrivalSummary(stockWithConfirmedNoAnnouncements, 'stock');
assert.equal(confirmedArrival.sections.find(item => item.id === 'announcements')?.status, 'EMPTY_CONFIRMED');
const confirmedCritical = _test.criticalSectionStatus(stockWithConfirmedNoAnnouncements, 'stock', {});
assert.ok(!confirmedCritical.missingRequiredSections.includes('announcements'), 'ausência confirmada não pode gerar recuperação infinita');

const paperFii = {
  assetType: 'FII',
  quoteSummary: { price: 10, priceDisplay: 'R$ 10,00' },
  aboutFund: { status: 'OK', summary: 'FII de papel focado em certificados de recebíveis imobiliários (CRI).', sections: [] },
  propertyPortfolio: { status: 'EMPTY', properties: [], states: [], diagnostics: { reason: 'section_not_found' } },
  announcements: { status: 'EMPTY', items: [], diagnostics: { reason: 'section_not_found' } },
  historicalIndicators: { status: 'OK', rows: [{ label: 'P/VP', values: { Atual: '0,95', 2025: '0,92' } }], tablesByPeriod: {} },
  patrimonialInfo: { status: 'OK', metrics: [{ id: 'vp', value: 'R$ 10,50' }], bars: [], segmentAverage: { rows: [] } },
  comparison: {
    status: 'OK',
    series: [
      { code: 'MXRF11', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 1 }] },
      { code: 'IFIX', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 0.7 }] }
    ],
    seriesByPeriod: {}
  }
};
const fiiArrival = _test.modalSectionArrivalSummary(paperFii, 'fii');
assert.equal(fiiArrival.sections.find(item => item.id === 'propertyPortfolio')?.status, 'NOT_APPLICABLE');
const fiiDelivery = _test.buildModalDelivery(paperFii, { family: 'fii', mode: 'full', requestedMode: 'full' });
assert.ok(fiiDelivery.notApplicableSections.includes('propertyPortfolio'));
assert.ok(!fiiDelivery.settlementSections.includes('propertyPortfolio'));
assert.equal(fiiDelivery.schemaVersion, '4');

const statementPayload = {
  resultsStatement: { rows: [], tablesByPeriod: { 'annual': { rows: [] } } },
  balanceSheetStatement: { rows: [], tablesByPeriod: { 'annual': { rows: [{ label: 'Patrimônio', values: { 2025: '—' } }] } } }
};
const statementSections = new Map(_test.stockModalSections(statementPayload));
assert.equal(statementSections.get('financialStatements'), false, 'containers de tabela vazios não contam como demonstrações recebidas');

console.log('asset modal source-arrival integrity v327: ok');
