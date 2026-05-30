import assert from 'node:assert/strict';
import { ValoraeEngine } from '../lib/Valorae-engine.js';

const originalFetch = globalThis.fetch;

function investorHtml(ticker = 'PETR4') {
  return `<!doctype html><html><head><title>${ticker} | Investidor10</title></head><body>
    <h1>${ticker} Petrobras PN</h1>
    <section>
      Cotação R$ 32,45 Variação 1,25% Variação 12M 8,50%
      Dividend Yield 7,20% P/L 5,40 P/VP 1,20 ROE 18,70% ROIC 12,30%
      Valor de Mercado R$ 520 Bilhões Liquidez Média Diária R$ 1,2 Bilhão
      Lucro Líquido R$ 100 Bilhões Patrimônio Líquido R$ 430 Bilhões
    </section>
    <div class="description-text">Petrobras é uma companhia brasileira de energia.</div>
  </body></html>`;
}

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), { status: init.status || 200, headers: { 'content-type': 'application/json' } });
}

try {
  let calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET' });
    if (String(url).includes('/api/scrape')) {
      return jsonResponse({
        status: 200,
        results: {
          cells_titles: ['Cotação'],
          cells_values: ['R$ 32,45']
        }
      });
    }
    if (String(url).includes('investidor10.com.br')) {
      return new Response(investorHtml('PETR4'), { status: 200, headers: { 'content-type': 'text/html' } });
    }
    return jsonResponse({ chart: { result: [] } }, { status: 404 });
  };

  const completed = await ValoraeEngine.fetchAtivo('PETR4', 'ACAO', {
    profile: 'fast',
    view: 'app',
    valoraeScrapeUrl: 'https://proxy.local/api/scrape',
    cache: false,
    useYahooFallback: false,
    adaptiveCompletionTimeoutMs: 1200,
  });

  assert.equal(completed.status, 'OK');
  assert.equal(completed.partial, false);
  assert.ok(completed.metrics.extractionCompleteness.adaptiveCompletion.attempted, 'deve tentar complemento quando seletores rápidos são insuficientes');
  assert.ok(completed.metrics.extractionCompleteness.adaptiveCompletion.ok, 'complemento direto deve preencher campos');
  assert.ok(completed.metrics.extractionCompleteness.afterSnapshotKeys >= completed.metrics.extractionCompleteness.targetKeys);
  assert.ok(calls.some(c => c.method === 'GET' && c.url.includes('investidor10.com.br')), 'deve fazer DirectFetch adaptativo');

  // Sem ValoraeScrape e com DirectFetch pulado no perfil fast, o último snapshot real deve evitar uma resposta vazia/PARTIAL.
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET' });
    return jsonResponse({ chart: { result: [] } }, { status: 404 });
  };

  const hydrated = await ValoraeEngine.fetchAtivo('PETR4', 'ACAO', {
    profile: 'fast',
    view: 'app',
    cache: false,
    useYahooFallback: false,
    adaptiveCompletion: false,
  });

  assert.equal(hydrated.status, 'OK');
  assert.equal(hydrated.partial, false);
  assert.ok(hydrated.metrics.extractionCompleteness.bestSnapshotHydration.used, 'deve hidratar com último snapshot real');
  assert.ok(hydrated.bestSnapshotHydration.used);
  assert.equal(hydrated.appPayload.quote.price, 32.45);
  assert.ok(!calls.some(c => c.method === 'GET' && c.url.includes('investidor10.com.br')), 'perfil fast sem adaptiveCompletion não deve forçar DirectFetch');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('extraction-completion-v21-12-40 OK');
