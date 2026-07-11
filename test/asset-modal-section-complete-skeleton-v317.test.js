import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/asset-modal-runtime.js';

const baseStock = {
  assetType: 'ACAO',
  status: 'OK',
  quoteSummary: { price: 10 },
  chart: { points: [{ close: 9 }, { close: 10 }] },
  metrics: [{ value: 'R$ 10,00' }],
  fundamentalIndicators: { items: [{ value: '8,2' }] },
  historicalIndicators: { rows: [{ values: { '2025': '8,2' } }] },
  checklist: { items: [{ passed: true, status: 'PASSED' }] },
  dividendHistory: { events: [{ amount: 1 }] },
  dividendRadar: { status: 'EMPTY', months: Array.from({ length: 12 }, () => ({ activeDateCom: false, activePayment: false })) },
  payoutChart: { points: [] },
  peerComparison: { rows: [{ ticker: 'TEST3' }] },
  indexComparison: { items: [{ code: 'IBOV' }] },
  companyProfile: { sections: [{ paragraphs: ['Perfil'] }], facts: [] },
  companyData: { facts: [], companyPapers: [], fractionalPapers: [], sections: [] },
  companyInformation: { facts: [], groups: [] },
  revenueByRegion: { items: [{ label: 'Brasil' }] },
  revenueByBusiness: { items: [] },
  shareholdingPosition: { rows: [{ shareholder: 'Mercado' }] },
  revenueProfitChart: { points: [{ period: '2025' }] },
  profitQuoteChart: { points: [] },
  equityEvolutionChart: { points: [] },
  resultsStatement: { rows: [{ label: 'Receita' }] },
  balanceSheetStatement: { rows: [] },
  announcements: { items: [] },
  returns: { rows: [{ label: '12M' }] }
};

const partialSections = new Map(_test.stockModalSections(baseStock));
assert.equal(partialSections.get('dividends'), false, 'meses default do radar não podem fingir que dividendos completos chegaram');
assert.equal(partialSections.get('company'), false, 'um perfil isolado não conclui os três cards da empresa');
assert.equal(partialSections.get('revenueBreakdown'), false, 'região sem negócios mantém o grupo deferred');
assert.equal(partialSections.get('financialCharts'), false, 'um gráfico isolado não conclui os três gráficos financeiros');
assert.equal(partialSections.get('financialStatements'), false, 'DRE sem balanço mantém demonstrações deferred');


const partialDelivery = _test.buildModalDelivery(baseStock, {
  family: 'stock', requestedMode: 'full', mode: 'full', requestId: 'section-partial'
});
assert.equal(partialDelivery.completeForDelivery, false, 'grupo visual parcial não pode finalizar a entrega');
assert.equal(partialDelivery.isFinal, false, 'skeleton deve permanecer durante a recuperação full');
assert.ok(partialDelivery.deferredSections.includes('dividends'));

const completeStock = structuredClone(baseStock);
completeStock.dividendRadar = { status: 'OK', months: [{ activeDateCom: true, dateComCount: 2 }] };
completeStock.payoutChart.points = [{ period: '2025' }];
completeStock.companyData.facts = [{ value: 'Energia' }];
completeStock.companyInformation.facts = [{ value: 'Concessionária' }];
completeStock.revenueByBusiness.items = [{ label: 'Distribuição' }];
completeStock.profitQuoteChart.points = [{ period: '2025' }];
completeStock.equityEvolutionChart.points = [{ period: '2025' }];
completeStock.balanceSheetStatement.rows = [{ label: 'Patrimônio' }];
completeStock.shareholdingPosition = { rows: [{ shareholder: 'Mercado' }] };
completeStock.announcements = { items: [{ title: 'Comunicado' }] };
completeStock.returns = { rows: [{ label: '12M' }] };

const completeSections = new Map(_test.stockModalSections(completeStock));
for (const id of ['dividends', 'company', 'revenueBreakdown', 'financialCharts', 'financialStatements']) {
  assert.equal(completeSections.get(id), true, `${id} deve ficar disponível quando todas as subseções renderizadas chegaram`);
}


const completeDelivery = _test.buildModalDelivery(completeStock, {
  family: 'stock', requestedMode: 'full', mode: 'full', requestId: 'section-complete'
});
assert.equal(completeDelivery.completeForDelivery, true);
assert.equal(completeDelivery.isFinal, true);
assert.deepEqual(completeDelivery.deferredSections, []);

const fiiSections = new Map(_test.fiiModalSections({
  patrimonialInfo: { metrics: [], bars: [], segmentAverage: { rows: [{ label: 'P/VP' }] } }
}));
assert.equal(fiiSections.get('patrimonialInfo'), true, 'média por segmento também é conteúdo patrimonial válido');

console.log('asset-modal-section-complete-skeleton-v317: ok');
