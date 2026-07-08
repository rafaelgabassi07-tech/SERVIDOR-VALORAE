import assert from 'node:assert/strict';
import { buildPortfolioHistory } from '../lib/portfolio/history.js';

const jan1 = Math.floor(Date.parse('2024-01-01T00:00:00Z') / 1000);
const jan2 = Math.floor(Date.parse('2024-01-02T00:00:00Z') / 1000);
const jan3 = Math.floor(Date.parse('2024-01-03T00:00:00Z') / 1000);

globalThis.fetch = async (url) => {
  const decoded = decodeURIComponent(String(url));
  const ticker = decoded.includes('KEEP3') ? 'KEEP3' : 'OLD4';
  const closes = ticker === 'KEEP3' ? [10, 11, 12] : [100, 100, 100];
  return new Response(JSON.stringify({
    chart: {
      result: [{
        meta: { regularMarketPrice: closes.at(-1), chartPreviousClose: closes.at(-2) },
        timestamp: [jan1, jan2, jan3],
        indicators: { quote: [{ close: closes, open: closes, high: closes, low: closes, volume: [1, 1, 1] }] }
      }],
      error: null
    }
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};

const result = await buildPortfolioHistory([
  { ticker: 'KEEP3', quantity: 2, averagePrice: 10, currentPrice: 12, firstPurchaseAt: jan2 },
], {
  range: 'MAX',
  interval: '1d',
  transactions: [
    { ticker: 'OLD4', date: '2020-01-01', operation: 'COMPRA', quantity: 100, price: 100, grossValue: 10000 },
    { ticker: 'KEEP3', date: '2024-01-02', operation: 'COMPRA', quantity: 2, price: 10, grossValue: 20 },
  ],
  timeoutMs: 1000,
  maxConcurrency: 2
});

assert.equal(result.ok, true);
assert.deepEqual(result.historyTickers, ['KEEP3']);
assert.deepEqual(result.activeTickers, ['KEEP3']);
assert.equal(result.ignoredTransactionCount, 1);
assert.equal(result.transactionCount, 1);
assert.ok(result.series.every(row => !row.positions || !('OLD4' in row.positions)), 'ativo antigo/deletado não deve compor o gráfico');
assert.ok(result.series[0].timestamp >= jan2, 'série deve iniciar no ativo atualmente mantido, não no primeiro ativo histórico');
console.log('portfolio-active-history-v293 ok');
