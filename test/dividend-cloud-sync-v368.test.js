import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync(new URL('../routes/sync.js', import.meta.url), 'utf8');

assert.match(route, /upsert_dividend_events/);
assert.match(route, /valorae_sync_upsert_dividends/);
assert.match(route, /return Boolean\(ticker\) && Boolean\(dateCom \|\| inferredComDate \|\| exDate \|\| paymentDate\)/);
assert.doesNotMatch(route, /Boolean\(dateCom \|\| inferredComDate \|\| exDate \|\| paymentDate\) && \(Number\.isFinite\(value\)/);
assert.match(route, /ignoredLocalProjections: localProjectionCount/);
assert.match(route, /ignoredInvalid: invalidCount/);
assert.match(route, /Number\.isFinite\(numericValuePerShare\)/);
assert.match(route, /isLocalDividendProjection/);

console.log('Dividend cloud sync v368 contract OK.');
