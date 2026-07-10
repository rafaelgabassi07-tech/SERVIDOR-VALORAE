import assert from 'node:assert/strict';
import { _test as runtimeTest } from '../lib/analysis/asset-modal-runtime.js';
import { _test as stockTest } from '../lib/analysis/stock-modal-contract.js';
import { _test as fiiTest } from '../lib/analysis/fii-modal-contract.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const apkService = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyAssetModalService.kt');
const apkLoader = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalProgressiveLoader.kt');
const apkUi = readSiblingApkFile('app/src/main/java/com/example/ui/AssetDetailsModalUi.kt');

assert.equal(runtimeTest.normalizeModalCacheMode({ stage: 'fast' }), 'fast');
assert.equal(runtimeTest.normalizeModalCacheMode({ stage: 'full' }), 'full');
assert.equal(runtimeTest.assetModalDeadlineMs({ stage: 'fast', timeoutMs: 9000 }), 4500);
assert.equal(runtimeTest.assetModalDeadlineMs({ stage: 'full', timeoutMs: 9000 }), 9000);

assert.equal(stockTest.normalizeStockModalStage({ stage: 'fast' }), 'fast');
assert.equal(stockTest.stockStageTimeoutMs({ stage: 'fast', timeoutMs: 9000 }), 4500);
assert.equal(stockTest.stockStageTimeoutMs({ stage: 'full', timeoutMs: 9000 }), 9000);
assert.equal(stockTest.deferredStockIndexComparison('PETR4').status, 'DEFERRED');

assert.equal(fiiTest.normalizeFiiModalStage({ stage: 'fast' }), 'fast');
assert.equal(fiiTest.fiiStageTimeoutMs({ stage: 'fast', timeoutMs: 9000 }), 4500);
assert.equal(fiiTest.deferredFiiIndexComparison('MXRF11').status, 'DEFERRED');

if (apkService && apkLoader && apkUi) {
  assert.ok(apkService.includes('val normalizedStage = stage.normalizedModalStage()'), 'APK deve preservar stage fast/full recebido pela UI');
  assert.ok(apkService.includes('"stage" to stage'), 'APK deve enviar stage real para o Proxy');
  assert.ok(apkLoader.includes('loadSingleAssetModalFast') && apkLoader.includes('loadSingleAssetModalFull'), 'APK deve preservar os dois estágios fast/full');
  assert.ok(apkUi.includes('loadSingleAssetModalProgressively') && apkUi.includes('onIntermediate = { incoming ->') && apkUi.includes('resolveSingleAssetModalProgressiveResult(visible, incoming)'), 'UI deve renderizar e mesclar cada resposta útil sem rebaixar o conteúdo já visível');
}

console.log('asset-modal-progressive-alignment-v301 ok');
