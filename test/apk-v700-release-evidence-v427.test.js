import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSiblingApkFile, resolveSiblingApkRoot } from './helpers/cross-stack-apk.js';
import { APK_COMPATIBILITY, annotateSourceFingerprint, evaluateApkCompatibility } from '../lib/core/apk-compatibility.js';
import { RELEASE } from '../lib/core/release.js';
import {
  VALORAE_MOBILE_PROTOCOL_VERSION,
  VALORAE_ASSET_MODAL_DELIVERY_SCHEMA_VERSION,
  VALORAE_CANONICAL_REQUEST_HEADERS,
  VALORAE_EXPOSE_HEADERS,
} from '../lib/core/mobile-protocol.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apkRoot = resolveSiblingApkRoot();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const proxyMetadata = JSON.parse(fs.readFileSync(path.join(root, 'metadata.json'), 'utf8'));
const apkMetadata = JSON.parse(readSiblingApkFile('metadata.json'));
const build = readSiblingApkFile('app/build.gradle.kts');
if (!build) {
  console.log('apk-v700-release-evidence-v427 skipped: execute npm run test:cross-stack para validar o APK pareado');
  process.exit(0);
}
const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const baselineContract = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeContractContinuityGuard.kt');
const formalSchema = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeFormalSchema.kt');
const proxyBaseline = fs.readFileSync(path.join(root, 'lib/contract/baseline.js'), 'utf8');
const proxyFeatureVersions = fs.readFileSync(path.join(root, 'lib/core/feature-versions.js'), 'utf8');
const proxyHttp = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const syncClient = readSiblingApkFile('app/src/main/java/com/example/data/sync/ValoraeSyncClient.kt');
const logoUi = readSiblingApkFile('app/src/main/java/com/example/ui/shared/asset/PortfolioAssetsCardsUi.kt');
const router = fs.readFileSync(path.join(root, 'routes/_router.js'), 'utf8');
const syncRoute = fs.readFileSync(path.join(root, 'routes/sync.js'), 'utf8');

