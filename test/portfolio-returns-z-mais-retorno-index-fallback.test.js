import assert from 'node:assert/strict';
import { clearCache } from '../lib/core/cache.js';

clearCache();

const originalFetch = global.fetch;
const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
delete process.env.VALORAE_DISABLE_EXTERNAL;
const requests = [];

global.fetch = async (url) => {
  const textUrl = String(url);
  requests.push(textUrl);
  if (textUrl.includes('finance.yahoo.com')) {
    return new Response(JSON.stringify({
      chart: {
        result: [{
          meta: { regularMarketPrice: 100, chartPreviousClose: 99 },
          timestamp: [],
          indicators: { quote: [{ close: [] }] }
        }],
        error: null
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('maisretorno.com/indice/')) return new Response('', { status: 500 });
  if (textUrl.includes('investidor10.com.br')) return new Response('', { status: 500 });
  if (textUrl.includes('sistemaswebb3-listados.b3.com.br')) return new Response('', { status: 500 });
  return new Response('', { status: 404 });
};

try {
  const { buildPortfolioReturns } = await import('../lib/portfolio/analysis.js');
  const portfolioHistory = Array.from({ length: 13 }, (_, i) => {
    const date = new Date(Date.UTC(2025, 5 + i, 1)).toISOString().slice(0, 10);
    return { date, totalValue: 1000 + i * 10, investedValue: 1000, returnPercent: i, source: 'broker-real-history' };
  });
  const contract = await buildPortfolioReturns({
    range: '12M',
    historyMonths: 12,
    benchmarks: ['SMLL', 'IFIX', 'IDIV'],
    portfolioHistory
  });

  for (const ticker of ['SMLL', 'IFIX', 'IDIV']) {
    const benchmark = contract.benchmarks.find(item => item.ticker === ticker);
    assert.equal(benchmark?.status, 'SNAPSHOT_ONLY', `${ticker} deve aguardar série histórica real quando o Yahoo entrega apenas meta`);
    assert.equal(benchmark?.simulated, false, `${ticker} must not be simulated`);
    assert.equal(benchmark?.proxyTickerUsed, false, `${ticker} must not use proxy ticker`);
    assert.ok(String(benchmark?.source || '').includes('Yahoo Finance Chart API'), `${ticker} should show Yahoo direct source`);
    assert.equal((benchmark?.points || []).length, 0, `${ticker} não pode fabricar curva com current/previousClose`);
  }
  assert.equal(requests.some(url => url.includes('maisretorno.com/indice/')), false, 'IFIX/SMLL/IDIV policy must not call Mais Retorno while Yahoo direct is available');
  console.log('Portfolio returns direct-index policy regression test OK.');
} finally {
  clearCache();
  global.fetch = originalFetch;
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
}
