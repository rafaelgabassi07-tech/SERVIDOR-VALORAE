import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const metadata = JSON.parse(fs.readFileSync(new URL('../metadata.json', import.meta.url), 'utf8'));
assert.ok(['21.12.358', '21.12.359', '21.12.360', '21.12.364', '21.12.367', '21.12.369', '21.12.373', '21.12.374', '21.12.375', '21.12.376', '21.12.380', '21.12.382', '21.12.390', '21.12.396', '21.12.397', '21.12.398', '21.12.401', '21.12.404'].includes(pkg.valorae.publicVersion));
assert.ok(['21.12.358-modal-data-truth-audit-v326', '21.12.359-modal-source-arrival-integrity-v327', '21.12.360-news-logos-chart-tooltips-v328', '21.12.364-monthly-variation-logos-return-indices-v332', '21.12.367-logo-source-performance-v335', '21.12.369-field-observability-v337', '21.12.373-dynamic-render-fallback-v341', '21.12.374-formal-schema-validation-v342', '21.12.375-http-provider-transport-v343', '21.12.376-shared-runtime-state-v344', '21.12.380-scraping-runtime-hardening-v348', '21.12.382-quote-state-resilience-v350', '21.12.390-financial-sync-integrity-v358', '21.12.396-asset-modal-completeness-v364', '21.12.397-financial-integrity-audit-v365', '21.12.398-ecosystem-performance-hardening-v366', '21.12.401-ecosystem-maturity-v410', '21.12.404-account-profile-v413'].includes(pkg.valorae.releasePatch));
if (metadata.apkVersion) assert.match(metadata.apkVersion, /^2026\.(?:07\.(?:13|14|15|16|17|23|24|25|26|27|30)|08\.(?:04|05))\.\d{2}$/);
if (metadata.contractVersion) assert.ok(metadata.contractVersion.includes(`Proxy ${pkg.valorae.publicVersion}`));

const models = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeFiiModalModels.kt');
const parser = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyAssetModalFundamentalParsers.kt');
const fiiParser = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyFiiModalParsers.kt');
const checklistUi = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalChecklistUi.kt');
const vacancyUi = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalFiiPatrimonialVacancyUi.kt');
const build = readSiblingApkFile('app/build.gradle.kts');
const apkMetadataSource = readSiblingApkFile('metadata.json');

if ([models, parser, fiiParser, checklistUi, vacancyUi, build, apkMetadataSource].every(Boolean)) {
  assert.match(models, /val evidence: String\? = null/);
  assert.match(models, /val dataNature: String = "UNKNOWN"/);
  assert.match(models, /val calculated: Boolean = false/);
  assert.match(models, /val occupancyCalculated: Boolean = false/);
  assert.match(parser, /null -> "Em apuração"/);
  assert.match(parser, /dataNature = item\.optStringOrNull\("dataNature"\)/);
  assert.doesNotMatch(checklistUi, /Sem evidência suficiente/);
  assert.match(checklistUi, /Fonte em atualização/);
  assert.match(checklistUi, /Cálculo transparente com dados da fonte/);
  assert.match(checklistUi, /Dado direto da fonte/);
  assert.doesNotMatch(checklistUi, /Calculado pelo VALORAE com dados da fonte/);
  assert.match(checklistUi, /AssetChecklistSummaryChip\("Em apuração"/);
  assert.match(fiiParser, /directOccupancy == null/);
  assert.match(vacancyUi, /Ocupação calculada/);
  const apkMetadata = JSON.parse(apkMetadataSource);
  assert.match(build, new RegExp(`versionCode = ${apkMetadata.versionCode}`));
  assert.match(build, new RegExp(`versionName = \"${apkMetadata.versionName.replaceAll('.', '\\.') }\"`));
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
