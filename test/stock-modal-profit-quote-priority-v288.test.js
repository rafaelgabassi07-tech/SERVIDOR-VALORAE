import assert from 'node:assert/strict';
import fs from 'node:fs';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const source = fs.readFileSync('lib/analysis/stock-modal-contract.js', 'utf8');
const firstLucro = source.indexOf("addTask('lucroCotacao'");
const firstRevenueCandidates = source.indexOf('for (const [revenueKey, revenueUrl] of stockRevenueApiEndpointCandidates({ symbol, ids: {} })');
assert.ok(firstLucro > 0, 'lucroCotacao precisa estar presente na fila de APIs do modal de ação');
assert.ok(firstRevenueCandidates > 0, 'candidatos de receita por ticker precisam existir');
assert.ok(firstLucro < firstRevenueCandidates, 'lucroCotacao deve ser priorizado antes da expansão de endpoints de receita');
assert.equal(_test.STOCK_MODAL_VERSION, '26.asset-modal.stock.v56-progressive-fast-full');

const profitQuoteChart = _test.buildStockProfitQuoteChartPayload({
  ticker: 'PETR4',
  canonical: { financial: { profitVsQuote: [
    { label: '2023', year: 2023, value: 32.10, secondaryValue: 124000000000 },
    { label: '2024', year: 2024, quote: 38.50, profit: 98000000000 }
  ] } }
});
assert.equal(profitQuoteChart.status, 'OK');
assert.equal(profitQuoteChart.points.length, 2);
assert.equal(profitQuoteChart.points[0].quote, 32.1);
assert.equal(profitQuoteChart.points[0].netIncome, 124000000000);

console.log('stock-modal-profit-quote-priority-v288 ok');
