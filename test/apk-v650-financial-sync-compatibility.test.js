import assert from 'node:assert/strict';
import { APK_COMPATIBILITY, evaluateApkCompatibility } from '../lib/core/apk-compatibility.js';
import { dispatchRoute } from '../routes/_router.js';

assert.equal(APK_COMPATIBILITY.pairedVersion, '2026.08.11.03');
assert.equal(APK_COMPATIBILITY.maxTestedVersion, '2026.08.11.03');
assert.equal(evaluateApkCompatibility('2026.08.11.03', { allowFuture: false }).status, 'PAIRED');
assert.equal(evaluateApkCompatibility('2026.08.11.03', { allowFuture: false }).reject, false);
assert.equal(evaluateApkCompatibility('2026.08.09.12', { allowFuture: false }).status, 'SUPPORTED');
assert.equal(evaluateApkCompatibility('2026.08.11.04', { allowFuture: false }).reject, true);

function response() {
  const headers = new Map();
  return {
    statusCode: 200, body: '', writableEnded: false,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    removeHeader(name) { headers.delete(String(name).toLowerCase()); },
    end(value = '') { this.body = String(value); this.writableEnded = true; return this; },
    status(code) { this.statusCode = code; return this; },
    send(value) { return this.end(value); },
  };
}

const res = response();
await dispatchRoute({
  method: 'POST',
  url: '/api/v1/sync',
  headers: {
    'x-valorae-app': 'VALORAE Android',
    'x-valorae-channel': 'android',
    'x-valorae-app-version': '2026.08.11.03',
    'x-valorae-build': 'release',
    'x-valorae-app-id': 'com.aistudio.carteira.kxmpzq',
    'x-valorae-mobile-protocol': '2026.07.10.10',
    'x-valorae-sync-contract': 'valorae-financial-sync-v2',
    'content-type': 'application/json',
  },
  body: { action: 'download_financial_data' },
  socket: { remoteAddress: '127.0.0.23' },
}, res);
const payload = JSON.parse(res.body || '{}');
assert.notEqual(res.statusCode, 426, 'v650 não pode ser bloqueada pelo gate de compatibilidade');
assert.notEqual(payload.code, 'APK_VERSION_NOT_TESTED');
console.log('APK v650 /sync compatibility gate OK:', res.statusCode, payload.code || payload.status || 'OK');