const versionCode = Number(build.match(/versionCode\s*=\s*(\d+)/)?.[1] || 0);
const versionName = build.match(/versionName\s*=\s*"([^"]+)"/)?.[1] || '';
const checkpoint = build.match(/buildConfigField\("String",\s*"RELEASE_CHECKPOINT",\s*"\\"([^"]+)\\""\)/)?.[1] || '';
const sourceFingerprint = build.match(/buildConfigField\("String",\s*"SOURCE_FINGERPRINT",\s*"\\"([0-9a-f]{16})\\""\)/)?.[1] || '';
const buildFingerprint = build.match(/buildConfigField\("String",\s*"BUILD_FINGERPRINT",\s*"\\"([0-9a-f]{16})\\""\)/)?.[1] || '';
assert.equal(versionCode, 26082201);
assert.equal(versionName, '2026.08.22.01');
assert.equal(checkpoint, 'v700-reproducible-release-evidence');

const hash = crypto.createHash('sha256');
const main = path.join(apkRoot, 'app/src/main');
const sourceFiles = [];
const walk = directory => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile()) sourceFiles.push(full);
  }
};
walk(main);
sourceFiles.sort((a, b) => {
  const left = path.relative(apkRoot, a).replaceAll('\\', '/').split('/');
  const right = path.relative(apkRoot, b).replaceAll('\\', '/').split('/');
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return left.length - right.length;
});
for (const file of sourceFiles) {
  const relative = path.relative(apkRoot, file).replaceAll('\\', '/');
  hash.update(relative); hash.update('\0'); hash.update(fs.readFileSync(file)); hash.update('\0');
}
assert.equal(hash.digest('hex').slice(0, 16), sourceFingerprint, 'fingerprint do APK precisa representar app/src/main real');

for (const [label, actual] of [
  ['APK metadata.versionName', apkMetadata.versionName],
  ['Proxy package apkVersion', pkg.valorae.apkVersion],
  ['Proxy metadata apkVersion', proxyMetadata.apkVersion],
  ['Proxy compatibility pairedVersion', APK_COMPATIBILITY.pairedVersion],
  ['Proxy compatibility maxTestedVersion', APK_COMPATIBILITY.maxTestedVersion],
]) assert.equal(actual, versionName, label);
for (const [label, actual] of [
  ['APK metadata sourceFingerprint', apkMetadata.sourceFingerprint],
  ['Proxy package sourceFingerprint', pkg.valorae.apkSourceFingerprint],
  ['Proxy metadata sourceFingerprint', proxyMetadata.apkSourceFingerprint],
  ['Proxy compatibility sourceFingerprint', APK_COMPATIBILITY.pairedSourceFingerprint],
]) assert.equal(actual, sourceFingerprint, label);
for (const [label, actual] of [
  ['APK metadata buildFingerprint', apkMetadata.buildFingerprint],
  ['Proxy package buildFingerprint', pkg.valorae.apkBuildFingerprint],
  ['Proxy metadata buildFingerprint', proxyMetadata.apkBuildFingerprint],
  ['Proxy compatibility buildFingerprint', APK_COMPATIBILITY.pairedBuildFingerprint],
]) assert.equal(actual, buildFingerprint, label);
assert.equal(proxyMetadata.apkCheckpoint, checkpoint);
assert.equal(RELEASE.publicVersion, '21.12.409');
assert.equal(RELEASE.patch, '21.12.409-cross-stack-integrity-v423');
assert.equal(evaluateApkCompatibility(versionName, { allowFuture: false }).status, 'PAIRED');
assert.equal(annotateSourceFingerprint(evaluateApkCompatibility(versionName), sourceFingerprint).sourceFingerprintStatus, 'PAIRED');

assert.match(protocol, /const val Version = "2026\.07\.10\.10"/);
assert.equal(VALORAE_MOBILE_PROTOCOL_VERSION, '2026.07.10.10');
assert.match(protocol, /AssetModalDeliverySchemaVersion = "4"/);
assert.equal(VALORAE_ASSET_MODAL_DELIVERY_SCHEMA_VERSION, '4');
assert.match(protocol, /ResponseContractVersion = "valorae-api-v1"/);
assert.match(protocol, /EcosystemContractVersion = "valorae-ecosystem-2026\.08\.05\.04-p404"/);
assert.match(protocol, /BaselineContractVersion = ValoraeContractContinuityGuard\.BaselineVersion/);
assert.match(baselineContract, /BaselineVersion = "2026\.07\.14-checkpoint106-v1"/);
assert.match(proxyBaseline, /VALORAE_BASELINE_CONTRACT_VERSION = '2026\.07\.14-checkpoint106-v1'/);
assert.match(protocol, /FormalSchemaVersion = ValoraeFormalSchemaContract\.Version/);
assert.match(formalSchema, /Version = "2026\.07\.15-checkpoint112-v1"/);
assert.match(proxyFeatureVersions, /VALORAE_FORMAL_SCHEMA_VERSION = '2026\.07\.15-checkpoint112-v1'/);
assert.ok(VALORAE_CANONICAL_REQUEST_HEADERS.includes('X-Valorae-Source-Fingerprint'));
assert.ok(VALORAE_EXPOSE_HEADERS.includes('X-Valorae-Paired-Source-Fingerprint'));
assert.ok(VALORAE_EXPOSE_HEADERS.includes('X-Valorae-Source-Fingerprint-Status'));
assert.match(protocol, /HeaderPairedSourceFingerprint = "X-Valorae-Paired-Source-Fingerprint"/);
assert.match(protocol, /HeaderSourceFingerprintStatus = "X-Valorae-Source-Fingerprint-Status"/);
assert.match(proxyHttp, /HeaderSourceFingerprint, BuildConfig\.SOURCE_FINGERPRINT/);
assert.match(syncClient, /HeaderSourceFingerprint, BuildConfig\.SOURCE_FINGERPRINT/);
assert.match(proxyHttp, /pairedSourceFingerprint = header\(ValoraeMobileProtocol\.HeaderPairedSourceFingerprint\)/);
assert.match(proxyHttp, /sourceFingerprintStatus = header\(ValoraeMobileProtocol\.HeaderSourceFingerprintStatus\)/);
assert.doesNotMatch(proxyHttp, /sourceFingerprintMismatch|fingerprintRetrySafe/, 'fingerprint do deployment é diagnóstico, não saúde de transporte');
assert.doesNotMatch(syncClient, /sourceFingerprintMismatch|fingerprintRetrySafe/, 'sync não deve rejeitar resposta válida por fingerprint divergente');
assert.match(proxyHttp, /\((?:retryableStatus \|\| contractMismatch|contractMismatch \|\| retryableStatus)\)/);
assert.match(syncClient, /\((?:retryableStatus \|\| contractMismatch|contractMismatch \|\| retryableStatus)\)/);

const retrySet = syncClient.match(/retryableStatus\s*=\s*response\.code\s+in\s+setOf\(([^)]*)\)/)?.[1] || '';
assert.ok(/\b500\b/.test(retrySet), 'sync precisa alternar host em HTTP 500');
const diagnostics = syncClient.slice(syncClient.indexOf('private fun JSONObject.toDiagnostics'), syncClient.indexOf('private fun JSONObject.toAuthCheck'));
assert.match(diagnostics, /ifBlank \{ optString\("authMode"\) \}/, 'authMode top-level do Proxy precisa ser interpretado');
assert.match(logoUi, /BuildConfig\.VALORAE_PROXY_FALLBACK_BASE_URL/, 'logos precisam ter host de contingência');

