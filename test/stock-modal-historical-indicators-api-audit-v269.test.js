import assert from 'node:assert/strict';
import fs from 'node:fs';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const htmlCommaSeparated = _test.extractInvestidor10StockHistoricalIndicatorsFromHtml(`
  <main>
    <h2>HISTÓRICO DE INDICADORES FUNDAMENTALISTAS VALE3</h2>
    <p>ARRASTE O QUADRO PARA VER MAIS DADOS Atual, 2025, 2024, 2023, 2022, 2021</p>
    <p>P/L, 7,10, 6,83, 5,40, 4,31, 3,22, 8,99;</p>
    <p>P/Receita (PSR), 1,24, 1,10, 0,95, 0,84, 0,80, 1,03;</p>
    <p>Dividend Yield, 8,44%, 6,10%, 9,50%, 11,20%, 15,00%, 5,30%;</p>
    <p>ROE, 18,20%, 17,90%, 19,10%, 21,30%, 24,00%, 16,00%;</p>
    <p>ROIC, 13,20%, 12,90%, 14,10%, 15,30%, 18,00%, 12,00%;</p>
    <p>CAGR Receitas 5 anos, 9,20%, 8,10%, 7,30%, 6,60%, 5,40%, 4,90%;</p>
    <h2>CHECKLIST DO INVESTIDOR</h2>
  </main>
`, 'VALE3');
assert.equal(htmlCommaSeparated.status, 'OK');
assert.equal(htmlCommaSeparated.rows.find(row => row.label === 'P/L')?.values.Atual, '7,10');
assert.equal(htmlCommaSeparated.rows.find(row => row.label === 'P/Receita (PSR)')?.values['2024'], '0,95');
assert.equal(htmlCommaSeparated.rows.find(row => row.label === 'Dividend Yield')?.values['2023'], '11,20%');
assert.equal(htmlCommaSeparated.rows.find(row => row.label === 'ROE')?.values['2025'], '17,90%');
assert.equal(htmlCommaSeparated.rows.find(row => row.label === 'CAGR Receitas 5 anos')?.values['2021'], '4,90%');

const deeplyNestedRestTickerPayload = {
  data: {
    ticker: 'BBAS3',
    asset: { ticker: 'BBAS3', companyId: 101, tickerId: 202 },
    analysis: {
      cards: [],
      fundamentos: {
        seriesHistoricas: {
          headers: [{ label: 'Atual' }, { label: '2025' }, { label: '2024' }, { label: '2023' }, { label: '2022' }, { label: '2021' }],
          items: [
            { metricName: 'P/L', values: [5.11, 4.98, 5.44, 6.01, 5.20, 4.88] },
            { metricName: 'P/VP', values: [0.95, 0.91, 0.88, 0.82, 0.79, 0.76] },
            { metricName: 'Dividend Yield', unit: 'percent', values: [8.2, 7.9, 9.1, 6.4, 5.8, 4.7] },
            { metricName: 'ROE', unit: 'percent', values: [18.4, 17.9, 16.2, 14.8, 13.1, 12.4] }
          ]
        }
      }
    }
  }
};
const nestedSources = _test.buildStockHistoricalIndicatorSources({
  ticker: 'BBAS3',
  apiExtras: { rawJson: { assetTickerRest: deeplyNestedRestTickerPayload, unrelatedEnvelope: { ignored: true } } }
});
const nestedBuilt = _test.buildStockHistoricalIndicators(nestedSources, 'BBAS3', {});
assert.equal(nestedBuilt.status, 'OK');
assert.equal(nestedBuilt.rows.find(row => row.label === 'P/L')?.values.Atual, '5,11');
assert.equal(nestedBuilt.rows.find(row => row.label === 'P/VP')?.values['2024'], '0,88');
assert.equal(nestedBuilt.rows.find(row => row.label === 'Dividend Yield')?.values['2023'], '6,40%');
assert.equal(nestedBuilt.rows.find(row => row.label === 'ROE')?.values['2021'], '12,40%');

const alternativeRestTickerEnvelope = {
  assetTickerRest: {
    result: {
      symbol: 'ITSA4',
      indicadoresFundamentalistasHistorico: {
        anos: ['Atual', '2025', '2024', '2023'],
        metricas: {
          pl: [7.1, 6.9, 8.2, 7.8],
          p_vp: [1.31, 1.24, 1.18, 1.10],
          margem_liquida: ['18,10%', '17,80%', '16,40%', '15,70%'],
          roe: ['18,90%', '18,30%', '16,90%', '15,50%']
        }
      }
    }
  }
};
const alternativeBuilt = _test.buildStockHistoricalIndicators(
  _test.buildStockHistoricalIndicatorSources({ ticker: 'ITSA4', apiExtras: { rawJson: alternativeRestTickerEnvelope } }),
  'ITSA4',
  {}
);
assert.equal(alternativeBuilt.status, 'OK');
assert.equal(alternativeBuilt.rows.find(row => row.label === 'P/L')?.values['2024'], '8,20');
assert.equal(alternativeBuilt.rows.find(row => row.label === 'P/VP')?.values.Atual, '1,31');
assert.equal(alternativeBuilt.rows.find(row => row.label === 'Margem Líquida')?.values['2023'], '15,70%');
assert.equal(alternativeBuilt.rows.find(row => row.label === 'ROE')?.values['2025'], '18,30%');

const source = fs.readFileSync('lib/analysis/stock-modal-contract.js', 'utf8');
assert.ok(source.includes('/api/rest/assets/tickers/${encodeURIComponent(symbol)}'), 'deve manter a API REST principal enviada pelo usuário');
assert.ok(source.includes('/api/rest/assets/tickers/${encodeURIComponent(symbol)}/'), 'deve tentar também a API REST com barra final');
assert.ok(source.includes('collectStockHistoricalIndicatorCandidates(raw, { maxDepth: 12 })'), 'deve varrer o envelope rawJson completo do Investidor10');
assert.ok(source.includes("26.asset-modal.stock.v49"), 'contrato de ação deve subir para v48');

console.log('stock-modal-historical-indicators-api-audit-v270 ok');
