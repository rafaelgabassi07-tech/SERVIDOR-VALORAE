import assert from 'node:assert/strict';
import { _runtimeCacheTest as quoteCache } from '../lib/sources/quotes.js';
import { _runtimeCacheTest as rankingCache } from '../lib/market/rankings-i10.js';

quoteCache.reset();
for (let i = 0; i < 900; i += 1) {
  const ticker = `T${String(i).padStart(4, '0')}`;
  quoteCache.rememberLiveQuote(ticker, { ticker, price: 10 + i });
}
let stats = quoteCache.stats();
assert.ok(stats.liveEntries <= stats.liveMaxEntries, `live quote cache excedeu limite: ${JSON.stringify(stats)}`);
assert.equal(stats.liveEntries, stats.liveMaxEntries, 'cache de cotação deve estabilizar no teto configurado');

for (let i = 0; i < 900; i += 1) {
  const clean = `B${String(i).padStart(4, '0')}`;
  quoteCache.applyQuoteBackoff(clean, `${clean}.SA`);
}
stats = quoteCache.stats();
assert.ok(stats.backoffEntries <= stats.backoffMaxEntries, `backoff cache excedeu limite: ${JSON.stringify(stats)}`);
assert.equal(stats.backoffEntries, stats.backoffMaxEntries, 'cache de backoff deve estabilizar no teto configurado');

rankingCache.reset();
for (let i = 0; i < 120; i += 1) {
  rankingCache.rememberRankingSnapshot(`variant-${i}`, {
    data: { status: 'OK', rankings: { altas: [], baixas: [] } },
    expiresAt: Date.now() + 60_000,
    staleUntil: Date.now() + 120_000,
  });
}
const rankingStats = rankingCache.stats();
assert.ok(rankingStats.entries <= rankingStats.maxEntries, `ranking cache excedeu limite: ${JSON.stringify(rankingStats)}`);
assert.equal(rankingStats.entries, rankingStats.maxEntries, 'cache de rankings deve estabilizar no teto configurado');

quoteCache.reset();
rankingCache.reset();
console.log(`runtime-memory-bounds-v424 ok: quotes=${stats.liveEntries}/${stats.liveMaxEntries}, backoff=${stats.backoffEntries}/${stats.backoffMaxEntries}, rankings=${rankingStats.entries}/${rankingStats.maxEntries}`);
