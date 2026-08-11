import assert from 'node:assert/strict';
import { APK_COMPATIBILITY, evaluateApkCompatibility } from '../lib/core/apk-compatibility.js';
import { INVESTIDOR10_ANALYSIS_RANKINGS_VERSION } from '../lib/market/analysis-rankings-i10.js';

assert.equal(APK_COMPATIBILITY.pairedVersion, '2026.08.11.03');
assert.equal(APK_COMPATIBILITY.maxTestedVersion, '2026.08.11.03');
assert.equal(evaluateApkCompatibility('2026.08.11.03').status, 'PAIRED');
assert.equal(evaluateApkCompatibility('2026.08.09.07').status, 'SUPPORTED');
assert.equal(evaluateApkCompatibility('2026.08.09.06').status, 'SUPPORTED');
assert.equal(evaluateApkCompatibility('2026.08.11.04', { allowFuture: false }).reject, true);
assert.equal(INVESTIDOR10_ANALYSIS_RANKINGS_VERSION, '21.12.405-analysis-rankings-semantic-v3');
console.log('apk-v644-rankings-ui-compatibility: ok');
