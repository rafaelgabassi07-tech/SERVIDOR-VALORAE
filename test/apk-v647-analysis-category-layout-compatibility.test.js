import assert from 'node:assert/strict';
import { APK_COMPATIBILITY, evaluateApkCompatibility } from '../lib/core/apk-compatibility.js';

assert.equal(APK_COMPATIBILITY.pairedVersion, '2026.08.11.06');
assert.equal(APK_COMPATIBILITY.maxTestedVersion, '2026.08.11.06');
assert.equal(evaluateApkCompatibility('2026.08.11.06').status, 'PAIRED');
assert.equal(evaluateApkCompatibility('2026.08.09.09').status, 'SUPPORTED');
assert.equal(evaluateApkCompatibility('2026.08.11.07', { allowFuture: false }).reject, true);

console.log('apk-v647-analysis-category-layout-compatibility: ok');
