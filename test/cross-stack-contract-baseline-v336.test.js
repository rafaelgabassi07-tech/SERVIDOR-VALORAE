import assert from 'node:assert/strict';
import { VALORAE_BASELINE_CONTRACT_VERSION } from '../lib/contract/baseline.js';
import { VALORAE_EXPOSE_HEADERS } from '../lib/core/mobile-protocol.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const http = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const guard = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeContractContinuityGuard.kt');
const assetService = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyAssetModalService.kt');
const universalModalService = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeUniversalAssetModalService.kt');
const portfolioService = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyPortfolioContractsService.kt');
const runtime = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyRuntime.kt');
const build = readSiblingApkFile('app/build.gradle.kts');
const apkMetadataText = readSiblingApkFile('metadata.json');
if ([protocol, http, guard, assetService, universalModalService, portfolioService, runtime, build, apkMetadataText].every(Boolean)) {
  assert.ok(VALORAE_EXPOSE_HEADERS.includes('X-Valorae-Baseline-Contract'));
  assert.match(protocol, /BaselineContractVersion = ValoraeContractContinuityGuard\.BaselineVersion/);
  assert.match(guard, new RegExp(VALORAE_BASELINE_CONTRACT_VERSION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(protocol, /HeaderBaselineContract/);
  assert.match(http, /baselineContractVersion = header\(ValoraeMobileProtocol\.HeaderBaselineContract\)/);
  assert.match(guard, /shouldPreservePreviousSnapshot/);
  assert.match(guard, /contractBaseline/);
  assert.match(guard, /contractBaseline\.version=/);
  assert.match(http, /!hasCompatibleBaselineContract/);
  assert.match(assetService, /requireSafeContractReplacement\("\/api\/v1\/asset", hasPreviousSnapshot\)/);
  assert.match(universalModalService, /requireSafeContractReplacement\("\/api\/v1\/asset\/modal", hasPreviousSnapshot\)/);
  assert.match(portfolioService, /requireSafeContractReplacement\("\/api\/v1\/portfolio\/history", hasPreviousSnapshot\)/);
  assert.match(runtime, /assetDetailCache/);
  const apkMetadata = JSON.parse(apkMetadataText);
  assert.ok(build.includes(`versionCode = ${apkMetadata.versionCode}`));
  assert.ok(build.includes(`versionName = "${apkMetadata.versionName}"`));
}
console.log('cross-stack-contract-baseline-v336 ok');
