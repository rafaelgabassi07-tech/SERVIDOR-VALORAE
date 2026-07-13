import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveAssetModalFamily } from '../lib/analysis/asset-modal-contract.js';
import { alignComparisonSeriesToSharedWindow } from '../lib/analysis/asset-index-comparison.js';
import { _test as runtime } from '../lib/analysis/asset-modal-runtime.js';
import { _test as stock } from '../lib/analysis/stock-modal-contract.js';
import { _test as fii } from '../lib/analysis/fii-modal-contract.js';

assert.equal(resolveAssetModalFamily({ ticker: 'ABCD11', assetType: 'ACAO_UNIT' }).family, 'stock');
assert.equal(resolveAssetModalFamily({ ticker: 'TAEE11', assetType: 'FII' }).family, 'stock');
assert.equal(resolveAssetModalFamily({ ticker: 'MXRF11', assetType: 'FII' }).family, 'fii');

const stockTarget = stock.stockSectionRecoveryTargets({ recovery: true, requiredSections: 'announcements,indexComparison' });
assert.deepEqual([...stockTarget.sections], ['announcements', 'indexComparison']);
const fiiTarget = fii.fiiSectionRecoveryTargets({ recovery: true, requiredSections: 'announcements,indexComparison' });
assert.deepEqual([...fiiTarget.sections], ['announcements', 'indexComparison']);

const stockPayload = {
  quoteSummary: { price: 10 }, chart: { points: [{ close: 10 }, { close: 11 }] }, metrics: [{ value: '10' }],
  historicalIndicators: { rows: [{}] }, revenueProfitChart: { points: [{}] }, profitQuoteChart: { points: [{}] }, equityEvolutionChart: { points: [{}] },
  indexComparison: { series: [] }, announcements: { items: [] }
};
const quality = runtime.modalPayloadQualityProfile(stockPayload, 'stock');
assert.ok(quality.missingCriticalSections.includes('indexComparison'));
assert.ok(quality.missingCriticalSections.includes('announcements'));
assert.equal(runtime.isModalPayloadCacheable(stockPayload, 'stock'), false);

const aligned = alignComparisonSeriesToSharedWindow([
  { code: 'ASSET', points: [
    { timestamp: 100, value: 10 }, { timestamp: 200, value: 20 }, { timestamp: 300, value: 30 }, { timestamp: 400, value: 40 }
  ] },
  { code: 'IBOV', points: [
    { timestamp: 200, value: 5 }, { timestamp: 300, value: 10 }, { timestamp: 400, value: 15 }, { timestamp: 500, value: 20 }
  ] }
]);
assert.equal(aligned.length, 2);
assert.deepEqual(aligned.map(item => [item.points[0].timestamp, item.points.at(-1).timestamp]), [[200, 400], [200, 400]]);
assert.equal(aligned[0].points[0].value, 0);
assert.equal(aligned[1].points[0].value, 0);
assert.equal(aligned[0].points.length, 3);

const stockSource = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
const fiiSource = fs.readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');
assert.match(stockSource, /wantsAnnouncements/);
assert.match(stockSource, /wantsIndexComparison/);
assert.match(stockSource, /const periodMarketTasks = STOCK_COMPARISON_PERIODS\.map/);
assert.match(stockSource, /Promise\.all\(periodMarketTasks\.map/);
assert.match(fiiSource, /recoveryTarget\.sections\.has\('announcements'\)/);
assert.match(fiiSource, /recoveryTarget\.sections\.has\('indexComparison'\)/);
console.log('asset-modal-family-announcements-index-alignment-v320 ok');
