import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSiblingApkFile, resolveSiblingApkRoot } from './helpers/cross-stack-apk.js';
import { APK_COMPATIBILITY, annotateSourceFingerprint, evaluateApkCompatibility } from '../lib/core/apk-compatibility.js';
import { RELEASE } from '../lib/core/release.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apkRoot = resolveSiblingApkRoot();
const build = readSiblingApkFile('app/build.gradle.kts');
if (!build) {
  console.log('apk-v707-portfolio-modal-return-v433 skipped: execute npm run test:cross-stack para validar o APK pareado');
  process.exit(0);
}

const apkMetadata = JSON.parse(readSiblingApkFile('metadata.json'));
const proxyMetadata = JSON.parse(fs.readFileSync(path.join(root, 'metadata.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const portfolioPrice = readSiblingApkFile('app/src/main/java/com/example/feature/portfolio/PortfolioSparklineChartsUi.kt');
const modalService = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeUniversalAssetModalService.kt');
const proxyHttp = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const returnEngine = fs.readFileSync(path.join(root, 'lib/portfolio/return-engine-v5.js'), 'utf8');
const returnAnalysis = fs.readFileSync(path.join(root, 'lib/portfolio/analysis.js'), 'utf8');

const versionCode = Number(build.match(/versionCode\s*=\s*(\d+)/)?.[1] || 0);
const versionName = build.match(/versionName\s*=\s*"([^"]+)"/)?.[1] || '';
const checkpoint = build.match(/buildConfigField\("String",\s*"RELEASE_CHECKPOINT",\s*"\\"([^"]+)\\""\)/)?.[1] || '';
const sourceFingerprint = build.match(/buildConfigField\("String",\s*"SOURCE_FINGERPRINT",\s*"\\"([0-9a-f]{16})\\""\)/)?.[1] || '';
const buildFingerprint = build.match(/buildConfigField\("String",\s*"BUILD_FINGERPRINT",\s*"\\"([0-9a-f]{16})\\""\)/)?.[1] || '';
assert.equal(versionCode, 26082306);
assert.equal(versionName, '2026.08.23.06');
assert.equal(checkpoint, 'v707-portfolio-modal-return-alignment');

const hash = crypto.createHash('sha256');
const main = path.join(apkRoot, 'app/src/main');
const files = [];
const walk = directory => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile()) files.push(full);
  }
};
walk(main);
files.sort((a, b) => {
  const left = path.relative(apkRoot, a).replaceAll('\\', '/').split('/');
  const right = path.relative(apkRoot, b).replaceAll('\\', '/').split('/');
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return left.length - right.length;
});
for (const file of files) {
  hash.update(path.relative(apkRoot, file).replaceAll('\\', '/'));
  hash.update('\0');
  hash.update(fs.readFileSync(file));
  hash.update('\0');
}
assert.equal(hash.digest('hex').slice(0, 16), sourceFingerprint);

for (const actual of [apkMetadata.versionName, proxyMetadata.apkVersion, pkg.valorae.apkVersion, APK_COMPATIBILITY.pairedVersion]) {
  assert.equal(actual, versionName);
}
for (const actual of [apkMetadata.sourceFingerprint, proxyMetadata.apkSourceFingerprint, pkg.valorae.apkSourceFingerprint, APK_COMPATIBILITY.pairedSourceFingerprint]) {
  assert.equal(actual, sourceFingerprint);
}
for (const actual of [apkMetadata.buildFingerprint, proxyMetadata.apkBuildFingerprint, pkg.valorae.apkBuildFingerprint, APK_COMPATIBILITY.pairedBuildFingerprint]) {
  assert.equal(actual, buildFingerprint);
}
assert.equal(proxyMetadata.apkCheckpoint, checkpoint);
assert.equal(RELEASE.publicVersion, '21.12.409');
assert.equal(RELEASE.patch, '21.12.409-portfolio-modal-return-v425');
assert.equal(evaluateApkCompatibility(versionName, { allowFuture: false }).status, 'PAIRED');
assert.equal(annotateSourceFingerprint(evaluateApkCompatibility(versionName), sourceFingerprint).sourceFingerprintStatus, 'PAIRED');

assert.doesNotMatch(portfolioPrice, /heightIn\(min = 172\.dp\)/, 'acordeão fechado não pode voltar à altura mínima excessiva');
assert.match(portfolioPrice, /supporting = profitLossPercent/, 'P\/L deve manter percentual dentro da faixa compacta');
assert.doesNotMatch(portfolioPrice, /Resumo da posição e resultado acumulado/, 'subtítulo redundante fechado não deve ocupar largura');
assert.match(portfolioPrice, /Histórico de preço \(\$periodLabel\)/, 'subtítulo do estado expandido deve permanecer');

assert.match(modalService, /else -> "22000"/, 'full/recovery do modal precisa do orçamento de 22 s');
assert.match(modalService, /fundamentalTimeoutMs", if \(fast\) "3200" else "18000"/, 'fontes profundas precisam de 18 s');
assert.doesNotMatch(modalService, /else -> "14000"/, 'regressão de timeout de 14 s não pode retornar');
assert.match(proxyHttp, /\.readTimeout\(32, TimeUnit\.SECONDS\)/, 'OkHttp deve permitir a conclusão do full de 22 s');

assert.match(returnEngine, /export function reconcileCurrentMarketSnapshotV5/, 'Return Engine deve reconciliar snapshot vivo antes da fórmula');
assert.match(returnAnalysis, /reconcileCurrentMarketSnapshotV5\([\s\S]*?buildExposureOnlyReturnSeriesV5\(returnHistoryPoints/, 'snapshot vivo precisa entrar antes do Modified Dietz');
assert.doesNotMatch(returnAnalysis, /point\.month === currentMonth && currentSnapshotComplete && currentSnapshotMarketValue > 0[\s\S]{0,160}\? currentSnapshotMarketValue/, 'marketValue final não pode ser trocado sem recalcular retorno');

console.log(`apk-v707-portfolio-modal-return-v433 ok: APK ${versionName}/${sourceFingerprint}/${buildFingerprint} ↔ Proxy ${RELEASE.publicVersion}/${RELEASE.patch}`);
