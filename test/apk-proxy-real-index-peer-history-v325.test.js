import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const metadata = JSON.parse(fs.readFileSync(new URL('../metadata.json', import.meta.url), 'utf8'));
assert.ok(['21.12.357', '21.12.358', '21.12.359', '21.12.360', '21.12.363'].includes(pkg.valorae.publicVersion));
assert.ok(['21.12.357-real-indices-peer-patrimony-history-v325', '21.12.358-modal-data-truth-audit-v326', '21.12.359-modal-source-arrival-integrity-v327', '21.12.360-news-logos-chart-tooltips-v328', '21.12.363-portfolio-chart-regression-repair-v331'].includes(pkg.valorae.releasePatch));
assert.ok(['2026.07.13.01', '2026.07.13.02', '2026.07.13.03', '2026.07.13.04', '2026.07.13.07'].includes(metadata.apkVersion));
assert.match(metadata.contractVersion, /APK v(?:50[5-9]|51[01]) \/ Proxy 21\.12\.(?:35[7-9]|36[0-3])/);

const returnsUi = readSiblingApkFile('app/src/main/java/com/example/ui/PortfolioDashboardReturnsUi.kt');
const readiness = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalSectionReadiness.kt');
const merge = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalMergePolicy.kt');
const quality = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeAssetModalQuality.kt');
const build = readSiblingApkFile('app/build.gradle.kts');

if (returnsUi && readiness && merge && quality && build) {
  assert.doesNotMatch(returnsUi, /ReturnSelectedPointRow\(/);
  assert.doesNotMatch(returnsUi, /private fun ReturnValueChip/);
  assert.match(returnsUi, /ReturnBenchmarkSelector\(/);
  assert.match(readiness, /PeerComparison -> peerComparison\.hasUsefulPatrimonialCoverage\(\)/);
  assert.match(merge, /mergeFiiPeerComparison\(fast\.peerComparison, full\.peerComparison\)/);
  assert.match(quality, /peerComparison\.hasUsefulPatrimonialCoverage\(\)/);
  assert.match(build, /versionCode = 2607130[1-7]/);
  assert.match(build, /versionName = "2026\.07\.13\.0[1-7]"/);
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
