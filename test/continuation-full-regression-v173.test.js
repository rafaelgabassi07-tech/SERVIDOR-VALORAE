import assert from 'node:assert/strict';
import { canonicalizeTicker } from '../lib/Valorae-engine.js';
import { normalizeTicker } from '../lib/core/tickers.js';
import { canonicalTicker as yahooCanonicalTicker } from '../lib/market/yahoo.js';
import { buildAssetHistory, buildRankings } from '../lib/portfolio/analysis.js';

const dirtyTickerCases = [
  ['BVMF:KLBN4F.SA', 'KLBN4'],
  ['B3:PETR4F.SA', 'PETR4'],
  ['BMFBOVESPA:VALE3-SA', 'VALE3'],
  ['KLBN4SA', 'KLBN4'],
  ['BVMF:MXRF11F', 'MXRF11']
];

for (const [input, expected] of dirtyTickerCases) {
  assert.equal(normalizeTicker(input), expected, `normalizeTicker(${input})`);
  assert.equal(canonicalizeTicker(input), expected, `canonicalizeTicker(${input})`);
  assert.equal(yahooCanonicalTicker(input), expected, `yahoo canonicalTicker(${input})`);
}

const rankings = buildRankings({
  rankings: [
    { ticker: 'BVMF:KLBN4F.SA', score: 10, rank: 1 },
    { symbol: 'B3:PETR4F.SA', score: 9, rank: 2 }
  ]
});
assert.equal(rankings.items[0].ticker, 'KLBN4');
assert.equal(rankings.items[1].ticker, 'PETR4');

const history = buildAssetHistory({
  ticker: 'BMFBOVESPA:VALE3-SA',
  points: [
    { date: '2026-07-01', close: 60, source: 'Yahoo Finance Chart API' }
  ]
});
assert.equal(history.ticker, 'VALE3');
assert.equal(history.status, 'OK');

console.log('Continuation full regression v173 test OK.');
