import assert from 'node:assert/strict';
import fs from 'node:fs';
import assets from '../routes/assets.js';
import { clearValoraeCaches } from '../lib/Valorae-engine.js';

const RELEASE = '21.12.49-extreme-audit-logo-standard';
const originalFetch = globalThis.fetch;

function mockReq(url, query = {}) {
  return {
    method: 'GET',
    url,
    query,
    headers: {
      host: 'valorae-proxy.vercel.app',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': '127.0.0.1',
      'x-valorae-app': 'VALORAE Batch Audit',
      'x-valorae-channel': 'final-audit-corrections',
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    writableEnded: false,
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = String(v); },
    getHeader(k) { return this.headers[String(k).toLowerCase()]; },
    status(code) { this.statusCode = code; return this; },
    send(value = '') { this.body += String(value ?? ''); this.writableEnded = true; return this; },
    end(value = '') { this.body += String(value ?? ''); this.writableEnded = true; return this; },
  };
}

function htmlFor(ticker, price) {
  return `<!doctype html><html><body>
    <h1>${ticker} Empresa Teste</h1>
    <section>
      Cotação R$ ${price} Variação 1,25% Dividend Yield 7,20%
      P/L 5,40 P/VP 1,20 ROE 18,70% ROIC 12,30%
      Valor de Mercado R$ 520 Bilhões Liquidez Média Diária R$ 1,2 Bilhão
    </section>
    <div class="description-text">Descrição de ${ticker} para teste local.</div>
  </body></html>`;
}

try {
  clearValoraeCaches('all');
  globalThis.fetch = async (url) => {
    const u = String(url).toUpperCase();
    if (u.includes('VALE3')) return new Response(htmlFor('VALE3', '61,20'), { status: 200, headers: { 'content-type': 'text/html' } });
    return new Response(htmlFor('PETR4', '32,45'), { status: 200, headers: { 'content-type': 'text/html' } });
  };

  const response = mockRes();
  await assets(mockReq('/api/assets?tickers=PETR4,PETR4,VALE3&view=app&profile=portfolio&timeoutMs=800', {
    tickers: 'PETR4,PETR4,VALE3',
    view: 'app',
    profile: 'portfolio',
    timeoutMs: '800',
  }), response);
  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.count, 3, '/api/assets deve devolver uma posição para cada ticker solicitado');
  assert.equal(payload.stats.requested, 3);
  assert.equal(payload.stats.uniqueRequested, 2);
  assert.equal(payload.stats.deduped, 1);
  assert.deepEqual(payload.assets.map(a => a.ticker), ['PETR4', 'PETR4', 'VALE3']);

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const metadata = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));
  const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
  const sw = fs.readFileSync('public/service-worker.js', 'utf8');
  const html = fs.readFileSync('public/server.html', 'utf8');
  const openapi = fs.readFileSync('routes/openapi.js', 'utf8');
  assert.equal(pkg.valorae.releasePatch, RELEASE);
  assert.equal(metadata.releasePatch, RELEASE);
  assert.equal(manifest.version, '21.12.49');
  assert.match(sw, /valorae-proxy-server-v21-12-49/);
  assert.match(html, /21\.12\.48-monitor-responsive-settings-theme/);
  assert.match(openapi, /v21\.12\.48: Monitor Chart Rendering Boost/);
} finally {
  globalThis.fetch = originalFetch;
  clearValoraeCaches('all');
}

console.log('final-audit-corrections-v21-12-49 OK');
