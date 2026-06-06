import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dispatchRoute } from '../routes/_router.js';
import { _test as metricsTest } from '../lib/observability/server-metrics.js';

function mockGetReq(url) {
  return { method: 'GET', url, query: {}, headers: { host: 'example.vercel.app' }, socket: { remoteAddress: '127.0.0.1' } };
}
function mockRes() {
  return {
    statusCode: 200,
    body: '',
    headers: {},
    writableEnded: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = String(v); },
    getHeader(k) { return this.headers[String(k).toLowerCase()]; },
    removeHeader(k) { delete this.headers[String(k).toLowerCase()]; },
    status(c) { this.statusCode = c; return this; },
    send(b) { this.body += String(b ?? ''); this.writableEnded = true; return this; },
    end(b = '') { this.body += String(b ?? ''); this.writableEnded = true; return this; },
  };
}

const html = fs.readFileSync('public/server.html', 'utf8');
assert.equal(html, fs.readFileSync('public/index.html', 'utf8'), 'server.html e index.html devem permanecer espelhados');

for (const needle of [
  '21.12.35-monitor-data-fill',
  'loadIntegrationLive',
  'runDiagnosticsHealth',
  '/api/v1/integration/manifest',
  '/api/v1/integration/sdk',
  '/api/v1/integration/prompts',
  'Benchmark rápido será executado automaticamente',
  'Manifesto, SDK, prompts, readiness e fontes foram lidos via API',
]) assert.ok(html.includes(needle), `UI deve conter ${needle}`);

const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
assert.match(manifest.version, /^21\.12\.(35|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|54|55|56|57|58|59|60)$/);

for (const route of ['/api/integration/manifest', '/api/integration/sdk', '/api/integration/prompts', '/api/v1/integration/manifest', '/api/v1/integration/sdk', '/api/v1/integration/prompts', '/api/release/readiness', '/api/v1/release/readiness']) {
  assert.equal(metricsTest.isInternalTelemetryRoute(route), true, `${route} deve ser telemetria interna quando chamado pelo monitor`);
}

const sdkRes = mockRes();
await dispatchRoute(mockGetReq('/api/v1/integration/sdk'), sdkRes);
assert.equal(sdkRes.statusCode, 200);
const sdk = JSON.parse(sdkRes.body);
assert.ok(sdk.examples.javascript.includes("replace(/\\/$/, '')"), 'SDK deve manter regex válida para remover barra final da baseUrl');
assert.ok(!sdk.examples.javascript.includes('replace(//$/'), 'SDK não pode gerar regex quebrada replace(//$/');

console.log('monitor-data-fill-v21-12-35 ok');
