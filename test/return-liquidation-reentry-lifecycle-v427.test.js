import assert from 'node:assert/strict';
import { buildPortfolioReturns } from '../lib/portfolio/analysis.js';

function yahooChart(closes, timestamps) {
  return new Response(JSON.stringify({
    chart: {
      result: [{
        meta: {
          currency: 'BRL',
          regularMarketPrice: closes.at(-1),
          chartPreviousClose: closes.at(-2) || closes.at(-1)
        },
        timestamp: timestamps,
        indicators: { quote: [{ close: closes, open: closes, high: closes, low: closes, volume: closes.map(() => 1000) }] }
      }],
      error: null
    }
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

const timestamps = [];
const oldCloses = [];
const newCloses = [];
for (let year = 2022; year <= 2030; year += 1) {
  for (let month = 0; month < 12; month += 1) {
    timestamps.push(Math.floor(Date.UTC(year, month, 25) / 1000));
    oldCloses.push(10 + (year - 2022) * 1.2 + month * 0.08);
    newCloses.push(20 + (year - 2022) * 1.1 + month * 0.12);
  }
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const target = String(url);
  if (target.includes('query1.finance.yahoo.com') || target.includes('query2.finance.yahoo.com')) {
    if (target.includes('OLD3.SA')) return yahooChart(oldCloses, timestamps);
    if (target.includes('NEW3.SA')) return yahooChart(newCloses, timestamps);
  }
  return new Response('', { status: 404 });
};

try {
  const contract = await buildPortfolioReturns({
    range: 'SINCE_START',
    assetFilter: 'ALL',
    benchmarks: ['NONE'],
    timeoutMs: 300,
    positions: [
      { ticker: 'NEW3', quantity: 5, avgPrice: 20, currentPrice: 26, firstPurchaseDate: '2025-04-10', assetClass: 'ACAO' }
    ],
    transactions: [
      { ticker: 'OLD3', quantity: 10, price: 10, date: '2023-01-10', side: 'BUY', assetClass: 'ACAO' },
      { ticker: 'OLD3', quantity: 10, price: 14, date: '2024-06-05', side: 'SELL', assetClass: 'ACAO' },
      { ticker: 'NEW3', quantity: 5, price: 20, date: '2025-04-10', side: 'BUY', assetClass: 'ACAO' }
    ]
  });

  assert.equal(contract.diagnostics.portfolioStartDate, '2023-01-10');
  assert.deepEqual(contract.diagnostics.closedHistoricalTickers, ['OLD3']);
  assert.ok(contract.series.some(row => row.month === '2023-01'), 'histórico precisa começar no ativo já vendido');
  assert.ok(contract.series.some(row => row.month === '2024-06'), 'mês da liquidação total precisa continuar na cadeia de retorno');
  assert.ok(contract.series.some(row => row.month === '2025-04'), 'mês da reentrada precisa continuar na cadeia');
  assert.ok(contract.series.every(row => Math.abs(Number(row.monthlyReturnPercent || 0)) < 100), 'liquidação/reentrada não pode gerar retorno mensal explosivo');
  assert.ok(Number(contract.summary.totalReturnPercent) > -100 && Number(contract.summary.totalReturnPercent) < 500, 'retorno acumulado deve permanecer economicamente plausível');
  assert.equal(contract.diagnostics.partial, false, 'benchmarks não solicitados não podem marcar a resposta como parcial');
  assert.deepEqual(contract.diagnostics.warnings, [], 'benchmarks não solicitados não devem gerar avisos');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('return liquidation/reentry lifecycle v427 OK');
