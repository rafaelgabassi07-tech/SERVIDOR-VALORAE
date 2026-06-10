process.env.VALORAE_DISABLE_EXTERNAL = '1';
import assert from 'node:assert/strict';
import { buildAssetsPayload, buildMarketMovers } from '../lib/sources/quotes.js';
import { getNews } from '../lib/sources/news.js';
import { getIpcaSeries } from '../lib/sources/ipca.js';

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
assert.ok(['OK','FALLBACK'].includes(ipca.status));
assert.equal(ipca.points.length, 6);
assert.ok(typeof ipca.points.at(-1).accumulatedPercent === 'number');
