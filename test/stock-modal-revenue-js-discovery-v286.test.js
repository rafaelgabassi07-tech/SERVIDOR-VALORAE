import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const html = `
<html><head>
  <script src="/assets/js/app-stock-page.js?id=abc"></script>
  <script src="https://investidor10.com.br/build/assets/revenue-pie.js"></script>
</head></html>`;
const scripts = _test.extractInvestidor10ScriptUrls(html);
assert.deepEqual(scripts, [
  'https://investidor10.com.br/assets/js/app-stock-page.js?id=abc',
  'https://investidor10.com.br/build/assets/revenue-pie.js'
], 'Investidor10 script URLs must be resolved from asset page HTML');

const jsPayload = [
  'const companyId = 1234;',
  'axios.get(`/api/acoes/grafico-receita-regiao/${companyId}`);',
  "fetch('/api/acoes/chart-receita-negocio/' + companyId);",
  'window.__route = "https:\\/\\/investidor10.com.br\\/api\\/acoes\\/sales-by-segment\\/1234";'
].join('\n');
const discovered = _test.discoverInvestidor10StockRevenueApiUrlsFromText(jsPayload, {
  symbol: 'PETR4',
  ids: { companyId: '1234', tickerId: '5678' }
});
const discoveredUrls = discovered.map(([, url]) => url);
assert.ok(discovered.some(([key, url]) => key === 'revenueGeography' && /grafico-receita-regiao\/1234/i.test(url)), 'JS discovery must classify region revenue API URLs');
assert.ok(discovered.some(([key, url]) => key === 'revenueSegment' && /sales-by-segment\/1234/i.test(url)), 'JS discovery must classify business/segment revenue API URLs');
assert.equal(new Set(discoveredUrls).size, discoveredUrls.length, 'JS discovered URLs must be deduplicated');

const regionRows = _test.rowsFromRevenueCandidate({
  data: {
    ano: 2025,
    regioes: [
      { nomeRegiao: 'Brasil', valorReceita: 'R$ 89,95 Bilhões', percentualReceita: '71%' },
      { nomeRegiao: 'China', valorReceita: 'R$ 13,67 Bilhões', percentualReceita: 11 }
    ]
  }
}, 'region');
assert.equal(regionRows.length, 2, 'region rows must be extracted from nested API payload aliases');
assert.equal(regionRows[0].label, 'Brasil');
assert.equal(regionRows[0].percent, 71);

const businessRows = _test.rowsFromRevenueCandidate({
  result: {
    anos: {
      2025: [
        { nomeProduto: 'Diesel', receitaValor: 'R$ 52,00 Bilhões', receitaPercentual: '42%' },
        { nomeProduto: 'Gasolina', receitaValor: 'R$ 31,00 Bilhões', receitaPercentual: '25%' }
      ]
    }
  }
}, 'business');
assert.equal(businessRows.length, 2, 'business rows must be extracted from nested product aliases');
assert.equal(businessRows[0].label, 'Diesel');
assert.equal(businessRows[0].percent, 42);

assert.equal(_test.STOCK_MODAL_VERSION, '26.asset-modal.stock.v57-data-truth');
console.log('stock-modal-revenue-js-discovery-v286 ok');
