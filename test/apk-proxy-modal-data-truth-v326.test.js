import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const metadata = JSON.parse(fs.readFileSync(new URL('../metadata.json', import.meta.url), 'utf8'));
assert.equal(pkg.valorae.publicVersion, '21.12.358');
assert.equal(pkg.valorae.releasePatch, '21.12.358-modal-data-truth-audit-v326');
assert.equal(metadata.apkVersion, '2026.07.13.02');
assert.match(metadata.contractVersion, /APK v506 \/ Proxy 21\.12\.358/);

const models = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeFiiModalModels.kt');
const parser = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyAssetModalFundamentalParsers.kt');
const fiiParser = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyFiiModalParsers.kt');
const checklistUi = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalChecklistUi.kt');
const vacancyUi = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalFiiPatrimonialVacancyUi.kt');
const build = readSiblingApkFile('app/build.gradle.kts');

if ([models, parser, fiiParser, checklistUi, vacancyUi, build].every(Boolean)) {
  assert.match(models, /val evidence: String\? = null/);
  assert.match(models, /val dataNature: String = "UNKNOWN"/);
  assert.match(models, /val calculated: Boolean = false/);
  assert.match(models, /val occupancyCalculated: Boolean = false/);
  assert.match(parser, /null -> "Não informado"/);
  assert.match(parser, /dataNature = item\.optStringOrNull\("dataNature"\)/);
  assert.match(checklistUi, /Sem evidência suficiente/);
  assert.match(checklistUi, /Calculado pelo VALORAE com dados da fonte/);
  assert.match(fiiParser, /directOccupancy == null/);
  assert.match(vacancyUi, /Ocupação calculada/);
  assert.match(build, /versionCode = 26071302/);
  assert.match(build, /versionName = "2026\.07\.13\.02"/);
}

const stock = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
const fii = fs.readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');
const integrity = fs.readFileSync(new URL('../lib/sources/history-integrity.js', import.meta.url), 'utf8');
assert.match(stock, /dataTruth:\s*\{/);
assert.match(fii, /dataTruth:\s*\{/);
assert.match(stock, /historical_dy_from_current_price/);
assert.match(fii, /peer_type_inheritance/);
assert.match(fii, /patrimonial_value_inference/);
assert.match(integrity, /reconstructedFromMonthlyReturns/);
assert.doesNotMatch(stock, /function deriveStockYieldFromDividends/);
assert.doesNotMatch(fii, /function buildDerivedDividendYieldSeries/);

console.log('apk-proxy-modal-data-truth-v326 ok');
