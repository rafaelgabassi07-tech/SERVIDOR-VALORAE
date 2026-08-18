import assert from 'node:assert/strict';
import fs from 'node:fs';

const analysis = fs.readFileSync(new URL('../lib/portfolio/analysis.js', import.meta.url), 'utf8');
const metrics = fs.readFileSync(new URL('../lib/portfolio/return-metrics.js', import.meta.url), 'utf8');
const calc = fs.readFileSync(new URL('../lib/portfolio/return-calculation.js', import.meta.url), 'utf8');

assert.match(analysis, /MODIFIED_DIETZ_INCEPTION/, 'O primeiro fechamento deve medir retorno desde a primeira compra');
assert.match(analysis, /weightedPortfolioCashFlows/, 'O mês inicial deve usar a janela efetiva de exposição, não o mês civil inteiro');
assert.match(analysis, /const historicalMarketValue = round\(Number\(point\.marketValue \?\? point\.totalValue \?\? point\.value \?\? 0\), 2\)/, 'A série deve transportar marketValue real');
assert.match(analysis, /const marketValue = round\(Number\(item\.marketValue \?\? item\.portfolioMarketValue \?\? item\.currentValue \?\? value\), 2\)/, 'Histórico fornecido deve preservar marketValue');
assert.match(analysis, /const currentSnapshotMarketValue = currentSnapshotComplete[\s\S]*?round\(currentPositions\.reduce/, 'O valor atual precisa ser ancorado somente quando todas as posições têm cotação real');
assert.match(analysis, /point\.month === currentMonth && currentSnapshotComplete && currentSnapshotMarketValue > 0/, 'Somente o mês corrente pode receber a âncora do snapshot atual');
assert.match(analysis, /currentSnapshotMissingTickers/, 'Snapshot parcial precisa ser diagnosticado em vez de virar patrimônio incompleto');
assert.match(analysis, /modifiedDietzMonthlyReturnPercent\(/, 'Retorno mensal precisa descontar fluxos externos');
assert.match(calc, /const netCashFlow = contributed - withdrawn;/);
assert.match(calc, /const denominator = beginning \+ weightedFlow;/);
assert.match(metrics, /selectPortfolioRowsForRange/);
assert.match(metrics, /startsWith\(currentYear\)/, 'Ano atual não pode carregar meses de outro ano');
assert.doesNotMatch(analysis, /Base simulada|1_000\.0/, 'Proxy não deve produzir patrimônio por base monetária simulada');

console.log('portfolio-return-real-patrimony-static-v424 ok');
