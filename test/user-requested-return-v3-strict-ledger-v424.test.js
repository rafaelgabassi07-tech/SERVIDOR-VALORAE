import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExposureOnlyReturnSeriesV5,
  selectExposureReturnWindowV5,
  summarizeExposureReturnV5
} from '../lib/portfolio/return-engine-v5.js';

const complete = (month, marketValue, extra = {}) => ({
  month,
  marketValue,
  valuationCoveragePercent: 100,
  partialValuation: false,
  ...extra
});

test('Return v5 usa apenas valor de mercado + fluxos e não confunde aporte com performance', () => {
  const result = buildExposureOnlyReturnSeriesV5([
    complete('2026-01', 1050, { monthlyContributions: 1000, weightedNetCashFlow: 1000 }),
    complete('2026-02', 1100),
    complete('2026-03', 1200, { monthlyContributions: 100, weightedNetCashFlow: 50 })
  ]);

  assert.deepEqual(result.rows.map(row => row.month), ['2026-01', '2026-02', '2026-03']);
  assert.equal(result.rows[0].monthlyReturnPercent, 5);
  assert.equal(result.rows[1].monthlyReturnPercent, 4.7619);
  assert.equal(result.rows[2].monthlyReturnPercent, 0, 'aporte de R$ 100 explica integralmente a alta do patrimônio');
  assert.equal(result.diagnostics.engine, 'VALORAE_RETURN_V5_EXPOSURE_ONLY');
});

test('valuation parcial interrompe a cadeia e nunca vira denominador do mês seguinte', () => {
  const result = buildExposureOnlyReturnSeriesV5([
    complete('2026-01', 1000, { monthlyContributions: 1000, weightedNetCashFlow: 1000 }),
    complete('2026-02', 1100),
    complete('2026-03', 900, { partialValuation: true, valuationCoveragePercent: 72 }),
    complete('2026-04', 1200),
    complete('2026-05', 1260)
  ]);

  assert.deepEqual(result.rows.map(row => row.month), ['2026-01', '2026-02', '2026-05']);
  assert.deepEqual(result.diagnostics.droppedMonths, ['2026-03']);
  assert.ok(result.diagnostics.baselineMonths.includes('2026-04'));
  assert.equal(result.rows.at(-1).calculationChainId, 1);
  assert.equal(result.rows.at(-1).monthlyReturnPercent, 5);
});

test('mês sem valuation entre dois fechamentos faz o fechamento seguinte virar baseline', () => {
  const result = buildExposureOnlyReturnSeriesV5([
    complete('2026-01', 1000, { monthlyContributions: 1000, weightedNetCashFlow: 1000 }),
    complete('2026-02', 1050),
    complete('2026-04', 1200),
    complete('2026-05', 1260)
  ], { skippedMonths: ['2026-03'] });

  assert.deepEqual(result.rows.map(row => row.month), ['2026-01', '2026-02', '2026-05']);
  assert.ok(result.diagnostics.droppedMonths.includes('2026-04'));
  assert.ok(result.diagnostics.baselineMonths.includes('2026-04'));
  assert.equal(result.rows.at(-1).monthlyReturnPercent, 5);
});

test('liquidação total e nova entrada usam os fluxos reais sem retorno sobre custo', () => {
  const result = buildExposureOnlyReturnSeriesV5([
    complete('2026-01', 1000, { monthlyContributions: 1000, weightedNetCashFlow: 1000 }),
    complete('2026-02', 0, { monthlyWithdrawals: 1100, weightedNetCashFlow: -100 }),
    complete('2026-03', 1020, { monthlyContributions: 1000, weightedNetCashFlow: 1000 }),
    complete('2026-04', 1071)
  ]);

  assert.equal(result.rows[1].monthlyReturnPercent, 11.1111);
  assert.equal(result.rows[2].monthlyReturnPercent, 2);
  assert.equal(result.rows[3].monthlyReturnPercent, 5);
  assert.ok(result.rows.every(row => row.returnCalculationStatus === 'VALORAE_V5_EXPOSURE_ONLY_DIETZ'));
});

test('seleção de período usa somente a cadeia de cálculo confiável mais recente e preserva retorno mensal explícito', () => {
  const built = buildExposureOnlyReturnSeriesV5([
    complete('2026-01', 1000, { monthlyContributions: 1000, weightedNetCashFlow: 1000 }),
    complete('2026-02', 1100),
    complete('2026-03', 900, { partialValuation: true, valuationCoveragePercent: 80 }),
    complete('2026-04', 1200),
    complete('2026-05', 1260),
    complete('2026-06', 1323)
  ]);
  const selected = selectExposureReturnWindowV5(built.rows, 'SINCE_START', 120, new Date('2026-06-20T00:00:00Z'));

  assert.deepEqual(selected.rows.map(row => row.month), ['2026-05', '2026-06']);
  assert.deepEqual(selected.rows.map(row => row.monthlyReturnPercent), [5, 5]);
  assert.equal(selected.rows[0].portfolioReturnPercent, 5);
  assert.equal(selected.rows[1].portfolioReturnPercent, 10.25);
  assert.equal(selected.comparisonBaseMonth, '');
  assert.equal(selected.comparisonStartMonth, '2026-05');
});

test('resumo usa apenas meses comparáveis da série selecionada', () => {
  const summary = summarizeExposureReturnV5([
    { month: '2026-01', monthlyReturnPercent: 10, portfolioReturnPercent: 10 },
    { month: '2026-02', monthlyReturnPercent: -5, portfolioReturnPercent: 4.5 }
  ]);
  assert.equal(summary.totalReturnPercent, 4.5);
  assert.equal(summary.last12MonthsReturnPercent, 4.5);
  assert.equal(summary.lastMonthReturnPercent, -5);
  assert.equal(summary.bestMonth.month, '2026-01');
  assert.equal(summary.worstMonth.month, '2026-02');
});

test('mês corrente participa da prévia, mas não contamina estatísticas de meses fechados', () => {
  const summary = summarizeExposureReturnV5([
    { month: '2026-06', monthlyReturnPercent: 5, portfolioReturnPercent: 5, currentMonthPartial: false },
    { month: '2026-07', monthlyReturnPercent: -2, portfolioReturnPercent: 2.9, currentMonthPartial: false },
    { month: '2026-08', monthlyReturnPercent: 50, portfolioReturnPercent: 54.35, currentMonthPartial: true }
  ]);
  assert.equal(summary.totalReturnPercent, 54.35, 'retorno no período continua mostrando a prévia atual');
  assert.equal(summary.lastMonthReturnPercent, 50, 'mês atual continua visível como prévia');
  assert.equal(summary.bestMonth.month, '2026-06', 'prévia não pode virar melhor mês antes do fechamento');
  assert.equal(summary.worstMonth.month, '2026-07');
  assert.equal(summary.averageMonthlyReturnPercent, 1.5);
  assert.equal(summary.volatilityMonthlyPercent, 3.5);
});

