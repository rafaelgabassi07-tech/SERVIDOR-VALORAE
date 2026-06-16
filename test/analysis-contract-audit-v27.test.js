import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

function assertMissingSignalsMirrorEmptySections(response) {
  const missingIds = new Set(response.missingSignals.map(signal => signal.id));
  for (const section of response.sections) {
    const hasPayload = (section.items || []).length > 0 || (section.charts || []).length > 0;
    if (hasPayload) {
      assert.equal(section.status, 'ready', `${section.id} tem payload real e precisa ficar ready`);
      assert.equal(missingIds.has(section.id), false, `${section.id} tem dados reais e não pode aparecer como pendente`);
    } else {
      assert.notEqual(section.status, 'ready', `${section.id} sem itens/gráficos não pode ficar ready`);
      assert.equal(missingIds.has(section.id), true, `${section.id} vazio deve ter sinalização discreta`);
    }
  }
}

const basePayload = {
  currentPrice: 30,
  indicators: { pl: 5.2, pvp: 1.1, dividendYield: 8.1, roe: 18, roic: 12, margemLiquida: 22 },
  dividends: [{ dividendType: 'JCP', valuePerShare: 0.42, paymentDate: '2026-03-10', dateCom: '2026-03-01' }],
  companyInfo: { setor: 'Financeiro', segmento: 'Bancos', descricao: 'Descrição institucional real recebida por fonte estruturada.' },
  historicalIndicators: [{ label: 'P/L 2025', value: '5,2', period: '2025' }],
  statements: { receitaLiquida: '100 bi', lucroLiquido: '20 bi' },
  assetChartBundle: {
    priceHistory: [{ date: '2025-01-01', close: 20 }, { date: '2026-01-01', close: 30 }],
    dividendMonthly: [{ label: 'Jan/26', value: 0.4 }, { label: 'Fev/26', value: 0.5 }],
    revenueProfit: [{ year: '2025', netRevenue: 100000000000, netProfit: 20000000000 }],
    equityEvolution: [{ year: '2025', netWorth: 95000000000 }],
    revenueByBusiness: { Bancos: '70%', Seguros: '30%' },
    revenueByRegion: { Brasil: '92%', Exterior: '8%' },
    indexComparison: [{ name: 'IBOV', points: [{ label: 'Jan', value: 1.2 }, { label: 'Fev', value: 2.4 }] }]
  },
  peers: [{ ticker: 'ITUB4', pl: '7,1' }]
};

for (const fixture of [
  { ticker: 'PETR4', assetClass: 'ACAO', name: 'PETROBRAS PN', ...basePayload },
  { ticker: 'BBAS3', assetClass: 'ACAO', name: 'BANCO DO BRASIL ON', ...basePayload },
  { ticker: 'HGLG11', assetClass: 'FII', name: 'CSHG LOGÍSTICA FII', ...basePayload, companyInfo: { descricao: 'Fundo imobiliário logístico.', segmento: 'Logística', administrador: 'Administrador' } }
]) {
  const response = buildAnalysisPageResponse(fixture, { ticker: fixture.ticker });
  assert.equal(response.endpoint, 'analysis');
  assert.equal(response.contract, 'AnalysisPageResponse');
  assert.equal(response.contractVersion, '26.analysis.v2');
  assert.equal(response.ticker, fixture.ticker);
  assertMissingSignalsMirrorEmptySections(response);
  assert.ok(response.sections.some(section => section.id === 'asset_charts' && section.status === 'ready'));
  assert.ok(response.sections.some(section => section.id === 'company_profile' && section.status === 'ready'));
}

const client = fs.readFileSync('../apk/app/src/main/java/com/example/data/proxy/ValoraeProxyClient.kt', 'utf8');
const screen = fs.readFileSync('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt', 'utf8');
assert.match(client, /readySectionIds/);
assert.match(client, /sanitizedSignals/);
assert.match(client, /items\.size \+ charts\.size/);
assert.match(client, /"26\.analysis\.v2"/);
assert.doesNotMatch(screen, /quoteOverview|assetSummary solto|appPayload\.assetAnalysisPage|appMobileSnapshot\.assetAnalysisPage/);

console.log('Checkpoint 27 analysis contract audit test OK.');
