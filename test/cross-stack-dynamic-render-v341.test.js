import assert from 'node:assert/strict';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';
import { VALORAE_DYNAMIC_RENDER_VERSION, VALORAE_DYNAMIC_RENDER_POLICY, buildDynamicRenderManifest } from '../lib/scrape/dynamic-render-fallback.js';

const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const http = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const contract = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeDynamicRender.kt');
const catalog = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeProxyEndpointCatalog.kt');
const build = readSiblingApkFile('app/build.gradle.kts');
if ([protocol, http, contract, catalog, build].every(Boolean)) {
  assert.ok(protocol.includes('HeaderDynamicRender'));
  assert.ok(protocol.includes('HeaderDynamicRenderAccept'));
  assert.ok(http.includes(VALORAE_DYNAMIC_RENDER_POLICY));
  assert.ok(http.includes('dynamicRenderVersion = header(ValoraeMobileProtocol.HeaderDynamicRender)'));
  assert.ok(contract.includes(VALORAE_DYNAMIC_RENDER_VERSION));
  assert.ok(contract.includes(VALORAE_DYNAMIC_RENDER_POLICY));
  assert.ok(catalog.includes('/api/v1/contract/dynamic-render'));
  assert.match(build, /versionCode = (?:2607150[4-8]|26072302)/);
}
const manifest = buildDynamicRenderManifest();
assert.equal(manifest.safety.browserIsNeverMandatoryForFinancialContract, true);
assert.equal(manifest.runtime.optional, true);
console.log('cross-stack-dynamic-render-v341 ok');
