import assert from 'node:assert/strict';
import fs from 'node:fs';
import assetHandler, { buildAssetRouteTimeoutPayload } from '../routes/asset.js';
import assetsHandler from '../routes/assets.js';
import { withRouteDeadline } from '../lib/http/route.js';

class MockRes {
  constructor() { this.headers = {}; this.statusCode = 200; this.body = undefined; }
  setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; return this; }
  getHeader(key) { return this.headers[String(key).toLowerCase()]; }
  status(code) { this.statusCode = code; return this; }
  json(value) { this.body = value; return this; }
  send(value) { this.body = value; return this; }
  end(value = '') { this.body = value; return this; }
}

function request(query = {}, url = '/api/v1/assets') {
  return {
    method: 'GET',
    query,
    body: undefined,
    url,
    headers: {
      host: 'valorae-proxy.vercel.app',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': '127.0.0.1',
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

function bodyOf(response) {
  if (typeof response.body === 'string') return JSON.parse(response.body || '{}');
  return response.body || {};
}

const started = Date.now();
const deadlineResult = await withRouteDeadline(
  () => new Promise(() => {}),
  25,
  () => ({ timeout: true })
);
assert.deepEqual(deadlineResult, { timeout: true });
assert.ok(Date.now() - started < 250, 'deadline defensivo precisa responder sem aguardar trabalho pendurado');

const timeoutPayload = buildAssetRouteTimeoutPayload({
  ticker: 'PETR4',
  type: 'Ação',
  view: 'app',
  routeDeadlineMs: 8500,
  requestId: 'test',
  profile: 'asset',
});
assert.equal(timeoutPayload.status, 'PARTIAL');
assert.equal(timeoutPayload.retryable, true);
assert.equal(timeoutPayload.appDataContract.canReplacePreviousSnapshot, false);
assert.equal(timeoutPayload.appDataContract.preservePreviousSnapshot, true);

const directSource = fs.readFileSync(new URL('../routes/asset.js', import.meta.url), 'utf8');
const routerSource = fs.readFileSync(new URL('../routes/_router.js', import.meta.url), 'utf8');
const assetsSource = fs.readFileSync(new URL('../routes/assets.js', import.meta.url), 'utf8');
const crossStackHelperSource = fs.readFileSync(new URL('./helpers/cross-stack-apk.js', import.meta.url), 'utf8');
assert.ok(directSource.includes('withRouteDeadline('), 'rota física asset precisa de deadline global');
assert.ok(routerSource.includes('legacyAssetTimeoutPayload'), 'router consolidado precisa de fallback de timeout');
assert.ok(routerSource.includes('() => buildAssetDetails(payload)'), 'buildAssetDetails legado precisa estar protegido pelo deadline');
assert.ok(directSource.includes('input.routeDeadlineMs || input.deadlineMs || input.timeoutMs'), 'timeoutMs explícito também deve limitar a duração total da rota física');
assert.ok(routerSource.includes('payload.routeDeadlineMs || payload.deadlineMs || payload.timeoutMs'), 'timeoutMs explícito também deve limitar a rota consolidada legada');
assert.ok(crossStackHelperSource.includes('if (!explicitApkRoot() && !strictCrossStackMode()) return null'), 'suíte autônoma não pode ler checkout APK global/desatualizado por acidente');
assert.ok(assetsSource.includes('batch.stats?.partial') && assetsSource.includes('(batch.errors || []).length'), 'batch parcial ou com erros não pode receber cache privado como resposta completa');

const previousDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
process.env.VALORAE_DISABLE_EXTERNAL = '1';
try {
  const response = new MockRes();
  const batchStarted = Date.now();
  await assetsHandler(request({ tickers: 'PETR4,HGLG11' }), response);
  const elapsed = Date.now() - batchStarted;
  const body = bodyOf(response);
  assert.equal(response.statusCode, 200);
  assert.equal(body.partial, true);
  assert.equal(body.stats.externalDisabled, true);
  assert.equal(body.stats.timeout, false);
  assert.equal(response.getHeader('cache-control'), 'no-store');
  assert.deepEqual(body.assets, []);
  assert.equal(body.errors.length, 2);
  assert.ok(body.errors.every(item => item.code === 'EXTERNAL_SOURCES_DISABLED'));
  assert.ok(elapsed < 300, `modo operacional sem fontes deve falhar rápido; elapsed=${elapsed}ms`);

  const degradedAssetResponse = new MockRes();
  await assetHandler(request({ ticker: 'PETR4', timeoutMs: '600' }, '/api/asset?ticker=PETR4'), degradedAssetResponse);
  const degradedAssetBody = bodyOf(degradedAssetResponse);
  assert.equal(degradedAssetResponse.statusCode, 200);
  assert.equal(degradedAssetBody.appResponseIntegrity?.cacheSafe, false);
  assert.match(String(degradedAssetResponse.getHeader('cache-control') || ''), /^no-store/);

  const invalidResponse = new MockRes();
  await assetHandler(request({}, '/api/asset'), invalidResponse);
  assert.equal(invalidResponse.statusCode, 400, 'validação do ticker deve permanecer anterior ao trabalho externo');
} finally {
  if (previousDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = previousDisableExternal;
}

console.log('asset route deadline/cross-stack v318 ok');
