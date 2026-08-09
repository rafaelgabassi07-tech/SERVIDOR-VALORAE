import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APK_COMPATIBILITY, evaluateApkCompatibility } from '../lib/core/apk-compatibility.js';
import { _test, getInvestidor10AnalysisRankingCatalog } from '../lib/market/analysis-rankings-i10.js';

assert.equal(APK_COMPATIBILITY.pairedVersion, '2026.08.09.07');
assert.equal(APK_COMPATIBILITY.maxTestedVersion, '2026.08.09.07');
assert.equal(evaluateApkCompatibility('2026.08.09.07').status, 'PAIRED');
assert.equal(evaluateApkCompatibility('2026.08.09.02').status, 'SUPPORTED');
assert.equal(evaluateApkCompatibility('2026.08.09.08', { allowFuture: false }).reject, true);

const catalog = getInvestidor10AnalysisRankingCatalog();
assert.equal(catalog.items.length, 19);
for (const id of [
  'STOCK_REVENUE','STOCK_NET_INCOME','STOCK_ROE','STOCK_PL_LOW','STOCK_30D_GAIN',
  'STOCK_12M_GAIN','STOCK_CASH','STOCK_PROFIT_GROWTH_5Y','STOCK_REVENUE_GROWTH_5Y'
]) assert.ok(_test.definitions[id], `${id} missing`);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
assert.ok(fs.existsSync(path.join(root, 'docs', 'RELATORIO_COMPATIBILIDADE_APK_V640.md')));
console.log('OK: APK v640 compatibility + analysis rankings semantic-v2');
