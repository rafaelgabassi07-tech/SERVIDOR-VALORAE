import assert from 'node:assert/strict';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const response = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  name: 'PETROBRAS PN',
  currentPrice: 38.99,
  indicators: { pl: 4.67, pvp: 1.13, dividendYield: 7.15 },
  dividends: [{ dividendType: 'DIVIDENDO', valuePerShare: 0.55, paymentDate: '2026-02-20', dateCom: '2026-02-10' }],
  companyInfo: { setor: 'Petróleo, Gás e Biocombustíveis', segmento: 'Exploração e Refino', descricao: 'Empresa integrada de energia.' },
  assetChartBundle: {
    priceHistory: [
      { date: '2025-01-01', close: 30 },
      { date: '2025-06-01', close: 35 },
      { date: '2026-01-01', close: 39 }
    ],
    dividendYieldHistory: [
      { year: '2024', value: 6.1 },
      { year: '2025', value: 7.2 }
    ],
    revenueProfit: [
      { year: '2023', netRevenue: 510000000000, netProfit: 124000000000 },
      { year: '2024', netRevenue: 490000000000, netProfit: 98000000000 }
    ],
    equityEvolution: [
      { year: '2023', netWorth: 389000000000 },
      { year: '2024', netWorth: 410000000000 }
    ],
    revenueByBusiness: { Refino: '55%', 'Exploração e Produção': '40%' },
    revenueByRegion: { Brasil: '78%', Exterior: '22%' },
    indexComparison: [{ name: 'IBOV', points: [{ label: 'Jan', value: 2.3 }, { label: 'Fev', value: 3.7 }] }]
  },
  peers: [{ ticker: 'PRIO3', pl: 8.9 }]
}, { ticker: 'PETR4' });

const byId = Object.fromEntries(response.sections.map(section => [section.id, section]));
assert.equal(response.contractVersion, '26.analysis.v2');
assert.equal(byId.historical_indicators.status, 'ready');
assert.equal(byId.financial_statements.status, 'ready');
assert.equal(byId.asset_charts.status, 'ready');
assert.ok(byId.asset_charts.charts.length >= 3);
assert.equal(byId.company_profile.status, 'ready');
assert.equal(byId.revenue_breakdown.status, 'ready');
assert.ok(byId.revenue_breakdown.charts.length >= 2);
assert.equal(byId.comparisons.status, 'ready');
assert.ok(response.summary.totalCharts >= 6);
assert.ok(!response.missingSignals.some(signal => signal.id === 'asset_charts'));
assert.ok(JSON.stringify(response).includes('Receitas e Lucros'));
assert.ok(JSON.stringify(response).includes('Negócios que geram receita'));

console.log('Analysis complete sections v26 test OK.');
