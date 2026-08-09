import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APK_COMPATIBILITY, evaluateApkCompatibility } from '../lib/core/apk-compatibility.js';

assert.equal(APK_COMPATIBILITY.pairedVersion, '2026.08.09.10');
assert.equal(APK_COMPATIBILITY.maxTestedVersion, '2026.08.09.10');
assert.equal(evaluateApkCompatibility('2026.08.09.02').status, 'SUPPORTED');
assert.equal(evaluateApkCompatibility('2026.08.09.11', { allowFuture: false }).reject, true);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
assert.ok(fs.existsSync(path.join(root, 'docs', 'RELATORIO_COMPATIBILIDADE_APK_V639.md')));
for (const name of [
  'AUDIT_VALORAE_PROXY.md',
  'AUDIT_ANALYSIS_VALUE_SCALE_PROXY_V146_2026_06_28.md',
  'AUDIT_ANALISE_CLEAN_MOBILE_V47_2026_06_16.md',
  'AUDIT_APK_PROXY_CONTRACT_HARDENING_V115_2026_06_23.md'
]) {
  assert.equal(fs.existsSync(path.join(root, 'docs', 'archive', name)), false, `${name} should be deduplicated`);
}
console.log('OK: APK v639 compatibility and docs hygiene');
