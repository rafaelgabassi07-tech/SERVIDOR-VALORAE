import assert from 'node:assert/strict';
import { dispatchRoute } from '../routes/_router.js';
import { RELEASE } from '../lib/core/release.js';

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

const futureHeaders = {
  'x-valorae-app': 'VALORAE Android',
  'x-valorae-channel': 'android',
  'x-valorae-app-version': '2026.08.11.03',
  'x-valorae-build': 'release',
  'x-valorae-app-id': 'com.aistudio.carteira.kxmpzq',
  'x-valorae-mobile-protocol': '2026.07.10.10',
  'x-valorae-ecosystem-contract': RELEASE.ecosystemContract,
  'x-valorae-sync-contract': 'valorae-financial-sync-v2',
  'content-type': 'application/json',
};
const res = response();
await dispatchRoute({
  method: 'POST', url: '/api/v1/sync', headers: futureHeaders,
  body: { action: 'download_financial_data' }, socket: { remoteAddress: '127.0.0.24' },
}, res);
const payload = JSON.parse(res.body || '{}');
assert.notEqual(payload.code, 'APK_VERSION_NOT_TESTED', 'future APK with matching ecosystem contract must not be rejected as untested');
assert.notEqual(res.statusCode, 426, 'matching ecosystem future APK must pass version gate');

const mismatch = response();
await dispatchRoute({
  method: 'POST', url: '/api/v1/sync', headers: { ...futureHeaders, 'x-valorae-ecosystem-contract': 'valorae-ecosystem-incompatible' },
  body: { action: 'download_financial_data' }, socket: { remoteAddress: '127.0.0.25' },
}, mismatch);
const mismatchPayload = JSON.parse(mismatch.body || '{}');
assert.equal(mismatch.statusCode, 426);
assert.equal(mismatchPayload.code, 'ECOSYSTEM_CONTRACT_MISMATCH');
console.log('future APK sync compatibility is contract-gated: OK');
