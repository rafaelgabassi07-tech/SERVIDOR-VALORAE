process.env.VALORAE_DISABLE_EXTERNAL = '1';
import assert from 'node:assert/strict';
import { buildAssetDetails, getAssetHistory } from '../lib/sources/asset-details.js';

const history = await getAssetHistory({ ticker: 'PETR4', range: '1Y', timeoutMs: 10 });
assert.equal(history.ticker, 'PETR4');
assert.ok(Array.isArray(history.points));
assert.ok(Array.isArray(history.chartHistory));

const details = await buildAssetDetails({ ticker: 'PETR4', range: '1Y', timeoutMs: 10 });
assert.equal(details.ticker, 'PETR4');
assert.ok(details.assetChartBundle);
assert.equal(details.assetChartBundle.ticker, 'PETR4');
assert.ok(Array.isArray(details.assetChartBundle.priceHistory));
assert.ok(details.results.assetChartBundle);
assert.ok(details.appPayload.charts.assetChartBundle);
assert.ok('indicators' in details);
