import assert from 'node:assert/strict';
import {
  STOCK_MODAL_CRITICAL_SECTIONS,
  STOCK_MODAL_RECOVERABLE_SECTIONS,
  FII_MODAL_CRITICAL_SECTIONS,
  FII_MODAL_RECOVERABLE_SECTIONS,
} from '../lib/analysis/asset-modal-sections.js';
import { _test as runtime } from '../lib/analysis/asset-modal-runtime.js';
import fs from 'node:fs';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

function listFromKotlin(source, name) {
  const match = source.match(new RegExp(`${name}:[^=]*=\\s*listOf\\(([\\s\\S]*?)\\n\\)`));
  assert.ok(match, `lista Kotlin ausente: ${name}`);
  return [...match[1].matchAll(/"([A-Za-z0-9]+)"/g)].map(item => item[1]);
}

assert.equal(new Set(STOCK_MODAL_RECOVERABLE_SECTIONS).size, STOCK_MODAL_RECOVERABLE_SECTIONS.length);
assert.equal(new Set(FII_MODAL_RECOVERABLE_SECTIONS).size, FII_MODAL_RECOVERABLE_SECTIONS.length);
assert.ok(STOCK_MODAL_CRITICAL_SECTIONS.every(id => STOCK_MODAL_RECOVERABLE_SECTIONS.includes(id)));
assert.ok(FII_MODAL_CRITICAL_SECTIONS.every(id => FII_MODAL_RECOVERABLE_SECTIONS.includes(id)));
assert.equal(STOCK_MODAL_RECOVERABLE_SECTIONS.includes('financialCharts'), false, 'aggregate alias must not leak into public delivery');
assert.equal(new Map(runtime.stockModalSections({})).has('financialCharts'), false, 'runtime public section catalog must be canonical');

const stockDelivery = runtime.buildModalDelivery({
  assetType: 'ACAO', stage: 'full', status: 'PARTIAL',
  quoteSummary: { price: 10 }, chart: { points: [{ close: 9 }, { close: 10 }] }, metrics: [{ id: 'price', value: '10' }]
}, {
  family: 'stock', requestedMode: 'full', mode: 'full',
  requestPayload: { recovery: true, requestedRecoverySections: 'chart,company,financialCharts' }
});
assert.equal(stockDelivery.schemaVersion, '4', 'alignment is additive and backward compatible with delivery v4');
assert.deepEqual(stockDelivery.recoverableSections, STOCK_MODAL_RECOVERABLE_SECTIONS);
assert.deepEqual(stockDelivery.criticalSections, STOCK_MODAL_CRITICAL_SECTIONS);
assert.deepEqual(stockDelivery.requestedRecoverySections, ['chart', 'company', 'revenueProfitChart', 'profitQuoteChart', 'equityEvolutionChart']);
assert.equal(stockDelivery.maxRecoverySectionsPerRequest, 6);
assert.equal(stockDelivery.recoveryRetryAfterMs, 250);

const stockSource = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
const fiiSource = fs.readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');
assert.match(stockSource, /parseStockSectionList\(payload\.requestedRecoverySections\)/);
assert.match(fiiSource, /parseFiiSectionList\(payload\.requestedRecoverySections\)/);
assert.match(stockSource, /STOCK_MODAL_CRITICAL_SECTIONS, STOCK_MODAL_RECOVERABLE_SECTIONS/);
assert.match(fiiSource, /FII_MODAL_CRITICAL_SECTIONS, FII_MODAL_RECOVERABLE_SECTIONS/);

const apkQuality = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeAssetModalQuality.kt', { optional: true });
const apkDelivery = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeAssetModalDelivery.kt', { optional: true });
const apkParser = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyAssetModalParsers.kt', { optional: true });
const apkService = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeUniversalAssetModalService.kt', { optional: true });
if (apkQuality && apkDelivery && apkParser && apkService) {
  assert.deepEqual(listFromKotlin(apkQuality, 'StockModalCriticalSectionIds'), STOCK_MODAL_CRITICAL_SECTIONS);
  assert.deepEqual(listFromKotlin(apkQuality, 'StockModalRecoverableSectionIds'), STOCK_MODAL_RECOVERABLE_SECTIONS);
  assert.deepEqual(listFromKotlin(apkQuality, 'FiiModalCriticalSectionIds'), FII_MODAL_CRITICAL_SECTIONS);
  assert.deepEqual(listFromKotlin(apkQuality, 'FiiModalRecoverableSectionIds'), FII_MODAL_RECOVERABLE_SECTIONS);
  for (const field of ['recoverableSections', 'criticalSections', 'requestedRecoverySections', 'resolvedRecoverySections', 'remainingRecoverySections', 'maxRecoverySectionsPerRequest', 'recoveryRetryAfterMs']) {
    assert.ok(apkDelivery.includes(`val ${field}`), `APK delivery missing ${field}`);
    assert.ok(apkParser.includes(`"${field}"`), `APK parser missing ${field}`);
  }
  assert.ok(apkService.includes('put("requestedRecoverySections"'));
  assert.ok(apkService.includes('put("knownSettledSections"'));
}

console.log('asset modal contract alignment v428: OK');
