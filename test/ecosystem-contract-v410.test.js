import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
import { RELEASE } from '../lib/core/release.js';
import { APK_COMPATIBILITY } from '../lib/core/apk-compatibility.js';
import { sendJson } from '../lib/core/http.js';
import { dispatchRoute } from '../routes/_router.js';

const EXPECTED = 'valorae-ecosystem-2026.08.05.04-p404';
assert.equal(RELEASE.ecosystemContract, EXPECTED);
assert.equal(pkg.valorae.ecosystemContract, EXPECTED);
assert.equal(pkg.valorae.publicVersion, '21.12.404');
assert.equal(APK_COMPATIBILITY.pairedVersion, '2026.08.09.10');
assert.equal(APK_COMPATIBILITY.maxTestedVersion, '2026.08.09.10');

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

const direct = response();
sendJson({ method: 'GET', url: '/api/v1/test', headers: {} }, direct, { status: 'OK' });
assert.equal(direct.getHeader('X-Valorae-Ecosystem-Contract'), EXPECTED);

const ready = response();
await dispatchRoute({
  method: 'GET',
  url: '/api/v1/ready',
  headers: {
    'x-valorae-app': 'VALORAE Android',
    'x-valorae-channel': 'android',
    'x-valorae-app-version': '2026.08.09.10',
    'x-valorae-build': 'release',
    'x-valorae-app-id': 'com.aistudio.carteira.kxmpzq',
    'x-valorae-mobile-protocol': '2026.07.10.10',
    'x-valorae-ecosystem-contract': EXPECTED,
    'x-request-id': 'ecosystem-v410',
  },
  socket: { remoteAddress: '127.0.0.22' },
}, ready);
assert.equal(ready.statusCode, 200);
assert.equal(ready.getHeader('X-Valorae-Ecosystem-Contract'), EXPECTED);
assert.equal(ready.getHeader('X-Valorae-Apk-Compatibility'), 'PAIRED');
const payload = JSON.parse(ready.body);
assert.equal(payload.ecosystemContract, EXPECTED);
assert.equal(payload.publicVersion, '21.12.404');
assert.equal(payload.apkCompatibility.pairedVersion, '2026.08.09.10');

console.log('ecosystem contract v410: ok');
