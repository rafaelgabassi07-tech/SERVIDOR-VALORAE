import assert from 'node:assert/strict';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';
import { VALORAE_DYNAMIC_RENDER_VERSION, VALORAE_DYNAMIC_RENDER_POLICY, buildDynamicRenderManifest } from '../lib/scrape/dynamic-render-fallback.js';

const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const http = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const contract = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeDynamicRender.kt', { optional: true });
const build = readSiblingApkFile('app/build.gradle.kts');
const apkMetadataText = readSiblingApkFile('metadata.json');
if (protocol !== null || http !== null || contract !== null) {
  assert.ok(!protocol?.includes('HeaderDynamicRender'));
  assert.ok(!http?.includes('dynamicRenderVersion'));
  assert.equal(contract, null);
}
if (build && apkMetadataText) {
  const apkMetadata = JSON.parse(apkMetadataText);
  assert.ok(build.includes(`versionCode = ${apkMetadata.versionCode}`));
  assert.ok(build.includes(`versionName = "${apkMetadata.versionName}"`));
}
const manifest = buildDynamicRenderManifest();
assert.equal(manifest.safety.browserIsNeverMandatoryForFinancialContract, true);
assert.equal(manifest.runtime.optional, true);
console.log('cross-stack-dynamic-render-v341 ok');
