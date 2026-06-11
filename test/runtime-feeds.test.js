process.env.VALORAE_DISABLE_EXTERNAL = '1';
import assert from 'node:assert/strict';
import { buildAssetsPayload, buildMarketMovers } from '../lib/sources/quotes.js';
import { getNews } from '../lib/sources/news.js';
import { getIpcaSeries } from '../lib/sources/ipca.js';
import { buildMobilePortfolioSync } from '../lib/contracts/mobile.js';

const assets = await buildAssetsPayload({ tickers: 'PETR4,VALE3', timeoutMs: 10 });
assert.equal(assets.endpoint, 'assets');
assert.equal(assets.assets.length, 2);
assert.equal(assets.assets[0].ticker, 'PETR4');
assert.ok('currentPrice' in assets.assets[0]);

const rankings = await buildMarketMovers({ timeoutMs: 10, limit: 3 });
assert.ok(['OK','FALLBACK'].includes(rankings.status));
assert.ok(rankings.highs.length >= 3);
assert.ok(rankings.lows.length >= 3);

const news = await getNews({ timeoutMs: 10, limit: 2 });
assert.ok(['OK','FALLBACK'].includes(news.status));
assert.ok(news.items.length >= 1);
assert.ok(news.items[0].title);

const ipca = await getIpcaSeries(6);
assert.ok(['OK','EMPTY'].includes(ipca.status));
assert.ok(Array.isArray(ipca.points));
if (ipca.points.length) assert.ok(typeof ipca.points.at(-1).accumulatedPercent === 'number');


const mobile = await buildMobilePortfolioSync({
  positions: [{ ticker: 'PETR4', quantity: 10, avgPrice: 30, currentPrice: 32, firstPurchaseAt: Date.now() - 365 * 86400000 }],
  includeHistory: true,
  includeIpca: true,
  includeAnalysis: true,
  includeDividends: false,
  includeRankings: false,
  months: 6
});
assert.equal(mobile.endpoint, 'mobile-portfolio-sync');
assert.ok(Array.isArray(mobile.portfolioHistory));
assert.ok(Array.isArray(mobile.portfolioHistory));
assert.ok(Array.isArray(mobile.ipcaSeries));
assert.ok(Array.isArray(mobile.ipcaSeries));
