import assert from 'node:assert/strict';
import { buildPortfolioHistory, normalizePortfolioTransactions } from '../lib/portfolio/history.js';

const jan1 = Math.floor(Date.parse('2024-01-01T00:00:00Z') / 1000);
const jan2 = Math.floor(Date.parse('2024-01-02T00:00:00Z') / 1000);
const jan3 = Math.floor(Date.parse('2024-01-03T00:00:00Z') / 1000);

const closes = {
  TESTA3: [10, 11, 12],
  TESTB4: [20, 21, 22],
};

globalThis.fetch = async (url) => {
  const decoded = decodeURIComponent(String(url));
  const ticker = decoded.includes('TESTB4') ? 'TESTB4' : 'TESTA3';
  return new Response(JSON.stringify({
    chart: {
      result: [{
        meta: { currency: 'BRL', timezone: 'America/Sao_Paulo', regularMarketPrice: closes[ticker].at(-1), chartPreviousClose: closes[ticker].at(-2) },
        timestamp: [jan1, jan2, jan3],
        indicators: { quote: [{ close: closes[ticker], open: closes[ticker], high: closes[ticker], low: closes[ticker], volume: [100, 100, 100] }] }
      }],
      error: null
    }
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};

const transactions = normalizePortfolioTransactions({ transactions: [
  { ticker: 'TESTA3', date: '2024-01-01', operation: 'COMPRA', quantity: 1, price: 10, grossValue: 10 },
  { ticker: 'TESTB4', date: '2024-01-02', operation: 'COMPRA', quantity: 2, price: 20, grossValue: 40 },
] });

const result = await buildPortfolioHistory([
  { ticker: 'TESTA3', quantity: 1, averagePrice: 10, currentPrice: 12, firstPurchaseAt: jan1 },
  { ticker: 'TESTB4', quantity: 2, averagePrice: 20, currentPrice: 22, firstPurchaseAt: jan2 },
], { range: 'MAX', interval: '1d', timeoutMs: 1000, maxConcurrency: 2, transactions });

assert.equal(result.ok, true);
assert.equal(result.fallbackUsed, false);
assert.equal(result.transactionCount, 2);
assert.ok(result.series.length >= 3, `series.length=${result.series.length}`);
assert.equal(String(result.series[0].date).slice(0, 10), '2024-01-01');
assert.equal(result.series[0].totalValue, 10, 'no primeiro dia só o primeiro ativo comprado entra na carteira');
const jan2Row = result.series.find(row => String(row.date).slice(0, 10) === '2024-01-02');
assert.ok(jan2Row, 'deve haver ponto no dia da segunda compra');
assert.equal(jan2Row.totalValue, 53, 'no segundo dia carteira soma TESTA3 + TESTB4');
console.log('portfolio-history-transaction-inception-v283 ok');
