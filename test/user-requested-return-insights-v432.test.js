import assert from 'node:assert/strict';
import { buildReturnAnalytics, buildReturnExposureCycles } from '../lib/portfolio/return-insights.js';

const rows = [];
let portfolioFactor = 1;
let cdiFactor = 1;
function add(month, cycle, monthly, cdiMonthly, { segmentStart = false, currentMonthPartial = false } = {}) {
  portfolioFactor *= 1 + monthly / 100;
  cdiFactor *= 1 + cdiMonthly / 100;
  rows.push({
    month,
    label: month,
    monthlyReturnPercent: monthly,
    portfolioReturnPercent: (portfolioFactor - 1) * 100,
    cdiReturnPercent: (cdiFactor - 1) * 100,
    exposureCycleId: cycle,
    chartSegmentId: cycle,
    segmentStart,
    currentMonthPartial,
    partialExposureMonth: false
  });
}

add('2024-10', 1, 2, 0.7, { segmentStart: true });
add('2024-11', 1, -1, 0.6);
add('2024-12', 1, 1.5, 0.8);
// Carteira liquidada no intervalo; a reentrada inicia outro ciclo e o benchmark não deve acumular no gap.
for (let month = 1; month <= 12; month += 1) add(`2025-${String(month).padStart(2, '0')}`, 2, 1, 0.5, { segmentStart: month === 1 });
add('2026-01', 2, -8, 0.6);
add('2026-02', 2, 4, 0.5);
add('2026-03', 2, 5, 0.5);

const analytics = buildReturnAnalytics(rows);
assert.equal(analytics.annualReturns.find(row => row.year === 2025)?.monthsInvested, 12);
assert.equal(analytics.annualReturns.find(row => row.year === 2025)?.fullCalendarYear, true);
assert.ok(analytics.rolling12Series.length >= 1, 'deve produzir 12M móvel somente após 12 fechamentos contínuos');
assert.ok(analytics.rolling12Series.every((point, index, all) => {
  if (index === 0) return true;
  return Number(point.exposureCycleId) === Number(all[index - 1].exposureCycleId);
}), '12M móvel não pode ligar ciclos diferentes');
const cdi = analytics.benchmarkStats.find(row => row.code === 'CDI');
assert.ok(cdi && cdi.comparableMonths > 0);
assert.ok(Number.isFinite(cdi.winRatePercent));
assert.ok(analytics.drawdown && analytics.drawdown.drawdownPercent < 0);
assert.equal(analytics.drawdown.troughMonth, '2026-01');

const cycles = buildReturnExposureCycles(rows);
assert.equal(cycles.length, 2);
assert.equal(cycles.at(-1).label, 'Ciclo atual');
assert.equal(cycles[0].label, 'Ciclo anterior');
assert.equal(cycles[1].series[0].segmentStart, true);
assert.ok(Math.abs(cycles[1].series[0].portfolioReturnPercent - 1) < 0.001, 'ciclo deve recomeçar a carteira na própria base');
assert.ok(Math.abs(cycles[1].series[0].cdiReturnPercent - 0.5) < 0.001, 'benchmark também deve ser rebaseado no ciclo');
assert.equal(cycles[1].analytics.rolling12Series.length >= 1, true);

console.log('PASS user-requested-return-insights-v432');
