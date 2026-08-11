import assert from 'node:assert/strict';
import { clearCache } from '../lib/core/cache.js';

clearCache();
const originalFetch = global.fetch;
const originalNow = Date.now;
Date.now = () => new Date('2026-08-11T20:30:00Z').getTime(); // 17:30 em São Paulo: after-market.

global.fetch = async (url) => {
  const textUrl = String(url);
  if (textUrl.includes('query1.finance.yahoo.com') || textUrl.includes('query2.finance.yahoo.com')) {
    const timestamps = [
      '2026-08-11T13:00:00Z', // 10:00 BRT
      '2026-08-11T19:55:00Z', // 16:55 BRT
      '2026-08-11T20:30:00Z', // 17:30 BRT, deve ser eliminado
    ].map(value => Math.floor(new Date(value).getTime() / 1000));
    const closes = [10, 11, 12];
    return new Response(JSON.stringify({
      chart: {
        result: [{
          meta: {
            symbol: 'PETR4.SA',
            regularMarketPrice: 12,
            chartPreviousClose: 9,
            previousClose: 9,
            currency: 'BRL'
          },
          timestamp: timestamps,
          indicators: { quote: [{ close: closes, open: closes, high: closes, low: closes, volume: [10, 10, 10] }] }
        }],
        error: null
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response('', { status: 404 });
};

try {
  const { buildPortfolioHistory } = await import('../lib/portfolio/history.js');
  const result = await buildPortfolioHistory(
    [{ ticker: 'PETR4', quantity: 10, averagePrice: 9, currentPrice: 15, firstPurchaseAt: 0 }],
    { range: '1d', interval: '5m' }
  );

  assert.equal(result.ok, true);
  assert.equal(result.series.length, 2, 'deve manter apenas os pontos de 10:00 e 16:55');
  assert.deepEqual(result.series.map(row => row.totalValue), [100, 110]);
  assert.equal(result.series.some(row => String(row.date).includes('20:30:00')), false, 'after-market não pode aparecer');
  assert.equal(result.series.some(row => /^currentPrice/i.test(String(row.source || ''))), false, 'currentPrice de 17:30 não pode ser anexado');
  assert.equal(result.summary.lastValue, 110, 'valor pós-fechamento não pode substituir o último ponto do pregão');

  console.log('portfolio-price-after-close-runtime-v655: ok');
} finally {
  global.fetch = originalFetch;
  Date.now = originalNow;
  clearCache();
}
