import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveClientAuth } from '../lib/security/client-auth.js';
import { VALORAE_REQUEST_HEADERS } from '../lib/core/mobile-protocol.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const metadata = JSON.parse(fs.readFileSync(new URL('../metadata.json', import.meta.url), 'utf8'));
assert.equal(pkg.valorae.apkVersion, metadata.apkVersion);
assert.equal(pkg.releaseMetadata.apkVersion, metadata.apkVersion);
assert.ok(metadata.contractVersion.includes(`APK ${metadata.apkCheckpoint.match(/^v\d+/)?.[0]} / Proxy ${pkg.valorae.publicVersion}`));
assert.ok(VALORAE_REQUEST_HEADERS.includes('X-Valorae-Client-Key'));

const savedKeys = process.env.VALORAE_CLIENT_KEYS;
try {
  process.env.VALORAE_CLIENT_KEYS = 'com.aistudio.carteira.kxmpzq:test-client-key';
  const authorized = resolveClientAuth({
    method: 'GET',
    url: '/api/v1/ready',
    headers: {
      'x-valorae-app-id': 'com.aistudio.carteira.kxmpzq',
      'x-valorae-client-key': 'test-client-key',
    },
  });
  assert.equal(authorized.ok, true);
  assert.equal(authorized.strategy, 'client_key');
  const rejected = resolveClientAuth({
    method: 'GET',
    url: '/api/v1/ready',
    headers: { 'x-valorae-app-id': 'com.aistudio.carteira.kxmpzq' },
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'missing_client_key_or_signature');
} finally {
  if (savedKeys === undefined) delete process.env.VALORAE_CLIENT_KEYS;
  else process.env.VALORAE_CLIENT_KEYS = savedKeys;
}

const apkMetadataText = readSiblingApkFile('metadata.json');
const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const http = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const sync = readSiblingApkFile('app/src/main/java/com/example/data/sync/ValoraeSyncClient.kt');
const catalog = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeProxyEndpointCatalog.kt');
if ([apkMetadataText, protocol, http, sync, catalog].every(Boolean)) {
  const apkMetadata = JSON.parse(apkMetadataText);
  assert.equal(apkMetadata.versionName, metadata.apkVersion);
  assert.ok(protocol.includes('HeaderClientKey = "X-Valorae-Client-Key"'));
  assert.ok(http.includes('BuildConfig.VALORAE_PROXY_CLIENT_KEY'));
  assert.ok(http.includes('builder.header(ValoraeMobileProtocol.HeaderClientKey, it)'));
  assert.ok(sync.includes('BuildConfig.VALORAE_PROXY_CLIENT_KEY'));
  assert.ok(sync.includes('header(ValoraeMobileProtocol.HeaderClientKey, it)'));
  assert.match(catalog, /\/api\/v1\/asset\/stock-modal[^\n]+sampleQuery/);
  assert.match(catalog, /\/api\/v1\/asset\/fii-modal[^\n]+sampleQuery/);
  assert.doesNotMatch(catalog, /\/api\/v1\/asset\/(?:stock|fii)-modal[^\n]+expectedForApk = false/);
}

console.log('apk-v546-proxy-alignment ok');
