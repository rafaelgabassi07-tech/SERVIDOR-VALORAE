import assert from 'node:assert/strict';
import { ValoraeEngine, clearValoraeCaches } from '../lib/Valorae-engine.js';
import { recordRequestStart, recordResponse, getServerMetricsSnapshot, resetServerMetricsForTests } from '../lib/observability/server-metrics.js';

const originalFetch = globalThis.fetch;

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), { status: init.status || 200, headers: { 'content-type': 'application/json' } });
}

function weakInvaloraerHtml() {
  return `<!doctype html><html><body>
    <h1>PETR4 Petrobras PN</h1>
    <section>Cotação R$ 32,45 Variação 1,25%</section>
  </body></html>`;
}

function richStatusInvestHtml() {
  return `<!doctype html><html><body>
    <h1>PETR4 Petrobras PN</h1>
    <section>
      Cotação R$ 32,45 Variação 1,25% Variação 12M 8,50%
      Dividend Yield 7,20% P/L 5,40 P/VP 1,20 ROE 18,70% ROIC 12,30%
      Valor de Mercado R$ 520 Bilhões Liquidez Média Diária R$ 1,2 Bilhão
      Lucro Líquido R$ 100 Bilhões Patrimônio Líquido R$ 430 Bilhões
    </section>
    <div class="description-text">Petrobras é uma companhia brasileira de energia com atuação integrada.</div>
  </body></html>`;
}

function fakeReq(url = '/api/asset?ticker=PETR4&view=app&profile=turbo') {
  return {
    method: 'GET',
    url,
    headers: {
      'user-agent': 'Mozilla/5.0 VALORAE Test',
      'x-valorae-app': 'VALORAE Monitor Test',
      'x-valorae-channel': 'final-audit-corrections',
      host: 'localhost:3000',
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

function fakeRes() {
  const headers = new Map();
  headers.set('content-type', 'application/json');
  headers.set('content-length', '2048');
  return {
    statusCode: 200,
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
  };
}

try {
  resetServerMetricsForTests();
  clearValoraeCaches('all');
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, method: init.method || 'GET' });
    if (u.includes('/api/scrape')) {
      return jsonResponse({ status: 200, results: { cells_titles: ['Cotação'], cells_values: ['R$ 32,45'] } });
    }
    if (u.includes('investidor10.com.br')) {
      return new Response(weakInvaloraerHtml(), { status: 200, headers: { 'content-type': 'text/html' } });
    }
    if (u.includes('statusinvest.com.br')) {
      return new Response(richStatusInvestHtml(), { status: 200, headers: { 'content-type': 'text/html' } });
    }
    return jsonResponse({ chart: { result: [] } }, { status: 404 });
  };

  const payload = await ValoraeEngine.fetchAtivo('PETR4', 'ACAO', {
    profile: 'turbo',
    view: 'app',
    valoraeScrapeUrl: 'https://proxy.local/api/scrape',
    cache: false,
    useYahooFallback: false,
    adaptiveCompletionTimeoutMs: 1600,
    statusInvestComplement: true,
  });

  assert.equal(payload.status, 'OK');
  assert.equal(payload.partial, false);
  assert.equal(payload.metrics.extractionCompleteness.statusInvestHedge.enabled, true);
  assert.equal(payload.metrics.extractionCompleteness.statusInvestHedge.ok, true);
  assert.equal(payload.metrics.extractionCompleteness.statusInvestHedge.enabled, true, 'metrics deve registrar hedge StatusInvest');
  assert.ok(calls.some(c => c.url.includes('statusinvest.com.br')), 'deve consultar StatusInvest no modo turbo');

  const req = fakeReq();
  const res = fakeRes();
  recordRequestStart(req, { route: 'asset' });
  recordResponse(req, res, payload, { status: 200, route: 'asset', cacheStatus: payload.cacheStatus, sourceStatus: payload.status });
  const metrics = getServerMetricsSnapshot();
  const event = metrics.proxyOutputMonitor.outputFeed.find(e => e.route === 'asset') || metrics.recentEvents[0];
  assert.ok(event, 'monitor deve registrar evento de saída do proxy');
  assert.equal(event.payloadSignals.performanceProfile, 'turbo');
  assert.equal(event.payloadSignals.extractionComplete, true);
  assert.ok(event.payloadSignals.extractionCompletenessScore >= event.payloadSignals.extractionCompletenessThreshold);
  assert.equal(event.payloadSignals.statusInvestHedged, true);
  assert.equal(event.payloadSignals.statusInvestHedgeOk, true);

  const batch = await ValoraeEngine.fetchAtivosBatch(['PETR4', 'PETR4', 'PETR4'], {
    profile: 'portfolio',
    view: 'app',
    valoraeScrapeUrl: 'https://proxy.local/api/scrape',
    cache: true,
    useYahooFallback: false,
    adaptiveCompletion: false,
  });
  assert.equal(batch.stats.requested, 3);
  assert.equal(batch.stats.uniqueRequested, 1);
  assert.equal(batch.stats.deduped, 2);
  assert.equal(batch.assets.length, 3, 'batch deve devolver uma posição para cada ticker solicitado');
} finally {
  globalThis.fetch = originalFetch;
  clearValoraeCaches('all');
  resetServerMetricsForTests();
}

console.log('extraction-performance-harmony-v21-12-42 OK');
