import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APK_COMPATIBILITY, evaluateApkCompatibility } from '../lib/core/apk-compatibility.js';
import { VALORAE_ANALYSIS_TICKER_ORDER } from '../lib/market/indices.js';

assert.equal(APK_COMPATIBILITY.pairedVersion, '2026.08.09.10');
assert.equal(APK_COMPATIBILITY.maxTestedVersion, '2026.08.09.10');
assert.equal(evaluateApkCompatibility('2026.08.09.10').status, 'PAIRED');
assert.equal(evaluateApkCompatibility('2026.08.09.05').status, 'SUPPORTED');
assert.equal(evaluateApkCompatibility('2026.08.09.11', { allowFuture: false }).reject, true);
assert.deepEqual(VALORAE_ANALYSIS_TICKER_ORDER, ['USD','IFIX','IDIV','SMLL','CDI','IPCA','IBOV','IVVB11']);
assert.ok(fs.existsSync(new URL('../docs/RELATORIO_COMPATIBILIDADE_APK_V643.md', import.meta.url)));
console.log('apk-v643-analysis-ux-compatibility: ok');
