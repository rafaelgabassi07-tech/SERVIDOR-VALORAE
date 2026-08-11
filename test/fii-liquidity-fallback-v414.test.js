import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeYahooAdapterQuote, resolveDailyLiquidity } from '../lib/sources/quotes.js';

const quote = normalizeYahooAdapterQuote('HGLG11', {
  ok: true,
  price: 160,
  previousClose: 158,
  volume: 4_000,
  regularMarketVolume: 100_000,
  averageVolume: 3_500,
  time: '2026-08-10T17:00:00.000Z',
  cache: 'MISS',
});
assert.equal(quote.regularMarketVolume, 100_000);
assert.equal(quote.volume, 4_000);
assert.equal(resolveDailyLiquidity({ fundamental: { dailyLiquidity: 0 }, quote, price: 160 }), 16_000_000);
assert.equal(resolveDailyLiquidity({ fundamental: { dailyLiquidity: 25_000_000 }, quote, price: 160 }), 25_000_000);
assert.equal(resolveDailyLiquidity({ fundamental: null, quote: {}, price: 160 }), null);

const yahoo = fs.readFileSync(new URL('../lib/market/yahoo.js', import.meta.url), 'utf8');
assert.match(yahoo, /regularMarketVolume: Number\(data\.summary\?\.totalVolume/);
console.log('FII liquidity fallback uses Yahoo day volume when fundamentals are missing: OK');
