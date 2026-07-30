import assert from 'node:assert/strict';
import { dispatchRoute, _test as routerTest } from '../routes/_router.js';

function response() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    writableEnded: false,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    removeHeader(name) { headers.delete(String(name).toLowerCase()); },
    end(value = '') { this.body = Buffer.isBuffer(value) ? value : String(value); this.writableEnded = true; return this; },
    status(code) { this.statusCode = code; return this; },
    send(value) { return this.end(value); },
  };
}

function apk569Headers(extras = {}) {
  return {
    'x-valorae-app': 'VALORAE Android',
    'x-valorae-channel': 'android',
    'x-valorae-app-version': '2026.07.30.01',
    'x-valorae-build': 'release',
    'x-valorae-app-id': 'com.aistudio.carteira.kxmpzq',
    'x-valorae-mobile-protocol': '2026.07.10.10',
    'x-valorae-delivery-schema': '4',
    'x-request-id': `v569-regression-${Math.random().toString(16).slice(2)}`,
    ...extras,
  };
}

async function invoke(url, { method = 'GET', headers = apk569Headers(), body } = {}) {
  const res = response();
  await dispatchRoute({ method, url, headers, body, socket: { remoteAddress: `127.0.8.${Math.floor(Math.random() * 180) + 20}` } }, res);
  return res;
}

function parsedBody(res) {
  if (Buffer.isBuffer(res.body)) return {};
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

function assertNotTransportBlocked(res, route) {
  const body = parsedBody(res);
  assert.notEqual(res.statusCode, 426, `${route} não pode exigir atualização do APK v569`);
  assert.notEqual(res.statusCode, 403, `${route} não pode bloquear a identidade válida do APK v569`);
  assert.notEqual(body.code, 'APK_VERSION_UNSUPPORTED');
  assert.notEqual(body.code, 'APK_VERSION_INVALID');
  assert.notEqual(body.code, 'VALORAE_APK_REQUEST_REQUIRED');
}

const originalFetch = globalThis.fetch;
const previousVercel = process.env.VERCEL;
const previousRateDisabled = process.env.VALORAE_RATE_LIMIT_DISABLED;
globalThis.fetch = async () => { throw new Error('network disabled for transport hotfix regression test'); };
process.env.VERCEL = '1';
process.env.VALORAE_RATE_LIMIT_DISABLED = '1';
try {
  const ready = await invoke('/api/v1/ready');
  assert.equal(ready.statusCode, 200);
  assert.equal(ready.getHeader('X-Valorae-Apk-Compatibility'), 'SUPPORTED');

  const news = await invoke('/api/v1/news?limit=4&timeoutMs=400');
  assert.equal(news.statusCode, 200);
  assertNotTransportBlocked(news, 'news');

  const rankings = await invoke('/api/v1/market/rankings?limit=6&timeoutMs=400&fallbackTimeoutMs=250');
  assert.equal(rankings.statusCode, 200);
  assertNotTransportBlocked(rankings, 'market/rankings');
  assert.ok(Array.isArray(parsedBody(rankings).rankings?.altas));

  for (const route of ['/assets', '/asset/modal', '/portfolio/returns', '/market/rankings', '/news']) {
    assert.equal(routerTest.PRODUCTION_ROUTE_ALLOWLIST.has(route), true, `${route} precisa estar publicada em produção`);
    assert.equal(routerTest.acceptsLegacyApkIdentity(route, true), true, `${route} precisa aceitar a identidade do APK v569`);
    assert.equal(routerTest.shouldBlockApkCompatibility(route, { reject: true }), false, `${route} não pode usar 426 como bloqueio transversal`);
  }
  assert.equal(routerTest.shouldBlockApkCompatibility('/sync', { reject: true }), true, 'somente sync mantém bloqueio incompatível por segurança');


  const logo = await invoke('/api/v1/asset/logo?ticker=PETR4&v=5', { headers: {} });
  assert.notEqual(logo.statusCode, 403, 'logo carregado pelo Coil precisa funcionar sem headers customizados');
} finally {
  globalThis.fetch = originalFetch;
  if (previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
  if (previousRateDisabled === undefined) delete process.env.VALORAE_RATE_LIMIT_DISABLED; else process.env.VALORAE_RATE_LIMIT_DISABLED = previousRateDisabled;
}

console.log('transport regression hotfix v399 OK');
