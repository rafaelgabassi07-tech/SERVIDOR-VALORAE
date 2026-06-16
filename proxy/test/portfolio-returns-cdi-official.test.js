import assert from 'node:assert/strict';
import { monthlyCdiFromDailyRows, monthlyCdiFromMonthlyRows } from '../lib/sources/cdi.js';
import { buildPortfolioReturns } from '../lib/portfolio/analysis.js';

const dailyPoints = monthlyCdiFromDailyRows([
  { data: '02/01/2026', valor: '0,040000' },
  { data: '03/01/2026', valor: '0,040000' },
  { data: '02/02/2026', valor: '0,050000' },
  { data: '03/02/2026', valor: '0,050000' }
], 2);
assert.equal(dailyPoints.length, 2);
assert.equal(dailyPoints[0].month, '2026-01');
assert.ok(dailyPoints[1].accumulatedPercent > dailyPoints[0].accumulatedPercent);

const monthlyPoints = monthlyCdiFromMonthlyRows([
  { data: '01/01/2026', valor: '0,90' },
  { data: '01/02/2026', valor: '1,00' }
], 2);
assert.equal(monthlyPoints.length, 2);
assert.equal(monthlyPoints[1].month, '2026-02');
assert.ok(monthlyPoints[1].accumulatedPercent > monthlyPoints[0].accumulatedPercent);

process.env.VALORAE_DISABLE_EXTERNAL = '1';
const contract = await buildPortfolioReturns({
  range: '12M',
  assetFilter: 'ALL',
  benchmarks: ['CDI'],
  portfolioHistory: [
    { date: '2026-01-01', totalValue: 1000, investedValue: 1000, returnPercent: 0, source: 'broker-real-history' },
    { date: '2026-02-01', totalValue: 1100, investedValue: 1000, returnPercent: 10, source: 'broker-real-history' }
  ]
});
const cdi = contract.benchmarks.find(item => item.ticker === 'CDI');
assert.ok(cdi, 'CDI benchmark should exist');
assert.match(cdi.source || '', /BancoCentralSGS/);
assert.ok(!/Yahoo|ETF|proxy|simulad/i.test(cdi.source || ''), 'CDI must not use proxy/ticker simulation');
assert.ok(contract.diagnostics.warnings.some(w => /CDI oficial|CDI/i.test(w)), 'must warn when official CDI is unavailable');
console.log('Portfolio returns CDI official source test OK.');
