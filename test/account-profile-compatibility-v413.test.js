import assert from 'node:assert/strict';
import { RELEASE } from '../lib/core/release.js';
import { APK_COMPATIBILITY, evaluateApkCompatibility } from '../lib/core/apk-compatibility.js';

assert.equal(RELEASE.publicVersion, '21.12.404');
assert.equal(RELEASE.ecosystemContract, 'valorae-ecosystem-2026.08.05.04-p404');
assert.ok(RELEASE.compatibleEcosystemContracts.includes('valorae-ecosystem-2026.08.05.03-p403'));
assert.ok(RELEASE.compatibleEcosystemContracts.includes('valorae-ecosystem-2026.08.05.02-p402'));
assert.equal(APK_COMPATIBILITY.pairedVersion, '2026.08.08.04');
assert.equal(APK_COMPATIBILITY.maxTestedVersion, '2026.08.08.04');
assert.equal(evaluateApkCompatibility('2026.08.08.04').status, 'PAIRED');
assert.equal(evaluateApkCompatibility('2026.08.07.13').status, 'SUPPORTED');
assert.equal(evaluateApkCompatibility('2026.08.05.03').status, 'SUPPORTED');
console.log('ACCOUNT_PROFILE_COMPATIBILITY_V413_OK');
