import assert from 'node:assert/strict';
import { clearCache } from '../lib/core/cache.js';

clearCache();

const originalFetch = global.fetch;
const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
delete process.env.VALORAE_DISABLE_EXTERNAL;
const requests = [];

const yahooPayload = (symbol) => ({
  chart: {
    result: [{
      meta: {
        symbol,
        regularMarketPrice: symbol === 'IFIX.SA' ? 3814.03 : symbol === 'IDIV.SA' ? 12117.78 : 2214.89,
        chartPreviousClose: symbol === 'IFIX.SA' ? 3802.62 : symbol === 'IDIV.SA' ? 12152.99 : 2223.78,
        previousClose: symbol === 'IFIX.SA' ? 3802.62 : symbol === 'IDIV.SA' ? 12152.99 : 2223.78,
        regularMarketTime: 1781280000
      },
      timestamp: [],
      indicators: { quote: [{ close: [] }] }
    }],
    error: null
  }
});

global.fetch = async (url) => {
  const textUrl = String(url);
  requests.push(textUrl);
  if (textUrl.includes('finance.yahoo.com')) {
    const symbol = decodeURIComponent(textUrl.match(/chart\/([^?]+)/)?.[1] || '');
    return new Response(JSON.stringify(yahooPayload(symbol)), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('investidor10.com.br/api/indices/cotacoes/')) {
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('sistemaswebb3-listados.b3.com.br') || textUrl.includes('maisretorno.com')) {
    throw new Error(`Fonte não prevista na cadeia direta + Yahoo: ${textUrl}`);
  }
  return new Response('', { status: 404 });
};

try {
  const { buildPortfolioReturns } = await import('../lib/portfolio/analysis.js');
  const contract = await buildPortfolioReturns({
    range: '12M',
    historyMonths: 12,
    benchmarks: ['SMLL', 'IFIX', 'IDIV'],
    portfolioHistory: [
      { date: '2026-05-01', totalValue: 1000, investedValue: 1000, returnPercent: 0, source: 'broker-real-history' },
      { date: '2026-06-01', totalValue: 1120, investedValue: 1000, returnPercent: 12, source: 'broker-real-history' }
    ]
  });

  for (const ticker of ['SMLL', 'IFIX', 'IDIV']) {
    const benchmark = contract.benchmarks.find(item => item.ticker === ticker);
    assert.equal(benchmark?.status, 'SNAPSHOT_ONLY', `${ticker} must remain unavailable for charting when Yahoo returns only one real snapshot`);
    assert.equal(benchmark?.simulated, false, `${ticker} must not be simulated`);
    assert.equal(benchmark?.proxyTickerUsed, false, `${ticker} must not use proxy ticker`);
    assert.equal(benchmark?.directIndexSymbol, true, `${ticker} must use a direct Yahoo index symbol`);
    assert.ok(String(benchmark?.source || '').includes('Yahoo Finance Chart API'), `${ticker} should show Yahoo Finance source`);
    assert.equal((benchmark?.points || []).length, 0, `${ticker} must not fabricate a second historical point from previousClose metadata`);
    assert.equal(contract.series.some(point => point[`${ticker.toLowerCase()}ReturnPercent`] != null || (ticker === 'SMLL' && point.smal11ReturnPercent != null)), false, `${ticker} should stay out of the chart until a real historical series arrives`);
  }
  assert.ok(requests.some(url => url.includes('IFIX.SA')), 'IFIX.SA must be requested');
  assert.ok(requests.some(url => url.includes('IDIV.SA')), 'IDIV.SA must be requested');
  assert.ok(requests.some(url => url.includes('SMLL.SA')), 'SMLL.SA must be requested');
  assert.equal(requests.some(url => url.includes('maisretorno.com')), false, 'Mais Retorno must not be called');
  assert.equal(requests.some(url => url.includes('investidor10.com.br/api/indices/cotacoes/')), true, 'A fonte direta usada pelos modais deve ser tentada antes do Yahoo');
  console.log('Portfolio returns direct-index-first with Yahoo snapshot fallback test OK.');
} finally {
  clearCache();
  global.fetch = originalFetch;
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
}
