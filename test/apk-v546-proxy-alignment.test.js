import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VALORAE_REQUEST_HEADERS } from '../lib/core/mobile-protocol.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const metadata = JSON.parse(fs.readFileSync(new URL('../metadata.json', import.meta.url), 'utf8'));
assert.equal(pkg.valorae.apkVersion, metadata.apkVersion);
assert.equal(pkg.releaseMetadata.apkVersion, metadata.apkVersion);
assert.ok(metadata.contractVersion.includes(`APK ${metadata.apkCheckpoint.match(/^v\d+/)?.[0]} / Proxy ${pkg.valorae.publicVersion}`));
for (const header of ['X-Valorae-App', 'X-Valorae-Channel', 'X-Valorae-App-Id', 'X-Valorae-Mobile-Protocol']) {
  assert.ok(VALORAE_REQUEST_HEADERS.includes(header));
}
assert.equal(VALORAE_REQUEST_HEADERS.includes('X-Valorae-Client-Key'), false);

const apkMetadataText = readSiblingApkFile('metadata.json');
const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const jsonPayload = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeJsonPayload.kt');
const http = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const sync = readSiblingApkFile('app/src/main/java/com/example/data/sync/ValoraeSyncClient.kt');
const modalService = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeUniversalAssetModalService.kt');
const modalRuntime = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalRuntime.kt');
if ([apkMetadataText, protocol, jsonPayload, http, sync, modalService, modalRuntime].every(Boolean)) {
  const apkMetadata = JSON.parse(apkMetadataText);
  assert.equal(apkMetadata.versionName, metadata.apkVersion);
  assert.ok(!protocol.includes('HeaderSignature'));
  assert.ok(!protocol.includes('HeaderNonce'));
  assert.ok(!protocol.includes('VALORAE_PROXY_CLIENT_KEY'));
  assert.equal(protocol.includes('HeaderClientKey'), false);
  assert.ok(jsonPayload.includes('canonicalBody'));
  assert.ok(!jsonPayload.includes('HmacSHA256'));
  assert.ok(!http.includes('VALORAE_PROXY_CLIENT_KEY'));
  assert.ok(!sync.includes('VALORAE_PROXY_CLIENT_KEY'));
  assert.equal(http.includes('HeaderClientKey'), false);
  assert.equal(sync.includes('HeaderClientKey'), false);
  assert.ok(modalService.includes('"/api/v1/asset/modal"'));
  assert.equal(modalRuntime.includes('/api/v1/asset/stock-modal'), false);
  assert.equal(modalRuntime.includes('/api/v1/asset/fii-modal'), false);
  assert.equal(modalRuntime.includes('loadSingleAssetModalContractLegacy'), false);
}

console.log('apk-v546-proxy-alignment ok');
