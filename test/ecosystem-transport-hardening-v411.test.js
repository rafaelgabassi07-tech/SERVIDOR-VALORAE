import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RELEASE } from '../lib/core/release.js';
import { APK_COMPATIBILITY } from '../lib/core/apk-compatibility.js';
import { VALORAE_EXPOSE_HEADERS } from '../lib/core/mobile-protocol.js';
import { sendJson } from '../lib/core/http.js';
import { dispatchRoute } from '../routes/_router.js';
import syncHandler from '../routes/sync.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const expectedContract = 'valorae-ecosystem-2026.08.05.04-p404';
assert.equal(pkg.valorae.publicVersion, '21.12.404');
assert.equal(pkg.valorae.releasePatch, '21.12.404-account-profile-v413');
assert.equal(RELEASE.ecosystemContract, expectedContract);
assert.equal(APK_COMPATIBILITY.pairedVersion, '2026.08.08.07');
assert.ok(VALORAE_EXPOSE_HEADERS.includes('X-Valorae-Public-Version'));
assert.ok(VALORAE_EXPOSE_HEADERS.includes('X-Valorae-Core-Version'));

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
assert.equal(direct.getHeader('X-Valorae-Ecosystem-Contract'), expectedContract);
assert.equal(direct.getHeader('X-Valorae-Public-Version'), '21.12.404');
assert.equal(direct.getHeader('X-Valorae-Core-Version'), '21.12.0');

const ready = response();
await dispatchRoute({
  method: 'GET',
  url: '/api/v1/ready',
  headers: {
    'x-valorae-app': 'VALORAE Android',
    'x-valorae-channel': 'android',
    'x-valorae-app-version': '2026.08.08.07',
    'x-valorae-build': 'release',
    'x-valorae-app-id': 'com.aistudio.carteira.kxmpzq',
    'x-valorae-mobile-protocol': '2026.07.10.10',
    'x-valorae-ecosystem-contract': expectedContract,
    'x-request-id': 'transport-v411',
  },
  socket: { remoteAddress: '127.0.0.24' },
}, ready);
assert.equal(ready.statusCode, 200);
const payload = JSON.parse(ready.body);
assert.equal(payload.version, '21.12.404');
assert.equal(payload.publicVersion, '21.12.404');
assert.equal(payload.coreVersion, '21.12.0');
assert.equal(payload.ecosystemContract, expectedContract);
assert.equal(ready.getHeader('X-Valorae-Public-Version'), '21.12.404');
assert.equal(ready.getHeader('X-Valorae-Core-Version'), '21.12.0');


const mismatch = response();
await dispatchRoute({
  method: 'GET',
  url: '/api/v1/assets?tickers=PETR4',
  headers: {
    'x-valorae-app': 'VALORAE Android',
    'x-valorae-channel': 'android',
    'x-valorae-app-version': '2026.08.08.07',
    'x-valorae-build': 'release',
    'x-valorae-app-id': 'com.aistudio.carteira.kxmpzq',
    'x-valorae-mobile-protocol': '2026.07.10.10',
    'x-valorae-ecosystem-contract': 'valorae-ecosystem-incompatible',
    'x-request-id': 'transport-mismatch-v411',
  },
  socket: { remoteAddress: '127.0.0.25' },
}, mismatch);
assert.equal(mismatch.statusCode, 426);
assert.equal(JSON.parse(mismatch.body).code, 'ECOSYSTEM_CONTRACT_MISMATCH');

const previousContract = response();
await dispatchRoute({
  method: 'GET',
  url: '/api/v1/ready',
  headers: {
    'x-valorae-app': 'VALORAE Android',
    'x-valorae-channel': 'android',
    'x-valorae-app-version': '2026.08.05.01',
    'x-valorae-build': 'release',
    'x-valorae-app-id': 'com.aistudio.carteira.kxmpzq',
    'x-valorae-mobile-protocol': '2026.07.10.10',
    'x-valorae-ecosystem-contract': 'valorae-ecosystem-2026.08.05.01-p401',
    'x-request-id': 'transport-previous-v411',
  },
  socket: { remoteAddress: '127.0.0.26' },
}, previousContract);
assert.equal(previousContract.statusCode, 200);
assert.ok(JSON.parse(previousContract.body).compatibleEcosystemContracts.includes('valorae-ecosystem-2026.08.05.01-p401'));

const syncMismatch = response();
await syncHandler({
  method: 'GET',
  url: '/api/sync?action=health',
  query: { action: 'health' },
  headers: {
    'x-valorae-app': 'VALORAE Android',
    'x-valorae-channel': 'android',
    'x-valorae-app-version': '2026.08.08.07',
    'x-valorae-build': 'release',
    'x-valorae-app-id': 'com.aistudio.carteira.kxmpzq',
    'x-valorae-mobile-protocol': '2026.07.10.10',
    'x-valorae-ecosystem-contract': 'valorae-ecosystem-incompatible',
    'x-request-id': 'sync-transport-mismatch-v411',
  },
  socket: { remoteAddress: '127.0.0.27' },
}, syncMismatch);
assert.equal(syncMismatch.statusCode, 426);
assert.equal(JSON.parse(syncMismatch.body).code, 'ECOSYSTEM_CONTRACT_MISMATCH');

const syncPrevious = response();
await syncHandler({
  method: 'GET',
  url: '/api/sync?action=health',
  query: { action: 'health' },
  headers: {
    'x-valorae-app': 'VALORAE Android',
    'x-valorae-channel': 'android',
    'x-valorae-app-version': '2026.08.05.01',
    'x-valorae-build': 'release',
    'x-valorae-app-id': 'com.aistudio.carteira.kxmpzq',
    'x-valorae-mobile-protocol': '2026.07.10.10',
    'x-valorae-ecosystem-contract': 'valorae-ecosystem-2026.08.05.01-p401',
    'x-request-id': 'sync-transport-previous-v411',
  },
  socket: { remoteAddress: '127.0.0.28' },
}, syncPrevious);
assert.equal(syncPrevious.statusCode, 200);
assert.equal(JSON.parse(syncPrevious.body).contract, 'valorae-financial-sync-v2');

console.log('ecosystem transport hardening v411: ok');
