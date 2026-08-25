import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildExposureOnlyReturnSeriesV5, selectExposureReturnWindowV5 } from '../lib/portfolio/return-engine-v5.js';
import { benchmarkExposureAlignedMonthMap } from '../lib/portfolio/return-metrics.js';
import { FII_MODAL_RECOVERABLE_SECTIONS } from '../lib/analysis/asset-modal-sections.js';
import { _test as modalRuntime } from '../lib/analysis/asset-modal-runtime.js';

const point = (month, marketValue, extra = {}) => ({
  month,
  marketValue,
  valuationCoveragePercent: 100,
  positions: marketValue > 0 ? [{ ticker: 'TEST3', quantity: 1, marketValue }] : [],
  monthlyContributions: 0,
  monthlyWithdrawals: 0,
  weightedNetCashFlow: 0,
  dividendsInMonth: 0,
  ...extra
});

test('retorno acumulado reinicia depois de liquidação e reentrada', () => {
  const built = buildExposureOnlyReturnSeriesV5([
    point('2026-01', 100, { monthlyContributions: 100, weightedNetCashFlow: 95 }),
    point('2026-02', 110),
    point('2026-03', 0, { positions: [] }),
    point('2026-05', 200, { monthlyContributions: 200, weightedNetCashFlow: 190 }),
    point('2026-06', 220)
  ]).rows;
  assert.equal(new Set(built.map(row => row.exposureCycleId)).size, 2);
  const reentry = built.find(row => row.month === '2026-05');
  assert.ok(reentry);
  assert.ok(Math.abs(reentry.portfolioReturnPercent) < 20, `reentry carried prior cycle: ${reentry.portfolioReturnPercent}`);
  const window = selectExposureReturnWindowV5(built, 'SINCE_START', 12).rows;
  const firstSecondCycle = window.find(row => row.exposureCycleId === 2);
  assert.ok(firstSecondCycle);
  assert.ok(Math.abs(firstSecondCycle.portfolioReturnPercent - firstSecondCycle.monthlyReturnPercent) < 0.0001);
});

test('benchmark acumulado reinicia no novo segmento', () => {
  const benchmark = [
    { month: '2026-01', accumulatedPercent: 0 },
    { month: '2026-02', accumulatedPercent: 10 },
    { month: '2026-03', accumulatedPercent: 21 },
    { month: '2026-04', accumulatedPercent: 33.1 },
    { month: '2026-05', accumulatedPercent: 46.41 },
    { month: '2026-06', accumulatedPercent: 61.051 }
  ];
  const portfolio = [
    { month: '2026-02', chartSegmentId: 1, exposureCycleId: 1, segmentStart: true },
    { month: '2026-03', chartSegmentId: 1, exposureCycleId: 1 },
    { month: '2026-05', chartSegmentId: 2, exposureCycleId: 2, segmentStart: true, partialExposureMonth: true },
    { month: '2026-06', chartSegmentId: 2, exposureCycleId: 2 }
  ];
  const values = benchmarkExposureAlignedMonthMap(benchmark, 'accumulatedPercent', portfolio, '');
  assert.ok(Math.abs(values.get('2026-06') - 10) < 0.0001, JSON.stringify([...values]));
});

test('FII não publica vacancyHistory e checklist materializado fica pronto', () => {
  assert.equal(FII_MODAL_RECOVERABLE_SECTIONS.includes('vacancyHistory'), false);
  const sections = new Map(modalRuntime.fiiModalSections({ checklist: { items: [{ label: 'P/VP', status: 'UNKNOWN' }] } }));
  assert.equal(sections.get('checklist'), true);
  assert.equal(sections.has('vacancyHistory'), false);
});

test('série pública transporta fluxos externos necessários ao equivalente monetário', () => {
  const source = fs.readFileSync(new URL('../lib/portfolio/analysis.js', import.meta.url), 'utf8');
  assert.match(source, /monthlyContributions:/);
  assert.match(source, /monthlyWithdrawals:/);
  assert.match(source, /weightedNetCashFlow:/);
});
