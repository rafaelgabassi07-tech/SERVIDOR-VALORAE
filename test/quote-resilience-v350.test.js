import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildAssetsPayload, normalizeYahooAdapterQuote } from '../lib/sources/quotes.js';

const normalized = normalizeYahooAdapterQuote('PETR4', {
  ok: true,
  price: 40.59,
  previousClose: 39.89,
  variationPct: 1.7548,
  time: '2026-07-17T15:00:00.000Z',
  cache: 'MISS',
  source: 'YahooChart'
});

assert.equal(normalized.price, 40.59);
assert.equal(normalized.currentPrice, 40.59);
assert.equal(normalized.previousClose, 39.89);
assert.equal(normalized.dayChangePercent, 1.7548);
assert.equal(normalized.variationPercent, 1.7548);
assert.equal(normalized.quoteQuality, 'LIVE_PRICE_AND_PREVIOUS_CLOSE');

const contract = JSON.parse(fs.readFileSync(new URL('../contracts/checkpoint120/quote-state-resilience.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(contract.version, '2026.07.17-checkpoint120-v1');
assert.equal(contract.invariants.existingResponseFieldsPreserved, true);
assert.equal(pkg.valorae.releasePatch, '21.12.394-runtime-safety-v362');

const fastEmpty = await buildAssetsPayload({ tickers: [], includeFundamentals: false });
assert.equal(fastEmpty.fundamentalsSnapshot.status, 'SKIPPED');
assert.equal(fastEmpty.quotePolicy.includeFundamentals, false);
assert.equal(fastEmpty.quotePolicy.mode, 'fast-quote-only');

const quotesSource = fs.readFileSync(new URL('../lib/sources/quotes.js', import.meta.url), 'utf8');
const routerSource = fs.readFileSync(new URL('../routes/_router.js', import.meta.url), 'utf8');
assert.match(quotesSource, /fetchYahooQuote\(clean, \{ timeoutMs: hostTimeoutMs, interval, bypassCache, cache \}\)/);
assert.match(quotesSource, /Math\.min\(8, Number\(process\.env\.VALORAE_QUOTE_CONCURRENCY \|\| 6\)\)/);
assert.match(quotesSource, /includeFundamentals \? 'safe-batch-cache-with-fundamentals' : 'fast-quote-only'/);
assert.match(routerSource, /bypassQuoteCache[\s\S]*bypassCache: bypassQuoteCache/);

console.log('quote-resilience-v350 ok');
