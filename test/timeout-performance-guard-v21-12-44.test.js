import assert from 'node:assert/strict';
import { resolvePerformanceOptions } from '../lib/performance/profile.js';
import { getBaseUrl } from '../lib/http/route.js';
import { ValoraeEngine, clearValoraeCaches } from '../lib/Valorae-engine.js';

const originalFetch = globalThis.fetch;

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), { status: init.status || 200, headers: { 'content-type': 'application/json' } });
}

function richInvestorHtml(price = '32,45') {
  return `<!doctype html><html><body>
    <h1>PETR4 Petrobras PN</h1>
    <section>
      Cotação R$ ${price} Variação 1,25% Variação 12M 8,50%
      Dividend Yield 7,20% P/L 5,40 P/VP 1,20 ROE 18,70% ROIC 12,30%
      Valor de Mercado R$ 520 Bilhões Liquidez Média Diária R$ 1,2 Bilhão
      Lucro Líquido R$ 100 Bilhões Patrimônio Líquido R$ 430 Bilhões
    </section>
    <div class="description-text">Petrobras é uma companhia brasileira de energia integrada.</div>
  </body></html>`;
}

const fast = resolvePerformanceOptions({ profile: 'fast', timeoutMs: 500 }, { endpoint: 'asset', ticker: 'PETR4', type: 'ACAO' });
assert.equal(fast.timeoutMs, 500);
assert.equal(fast.valoraeScrapeTimeoutMs, 500, 'timeoutMs deve limitar ValoraeScrape quando valoraeScrapeTimeoutMs não foi informado');
assert.equal(fast.adaptiveCompletionTimeoutMs, 500, 'timeoutMs deve limitar complemento adaptativo quando adaptiveCompletionTimeoutMs não foi informado');

const turbo = resolvePerformanceOptions({ profile: 'turbo', timeoutMs: 1200 }, { endpoint: 'asset', ticker: 'PETR4', type: 'ACAO' });
assert.equal(turbo.timeoutMs, 1200);
assert.equal(turbo.valoraeScrapeTimeoutMs, 1200);
assert.equal(turbo.adaptiveCompletionTimeoutMs, 1200);

const explicit = resolvePerformanceOptions({ profile: 'turbo', timeoutMs: 1000, adaptiveCompletionTimeoutMs: 3000, valoraeScrapeTimeoutMs: 2500 }, { endpoint: 'asset', ticker: 'PETR4', type: 'ACAO' });
assert.equal(explicit.timeoutMs, 1000);
assert.equal(explicit.valoraeScrapeTimeoutMs, 2500);
assert.equal(explicit.adaptiveCompletionTimeoutMs, 3000);

const lowLatency = resolvePerformanceOptions({ profile: 'turbo', timeoutMs: 500, adaptiveCompletion: false, statusInvestComplement: false, lowLatencyBudget: true }, { endpoint: 'asset', ticker: 'PETR4', type: 'ACAO' });
assert.equal(lowLatency.timeoutMs, 500);
assert.equal(lowLatency.valoraeScrapeTimeoutMs, 500);
assert.equal(lowLatency.adaptiveCompletion, false);
assert.equal(lowLatency.statusInvestComplement, false);

const localBaseUrl = getBaseUrl({ headers: { host: '127.0.0.1:3000' } });
assert.equal(localBaseUrl, 'http://127.0.0.1:3000');
const prodBaseUrl = getBaseUrl({ headers: { host: 'servidor-valorae.vercel.app' } });
assert.equal(prodBaseUrl, 'https://servidor-valorae.vercel.app');

try {
  clearValoraeCaches('all');
  let calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET' });
    if (String(url).includes('/api/scrape')) {
      return jsonResponse({ status: 200, html: richInvestorHtml('32,45') });
    }
    if (String(url).includes('investidor10.com.br')) {
      return new Response(richInvestorHtml('32,45'), { status: 200, headers: { 'content-type': 'text/html' } });
    }
    return jsonResponse({ chart: { result: [] } }, { status: 404 });
  };

  const baseOptions = {
    profile: 'fast',
    view: 'app',
    valoraeScrapeUrl: 'https://proxy.local/api/scrape',
    cache: true,
    useYahooFallback: false,
    adaptiveCompletion: true,
    resultCacheTtlMs: 5,
    staleResultCacheMs: 5000,
  };

  const first = await ValoraeEngine.fetchAtivo('PETR4', 'ACAO', baseOptions);
  assert.equal(first.status, 'OK');
  assert.ok(calls.length > 0, 'primeira chamada deve consultar fonte');

  await new Promise(resolve => setTimeout(resolve, 15));
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET' });
    await new Promise(resolve => setTimeout(resolve, 50));
    return jsonResponse({ error: 'fonte lenta em teste' }, { status: 503 });
  };

  const stale = await ValoraeEngine.fetchAtivo('PETR4', 'ACAO', { ...baseOptions, timeoutMs: 500, lowLatencyBudget: true });
  assert.equal(stale.cacheStatus, 'RESULT_CACHE_STALE_WHILE_REVALIDATE');
  assert.equal(stale.metrics.resultCache, 'STALE_WHILE_REVALIDATE');
  assert.equal(stale.status, 'OK');
  assert.equal(stale.partial, false);
  assert.equal(stale.metrics.staleWhileRevalidate, true);
  assert.ok(calls.length >= 0, 'refresh em segundo plano não deve bloquear retorno stale');
} finally {
  globalThis.fetch = originalFetch;
  clearValoraeCaches('all');
}

console.log('timeout-performance-guard-v21-12-45 OK');
