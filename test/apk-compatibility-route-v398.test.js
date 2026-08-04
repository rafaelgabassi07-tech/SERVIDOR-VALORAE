import assert from 'node:assert/strict';
import { clearCache } from '../lib/core/cache.js';
import { dispatchRoute } from '../routes/_router.js';

function response() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    writableEnded: false,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    removeHeader(name) { headers.delete(String(name).toLowerCase()); },
    end(value = '') { this.body = String(value); this.writableEnded = true; return this; },
    status(code) { this.statusCode = code; return this; },
    send(value) { return this.end(value); },
  };
}

function apkHeaders(version) {
  return {
    'x-valorae-app': 'VALORAE Android',
    'x-valorae-channel': 'android',
    'x-valorae-app-version': version,
    'x-valorae-build': 'release',
    'x-valorae-app-id': 'com.aistudio.carteira.kxmpzq',
    'x-valorae-mobile-protocol': '2026.07.10.10',
    'x-request-id': `compat-${String(version).replaceAll('.', '-')}`,
  };
}

async function invoke(url, { method = 'GET', headers = {}, body } = {}) {
  const res = response();
  await dispatchRoute({ method, url, headers, body, socket: { remoteAddress: '127.0.0.21' } }, res);
  return res;
}

const invalid = await invoke('/api/v1/ready', { headers: apkHeaders('abc') });
assert.equal(invalid.statusCode, 200);
assert.equal(invalid.getHeader('X-Valorae-Apk-Compatibility'), 'INVALID');

const old = await invoke('/api/v1/ready', { headers: apkHeaders('2026.07.30.01') });
assert.equal(old.statusCode, 200);
assert.equal(old.getHeader('X-Valorae-Apk-Compatibility'), 'SUPPORTED');

const supported = await invoke('/api/v1/ready', { headers: apkHeaders('2026.07.30.03') });
assert.equal(supported.statusCode, 200);
assert.equal(supported.getHeader('X-Valorae-Apk-Compatibility'), 'SUPPORTED');

const paired = await invoke('/api/v1/ready', { headers: apkHeaders('2026.07.30.04') });
assert.equal(paired.statusCode, 200);
assert.equal(paired.getHeader('X-Valorae-Apk-Compatibility'), 'PAIRED');

clearCache();
const daily = await invoke('/api/v1/mobile/daily-close', {
  method: 'POST',
  headers: { ...apkHeaders('2026.07.30.04'), 'content-type': 'application/json' },
  body: { positions: [] },
});
assert.equal(daily.statusCode, 200);
assert.equal(daily.getHeader('X-Valorae-Cache'), 'MISS');
const dailyPayload = JSON.parse(daily.body);
assert.equal(dailyPayload.status, 'EMPTY');
assert.match(dailyPayload.idempotencyKey, /^daily-close:/);

const invalidSync = await invoke('/api/v1/sync', { method: 'POST', headers: { ...apkHeaders('abc'), 'content-type': 'application/json' }, body: {} });
assert.equal(invalidSync.statusCode, 426);
assert.equal(JSON.parse(invalidSync.body).code, 'APK_VERSION_INVALID');

const logoWithoutHeaders = await invoke('/api/v1/asset/logo?ticker=PETR4');
assert.notEqual(logoWithoutHeaders.statusCode, 403);

console.log('APK compatibility route and daily-close headers v400 OK');
