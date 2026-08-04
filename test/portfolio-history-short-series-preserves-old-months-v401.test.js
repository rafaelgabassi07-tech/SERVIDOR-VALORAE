import assert from 'node:assert/strict';
import { buildPortfolioHistory } from '../lib/portfolio/history.js';

const month = value => Math.floor(Date.parse(`${value}-01T00:00:00Z`) / 1000);
const longTimestamps = ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'].map(month);
const shortTimestamps = ['2024-05', '2024-06'].map(month);

function yahooResponse(timestamps, closes, name) {
  return new Response(JSON.stringify({
    chart: {
      result: [{
        meta: {
          regularMarketPrice: closes.at(-1),
          chartPreviousClose: closes.at(-2),
          longName: name,
          shortName: name,
          currency: 'BRL'
        },
        timestamp: timestamps,
        indicators: {
          quote: [{ close: closes, open: closes, high: closes, low: closes, volume: closes.map(() => 1) }]
        }
      }],
      error: null
    }
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

globalThis.fetch = async url => {
  const value = String(url);
  if (value.includes('LONG3.SA')) return yahooResponse(longTimestamps, [10, 11, 12, 13, 14, 15], 'Empresa Longa');
  if (value.includes('NEW11.SA')) return yahooResponse(shortTimestamps, [20, 22], 'Fundo Novo');
  return new Response('{}', { status: 404 });
};

const result = await buildPortfolioHistory([
  { ticker: 'LONG3', quantity: 10, averagePrice: 8, currentPrice: 15, firstPurchaseAt: 0 },
  { ticker: 'NEW11', quantity: 5, averagePrice: 18, currentPrice: 22, firstPurchaseAt: 0 }
], {
  range: '5y',
  interval: '1mo',
  timeoutMs: 1000,
  maxConcurrency: 2
});

const remote = result.series.filter(row => !String(row.source || '').startsWith('CurrentPrice'));
assert.ok(remote.length >= 6, `meses históricos foram cortados: ${JSON.stringify(result.series)}`);
const january = remote.find(row => String(row.date).startsWith('2024-01'));
const april = remote.find(row => String(row.date).startsWith('2024-04'));
const may = remote.find(row => String(row.date).startsWith('2024-05'));
assert.equal(january?.totalValue, 100, 'janeiro deve preservar somente LONG3, que possui cotação real');
assert.equal(april?.totalValue, 130, 'abril deve permanecer disponível antes da primeira cotação de NEW11');
assert.equal(may?.totalValue, 240, 'maio deve incluir LONG3 e NEW11 após ambas terem cotação real');
assert.equal(january?.completeValuation, true);
assert.equal(january?.partialValuation, false);
assert.equal(january?.historicalCompositionInferred, true);
assert.deepEqual(january?.excludedBeforeHistoryTickers, ['NEW11']);
assert.equal(result.historicalCompositionInferred, true);
assert.ok(result.inferredHistoryStartTickers.includes('NEW11'));

console.log('portfolio-history-short-series-preserves-old-months-v401 ok');
