import assert from 'node:assert/strict';
import { buildPortfolioReturns } from '../lib/portfolio/analysis.js';

function months(count) {
  const rows = [];
  let value = 1000;
  for (let i = 0; i < count; i += 1) {
    const year = 2021 + Math.floor(i / 12);
    const month = String((i % 12) + 1).padStart(2, '0');
    value += 10;
    rows.push({ date: `${year}-${month}-01`, totalValue: value, investedValue: 1000, returnPercent: ((value / 1000) - 1) * 100, source: 'broker-real-history' });
  }
  return rows;
}

const basePayload = {
  assetFilter: 'ALL',
  benchmarks: ['NONE'],
  portfolioHistory: months(72)
};

const threeYears = await buildPortfolioReturns({ ...basePayload, range: '3Y' });
assert.equal(threeYears.series.length, 36);
assert.equal(threeYears.range, '3Y');

const fiveYears = await buildPortfolioReturns({ ...basePayload, range: '5Y' });
assert.equal(fiveYears.series.length, 60);
assert.equal(fiveYears.range, '5Y');

console.log('Portfolio returns year range v303 test OK.');
