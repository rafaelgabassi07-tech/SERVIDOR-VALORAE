import assert from 'node:assert/strict';
import { buildMobileScraperAssetContract } from '../lib/compat/mobile-scraper-contract.js';
import { buildInvestidor10CanonicalCharts } from '../lib/market/investidor10-chart-extractor.js';

const company = buildMobileScraperAssetContract({
  ticker: 'AAPL34',
  type: 'BDR',
  url: 'https://investidor10.com.br/bdrs/aapl34/',
  results: {
    nome: 'Apple',
    assetChartsCanonical: {
      profitability: {
        periods: ['1 mês', '3 meses', '1 ano'],
        nominal: [{ period: '1 mês', valuePercent: 4.56 }, { period: '3 meses', valuePercent: 13.3 }, { period: '1 ano', valuePercent: 36.58 }],
        real: [{ period: '1 mês', valuePercent: 4.56 }, { period: '3 meses', valuePercent: 12.55 }, { period: '1 ano', valuePercent: 31.49 }],
      },
      indexComparison: [
        { label: 'AAPL34', points: [{ date: '2 anos', profitability: 35.06 }, { date: '5 anos', profitability: 129.88 }] },
        { label: 'IBOV', points: [{ date: '2 anos', profitability: 22 }, { date: '5 anos', profitability: 60 }] },
      ],
      financial: {
        revenueProfit: [{ label: '2025', year: '2025', netRevenue: 'US$ 391,04 Bilhões', netProfit: 'US$ 93,74 Bilhões' }],
        profitVsQuote: [{ label: '2025', year: '2025', quote: '75,12', profit: '93,74 Bilhões' }],
        equityEvolution: [{ label: '2025', year: '2025', netWorth: '106,49 Bilhões', totalAssets: '371,08 Bilhões' }],
        incomeStatement: [{ label: '2025', year: '2025', netRevenue: '391,04 Bilhões', netProfit: '93,74 Bilhões', ebitda: '134,66 Bilhões' }],
        cashFlowStatement: [{ label: '2025', year: '2025', operatingCashFlow: '118,25 Bilhões', freeCashFlow: '108,81 Bilhões', capex: '9,44 Bilhões' }],
      },
    },
  },
});

assert.equal(company._contract, '21.13.15-mobile-investidor10-chart-fidelity-contract');
assert.equal(company.classe_ativo, 'bdr');
assert.ok(Array.isArray(company.graficos_i10));
assert.deepEqual(company.graficosI10, company.graficos_i10);
assert.deepEqual(company.graficos, company.graficos_i10);
assert.ok(company.chart_manifest.some(x => x.id === 'receitas_lucros' && x.renderable));
assert.ok(company.chart_manifest.some(x => x.id === 'lucro_cotacao' && x.chartType === 'combo_dual_axis_profit_quote'));
assert.ok(company.chart_manifest.some(x => x.id === 'evolucao_patrimonio' && x.renderable));
assert.ok(company.chart_manifest.some(x => x.id === 'resultados' && x.renderable));
assert.ok(company.chart_manifest.some(x => x.id === 'fluxo_caixa' && x.renderable));
assert.ok(company.chart_fidelity.renderableIds.includes('rentabilidade'));
assert.ok(company.chart_fidelity.renderableIds.includes('comparacao_indices'));
assert.equal(company.charts_financeiros.resultados[0].net_revenue, 391_040_000_000);
assert.equal(company.charts_financeiros.fluxo_caixa[0].operating_cash_flow, 118_250_000_000);

const fii = buildMobileScraperAssetContract({
  ticker: 'HGLG11',
  type: 'FII',
  url: 'https://investidor10.com.br/fiis/hglg11/',
  results: {
    assetChartsCanonical: {
      fii: {
        fundamentalIndicatorHistory: { colunas: ['2024', '2025'], linhas: [{ indicador: 'P/VP', valores: { '2024': '0,95', '2025': '0,97' } }] },
        distribution12m: [{ period: '1 MÊS', yieldPercent: '0,73%', amount: 'R$ 1,10' }, { period: '12 MESES', yieldPercent: '8,74%', amount: 'R$ 13,20' }],
        dividendYieldHistory: [{ label: '2024', dy: '8,60%' }, { label: '2025', dy: '8,74%' }],
        dividendHistory: [{ dataCom: '30/05/2025', paymentDate: '2025-06-13', value: '1,10', type: 'Rendimento' }],
        physicalAssets: [{ nome: 'HGLG CAMPO GRANDE', estado: 'Rio de Janeiro', area_bruta_locavel: '16.532,00 m²' }],
      },
    },
  },
});
assert.ok(fii.chart_manifest.some(x => x.id === 'historico_indicadores' && x.renderable));
assert.ok(fii.chart_manifest.some(x => x.id === 'distribuicoes_12m' && x.renderable));
assert.ok(fii.chart_manifest.some(x => x.id === 'dividend_yield_history' && x.renderable));
assert.ok(fii.chart_manifest.some(x => x.id === 'dividend_history' && x.renderable));
assert.ok(fii.chart_manifest.some(x => x.id === 'lista_imoveis' && x.chartType === 'property_list_with_abl'));

const papel = buildMobileScraperAssetContract({
  ticker: 'KNCR11',
  type: 'FII',
  url: 'https://investidor10.com.br/fiis/kncr11/',
  results: { assetChartsCanonical: { fii: { assetDistribution: [{ name: 'CRI', value: '78,20%' }, { name: 'LCI', value: '14,00%' }] } } },
});
assert.ok(papel.chart_manifest.some(x => x.id === 'distribuicao_ativos_fundo' && x.renderable));
assert.equal(papel.graficos_i10.find(x => x.id === 'distribuicao_ativos_fundo').points[0].y, 78.2);

const etfHtml = `
  <h2>COTAÇÃO BOVA11</h2>
  <h3>Rentabilidade de iShares Ibovespa Fundo de Índice</h3>
  1 mês 3 meses 1 ano 2 anos 5 anos 10 anos rentabilidade 1 mês -6,66% 3 meses -5,03% 1 ano 22,68% 2 anos 40,19% 5 anos 32,90% 10 anos 243,93%
  rentabilidade real rentabilidade menos a inflação. 1 mês -6,66% 3 meses -5,66% 1 ano 18,11% 2 anos 28,11% 5 anos 0,95% 10 anos 112,42%
  <h2>COMPARAÇÃO DE BOVA11 COM INDICES</h2>
`;
const canonicalEtf = buildInvestidor10CanonicalCharts({ ticker: 'BOVA11', type: 'ETF', html: etfHtml, apiExtras: {} });
assert.equal(canonicalEtf.coverage.checks.find(x => x.key === 'profitability').captured, true);
assert.equal(canonicalEtf.coverage.checks.some(x => x.key === 'revenueProfit'), false);
const etf = buildMobileScraperAssetContract({ ticker: 'BOVA11', type: 'ETF', url: 'https://investidor10.com.br/etfs/bova11/', results: { assetChartsCanonical: canonicalEtf } });
assert.equal(etf.classe_ativo, 'etf');
assert.ok(etf.chart_manifest.some(x => x.id === 'rentabilidade' && x.renderable));
assert.equal(etf.rentabilidade_chart.profitabilities[0].find(x => x.date === '1 ano').profitability, 22.68);

console.log('mobile-chart-fidelity-investidor10-v21-13-15 ok');
