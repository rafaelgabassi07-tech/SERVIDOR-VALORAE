import assert from 'node:assert/strict';
import fs from 'node:fs';
import { benchmarkAccumulatedMonthMap, buildDisplayPortfolioRows } from '../lib/portfolio/return-metrics.js';
import { buildExposureOnlyReturnSeriesV5, selectExposureReturnWindowV5 } from '../lib/portfolio/return-engine-v5.js';
import { modifiedDietzMonthlyReturnPercent } from '../lib/portfolio/return-calculation.js';

const points = [
  { month: '2026-01', accumulatedPercent: 0 },
  { month: '2026-02', accumulatedPercent: 10 },
  { month: '2026-03', accumulatedPercent: 21 }
];

const withPreviousClosing = benchmarkAccumulatedMonthMap(points, 'accumulatedPercent', '2026-02', '2026-01');
assert.equal(withPreviousClosing.get('2026-02'), 10);
assert.equal(withPreviousClosing.get('2026-03'), 21);

const inceptionBase = benchmarkAccumulatedMonthMap(points, 'accumulatedPercent', '2026-02', '2026-02');
assert.ok(Math.abs(inceptionBase.get('2026-02') - 10) < 1e-9, 'o primeiro mês visível precisa preservar seu retorno econômico, não ser zerado');
assert.ok(Math.abs(inceptionBase.get('2026-03') - 21) < 1e-9, 'a série seguinte precisa permanecer relativa ao início econômico real');

const missingBase = benchmarkAccumulatedMonthMap(points.slice(1), 'accumulatedPercent', '2026-02', '2026-01');
assert.equal(missingBase.size, 0, 'quando a carteira declara uma base anterior explícita, o benchmark sem esse mesmo fechamento não é comparável');

const thirteenMonthlyCloses = Array.from({ length: 13 }, (_, index) => ({
  month: `2025-${String(index + 1).padStart(2, '0')}`,
  monthlyReturnPercent: index === 0 ? 0 : 1,
  portfolioReturnPercent: ((1.01 ** index) - 1) * 100
}));
const twelveMonthWindow = buildDisplayPortfolioRows(thirteenMonthlyCloses, 12);
assert.equal(twelveMonthWindow.length, 12, '12M precisa preservar doze meses visíveis além do fechamento-base');
assert.ok(Math.abs(twelveMonthWindow[0].portfolioReturnPercent - 1) < 0.0001, 'primeiro mês visível de 12M não pode ser zerado');
assert.ok(Math.abs(twelveMonthWindow.at(-1).portfolioReturnPercent - (((1.01 ** 12) - 1) * 100)) < 0.001, 'retorno 12M precisa medir exatamente doze intervalos');

const reentryReturn = modifiedDietzMonthlyReturnPercent({
  beginningMarketValue: 0,
  endingMarketValue: 1050,
  contributions: 1000,
  withdrawals: 0,
  weightedNetCashFlow: 500,
  dividends: 0,
  fallbackReturnPercent: 5
});
assert.ok(Math.abs(reentryReturn - 10) < 1e-9, 'reentrada após liquidação precisa usar exposição ponderada, não retorno sobre custo');


const analysis = fs.readFileSync(new URL('../lib/portfolio/analysis.js', import.meta.url), 'utf8');
const returnV5 = fs.readFileSync(new URL('../lib/portfolio/return-engine-v5.js', import.meta.url), 'utf8');
assert.match(analysis, /const benchmarkMonths = Math\.max\(1, Math\.min\(600, Math\.max\(displayMonths, requestedBenchmarkMonths\)\)\)/,
  'Máx precisa ampliar benchmarks para toda a janela visível da carteira');
assert.match(analysis, /const boundary = isCurrentMonth \? Math\.min\(monthEnd, now\.getTime\(\)\) : monthEnd/,
  'mês corrente precisa usar somente o tempo já transcorrido no Modified Dietz');
assert.match(analysis, /currentSnapshotMissingTickers/,
  'ancoragem atual deve conhecer quais ativos estão sem cotação');
assert.match(analysis, /currentSnapshotComplete/,
  'ancoragem atual não pode usar snapshot parcial');
assert.match(analysis, /saoPauloMonthKey\(now\)/,
  'competência corrente precisa seguir o calendário de São Paulo/B3');
assert.match(analysis, /comparisonBaseMonth/,
  'contrato precisa declarar a base econômica comum da comparação');
assert.match(returnV5, /modifiedDietzMonthlyReturnPercent/,
  'reentrada após liquidação precisa chegar ao Modified Dietz no motor v5');
assert.doesNotMatch(analysis, /NEUTRALIZED_INVALID/,
  'retorno impossível não pode mais virar 0% por neutralização legada');
assert.match(analysis, /droppedReturnMonths/,
  'meses não mensuráveis precisam ficar explícitos no diagnóstico do contrato');
assert.match(returnV5, /inactiveMonths\.push\(point\.month\)/,
  'mês sem capital precisa sair da série em vez de ser reconstruído como 0%');

assert.match(analysis, /const portfolioFetchMonths = Math\.min\(600, portfolioMonths \+ 1\)/,
  'Retorno precisa pedir um fechamento extra para formar a base da janela visível');
assert.match(analysis, /limitHistoryToRequestedWindow: true/,
  'Retorno deve limitar a reconstrução histórica à janela pedida mais a base');
assert.match(analysis, /if \(n <= 24\) return '2Y'/,
  'janela de 13 a 24 meses não deve baixar cinco anos de histórico');
assert.match(analysis, /trailingBenchmarkReturnFromSeries/,
  'resumo CDI precisa respeitar os mesmos meses alinhados do gráfico');

console.log('portfolio-return-comparison-common-base-v425 ok');
