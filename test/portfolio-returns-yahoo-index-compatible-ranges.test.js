import assert from 'node:assert/strict';

const requests = [];
const originalFetch = global.fetch;
const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
delete process.env.VALORAE_DISABLE_EXTERNAL;
const closeBySymbol = {
  'IFIX.SA': [3700, 3740, 3814.03],
  'IDIV.SA': [11800, 12020, 12117.78],
  'SMLL.SA': [2180, 2200, 2214.89]
};

function yahooResponse(symbol, range, interval) {
  if (range === '10y' && interval === '1mo') {
    return { chart: { result: [{ meta: { regularMarketPrice: closeBySymbol[symbol].at(-1), chartPreviousClose: closeBySymbol[symbol].at(-2) }, timestamp: [], indicators: { quote: [{ close: [] }] } }], error: null } };
  }
  const closes = closeBySymbol[symbol] || [100, 101, 102];
  const timestamps = [1704067200, 1706745600, 1709251200];
  return { chart: { result: [{ meta: { currency: 'BRL', regularMarketPrice: closes.at(-1), chartPreviousClose: closes.at(-2) }, timestamp: timestamps.slice(0, closes.length), indicators: { quote: [{ close: closes, open: closes, high: closes, low: closes, volume: closes.map(() => 0) }] } }], error: null } };
}

global.fetch = async (url) => {
  const textUrl = String(url);
  requests.push(textUrl);
  if (textUrl.includes('query') && textUrl.includes('finance.yahoo.com')) {
    const parsed = new URL(textUrl);
    const symbol = decodeURIComponent(parsed.pathname.split('/').pop());
    const range = parsed.searchParams.get('range');
    const interval = parsed.searchParams.get('interval');
    return new Response(JSON.stringify(yahooResponse(symbol, range, interval)), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response('', { status: 404 });
};

try {
  const { buildPortfolioReturns } = await import('../lib/portfolio/analysis.js');
  const contract = await buildPortfolioReturns({
    range: 'SINCE_START',
    historyMonths: 120,
    assetFilter: 'ALL',
    benchmarks: ['SMLL', 'IFIX', 'IDIV'],
    portfolioHistory: [
      { date: '2024-01-01', totalValue: 1000, investedValue: 1000, returnPercent: 0, source: 'broker-real-history' },
      { date: '2024-02-01', totalValue: 1030, investedValue: 1000, returnPercent: 3, source: 'broker-real-history' },
      { date: '2024-03-01', totalValue: 1060, investedValue: 1000, returnPercent: 6, source: 'broker-real-history' }
    ]
  });

  for (const ticker of ['SMLL', 'IFIX', 'IDIV']) {
    const benchmark = contract.benchmarks.find(item => item.ticker === ticker);
    assert.equal(benchmark?.status, 'OK', `${ticker} should recover through a Yahoo compatible daily range`);
    assert.equal(benchmark?.directIndexSymbol, true, `${ticker} should be marked as direct Yahoo index symbol`);
    assert.equal(benchmark?.simulated, false, `${ticker} must not be simulated`);
    assert.equal(benchmark?.proxyTickerUsed, false, `${ticker} must not use proxy ticker`);
    assert.ok((benchmark?.points || []).length >= 2, `${ticker} should have real comparison points`);
    assert.ok(contract.series.some(point => point[`${ticker.toLowerCase()}ReturnPercent`] != null || (ticker === 'SMLL' && point.smal11ReturnPercent != null)), `${ticker} should be visible in chart series`);
  }
  assert.ok(requests.some(url => url.includes('range=10y') && url.includes('interval=1mo')), 'test must exercise the wide MAX request first');
  assert.ok(requests.some(url => url.includes('range=5y') || url.includes('range=2y') || url.includes('range=1y')), 'test must exercise compatible Yahoo fallback ranges');
  console.log('Portfolio returns Yahoo direct index compatible ranges test OK.');
} finally {
  global.fetch = originalFetch;
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
}
