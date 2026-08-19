import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExactPortfolioReturnSeriesV4,
  selectPortfolioReturnWindowV4,
  summarizePortfolioReturnV4
} from '../lib/portfolio/return-engine-v4.js';

const complete = (month, marketValue, extra = {}) => ({
  month,
  marketValue,
  valuationCoveragePercent: 100,
  partialValuation: false,
  ...extra
});

test('liquidação total, inatividade conhecida e reentrada preservam toda a trajetória', () => {
  const result = buildExactPortfolioReturnSeriesV4([
    complete('2026-01', 1100, { monthlyContributions: 1000, weightedNetCashFlow: 1000, components: [{ ticker: 'OLD3' }] }),
    complete('2026-02', 0, { monthlyWithdrawals: 1150, weightedNetCashFlow: -50, components: [] }),
    complete('2026-03', 0, { knownInactive: true, components: [] }),
    complete('2026-04', 1020, { monthlyContributions: 1000, weightedNetCashFlow: 1000, components: [{ ticker: 'NEW3' }] }),
    complete('2026-05', 1071, { components: [{ ticker: 'NEW3' }] })
  ]);

  assert.deepEqual(result.rows.map(row => row.month), ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']);
  assert.equal(result.rows[2].knownInactive, true);
  assert.equal(result.rows[2].monthlyReturnPercent, 0, 'mês sem capital não cria retorno');
  assert.equal(result.rows[2].returnCalculationStatus, 'VALORAE_V4_KNOWN_INACTIVE');
  assert.ok(result.rows.slice(1).every(row => !(row.components || []).some(item => item.ticker === 'OLD3')), 'ativo vendido não pode reaparecer no valuation após a liquidação');

  const selected = selectPortfolioReturnWindowV4(result.rows, 'SINCE_START', 120, new Date('2026-05-20T00:00:00Z'));
  assert.deepEqual(selected.rows.map(row => row.month), ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']);
  assert.equal(selected.rows.at(-1).portfolioReturnPercent > 0, true, 'histórico anterior à reentrada não pode ser descartado');
});

test('mês sem capital não contamina média, volatilidade, melhor ou pior mês', () => {
  const summary = summarizePortfolioReturnV4([
    { month: '2026-01', monthlyReturnPercent: 10, portfolioReturnPercent: 10 },
    { month: '2026-02', monthlyReturnPercent: -2, portfolioReturnPercent: 7.8 },
    { month: '2026-03', monthlyReturnPercent: 0, portfolioReturnPercent: 7.8, knownInactive: true },
    { month: '2026-04', monthlyReturnPercent: 4, portfolioReturnPercent: 12.112 }
  ]);

  assert.equal(summary.bestMonth.month, '2026-01');
  assert.equal(summary.worstMonth.month, '2026-02');
  assert.equal(summary.averageMonthlyReturnPercent, 4);
});
