import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  VALORAE_HTTP_TRANSPORT_POLICY,
  VALORAE_HTTP_TRANSPORT_VERSION,
} from '../lib/http/provider-transport.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const http = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const contract = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeHttpTransport.kt');
const build = readSiblingApkFile('app/build.gradle.kts');
const apkMetadataText = readSiblingApkFile('metadata.json');
if (protocol && http && contract && build && apkMetadataText) {
  assert.ok(contract.includes(VALORAE_HTTP_TRANSPORT_VERSION));
  assert.ok(contract.includes(VALORAE_HTTP_TRANSPORT_POLICY));
  assert.ok(protocol.includes('HeaderHttpTransportAccept'));
  assert.ok(http.includes(VALORAE_HTTP_TRANSPORT_POLICY));
  assert.ok(http.includes('httpTransportVersion = header(ValoraeMobileProtocol.HeaderHttpTransport)'));
  assert.ok(http.includes('fun httpTransport()'));
  const apkMetadata = JSON.parse(apkMetadataText);
  assert.ok(build.includes(`versionCode = ${apkMetadata.versionCode}`));
  assert.ok(build.includes(`versionName = "${apkMetadata.versionName}"`));
}
assert.ok(fs.existsSync(new URL('./test/http-provider-transport-checkpoint113-v343.test.js', new URL('../', import.meta.url))));
console.log('cross-stack-http-transport-v343 ok');
