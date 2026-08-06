import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const metadata = JSON.parse(fs.readFileSync(new URL('../metadata.json', import.meta.url), 'utf8'));
assert.ok(['21.12.357', '21.12.358', '21.12.359', '21.12.360', '21.12.364', '21.12.367', '21.12.369', '21.12.373', '21.12.374', '21.12.375', '21.12.376', '21.12.380', '21.12.382', '21.12.390', '21.12.396', '21.12.397', '21.12.398', '21.12.401', '21.12.404'].includes(pkg.valorae.publicVersion));
assert.ok(['21.12.357-real-indices-peer-patrimony-history-v325', '21.12.358-modal-data-truth-audit-v326', '21.12.359-modal-source-arrival-integrity-v327', '21.12.360-news-logos-chart-tooltips-v328', '21.12.364-monthly-variation-logos-return-indices-v332', '21.12.367-logo-source-performance-v335', '21.12.369-field-observability-v337', '21.12.373-dynamic-render-fallback-v341', '21.12.374-formal-schema-validation-v342', '21.12.375-http-provider-transport-v343', '21.12.376-shared-runtime-state-v344', '21.12.380-scraping-runtime-hardening-v348', '21.12.382-quote-state-resilience-v350', '21.12.390-financial-sync-integrity-v358', '21.12.396-asset-modal-completeness-v364', '21.12.397-financial-integrity-audit-v365', '21.12.398-ecosystem-performance-hardening-v366', '21.12.401-ecosystem-maturity-v410', '21.12.404-account-profile-v413'].includes(pkg.valorae.releasePatch));
assert.equal(metadata.apkVersion, pkg.valorae.apkVersion);
assert.ok(metadata.contractVersion.includes(`APK ${metadata.apkCheckpoint.match(/^v\d+/)?.[0]} / Proxy ${pkg.valorae.publicVersion}`));

const returnsUi = readSiblingApkFile('app/src/main/java/com/example/ui/PortfolioDashboardReturnsUi.kt');
const readiness = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalSectionReadiness.kt');
const merge = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalMergePolicy.kt');
const quality = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeAssetModalQuality.kt');
const build = readSiblingApkFile('app/build.gradle.kts');
const apkMetadataText = readSiblingApkFile('metadata.json');

if (returnsUi && readiness && merge && quality && build && apkMetadataText) {
  assert.doesNotMatch(returnsUi, /ReturnSelectedPointRow\(/);
  assert.doesNotMatch(returnsUi, /private fun ReturnValueChip/);
  assert.match(returnsUi, /ReturnBenchmarkSelector\(/);
  assert.match(readiness, /PeerComparison -> peerComparison\.hasUsefulPatrimonialCoverage\(\)/);
  assert.match(merge, /mergeFiiPeerComparison\(fast\.peerComparison, full\.peerComparison\)/);
  assert.match(quality, /peerComparison\.hasUsefulPatrimonialCoverage\(\)/);
  const apkMetadata = JSON.parse(apkMetadataText);
  assert.ok(build.includes(`versionCode = ${apkMetadata.versionCode}`));
  assert.ok(build.includes(`versionName = "${apkMetadata.versionName}"`));
}

const integrity = fs.readFileSync(new URL('../lib/sources/history-integrity.js', import.meta.url), 'utf8');
const quotes = fs.readFileSync(new URL('../lib/sources/quotes.js', import.meta.url), 'utf8');
const marketIndices = fs.readFileSync(new URL('../lib/market/indices.js', import.meta.url), 'utf8');
const fii = fs.readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');
const stock = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../lib/analysis/asset-modal-runtime.js', import.meta.url), 'utf8');

assert.match(integrity, /reconstructedFromYahooSnapshot/);
assert.match(integrity, /proxyTickerUsed/);
assert.doesNotMatch(quotes, /LAST_KNOWN_DIRECT_INDEX_QUOTES/);
assert.doesNotMatch(marketIndices, /LAST_KNOWN_YAHOO_INDEX_SNAPSHOT/);
assert.match(fii, /enrichFiiPeerComparisonPatrimonialValues/);
assert.match(fii, /individual_investidor10_fii_pages_no_inference_no_mock/);
assert.match(stock, /sanitizeStockHistoricalTable/);
assert.match(stock, /stockHistoricalTemporalEvidence/);
assert.match(runtime, /hasFiiPeerPatrimonialCoverage/);

console.log('apk-proxy-real-index-peer-history-v325 ok');
