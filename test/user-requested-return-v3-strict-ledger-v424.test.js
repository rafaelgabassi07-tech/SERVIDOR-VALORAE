import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStrictPortfolioReturnSeries,
  selectPortfolioReturnWindowV3,
  summarizePortfolioReturnV3
} from '../lib/portfolio/return-engine-v3.js';

const complete = (month, marketValue, extra = {}) => ({
  month,
  marketValue,
  valuationCoveragePercent: 100,
  partialValuation: false,
  ...extra
});

test('Return v3 usa apenas valor de mercado + fluxos e não confunde aporte com performance', () => {
  const result = buildStrictPortfolioReturnSeries([
    complete('2026-01', 1050, { monthlyContributions: 1000, weightedNetCashFlow: 1000 }),
    complete('2026-02', 1100),
    complete('2026-03', 1200, { monthlyContributions: 100, weightedNetCashFlow: 50 })
  ]);

  assert.deepEqual(result.rows.map(row => row.month), ['2026-01', '2026-02', '2026-03']);
  assert.equal(result.rows[0].monthlyReturnPercent, 5);
  assert.equal(result.rows[1].monthlyReturnPercent, 4.7619);
  assert.equal(result.rows[2].monthlyReturnPercent, 0, 'aporte de R$ 100 explica integralmente a alta do patrimônio');
  assert.equal(result.diagnostics.engine, 'VALORAE_RETURN_V3_STRICT_LEDGER');
});

test('valuation parcial interrompe a cadeia e nunca vira denominador do mês seguinte', () => {
  const result = buildStrictPortfolioReturnSeries([
    complete('2026-01', 1000, { monthlyContributions: 1000, weightedNetCashFlow: 1000 }),
    complete('2026-02', 1100),
    complete('2026-03', 900, { partialValuation: true, valuationCoveragePercent: 72 }),
    complete('2026-04', 1200),
    complete('2026-05', 1260)
  ]);

  assert.deepEqual(result.rows.map(row => row.month), ['2026-01', '2026-02', '2026-05']);
  assert.deepEqual(result.diagnostics.droppedMonths, ['2026-03']);
  assert.ok(result.diagnostics.baselineMonths.includes('2026-04'));
  assert.equal(result.rows.at(-1).returnChainId, 1);
  assert.equal(result.rows.at(-1).monthlyReturnPercent, 5);
});

test('mês sem valuation entre dois fechamentos faz o fechamento seguinte virar baseline', () => {
  const result = buildStrictPortfolioReturnSeries([
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
  const result = buildStrictPortfolioReturnSeries([
    complete('2026-01', 1000, { monthlyContributions: 1000, weightedNetCashFlow: 1000 }),
    complete('2026-02', 0, { monthlyWithdrawals: 1100, weightedNetCashFlow: -100 }),
    complete('2026-03', 1020, { monthlyContributions: 1000, weightedNetCashFlow: 1000 }),
    complete('2026-04', 1071)
  ]);

  assert.equal(result.rows[1].monthlyReturnPercent, 11.1111);
  assert.equal(result.rows[2].monthlyReturnPercent, 2);
  assert.equal(result.rows[3].monthlyReturnPercent, 5);
  assert.ok(result.rows.every(row => row.returnCalculationStatus === 'VALORAE_V3_MODIFIED_DIETZ'));
});

test('seleção de período usa somente a cadeia contínua mais recente e preserva retorno mensal explícito', () => {
  const built = buildStrictPortfolioReturnSeries([
    complete('2026-01', 1000, { monthlyContributions: 1000, weightedNetCashFlow: 1000 }),
    complete('2026-02', 1100),
    complete('2026-03', 900, { partialValuation: true, valuationCoveragePercent: 80 }),
    complete('2026-04', 1200),
    complete('2026-05', 1260),
    complete('2026-06', 1323)
  ]);
  const selected = selectPortfolioReturnWindowV3(built.rows, 'SINCE_START', 120, new Date('2026-06-20T00:00:00Z'));

  assert.deepEqual(selected.rows.map(row => row.month), ['2026-05', '2026-06']);
  assert.deepEqual(selected.rows.map(row => row.monthlyReturnPercent), [5, 5]);
  assert.equal(selected.rows[0].portfolioReturnPercent, 5);
  assert.equal(selected.rows[1].portfolioReturnPercent, 10.25);
  assert.equal(selected.comparisonBaseMonth, '');
  assert.equal(selected.comparisonStartMonth, '2026-05');
});

test('resumo usa apenas meses comparáveis da série selecionada', () => {
  const summary = summarizePortfolioReturnV3([
    { month: '2026-01', monthlyReturnPercent: 10, portfolioReturnPercent: 10 },
    { month: '2026-02', monthlyReturnPercent: -5, portfolioReturnPercent: 4.5 }
  ]);
  assert.equal(summary.totalReturnPercent, 4.5);
  assert.equal(summary.last12MonthsReturnPercent, 4.5);
  assert.equal(summary.lastMonthReturnPercent, -5);
  assert.equal(summary.bestMonth.month, '2026-01');
  assert.equal(summary.worstMonth.month, '2026-02');
});
