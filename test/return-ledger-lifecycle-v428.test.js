import assert from 'node:assert/strict';
import { buildPortfolioReturns } from '../lib/portfolio/analysis.js';
import { clearCache } from '../lib/core/cache.js';

const originalFetch = globalThis.fetch;
const savedExternal = process.env.VALORAE_DISABLE_EXTERNAL;

function yahooChart(rows) {
  return {
    chart: {
      result: [{
        timestamp: rows.map(([date]) => Math.floor(new Date(`${date}T18:00:00Z`).getTime() / 1000)),
        indicators: { quote: [{ close: rows.map(([, close]) => close) }] }
      }],
      error: null
    }
  };
}

try {
  delete process.env.VALORAE_DISABLE_EXTERNAL;
  clearCache();
  globalThis.fetch = async (url) => {
    const raw = String(url);
    if (/OPEN3\.SA/.test(raw)) {
      return new Response(JSON.stringify(yahooChart([
        ['2026-05-29', 110], ['2026-06-30', 115], ['2026-07-31', 118], ['2026-08-17', 120]
      ])), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (/OLD3\.SA/.test(raw)) {
      return new Response(JSON.stringify(yahooChart([
        ['2026-01-30', 11], ['2026-02-27', 12], ['2026-03-05', 14]
      ])), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('', { status: 404 });
  };

  const partialLedger = await buildPortfolioReturns({
    range: 'SINCE_START',
    benchmarks: ['NONE'],
    positions: [{ ticker: 'OPEN3', quantity: 10, avgPrice: 100, currentPrice: 120, firstPurchaseDate: '2026-05-05', assetClass: 'ACAO' }],
    // Only half of the current inventory exists in the imported ledger. Five units
    // predate the available B3 history and must be reconciled as opening inventory.
    transactions: [{ ticker: 'OPEN3', quantity: 5, price: 100, date: '2026-06-10', side: 'BUY', assetClass: 'ACAO' }]
  });
  assert.ok(partialLedger.series.length >= 4, 'carteira parcial precisa manter a trajetória desde a primeira compra explícita');
  assert.equal(partialLedger.diagnostics.portfolioStartDate, '2026-05-05');
  assert.deepEqual(partialLedger.diagnostics.openingInventoryReconciledTickers, ['OPEN3']);
  assert.equal(partialLedger.series[0].month, '2026-05');
  assert.ok(Math.abs(partialLedger.series[0].monthlyReturnPercent - 10) < 0.05,
    'primeiro mês deve medir 500 -> 550, sem tratar estoque preexistente como ganho gratuito');
  assert.equal(partialLedger.series.at(-1).marketValue, 1200, 'mês atual deve respeitar 10 unidades da posição real');

  clearCache();
  const closedAsset = await buildPortfolioReturns({
    range: 'SINCE_START',
    benchmarks: ['NONE'],
    positions: [],
    transactions: [
      { ticker: 'OLD3', quantity: 10, price: 10, date: '2026-01-05', side: 'BUY', assetClass: 'ACAO' },
      { ticker: 'OLD3', quantity: 10, price: 14, date: '2026-03-05', side: 'SELL', assetClass: 'ACAO' }
    ]
  });
  assert.deepEqual(closedAsset.diagnostics.closedHistoricalTickers, ['OLD3']);
  assert.equal(closedAsset.series.some(point => point.month === '2026-03'), true,
    'mês da liquidação total não pode desaparecer da série');
  assert.equal(closedAsset.series.at(-1).month, '2026-03',
    'meses posteriores sem capital não podem inventar exposição');
  assert.ok(closedAsset.summary.totalReturnPercent > 20,
    'ganho realizado do ativo já vendido precisa permanecer no retorno desde o início');

  console.log('return ledger lifecycle v428 OK');
} finally {
  clearCache();
  globalThis.fetch = originalFetch;
  if (savedExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = savedExternal;
}
