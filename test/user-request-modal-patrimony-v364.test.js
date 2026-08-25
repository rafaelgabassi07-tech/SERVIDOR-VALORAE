import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readSiblingApkFile, resolveSiblingApkRoot } from './helpers/cross-stack-apk.js';

function between(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0 && end > start, `Trecho não encontrado: ${startNeedle}`);
  return source.slice(start, end);
}

const runtime = fs.readFileSync(new URL('../lib/analysis/asset-modal-runtime.js', import.meta.url), 'utf8');
const stock = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
const fii = fs.readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');
assert.match(runtime, /stripRetiredAssetModalFeatures/);
assert.match(runtime, /analysisChanges[\s\S]*whatChanged[\s\S]*analysisChangeHistory/);
assert.match(stock, /expectedCriteria:\s*STOCK_BUY_HOLD_CHECKLIST_CRITERIA\.length/);
assert.match(stock, /fetchYahooQuote\('BRL=X'/);
assert.match(stock, /buildStockDividendRadarPayload/);
assert.match(fii, /expectedCriteria:\s*FII_BUY_HOLD_CHECKLIST_CRITERIA\.length/);
assert.match(fii, /short_dividend_history_is_not_failure/);

const details = readSiblingApkFile('app/src/main/java/com/example/ui/shared/asset/AssetDetailsModalUi.kt');
const patrimony = readSiblingApkFile('app/src/main/java/com/example/feature/portfolio/PatrimonyTotalModalComponents.kt');
const patrimonyEvolution = readSiblingApkFile('app/src/main/java/com/example/feature/portfolio/PatrimonyWealthEvolutionUi.kt');
const returnsUi = readSiblingApkFile('app/src/main/java/com/example/feature/portfolio/PortfolioDashboardReturnsUi.kt');
const confetti = readSiblingApkFile('app/src/main/java/com/example/ui/shared/ConfettiAnimation.kt');
const chartUi = [
  'AssetModalStockDividendChartsUi.kt',
  'AssetModalStockDividendHistoryUi.kt',
  'AssetModalStockDividendRadarUi.kt',
  'AssetModalStockPayoutChartUi.kt',
  'AssetModalStockFinancialChartUi.kt',
].map(name => readSiblingApkFile(`app/src/main/java/com/example/ui/shared/asset/${name}`)).filter(Boolean).join('\n');
const models = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeStockModalModels.kt');
const checklistReadiness = readSiblingApkFile('app/src/main/java/com/example/ui/shared/asset/AssetModalSectionReadiness.kt');

if ([details, patrimony, patrimonyEvolution, returnsUi, confetti, chartUi, models, checklistReadiness].every(Boolean)) {
  assert.doesNotMatch(details, /StockAssetAnalysisChangesSection|FiiAssetAnalysisChangesSection/);
  const apkRoot = resolveSiblingApkRoot();
  assert.equal(fs.existsSync(path.join(apkRoot, 'app/src/main/java/com/example/ui/AssetAnalysisChangesUi.kt')), false);
  assert.equal(fs.existsSync(path.join(apkRoot, 'app/src/test/java/com/example/ui/AssetAnalysisChangesTest.kt')), false);

  assert.match(checklistReadiness, /StockAssetModalSection\.Checklist -> true/);
  assert.match(checklistReadiness, /FiiAssetModalSection\.Checklist -> true/);
  assert.match(runtime, /expectedTotal[\s\S]*10[\s\S]*8[\s\S]*every\(item/);
  assert.match(models, /val observedYearCount:\s*Int/);
  assert.match(chartUi, /dateComScore|paymentScore/);
  assert.match(chartUi, /stockFinancialAxisTickIndices/);
  assert.match(chartUi, /val monthNames = listOf\("jan", "fev", "mar"/);

  const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
  assert.equal(
    sha256(patrimony),
    '0868ff1dd96245f7d817202eb391a49dd499f03c685da0e24cceee207cf024f8',
    'A fachada e os componentes gerais de Patrimônio devem permanecer inalterados.'
  );
  assert.equal(
    sha256(patrimonyEvolution),
    'cc04dd79ca2af7dc4086ad0aeb422dc4a096c3959bb9dd70aa62eabc024b551e',
    'O gráfico e a evolução patrimonial devem permanecer inalterados após o split.'
  );
  assert.equal(
    sha256(returnsUi),
    '49761f5148288417d04bbab089c9b88fa22f8084c2ed5dad16484f7759594c00',
    'O visual de Retorno deve manter a correção que remove patrimônio monetário simulado.'
  );

  assert.match(returnsUi, /ReturnIndexBenchmarkSelector/);
  assert.doesNotMatch(returnsUi, /1_000\.0 \* \(1\.0 \+ returnPercent \/ 100\.0\)/);
  assert.match(returnsUi, /Valor de mercado real da carteira em cada fechamento/);
  assert.match(returnsUi, /portfolioMarketHistory/);
  assert.match(confetti, /particleCount:\s*Int\s*=\s*128/);
  assert.match(confetti, /durationMillis:\s*Int\s*=\s*3_250/);
  assert.match(confetti, /width\s*=\s*6\.8f\s*\+\s*random\.nextFloat\(\)\s*\*\s*5\.4f/);
  assert.equal((confetti.match(/drawConfettiCannon\(/g) || []).length, 0, 'A animação atual não deve manter o helper legado de canhão.');
}

console.log('10 ajustes de modal, patrimônio, comparação e confetes protegidos por contrato estático');
