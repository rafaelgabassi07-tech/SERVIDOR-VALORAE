import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectPortfolioReturnWindowV4,
  summarizePortfolioReturnV4
} from '../lib/portfolio/return-engine-v4.js';
import { benchmarkExposureAlignedMonthMap } from '../lib/portfolio/return-metrics.js';

const inactive = month => ({
  month,
  monthlyReturnPercent: 0,
  portfolioReturnPercent: 0,
  returnChainId: 0,
  knownInactive: true
});

const active = (month, monthlyReturnPercent, portfolioReturnPercent, extra = {}) => ({
  month,
  monthlyReturnPercent,
  portfolioReturnPercent,
  returnChainId: 0,
  knownInactive: false,
  ...extra
});

test('reentrada no fim de 2025 não transforma janeiro-outubro em meses de rentabilidade', () => {
  const rows = [
    inactive('2025-01'), inactive('2025-02'), inactive('2025-03'), inactive('2025-04'),
    inactive('2025-05'), inactive('2025-06'), inactive('2025-07'), inactive('2025-08'),
    inactive('2025-09'), inactive('2025-10'),
    active('2025-11', 1.5, 1.5, { partialExposureMonth: true, capitalExposureStartDate: '2025-11-27' }),
    active('2025-12', 2.0, 3.53)
  ];

  const selected = selectPortfolioReturnWindowV4(rows, 'YTD', 12, new Date('2025-12-20T12:00:00Z'));
  assert.deepEqual(selected.rows.map(row => row.month), ['2025-11', '2025-12']);
  assert.deepEqual(selected.leadingInactiveMonths, [
    '2025-01','2025-02','2025-03','2025-04','2025-05','2025-06','2025-07','2025-08','2025-09','2025-10'
  ]);
  assert.equal(selected.comparisonStartMonth, '2025-11');
  assert.equal(selected.comparisonBaseMonth, '', 'base anterior a uma longa inatividade não pode atravessar o período sem capital');
});

test('resumo ignora meses sem capital e não inventa estatística fechada quando só há prévia', () => {
  const summary = summarizePortfolioReturnV4([
    inactive('2025-09'),
    inactive('2025-10'),
    active('2025-11', 1.5, 1.5),
    active('2025-12', 2.0, 3.53)
  ]);
  assert.equal(summary.totalReturnPercent, 3.53);
  assert.equal(summary.last12MonthsReturnPercent, 3.53);
  assert.equal(summary.bestMonth.month, '2025-12');
  assert.equal(summary.worstMonth.month, '2025-11');

  const previewOnly = summarizePortfolioReturnV4([
    inactive('2026-07'),
    active('2026-08', 4.2, 4.2, { currentMonthPartial: true })
  ]);
  assert.equal(previewOnly.totalReturnPercent, 4.2);
  assert.equal(previewOnly.averageMonthlyReturnPercent, 0);
  assert.equal(previewOnly.volatilityMonthlyPercent, 0);
  assert.equal(previewOnly.bestMonth, null);
  assert.equal(previewOnly.worstMonth, null);
});

test('benchmark acumula somente enquanto existe capital exposto', () => {
  // Série de índice com +1% ao mês. O acumulado de novembro já carrega o ano inteiro,
  // mas a comparação de uma carteira reaberta em novembro deve considerar só nov/dez.
  let factor = 1;
  const benchmark = [];
  for (let month = 1; month <= 12; month += 1) {
    factor *= 1.01;
    benchmark.push({
      month: `2025-${String(month).padStart(2, '0')}`,
      accumulatedPercent: (factor - 1) * 100
    });
  }
  const portfolio = [
    inactive('2025-09'), inactive('2025-10'),
    active('2025-11', 1.5, 1.5), active('2025-12', 2, 3.53)
  ];
  const map = benchmarkExposureAlignedMonthMap(benchmark, 'accumulatedPercent', portfolio, '');
  assert.equal(map.has('2025-09'), false);
  assert.equal(map.has('2025-10'), false);
  assert.ok(Math.abs(map.get('2025-11') - 1) < 0.0001, `novembro deveria ser ~1%, recebido ${map.get('2025-11')}`);
  assert.ok(Math.abs(map.get('2025-12') - 2.01) < 0.0001, `nov+dez deveriam ser ~2,01%, recebido ${map.get('2025-12')}`);
});

test('benchmark congela durante liquidação total e retoma na reentrada', () => {
  const benchmark = [
    { month: '2026-01', accumulatedPercent: 1 },
    { month: '2026-02', accumulatedPercent: 2.01 },
    { month: '2026-03', accumulatedPercent: 3.0301 },
    { month: '2026-04', accumulatedPercent: 4.060401 },
    { month: '2026-05', accumulatedPercent: 5.10100501 }
  ];
  const portfolio = [
    active('2026-02', 2, 2),
    inactive('2026-03'),
    inactive('2026-04'),
    active('2026-05', 3, 5.06)
  ];
  const map = benchmarkExposureAlignedMonthMap(benchmark, 'accumulatedPercent', portfolio, '2026-01');
  assert.ok(Math.abs(map.get('2026-02') - 1) < 0.0001);
  assert.equal(map.has('2026-03'), false);
  assert.equal(map.has('2026-04'), false);
  // Retoma usando abril->maio, sem somar fevereiro->maio inteiro.
  assert.ok(Math.abs(map.get('2026-05') - 2.01) < 0.0002, `esperado ~2,01%, recebido ${map.get('2026-05')}`);
});
