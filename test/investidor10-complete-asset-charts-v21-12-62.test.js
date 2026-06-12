import assert from 'node:assert/strict';
import {
  buildInvestidor10CanonicalCharts,
  discoverInvestidor10ChartApiUrls,
  extractProfitabilityFromHtml,
  VALORAE_I10_CHART_EXTRACTOR_VERSION,
} from '../lib/market/investidor10-chart-extractor.js';

const html = `
<html><body>
  <script>
    const urls = [
      '/api/balancos/receitaliquida/chart/123/3650/false/',
      '/api/balancos/ativospassivos/chart/123/3650/',
      '/api/cotacao-lucro/petr4/adjusted/',
      '/api/acoes/payout-chart/123/456/PETR4/3650'
    ];
  </script>
  <section>
    <h2>Rentabilidade de PETR4</h2>
    <span>1 mês</span><span>3 meses</span><span>1 ano</span><span>2 anos</span><span>5 anos</span><span>10 anos</span>
    <h3>Rentabilidade</h3>
    <strong>-13,40%</strong><strong>-1,20%</strong><strong>47,78%</strong><strong>35,68%</strong><strong>388,56%</strong><strong>1.612,26%</strong>
    <h3>Rentabilidade Real</h3>
    <strong>-13,40%</strong><strong>-1,86%</strong><strong>42,27%</strong><strong>23,99%</strong><strong>271,11%</strong><strong>957,55%</strong>
  </section>
  <section><h2>COMPARAÇÃO DE PETR4 COM ÍNDICES</h2></section>
</body></html>`;

const profitability = extractProfitabilityFromHtml(html);
assert.match(VALORAE_I10_CHART_EXTRACTOR_VERSION, /^21\.12\.\d+-.+i10-chart-extractor$/);
assert.equal(profitability.nominal.length, 6);
assert.equal(profitability.real.length, 6);
assert.equal(profitability.nominal.find(x => x.period === '1 ano').valuePercent, 47.78);
assert.equal(profitability.real.find(x => x.period === '10 anos').valuePercent, 957.55);

const urls = discoverInvestidor10ChartApiUrls(html, 'PETR4', 'ACAO');
assert.ok(urls.some(u => u.includes('/api/balancos/receitaliquida/chart/123/')));
assert.ok(urls.some(u => u.includes('/api/cotacao-lucro/petr4/adjusted/')));

const canonical = buildInvestidor10CanonicalCharts({
  ticker: 'PETR4',
  type: 'ACAO',
  html,
  apiExtras: {
    chartsFinanceiros: {
      receitasLucros: {
        categories: ['2022', '2023', '2024'],
        series: [
          { name: 'Receita Líquida', data: [500, 620, 740] },
          { name: 'Lucro Líquido', data: [80, 110, 130] },
        ],
      },
      lucroCotacao: {
        categories: ['2022', '2023', '2024'],
        series: [
          { name: 'Cotação', data: [25, 32, 40] },
          { name: 'Lucro Líquido', data: [80, 110, 130] },
        ],
      },
      evolucaoPatrimonio: {
        categories: ['2022', '2023', '2024'],
        series: [
          { name: 'Ativo Total', data: [1000, 1200, 1400] },
          { name: 'Patrimônio Líquido', data: [400, 450, 500] },
          { name: 'Passivo Total', data: [600, 750, 900] },
        ],
      },
      payoutHistorico: [
        { year: '2022', payout: 70.1 },
        { year: '2023', payout: 55.2 },
        { year: '2024', payout: 63.3 },
      ],
    },
    rawJson: {
      comparacaoIndices: {
        series: [
          { name: 'PETR4', data: [['Base', 0], ['12M', 47.78]] },
          { name: 'IBOV', data: [['Base', 0], ['12M', 18.0]] },
          { name: 'CDI', data: [['Base', 0], ['12M', 11.5]] },
        ],
      },
    },
  },
});

assert.equal(canonical.available.profitability, true);
assert.equal(canonical.available.indexComparison, true);
assert.equal(canonical.financial.revenueProfit.length, 3);
assert.equal(canonical.financial.profitVsQuote.length, 3);
assert.equal(canonical.financial.balanceSheet.length, 3);
assert.equal(canonical.financial.payoutHistory.length, 3);
assert.ok(canonical.indexComparison.some(s => s.name === 'PETR4'));
assert.ok(canonical.financial.balanceSheet[0].totalAssets > 0);

console.log('investidor10-complete-asset-charts-v21-12-62 OK');

const canonicalSingular = buildInvestidor10CanonicalCharts({
  ticker: 'PETR4',
  type: 'ACAO',
  html: '<html><body><h2>Regiões onde Petrobras gera receita</h2><h2>negócios que geram receita para Petrobras</h2><h2>BALANÇO PATRIMONIAL Petrobras</h2></body></html>',
  apiExtras: {
    chartsFinanceiros: {
      evolucaoPatrimonio: {
        categories: ['2023', '2024'],
        series: [
          { name: 'Ativo', data: [990, 1200] },
          { name: 'Patrimônio Líquido', data: [440, 500] },
          { name: 'Passivo', data: [550, 700] },
        ],
      },
      balancoPatrimonial: {
        labels: ['2023', '2024'],
        ativo: [990, 1200],
        patrimonio: [440, 500],
        passivo: [550, 700],
      },
    },
    embedded: {
      revenueGeography: { '2024': [{ name: 'Brasil', value: 62.5 }, { name: 'Exterior', value: 37.5 }] },
      revenueSegment: { '2024': [{ name: 'Refino', value: 54.2 }, { name: 'Exploração', value: 45.8 }] },
    },
  },
});

assert.equal(canonicalSingular.financial.balanceSheet.length, 2);
assert.equal(canonicalSingular.financial.balanceSheet[0].totalAssets, 990);
assert.equal(canonicalSingular.financial.balanceSheet[0].netWorth, 440);
assert.equal(canonicalSingular.financial.balanceSheet[0].totalLiabilities, 550);
assert.equal(canonicalSingular.revenueBreakdowns.geography['2024'][0].name, 'Brasil');
assert.equal(canonicalSingular.revenueBreakdowns.business['2024'][0].name, 'Refino');

const canonicalFiiAssetDistribution = buildInvestidor10CanonicalCharts({
  ticker: 'MXRF11',
  type: 'FII',
  html: '<html><body><h2>COTAÇÃO MXRF11</h2><h2>Rentabilidade de MAXI RENDA</h2><h2>distribuição de ativos do fundo</h2></body></html>',
  apiExtras: {
    rawJson: {
      distribuicaoAtivosFundo: [
        { name: 'CRI', value: 78.5 },
        { name: 'Caixa', value: 21.5 },
      ],
    },
  },
});

assert.equal(canonicalFiiAssetDistribution.available.fiiAssetDistribution, true);
assert.equal(canonicalFiiAssetDistribution.fii.assetDistribution.length, 2);
assert.equal(canonicalFiiAssetDistribution.coverage.checks.find(x => x.key === 'fiiAssetDistribution').captured, true);
