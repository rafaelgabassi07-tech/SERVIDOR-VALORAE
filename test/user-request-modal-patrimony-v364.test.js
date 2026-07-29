import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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

const details = readSiblingApkFile('app/src/main/java/com/example/ui/AssetDetailsModalUi.kt');
const patrimony = readSiblingApkFile('app/src/main/java/com/example/ui/PatrimonyTotalModalComponents.kt');
const returnsUi = readSiblingApkFile('app/src/main/java/com/example/ui/PortfolioDashboardReturnsUi.kt');
const confetti = readSiblingApkFile('app/src/main/java/com/example/ui/ConfettiAnimation.kt');
const chartUi = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalStockDividendChartsUi.kt');
const models = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeStockModalModels.kt');
const checklistReadiness = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalSectionReadiness.kt');

if ([details, patrimony, returnsUi, confetti, chartUi, models, checklistReadiness].every(Boolean)) {
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

  assert.match(patrimony, /text\s*=\s*"Patrimônio total"/);
  assert.match(patrimony, /Icons\.Rounded\.AccountBalanceWallet/);
  const filterBlock = between(patrimony, 'fun WealthEvolutionFilterRow', 'private fun WealthPeriodSelector');
  assert.match(filterBlock, /text\s*=\s*"Período"[\s\S]*Todos os ativos[\s\S]*WealthDisplayModeToggle[\s\S]*text\s*=\s*"Visualização"[\s\S]*WealthChartStyleToggle/);
  assert.match(filterBlock, /Modifier\.width\(96\.dp\)[\s\S]*Modifier\.width\(176\.dp\)/);
  const cardBlock = between(patrimony, 'fun WealthEvolutionCard', 'private fun WealthChartStyleToggle');
  assert.match(cardBlock, /Surface\s*\(/, 'O gráfico consolidado deve usar uma superfície estável e alinhada ao APK');
  assert.doesNotMatch(cardBlock, /animateContentSize/, 'O gráfico não deve animar todo o container durante atualizações');
  const chartBlock = between(patrimony, 'private fun WealthModernChart', 'private fun WealthChartLegend');
  assert.match(chartBlock, /padding\(horizontal\s*=\s*0\.dp/);

  assert.match(returnsUi, /ReturnSimulatedComparisonCard/);
  assert.match(returnsUi, /1_000\.0 \* \(1\.0 \+ returnPercent \/ 100\.0\)/);
  assert.match(returnsUi, /Comparação calculada com os índices selecionados para o período escolhido\./);
  assert.match(confetti, /width\s*=\s*3\.2f\s*\+\s*random\.nextFloat\(\)\s*\*\s*3\.4f/);
  assert.ok(confetti.indexOf('particles.forEach') < confetti.lastIndexOf('drawConfettiCannon'), 'Os canhões devem ser desenhados depois dos confetes');
}

console.log('10 ajustes de modal, patrimônio, comparação e confetes protegidos por contrato estático');
