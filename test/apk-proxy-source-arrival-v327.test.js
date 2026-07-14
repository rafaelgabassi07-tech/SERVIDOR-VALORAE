import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';
import { VALORAE_ASSET_MODAL_DELIVERY_SCHEMA_VERSION } from '../lib/core/mobile-protocol.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const metadata = JSON.parse(fs.readFileSync(new URL('../metadata.json', import.meta.url), 'utf8'));
assert.equal(VALORAE_ASSET_MODAL_DELIVERY_SCHEMA_VERSION, '4');
assert.equal(pkg.valorae.publicVersion, '21.12.365');
assert.equal(pkg.valorae.releasePatch, '21.12.365-return-index-provider-parity-v333');
assert.equal(metadata.apkVersion, '2026.07.13.09');
assert.match(metadata.contractVersion, /asset modal delivery v4/i);

const delivery = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeAssetModalDelivery.kt');
const parser = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyAssetModalParsers.kt');
const loader = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalProgressiveLoader.kt');
const quality = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeAssetModalQuality.kt');
const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const build = readSiblingApkFile('app/build.gradle.kts');

if ([delivery, parser, loader, quality, protocol, build].every(Boolean)) {
  assert.match(delivery, /val settledSections: List<String>/);
  assert.match(delivery, /val emptyConfirmedSections: List<String>/);
  assert.match(delivery, /val notApplicableSections: List<String>/);
  assert.match(delivery, /val failedSections: List<String>/);
  assert.match(delivery, /val sectionStates: Map<String, String>/);
  assert.match(parser, /firstArray\("settledSections", "settled"\)/);
  assert.match(parser, /optJSONObject\("sectionStates"\)/);
  assert.match(loader, /delivery\.emptyConfirmedSections/);
  assert.match(loader, /delivery\.notApplicableSections/);
  assert.match(loader, /delivery\.failedSections/);
  assert.match(quality, /hasRenderableHistoricalData/);
  assert.match(quality, /hasRealComparisonSeries/);
  assert.match(quality, /points\.size >= 2/);
  assert.match(protocol, /AssetModalDeliverySchemaVersion = "4"/);
  assert.match(build, /versionCode = 26071309/);
  assert.match(build, /versionName = "2026\.07\.13\.09"/);
}

const runtime = fs.readFileSync(new URL('../lib/analysis/asset-modal-runtime.js', import.meta.url), 'utf8');
assert.match(runtime, /v19-modal-source-repair/);
assert.match(runtime, /function hasRenderableTableMap/);
assert.match(runtime, /function hasRealIndexComparison/);
assert.match(runtime, /function modalSectionArrival/);
assert.match(runtime, /EMPTY_CONFIRMED/);
assert.match(runtime, /NOT_APPLICABLE/);
assert.match(runtime, /sourceArrivalDiagnostics: true/);
assert.match(runtime, /schemaVersion: '4'/);

console.log('apk-proxy-source-arrival-v327 ok');
