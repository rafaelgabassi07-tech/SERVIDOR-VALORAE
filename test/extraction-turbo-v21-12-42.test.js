import assert from 'node:assert/strict';
import { ValoraeEngine, clearValoraeCaches } from '../lib/Valorae-engine.js';

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

try {
  clearValoraeCaches('all');
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, method: init.method || 'GET' });
    if (u.includes('/api/scrape')) {
      return jsonResponse({
        status: 200,
        results: { cells_titles: ['Cotação'], cells_values: ['R$ 32,45'] },
      });
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
  assert.equal(payload.metrics.performanceProfile, 'turbo');
  assert.ok(payload.metrics.extractionCompleteness.score >= payload.metrics.extractionCompleteness.threshold);
  assert.ok(payload.metrics.extractionCompleteness.statusInvestComplement.attempted, 'deve tentar complemento StatusInvest quando Investidor10 segue incompleto');
  assert.ok(payload.metrics.extractionCompleteness.statusInvestComplement.ok, 'complemento StatusInvest deve preencher campos ausentes');
  assert.ok(payload.metrics.extractionCompleteness.criticalFields.presentCriticalFields.includes('roe'));
  assert.match(payload.metrics.source, /StatusInvestComplement/);
  assert.ok(calls.some(c => c.url.includes('statusinvest.com.br')), 'deve consultar StatusInvest apenas como complemento sob demanda');
  assert.equal(ValoraeEngine.cacheStats().performance.profiles.turbo.statusInvestComplement, true);
} finally {
  globalThis.fetch = originalFetch;
  clearValoraeCaches('all');
}

console.log('extraction-turbo-v21-12-42 OK');
