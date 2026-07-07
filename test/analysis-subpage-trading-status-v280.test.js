import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const quotesSource = fs.readFileSync(path.join(root, 'lib/sources/quotes.js'), 'utf8');

for (const marker of [
  'const quoteStatus = quote?.status',
  'const hasLiveTradingQuote = price > 0',
  "const listingStatus = hasLiveTradingQuote ? 'TRADING'",
  'isTradable: hasLiveTradingQuote',
  'tradable: hasLiveTradingQuote',
  'activeTrading: hasLiveTradingQuote',
  'partial: !hasLiveTradingQuote',
]) {
  assert.ok(quotesSource.includes(marker), `quotes contract missing ${marker}`);
}

console.log('analysis-subpage-trading-status-v280 contract markers ok');
