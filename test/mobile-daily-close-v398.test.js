import assert from 'node:assert/strict';
import fs from 'node:fs';
import { routeManifest, _test } from '../routes/_router.js';

assert.ok(routeManifest().routes.includes('/mobile/daily-close'));
assert.deepEqual(_test.routeMethods('/mobile/daily-close'), ['POST']);
const empty = await _test.buildDailyClose({ positions: [] });
assert.equal(empty.status, 'EMPTY');
assert.equal(empty.contractVersion, 'valorae-mobile-daily-close-v1');
assert.deepEqual(empty.quotes, []);
assert.deepEqual(empty.history, []);
assert.match(empty.tradingDate, /^\d{4}-\d{2}-\d{2}$/);
assert.match(empty.idempotencyKey, /^daily-close:\d{4}-\d{2}-\d{2}:[a-f0-9]{24}$/);
assert.ok(Number.isFinite(empty.timings.totalMs));

const identityA = _test.dailyClosePortfolioIdentity([
  { ticker: 'PETR4', quantity: 10, averagePrice: 25, currentPrice: 30 },
], '2026-07-30');
const identityB = _test.dailyClosePortfolioIdentity([
  { ticker: 'PETR4', quantity: 10, averagePrice: 25, currentPrice: 99 },
], '2026-07-30');
assert.equal(identityA.cacheKey, identityB.cacheKey, 'cotação transitória do APK não pode quebrar idempotência diária');
assert.equal(identityA.idempotencyKey, identityB.idempotencyKey);
assert.notEqual(
  identityA.idempotencyKey,
  _test.dailyClosePortfolioIdentity([{ ticker: 'PETR4', quantity: 11, averagePrice: 25 }], '2026-07-30').idempotencyKey,
  'mudança real de posição deve gerar nova identidade'
);

const contributions = _test.dailyCloseContributionRows([
  { ticker: 'PETR4', quantity: 10, currentPrice: 30 },
  { ticker: 'WEGE3', quantity: 5, currentPrice: 40 },
], new Map([
  ['PETR4', { price: 31, variationPercent: 3.333333, source: 'test' }],
  ['WEGE3', { price: 39, variationPercent: -2.5, source: 'test' }],
]));
assert.equal(contributions.length, 2);
assert.ok(contributions.every(row => Number.isFinite(row.contributionValue)));
assert.ok(contributions.some(row => row.contributionValue > 0));
assert.ok(contributions.some(row => row.contributionValue < 0));
const source=fs.readFileSync(new URL('../routes/_router.js', import.meta.url),'utf8');
const body=source.slice(source.indexOf('async function buildDailyClose('), source.indexOf('function comparisonPointsFromHistory'));
assert.match(body, /buildMobileAlertsCached/);
assert.match(body, /buildPortfolioHistory/);
assert.match(body, /range:\s*'1D'/);
assert.match(body, /interval:\s*'5m'/);
assert.match(body, /liveAlignment:\s*true/);
assert.match(body, /dailyClosePortfolioIdentity/);
assert.match(body, /idempotencyKey/);
assert.match(body, /quotesMs/);
assert.match(body, /historyMs/);
console.log('mobile daily close v398 OK');
