import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';
import { _test as runtimeTest } from '../lib/analysis/asset-modal-runtime.js';
import { setCache, clearCache } from '../lib/core/cache.js';

const apkHttp = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const apkUi = readSiblingApkFile('app/src/main/java/com/example/ui/AssetDetailsModalUi.kt');
const stockContract = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
const fiiContract = fs.readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');

if (apkHttp && apkUi) {
  assert.ok(apkHttp.includes('modalHttpCallTimeoutMs'), 'APK deve limitar timeout HTTP por chamada do modal');
  assert.ok(apkHttp.includes('call.timeout().timeout(requestTimeoutMs, TimeUnit.MILLISECONDS)'), 'APK deve usar timeout total por Call');
  assert.ok(!apkHttp.includes('.newBuilder()\n            .callTimeout(requestTimeoutMs'), 'APK deve reutilizar o OkHttpClient em vez de cloná-lo por request');
  assert.ok(apkUi.includes('loadSingleAssetModalProgressively') && apkUi.includes('onIntermediate = { fastReady -> state = fastReady }'), 'UI não deve trocar loading por erro temporário do fast enquanto full ainda está em andamento');
}

assert.ok(stockContract.includes('fastStageDeferred: true'), 'stock fast deve evitar canonical pesado');
assert.ok(stockContract.includes("status: 'DEFERRED'"), 'stock fast deve marcar blocos pesados como deferred');
assert.ok(fiiContract.includes('fastMode\n    ? ['), 'FII fast deve pular chamadas paralelas pesadas');
assert.ok(fiiContract.includes("reason: 'fast_stage_deferred'"), 'FII fast deve diferir comunicados/rotas pesadas');

const fullPayload = {
  ok: true,
  status: 'OK',
  stage: 'full',
  mode: 'full',
  updatedAt: '2026-07-09T23:59:00.000Z',
  ticker: 'PETR4',
  quoteSummary: { price: 38.5, priceDisplay: 'R$ 38,50' },
  chart: { points: [{ close: 38 }, { close: 38.5 }] }
};
const family = 'stock';
const ticker = 'PETR4';
const fastPayload = { ticker, stage: 'fast', range: '1D', interval: '5m', mobile: 'true', surface: 'single_asset_modal_stock' };
const fullPayloadForKey = { ...fastPayload, stage: 'full' };
clearCache();
setCache(runtimeTest.modalCacheKey({ family, ticker, payload: fullPayloadForKey }), fullPayload, 180_000, 900_000);
const crossKey = runtimeTest.modalCrossStageCacheKey({ family, ticker, payload: fastPayload });
assert.equal(crossKey, runtimeTest.modalCacheKey({ family, ticker, payload: fullPayloadForKey }), 'fast deve procurar o cache full equivalente antes de bater na rede');
assert.equal(runtimeTest.modalPayloadHasUsefulData(fullPayload), true);

console.log('asset-modal-runtime-hardening-v302 ok');
