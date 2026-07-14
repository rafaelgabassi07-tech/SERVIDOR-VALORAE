import assert from 'node:assert/strict';
import { buildPortfolioHistory } from '../lib/portfolio/history.js';

const jan1 = Math.floor(Date.parse('2024-01-01T00:00:00Z') / 1000);
const feb1 = Math.floor(Date.parse('2024-02-01T00:00:00Z') / 1000);
const mar1 = Math.floor(Date.parse('2024-03-01T00:00:00Z') / 1000);

function yahooMonthly(closes) {
  return new Response(JSON.stringify({
    chart: {
      result: [{
        meta: { regularMarketPrice: closes.at(-1), chartPreviousClose: closes.at(-2) },
        timestamp: [jan1, feb1, mar1],
        indicators: { quote: [{ close: closes, open: closes, high: closes, low: closes, volume: [1, 1, 1] }] }
      }],
      error: null
    }
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

globalThis.fetch = async () => yahooMonthly([10, 20, 30]);

// O candle mensal é rotulado pelo início do mês, mas representa o fechamento.
// Uma compra em 15/jan deve compor o fechamento de janeiro.
{
  const result = await buildPortfolioHistory([
    { ticker: 'MONTH3', quantity: 5, averagePrice: 10, currentPrice: 30, firstPurchaseAt: Math.floor(Date.parse('2024-01-15T00:00:00Z') / 1000) }
  ], {
    range: '5y',
    interval: '1mo',
    timeoutMs: 1000,
    maxConcurrency: 1,
    transactions: [{
      ticker: 'MONTH3', date: '2024-01-15', operation: 'COMPRA', quantity: 5, price: 10, grossValue: 50
    }]
  });

  const january = result.series.find(row => String(row.date).slice(0, 7) === '2024-01');
  assert.ok(january, `fechamento de janeiro ausente: ${JSON.stringify(result.series)}`);
  assert.equal(january.totalValue, 50);
  assert.equal(january.investedValue, 50);
}

// Se o histórico importado começou no meio da vida da posição, a primeira linha
// conhecida não pode cortar o estoque inicial nem os fechamentos anteriores.
{
  const result = await buildPortfolioHistory([
    { ticker: 'OPENM3', quantity: 10, averagePrice: 10, currentPrice: 30, firstPurchaseAt: Math.floor(Date.parse('2024-02-15T00:00:00Z') / 1000) }
  ], {
    range: '5y',
    interval: '1mo',
    timeoutMs: 1000,
    maxConcurrency: 1,
    transactions: [{
      ticker: 'OPENM3', date: '2024-02-15', operation: 'COMPRA', quantity: 5, price: 10, grossValue: 50
    }]
  });

  const january = result.series.find(row => String(row.date).slice(0, 7) === '2024-01');
  const february = result.series.find(row => String(row.date).slice(0, 7) === '2024-02');
  assert.ok(result.reconciledTransactionTickers.includes('OPENM3'));
  assert.ok(january, `estoque inicial não apareceu antes da importação parcial: ${JSON.stringify(result.series)}`);
  assert.equal(january.totalValue, 50, '5 cotas de abertura × fechamento de janeiro');
  assert.equal(february.totalValue, 200, '10 cotas após a compra × fechamento de fevereiro');
}

console.log('portfolio-history-monthly-close-composition-v331 ok');
