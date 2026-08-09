import assert from 'node:assert/strict';
import { _test, getInvestidor10AnalysisRankingCatalog } from '../lib/market/analysis-rankings-i10.js';

function stockHtml(title, primaryHeader, primaryValues) {
  const headers = [
    'Ativos', primaryHeader, 'P/L', 'P/VP', 'Dividend Yield', 'ROE', 'Margem Líquida',
    'Valor de Mercado', 'Receita', 'Lucro', 'Cresc. Receita 5 anos', 'Cresc. Lucro 5 anos',
    'Caixas', 'Variação 30d', 'Variação 12m', 'Preço Atual'
  ];
  const rows = [
    ['PETR4', primaryValues[0], '6,20', '1,22', '9,31%', '18,50%', '12,40%', '500,20 B', '498,09 B', '108,04 B', '8,80%', '14,20%', '65,10 B', '11,25%', '34,80%', 'R$ 40,87'],
    ['ITUB4', primaryValues[1], '9,10', '2,01', '8,90%', '22,70%', '25,10%', '390,10 B', '388,67 B', '47,02 B', '12,40%', '18,50%', '92,30 B', '9,60%', '28,10%', 'R$ 40,75'],
    ['VALE3', primaryValues[2], '7,30', '1,55', '7,20%', '20,10%', '28,20%', '350,00 B', '214,86 B', '13,84 B', '4,20%', '6,40%', '44,80 B', '7,20%', '21,40%', 'R$ 74,97'],
  ];
  return `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((v, i) => `<td>${i === 0 ? `<a href="/acoes/${String(v).toLowerCase()}/">${v}</a>` : v}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
}

const cases = [
  ['STOCK_REVENUE', 'Ranking de Ações de Maiores Receitas', 'Receita', ['498,09 B', '388,67 B', '214,86 B'], 498.09e9],
  ['STOCK_NET_INCOME', 'Ranking de Ações de Maiores Lucros', 'Lucro', ['108,04 B', '47,02 B', '13,84 B'], 108.04e9],
  ['STOCK_ROE', 'Ranking de Ações de Maiores ROEs', 'ROE', ['345,77%', '89,41%', '72,72%'], 345.77],
  ['STOCK_PL_LOW', 'Ranking de Ações de Menores P/Ls', 'P/L', ['0,61', '1,26', '1,63'], 0.61],
  ['STOCK_30D_GAIN', 'Ranking de Ações com Maiores Altas em 30 dias', 'Variação 30d', ['38,50%', '34,20%', '29,54%'], 38.50],
  ['STOCK_12M_GAIN', 'Ranking de Ações com Maiores Altas em 12 meses', 'Variação 12m', ['180,20%', '150,10%', '120,00%'], 180.20],
  ['STOCK_CASH', 'Ranking de Ações de Maiores Caixas', 'Caixas', ['92,30 B', '65,10 B', '44,80 B'], 92.30e9],
  ['STOCK_PROFIT_GROWTH_5Y', 'Ranking de Ações com Maiores Crescimento de Lucro', 'Cresc. Lucro 5 anos', ['88,20%', '70,10%', '62,30%'], 88.20],
  ['STOCK_REVENUE_GROWTH_5Y', 'Ranking de Ações de Maiores Crescimento de Receita', 'Cresc. Receita 5 anos', ['64,20%', '52,10%', '41,30%'], 64.20],
];

for (const [id, title, header, values, expected] of cases) {
  const parsed = _test.parseSemanticRankingHtml(stockHtml(title, header, values), id, 40);
  assert.equal(parsed.identityOk, true, `${id}: identity`);
  assert.equal(parsed.items.length, 3, `${id}: rows`);
  assert.equal(parsed.items[0].primaryMetricValue, expected, `${id}: primary value`);
  assert.equal(parsed.items[0].primaryMetricDisplay, values[0], `${id}: primary display`);
}

const revenue = _test.parseSemanticRankingHtml(stockHtml('Ranking de Ações de Maiores Receitas', 'Receita', ['498,09 B', '388,67 B', '214,86 B']), 'STOCK_REVENUE', 40);
assert.equal(revenue.items[0].revenue, 498.09e9);
assert.equal(revenue.items[0].netIncome, 108.04e9);
assert.ok(Math.abs(revenue.items[0].cash - 65.10e9) < 1);
assert.equal(revenue.items[0].variation30d, 11.25);
assert.equal(revenue.items[0].revenueGrowth5y, 8.80);
assert.equal(revenue.items[0].profitGrowth5y, 14.20);

const expectedUrls = new Map([
  ['STOCK_REVENUE', 'https://investidor10.com.br/acoes/rankings/maiores-receitas/'],
  ['STOCK_NET_INCOME', 'https://investidor10.com.br/acoes/rankings/maiores-lucros/'],
  ['STOCK_ROE', 'https://investidor10.com.br/acoes/rankings/maiores-roes/'],
  ['STOCK_PL_LOW', 'https://investidor10.com.br/acoes/rankings/menores-pls/'],
  ['STOCK_30D_GAIN', 'https://investidor10.com.br/acoes/rankings/maiores-altas-30-dias/'],
  ['STOCK_12M_GAIN', 'https://investidor10.com.br/acoes/rankings/maiores-altas-12-meses/'],
  ['STOCK_CASH', 'https://investidor10.com.br/acoes/rankings/maiores-caixas/'],
  ['STOCK_PROFIT_GROWTH_5Y', 'https://investidor10.com.br/acoes/rankings/maiores-crescimento-lucro/'],
  ['STOCK_REVENUE_GROWTH_5Y', 'https://investidor10.com.br/acoes/rankings/maiores-crescimento-receita/'],
]);

const catalog = getInvestidor10AnalysisRankingCatalog();
assert.equal(catalog.items.length, 19);
for (const [id] of cases) {
  const item = catalog.items.find(entry => entry.id === id);
  assert.ok(item, `${id} missing from catalog`);
  assert.equal(_test.definitions[id].url, expectedUrls.get(id), `${id}: source URL`);
}

console.log('analysis-rankings-stock-expansion-v640: ok');
