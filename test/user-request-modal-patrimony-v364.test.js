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

  const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
  assert.equal(
    sha256(patrimony),
    'dd44b74ed4f2a2c5587e7c357ce8ed35ff777169df55d21ee4bea805da15136c',
    'O visual atual de Patrimônio enviado pelo usuário deve permanecer inalterado.'
  );
  assert.equal(
    sha256(returnsUi),
    'e6234463bf55eba8a4708186e2c797f0e9817869e27fe8beb1c4c78faa9f5337',
    'O visual atual de Retorno enviado pelo usuário deve permanecer inalterado.'
  );

  assert.match(returnsUi, /ReturnSimulatedComparisonCard/);
  assert.match(returnsUi, /1_000\.0 \* \(1\.0 \+ returnPercent \/ 100\.0\)/);
  assert.match(returnsUi, /Comparação calculada com os índices selecionados para o período escolhido\./);
  assert.match(confetti, /width\s*=\s*3\.2f\s*\+\s*random\.nextFloat\(\)\s*\*\s*3\.4f/);
  assert.ok(confetti.indexOf('particles.forEach') < confetti.lastIndexOf('drawConfettiCannon'), 'Os canhões devem ser desenhados depois dos confetes');
}

console.log('10 ajustes de modal, patrimônio, comparação e confetes protegidos por contrato estático');