assert.match(syncClient, /valorae-financial-sync-v2/);
assert.match(syncRoute, /valorae-financial-sync-v2/);
const syncActions = ['diagnostics','auth_check','get_financial_status','upload_transactions','download_financial_data','upload_dividends','delete_financial_data'];
for (const action of syncActions) {
  assert.ok(syncClient.includes(`"${action}"`), `APK não declara ação sync ${action}`);
  assert.ok(syncRoute.includes(`'${action}'`) || syncRoute.includes(`"${action}"`), `Proxy não declara ação sync ${action}`);
}

const expectedRoutes = [
  '/ready','/assets','/asset/quote','/quotes','/asset/history','/asset/modal','/asset/logo',
  '/market/indices','/market/rankings','/analysis/rankings','/news','/portfolio/equilibrium',
  '/portfolio/history','/portfolio/returns','/dividends/batch','/mobile/alerts','/mobile/daily-close','/sync',
];
for (const route of expectedRoutes) {
  if (route === '/sync') assert.ok(syncClient.includes('/api/sync'), 'APK não usa /api/sync');
  else {
    assert.ok(router.includes(`'${route}'`) || router.includes(`"${route}"`), `Proxy allowlist sem ${route}`);
    const apkLiteral = `/api/v1${route}`;
    const allApk = [proxyHttp, syncClient, logoUi,
      ...['app/src/main/java/com/example/data/proxy/ValoraeProxyAssetModalService.kt','app/src/main/java/com/example/data/proxy/ValoraeProxyDiagnosticsService.kt']
        .map(file => readSiblingApkFile(file, { optional: true }) || '')].join('\n');
    if (['/ready','/assets','/asset/quote','/quotes','/asset/history','/asset/modal','/asset/logo'].includes(route)) {
      assert.ok(allApk.includes(apkLiteral) || router.includes(`'${route}'`));
    }
  }
}

const qualityGate = readSiblingApkFile('tools/quality_gate.py');
const preflight = readSiblingApkFile('tools/release_preflight.py');
const deviceGate = readSiblingApkFile('tools/run_performance_device_gate.sh');
const artifactVerifier = readSiblingApkFile('tools/verify_release_artifacts.py');
const proxyReleaseGate = fs.readFileSync(path.join(root, 'scripts/verify-release.js'), 'utf8');
assert.match(qualityGate, /choices=\["static", "full", "distribution"\]/);
assert.match(qualityGate, /release_approved = mode == "distribution"/);
assert.match(qualityGate, /verify_device_gate_evidence/);
assert.match(preflight, /android-platform-36/);
assert.match(preflight, /release-signing-env/);
assert.match(deviceGate, /REPORT_DIR="\$ROOT\/tools\/reports\/device-performance"/);
assert.match(deviceGate, /sourceFingerprint.*source_fingerprint/s);
assert.match(artifactVerifier, /--print-certs/);
assert.match(artifactVerifier, /jarsigner/);
assert.match(proxyReleaseGate, /--mode', 'distribution', '--with-static-analysis'/);
assert.match(proxyReleaseGate, /releaseApproved !== true/);
assert.doesNotMatch(proxyReleaseGate, /VALORAE_DEVICE_GATE_COMPLETED/);

console.log(`apk-v700-release-evidence-v427 ok: APK ${versionName}/${sourceFingerprint}/${buildFingerprint} ↔ Proxy ${RELEASE.publicVersion}; ${expectedRoutes.length} rotas auditadas`);
