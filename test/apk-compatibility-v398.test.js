import assert from 'node:assert/strict';
import { APK_COMPATIBILITY, compareApkVersions, evaluateApkCompatibility, normalizeApkVersion } from '../lib/core/apk-compatibility.js';
import { VALORAE_EXPOSE_HEADERS } from '../lib/core/mobile-protocol.js';

assert.equal(APK_COMPATIBILITY.pairedVersion, '2026.08.11.09');
assert.equal(APK_COMPATIBILITY.minSupportedVersion, '2026.07.30.01');
assert.equal(normalizeApkVersion('abc'), '');
assert.equal(compareApkVersions('2026.07.30.02', '2026.07.30.03'), -1);
assert.equal(evaluateApkCompatibility('2026.07.30.01').reject, false);
assert.equal(evaluateApkCompatibility('2026.07.30.01').status, 'SUPPORTED');
assert.equal(evaluateApkCompatibility('2026.07.30.02').status, 'SUPPORTED');
assert.equal(evaluateApkCompatibility('2026.08.08.04').status, 'SUPPORTED');
assert.equal(evaluateApkCompatibility('2026.08.08.14').status, 'SUPPORTED');
assert.equal(evaluateApkCompatibility('2026.08.11.09').status, 'PAIRED');
assert.equal(evaluateApkCompatibility('2026.08.11.10', { allowFuture: false }).reject, true);

const previousNodeEnv = process.env.NODE_ENV;
const previousVercel = process.env.VERCEL;
const previousRejectFuture = process.env.VALORAE_REJECT_UNTESTED_FUTURE_APK;
try {
  process.env.NODE_ENV = 'production';
  delete process.env.VERCEL;
  delete process.env.VALORAE_REJECT_UNTESTED_FUTURE_APK;
  assert.equal(evaluateApkCompatibility('2026.08.11.10').reject, true, 'produção deve rejeitar APK futuro não homologado por padrão');
  process.env.VALORAE_REJECT_UNTESTED_FUTURE_APK = '0';
  assert.equal(evaluateApkCompatibility('2026.08.11.10').reject, false, 'override explícito pode abrir janela futura');
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
  if (previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
  if (previousRejectFuture === undefined) delete process.env.VALORAE_REJECT_UNTESTED_FUTURE_APK; else process.env.VALORAE_REJECT_UNTESTED_FUTURE_APK = previousRejectFuture;
}

for (const header of ['X-Valorae-Apk-Compatibility','X-Valorae-Paired-Apk-Version','X-Valorae-Min-Apk-Version','X-Valorae-Max-Tested-Apk-Version']) assert.ok(VALORAE_EXPOSE_HEADERS.includes(header));
console.log('apk compatibility v400 backward-compatible OK');
