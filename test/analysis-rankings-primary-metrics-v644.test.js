import assert from 'node:assert/strict';
import { _test } from '../lib/market/analysis-rankings-i10.js';

function rankingHtml({ title, assetPath, primaryDisplay, extraHeaders = [], extraValues = [] }) {
  const headers = ['Ativos', 'Indicador principal', ...extraHeaders];
  const values = ['TEST3', primaryDisplay, ...extraValues];
  return `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1><table><thead><tr>${headers.map(h => `<th><span>${h}</span></th>`).join('')}</tr></thead><tbody><tr>${values.map((v, i) => `<td>${i === 0 ? `<a href="/${assetPath}/test3/">${v}</a>` : v}</td>`).join('')}</tr></tbody></table></body></html>`;
}

const cases = [
  { id: 'FII_PVP_LOW', title: 'Ranking de FIIs de Menores P/VP', assetPath: 'fiis', display: '0,15', field: 'pvpDisplay', value: 0.15 },
  { id: 'FII_PVP_HIGH', title: 'Ranking de FIIs de Maiores P/VP', assetPath: 'fiis', display: '1,86', field: 'pvpDisplay', value: 1.86 },
  { id: 'STOCK_ROE', title: 'Ranking de Ações de Maiores ROEs', assetPath: 'acoes', display: '345,77%', field: 'roeDisplay', value: 345.77 },
  { id: 'STOCK_PL_LOW', title: 'Ranking de Ações de Menores P/Ls', assetPath: 'acoes', display: '0,61', field: 'plDisplay', value: 0.61 },
  { id: 'STOCK_PROFIT_GROWTH_5Y', title: 'Ranking de Ações com Maiores Crescimento de Lucro', assetPath: 'acoes', display: '457,93%', field: 'profitGrowth5yDisplay', value: 457.93 },
  { id: 'STOCK_REVENUE_GROWTH_5Y', title: 'Ranking de Ações de Maiores Crescimento de Receita', assetPath: 'acoes', display: '124,40%', field: 'revenueGrowth5yDisplay', value: 124.40 },
  { id: 'STOCK_NET_MARGIN', title: 'Ranking de Ações com Maiores Margens Líquidas', assetPath: 'acoes', display: '203,02%', field: 'netMarginDisplay', value: 203.02 },
];

for (const entry of cases) {
  const html = rankingHtml({
    title: entry.title,
    assetPath: entry.assetPath,
    primaryDisplay: entry.display,
    extraHeaders: ['Dividend Yield', 'Valor de Mercado'],
    extraValues: ['8,00%', '10,00 B'],
  });
  const parsed = _test.parseSemanticRankingHtml(html, entry.id, 40);
  assert.equal(parsed.identityOk, true, `${entry.id}: page identity`);
  assert.equal(parsed.items.length, 1, `${entry.id}: one row`);
  const item = parsed.items[0];
  assert.equal(item.primaryMetricDisplay, entry.display, `${entry.id}: primary display fallback`);
  assert.ok(Math.abs(item.primaryMetricValue - entry.value) < 1e-9, `${entry.id}: primary numeric fallback`);
  assert.equal(item[entry.field], entry.display, `${entry.id}: semantic display field`);
}

console.log('analysis-rankings-primary-metrics-v644: ok');
