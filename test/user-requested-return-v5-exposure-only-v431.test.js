import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExposureOnlyReturnSeriesV5,
  selectExposureReturnWindowV5,
  summarizeExposureReturnV5
} from '../lib/portfolio/return-engine-v5.js';
import { returnDividendPerformanceMillis, dividendsEarnedBetween } from '../lib/portfolio/return-dividends.js';
import { monthHasCapitalExposure } from '../lib/portfolio/return-calculation.js';
import { benchmarkExposureAlignedMonthMap } from '../lib/portfolio/return-metrics.js';

const complete = (month, marketValue, extra = {}) => ({
  month,
  marketValue,
  valuationCoveragePercent: 100,
  partialValuation: false,
  ...extra
});

test('meses sem ativos nunca entram na série de rentabilidade', () => {
  const built = buildExposureOnlyReturnSeriesV5([
    complete('2025-01', 0, { capitalExposed: false }),
    complete('2025-02', 0, { capitalExposed: false }),
    complete('2025-10', 0, { capitalExposed: false }),
    complete('2025-11', 1020, { monthlyContributions: 1000, weightedNetCashFlow: 900, partialExposureMonth: true, capitalExposureStartDate: '2025-11-27' }),
    complete('2025-12', 1071)
  ]);

  assert.deepEqual(built.rows.map(row => row.month), ['2025-11', '2025-12']);
  assert.deepEqual(built.diagnostics.inactiveMonths, ['2025-01', '2025-02', '2025-10']);
  assert.equal(built.rows.some(row => row.capitalExposed === false), false);
  assert.equal(built.rows[0].segmentStart, true);
  assert.equal(built.rows[0].exposureCycleId, 1);
  assert.equal(built.rows[0].chartSegmentId, 1);
});

test('YTD começa no primeiro mês realmente investido, não em janeiro', () => {
  const built = buildExposureOnlyReturnSeriesV5([
    ...Array.from({ length: 10 }, (_, index) => complete(`2025-${String(index + 1).padStart(2, '0')}`, 0, { capitalExposed: false })),
    complete('2025-11', 1020, { monthlyContributions: 1000, weightedNetCashFlow: 900, partialExposureMonth: true, capitalExposureStartDate: '2025-11-27' }),
    complete('2025-12', 1071)
  ]);
  const selected = selectExposureReturnWindowV5(built.rows, 'YTD', 12, new Date('2025-12-20T12:00:00Z'));
  assert.deepEqual(selected.rows.map(row => row.month), ['2025-11', '2025-12']);
  assert.equal(selected.comparisonStartMonth, '2025-11');
  assert.equal(selected.exposureCycleCount, 1);
});

test('liquidação total e reentrada preservam resultado histórico sem preencher a inatividade', () => {
  const built = buildExposureOnlyReturnSeriesV5([
    complete('2026-01', 1100, { monthlyContributions: 1000, weightedNetCashFlow: 1000 }),
    complete('2026-02', 0, { capitalExposed: true, monthlyWithdrawals: 1150, weightedNetCashFlow: -50 }),
    complete('2026-03', 0, { capitalExposed: false }),
    complete('2026-04', 0, { capitalExposed: false }),
    complete('2026-05', 1020, { monthlyContributions: 1000, weightedNetCashFlow: 900, partialExposureMonth: true, capitalExposureStartDate: '2026-05-20' }),
    complete('2026-06', 1071)
  ]);
  assert.deepEqual(built.rows.map(row => row.month), ['2026-01', '2026-02', '2026-05', '2026-06']);
  assert.deepEqual(built.diagnostics.inactiveMonths, ['2026-03', '2026-04']);
  assert.deepEqual([...new Set(built.rows.map(row => row.exposureCycleId))], [1, 2]);
  assert.equal(built.rows[2].segmentStart, true);
  const selected = selectExposureReturnWindowV5(built.rows, 'SINCE_START', 120, new Date('2026-06-20T12:00:00Z'));
  assert.deepEqual(selected.rows.map(row => row.month), ['2026-01', '2026-02', '2026-05', '2026-06']);
  assert.equal(selected.exposureCycleCount, 2);
});

test('gap de valuation enquanto havia exposição quebra a cadeia financeira', () => {
  const built = buildExposureOnlyReturnSeriesV5([
    complete('2026-01', 1000, { monthlyContributions: 1000, weightedNetCashFlow: 1000 }),
    complete('2026-02', 1050),
    complete('2026-04', 1200),
    complete('2026-05', 1260)
  ], { skippedMonths: ['2026-03'] });
  assert.deepEqual(built.rows.map(row => row.month), ['2026-01', '2026-02', '2026-05']);
  const selected = selectExposureReturnWindowV5(built.rows, 'SINCE_START', 120, new Date('2026-05-20T12:00:00Z'));
  assert.deepEqual(selected.rows.map(row => row.month), ['2026-05']);
});

test('mês corrente participa da prévia mas não das estatísticas fechadas', () => {
  const summary = summarizeExposureReturnV5([
    { month: '2026-06', monthlyReturnPercent: 5, portfolioReturnPercent: 5 },
    { month: '2026-07', monthlyReturnPercent: -2, portfolioReturnPercent: 2.9 },
    { month: '2026-08', monthlyReturnPercent: 50, portfolioReturnPercent: 54.35, currentMonthPartial: true }
  ]);
  assert.equal(summary.totalReturnPercent, 54.35);
  assert.equal(summary.bestMonth.month, '2026-06');
  assert.equal(summary.worstMonth.month, '2026-07');
  assert.equal(summary.averageMonthlyReturnPercent, 1.5);
});



