import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  VALORAE_ASSET_MODAL_DELIVERY_SCHEMA_VERSION,
  VALORAE_MOBILE_CACHE_POLICY_SECONDS,
  VALORAE_MOBILE_PROTOCOL_VERSION,
  VALORAE_REQUEST_HEADERS,
  VALORAE_EXPOSE_HEADERS,
} from '../lib/core/mobile-protocol.js';
import { dispatchRoute } from '../routes/_router.js';
import { sendJson as sendPerformanceJson } from '../lib/performance/http.js';
import { _test as modalRuntimeTest, ASSET_MODAL_RUNTIME_VERSION } from '../lib/analysis/asset-modal-runtime.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const metadata = JSON.parse(fs.readFileSync(new URL('../metadata.json', import.meta.url), 'utf8'));
assert.equal(packageJson.valorae.publicVersion, '21.12.358');
assert.equal(packageJson.valorae.releasePatch, '21.12.358-modal-data-truth-audit-v326');
assert.equal(metadata.apkVersion, '2026.07.13.02');
assert.ok(metadata.contractVersion.includes('APK v506 / Proxy 21.12.358'));

assert.equal(VALORAE_MOBILE_PROTOCOL_VERSION, '2026.07.10.10');
assert.equal(VALORAE_ASSET_MODAL_DELIVERY_SCHEMA_VERSION, '3');
assert.equal(ASSET_MODAL_RUNTIME_VERSION, '26.asset-modal.runtime.v17-late-arrival-settlement');
assert.ok(VALORAE_REQUEST_HEADERS.includes('X-Valorae-Mobile-Protocol'));
assert.ok(VALORAE_EXPOSE_HEADERS.includes('X-Valorae-Mobile-Protocol'));
assert.equal(VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetModalFast, 35);
assert.equal(VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetModalFull, 180);
assert.equal(VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetModalFastStaleGrace, 120);
assert.equal(VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetModalFullStaleGrace, 900);

const fullPayload = { ok: true, status: 'OK', stage: 'full', mode: 'full', fullOnly: true };
const fastPayload = { ok: true, status: 'OK', stage: 'fast', mode: 'fast', fullOnly: false };
assert.equal(modalRuntimeTest.modalCacheTtlMs(fastPayload, 45_000), 35_000);
assert.equal(modalRuntimeTest.modalCacheTtlMs(fullPayload, 45_000), 180_000);
assert.equal(modalRuntimeTest.modalCacheStaleGraceMs(fastPayload), 120_000);
assert.equal(modalRuntimeTest.modalCacheStaleGraceMs(fullPayload), 900_000);
assert.equal(modalRuntimeTest.modalCacheStaleGraceMs(fastPayload, 999_000), 120_000, 'caller não pode ampliar stale além do protocolo');
assert.equal(modalRuntimeTest.modalCacheStaleGraceMs(fullPayload, 60_000), 60_000, 'caller pode reduzir stale de forma conservadora');

function plainResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    writableEnded: false,
    body: '',
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    removeHeader(name) { headers.delete(String(name).toLowerCase()); },
    end(value = '') { this.body = String(value); this.writableEnded = true; return this; },
    headers,
  };
}

const readyReq = {
  method: 'GET',
  url: '/api/v1/ready',
  headers: {
    origin: 'https://app.valorae.test',
    'x-request-id': 'protocol-v312-ready',
    'x-valorae-mobile-protocol': VALORAE_MOBILE_PROTOCOL_VERSION,
  },
};
const readyRes = plainResponse();
await dispatchRoute(readyReq, readyRes);
assert.equal(readyRes.getHeader('X-Valorae-Mobile-Protocol'), VALORAE_MOBILE_PROTOCOL_VERSION);
assert.equal(readyRes.getHeader('X-Valorae-Delivery-Schema'), VALORAE_ASSET_MODAL_DELIVERY_SCHEMA_VERSION);
assert.ok(String(readyRes.getHeader('Access-Control-Expose-Headers')).includes('X-Valorae-Mobile-Protocol'));
assert.equal(JSON.parse(readyRes.body).requestId, 'protocol-v312-ready');

const perfHeaders = new Map();
const perfRes = {
  statusCode: 200,
  setHeader(name, value) { perfHeaders.set(String(name).toLowerCase(), String(value)); },
  getHeader(name) { return perfHeaders.get(String(name).toLowerCase()); },
  removeHeader(name) { perfHeaders.delete(String(name).toLowerCase()); },
  status(code) { this.statusCode = code; return this; },
  send(value) { this.body = String(value); return this; },
  end(value = '') { this.body = String(value); return this; },
};
sendPerformanceJson({ method: 'GET', headers: {}, url: '/api/v1/test' }, perfRes, { status: 'OK' }, { cacheControl: 'private, max-age=10' });
assert.equal(perfRes.getHeader('X-Valorae-Mobile-Protocol'), VALORAE_MOBILE_PROTOCOL_VERSION);
assert.equal(perfRes.getHeader('X-Valorae-Delivery-Schema'), VALORAE_ASSET_MODAL_DELIVERY_SCHEMA_VERSION);

const routerSource = fs.readFileSync(new URL('../routes/_router.js', import.meta.url), 'utf8');
assert.ok(routerSource.includes("cachePolicySemantics: { freshness: 'seconds', staleGrace: 'seconds-after-freshness' }"));
assert.ok(routerSource.includes('analysisRouteCache.set(cacheKey, built, VALORAE_MOBILE_CACHE_POLICY_SECONDS.analysis * 1000)'));

const apkProtocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const apkCache = readSiblingApkFile('app/src/main/java/com/example/data/cache/ValoraeCachePolicy.kt');
const apkRuntime = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyRuntime.kt');
const apkUniversal = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeUniversalAssetModalService.kt');
const apkHttp = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const apkSync = readSiblingApkFile('app/src/main/java/com/example/data/sync/ValoraeSyncClient.kt');
if (apkProtocol && apkCache && apkRuntime && apkUniversal && apkHttp && apkSync) {
  assert.ok(apkProtocol.includes('const val Version = "2026.07.10.10"'));
  assert.ok(apkProtocol.includes('const val HeaderMobileProtocol = "X-Valorae-Mobile-Protocol"'));
  assert.ok(apkCache.includes('const val AssetModalFastStaleGraceMs = 2L * 60L * 1000L'));
  assert.ok(apkCache.includes('const val AssetModalFullStaleGraceMs = 15L * 60L * 1000L'));
  assert.ok(apkRuntime.includes('fun singleAssetModalStaleMaxAgeMs(stage: String)'));
  assert.ok(apkUniversal.includes('age <= singleAssetModalStaleMaxAgeMs(stage)'));
  assert.ok(!apkUniversal.includes('SingleAssetModalStaleMaxAgeMs = 30'));
  assert.ok(apkHttp.includes('ValoraeMobileProtocol.HeaderMobileProtocol'));
  assert.ok(apkHttp.includes('mobileProtocolVersion = header(ValoraeMobileProtocol.HeaderMobileProtocol)'));
  assert.ok(apkSync.includes('ValoraeMobileProtocol.HeaderMobileProtocol'));
}

console.log('apk-proxy-protocol-negotiation-v312 ok');
