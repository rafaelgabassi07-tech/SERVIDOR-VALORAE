import assert from 'node:assert/strict';
import { APK_COMPATIBILITY, evaluateApkCompatibility } from '../lib/core/apk-compatibility.js';

assert.equal(APK_COMPATIBILITY.pairedVersion, '2026.08.11.02');
assert.equal(APK_COMPATIBILITY.maxTestedVersion, '2026.08.11.02');
assert.equal(evaluateApkCompatibility('2026.08.11.02').status, 'PAIRED');
assert.equal(evaluateApkCompatibility('2026.08.11.03', { allowFuture: false }).reject, true);
console.log('apk-v642-preview-stability-compatibility: ok');