test('exposição é definida por posições ou negociação válida, nunca por renda ou venda órfã', () => {
  assert.equal(monthHasCapitalExposure({ beginningPositionCount: 0, endingPositionCount: 0, contributions: 0, withdrawals: 0 }), false);
  assert.equal(monthHasCapitalExposure({ beginningPositionCount: 1, endingPositionCount: 0, contributions: 0, withdrawals: 1000 }), true);
  assert.equal(monthHasCapitalExposure({ beginningPositionCount: 0, endingPositionCount: 1, contributions: 1000, withdrawals: 0 }), true);
  assert.equal(monthHasCapitalExposure({ beginningPositionCount: 0, endingPositionCount: 0, contributions: 1000, withdrawals: 1000 }), true);
  assert.equal(monthHasCapitalExposure({ beginningPositionCount: 0, endingPositionCount: 0, contributions: 0, withdrawals: 1000 }), false);
});

test('provento pago depois da venda não cria exposição no mês do pagamento', () => {
  const built = buildExposureOnlyReturnSeriesV5([
    complete('2025-12', 1000, {
      capitalExposed: true,
      monthlyContributions: 1000,
      weightedNetCashFlow: 1000,
      capitalExposureStartDate: '2025-12-01'
    }),
    complete('2026-01', 0, {
      capitalExposed: true,
      monthlyWithdrawals: 1100,
      weightedNetCashFlow: -100,
      dividendsInMonth: 20,
      capitalExposureStartDate: '2026-01-01',
      capitalExposureEndDate: '2026-01-20',
      partialExposureMonth: true
    }),
    complete('2026-02', 0, { capitalExposed: false }),
    complete('2026-03', 0, {
      capitalExposed: false,
      dividendsInMonth: 35,
      dividendsPaidInMonth: 35
    }),
    complete('2026-05', 1020, {
      capitalExposed: true,
      monthlyContributions: 1000,
      weightedNetCashFlow: 900,
      capitalExposureStartDate: '2026-05-20',
      partialExposureMonth: true
    })
  ]);
  assert.deepEqual(built.rows.map(row => row.month), ['2025-12', '2026-01', '2026-05']);
  assert.deepEqual(built.diagnostics.inactiveMonths, ['2026-02', '2026-03']);
});

test('provento é atribuído à elegibilidade e não ao pagamento tardio', () => {
  const event = {
    eligibilityDate: '2026-01-20',
    paymentDate: '2026-03-15',
    amount: 20
  };
  const performanceMillis = returnDividendPerformanceMillis(event);
  assert.equal(performanceMillis, Date.parse('2026-01-20T00:00:00Z'));
  const events = [{ ...event, performanceMillis }];
  const january = dividendsEarnedBetween(events, Date.parse('2026-01-01T00:00:00Z'), Date.parse('2026-01-31T23:59:59Z'));
  const march = dividendsEarnedBetween(events, Date.parse('2026-03-01T00:00:00Z'), Date.parse('2026-03-31T23:59:59Z'));
  assert.equal(january, 20);
  assert.equal(march, 0);
});

test('benchmark omite somente o mês parcial e retoma no primeiro mês completo do ciclo', () => {
  const benchmark = [
    { month: '2025-10', accumulatedPercent: 0 },
    { month: '2025-11', accumulatedPercent: 1 },
    { month: '2025-12', accumulatedPercent: 2.01 },
    { month: '2026-01', accumulatedPercent: 3.0301 }
  ];
  const portfolio = [
    { month: '2025-11', exposureCycleId: 1, chartSegmentId: 1, segmentStart: true, partialExposureMonth: true },
    { month: '2025-12', exposureCycleId: 1, chartSegmentId: 1, segmentStart: false },
    { month: '2026-01', exposureCycleId: 1, chartSegmentId: 1, segmentStart: false }
  ];
  const map = benchmarkExposureAlignedMonthMap(benchmark, 'accumulatedPercent', portfolio, '');
  assert.equal(map.has('2025-11'), false, 'o mês de entrada parcial não pode ganhar benchmark mensal artificial');
  assert.ok(Math.abs(map.get('2025-12') - 1) < 0.0001, 'o primeiro mês completo deve comparar do fechamento do mês parcial ao fechamento seguinte');
  assert.ok(Math.abs(map.get('2026-01') - 2.01) < 0.0001, 'o benchmark deve continuar acumulando após retomar a comparação');
  assert.equal(map.size, 2, 'a falta de base exata do mês parcial não pode bloquear o restante do ciclo');
});

test('últimos 12 meses usam janela de calendário e não os últimos 12 meses investidos', () => {
  const series = [
    { month: '2024-01', monthlyReturnPercent: 10, portfolioReturnPercent: 10 },
    { month: '2024-02', monthlyReturnPercent: 10, portfolioReturnPercent: 21 },
    { month: '2025-01', monthlyReturnPercent: 5, portfolioReturnPercent: 27.05 },
    { month: '2025-12', monthlyReturnPercent: 2, portfolioReturnPercent: 29.591 }
  ];
  const summary = summarizeExposureReturnV5(series);
  // Jan/2025..Dec/2025 is the trailing calendar year. The two 2024 observations must not leak in.
  assert.equal(summary.last12MonthsReturnPercent, 7.1);
});
