import assert from 'node:assert/strict';
import { dispatchRoute } from '../routes/_router.js';
import { isCanonicalValoraeApkRequest } from '../lib/security/client-auth.js';

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

function apkHeaders(version = '2026.08.07.09') {
  return {
    'x-valorae-app': 'VALORAE Android',
    'x-valorae-channel': 'android',
    'x-valorae-app-version': version,
    'x-valorae-build': 'release',
    'x-valorae-app-id': 'com.aistudio.carteira.kxmpzq',
    'x-valorae-mobile-protocol': '2026.07.10.10',
    'x-request-id': 'connectivity-regression-v405',
  };
}

async function invoke(url, { method = 'GET', headers = {}, body } = {}) {
  const res = response();
  await dispatchRoute({ method, url, headers, body, socket: { remoteAddress: '127.0.0.45' } }, res);
  return res;
}

const previousAppId = process.env.VALORAE_ANDROID_APP_ID;
const previousProtocol = process.env.VALORAE_MOBILE_PROTOCOL;
const previousNodeEnv = process.env.NODE_ENV;
try {
  process.env.NODE_ENV = 'production';
  process.env.VALORAE_ANDROID_APP_ID = 'com.legacy.stale.application';
  process.env.VALORAE_MOBILE_PROTOCOL = '2025.01.01.stale';

  assert.equal(isCanonicalValoraeApkRequest({ headers: apkHeaders() }), true,
    'override antigo do ambiente não pode bloquear o contrato canônico embarcado');

  const ready = await invoke('/api/v1/ready', { headers: apkHeaders() });
  assert.equal(ready.statusCode, 200);
  assert.equal(ready.getHeader('x-valorae-mobile-protocol'), '2026.07.10.10');

  const alerts = await invoke('/api/v1/mobile/alerts', {
    method: 'POST',
    headers: { ...apkHeaders(), 'content-type': 'application/json' },
    body: { includeQuotes: true, includeDividends: true, includeNews: true, symbols: [], positions: [], transactions: [] },
  });
  assert.equal(alerts.statusCode, 200);
  assert.notEqual(JSON.parse(alerts.body).status, 'FORBIDDEN');

  const daily = await invoke('/api/v1/mobile/daily-close', {
    method: 'POST',
    headers: { ...apkHeaders(), 'content-type': 'application/json' },
    body: { positions: [] },
  });
  assert.equal(daily.statusCode, 200);
  assert.notEqual(JSON.parse(daily.body).status, 'FORBIDDEN');
} finally {
  if (previousAppId === undefined) delete process.env.VALORAE_ANDROID_APP_ID;
  else process.env.VALORAE_ANDROID_APP_ID = previousAppId;
  if (previousProtocol === undefined) delete process.env.VALORAE_MOBILE_PROTOCOL;
  else process.env.VALORAE_MOBILE_PROTOCOL = previousProtocol;
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
}

console.log('Proxy connectivity regression v405 OK');
