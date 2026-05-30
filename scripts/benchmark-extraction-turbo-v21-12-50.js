import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { ValoraeEngine, clearValoraeCaches } from '../lib/Valorae-engine.js';

const originalFetch = globalThis.fetch;

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), { status: init.status || 200, headers: { 'content-type': 'application/json' } });
}

function weakInvestorHtml() {
  return '<!doctype html><html><body><h1>PETR4 Petrobras PN</h1><section>Cotação R$ 32,45 Variação 1,25%</section></body></html>';
}

function richStatusInvestHtml() {
  return `<!doctype html><html><body><h1>PETR4 Petrobras PN</h1><section>
  Cotação R$ 32,45 Variação 1,25% Variação 12M 8,50% Dividend Yield 7,20% P/L 5,40 P/VP 1,20 ROE 18,70% ROIC 12,30%
  Valor de Mercado R$ 520 Bilhões Liquidez Média Diária R$ 1,2 Bilhão Lucro Líquido R$ 100 Bilhões Patrimônio Líquido R$ 430 Bilhões
  </section><div class="description-text">Petrobras é uma companhia brasileira de energia com atuação integrada.</div></body></html>`;
}

function percentile(values, p) {
  const arr = [...values].sort((a,b)=>a-b);
  return arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] || 0;
}

async function bench(name, loops, fn) {
  const times = [];
  let last = null;
  for (let i = 0; i < loops; i += 1) {
    const started = performance.now();
    last = await fn(i);
    times.push(performance.now() - started);
  }
  return {
    name,
    loops,
    avgMs: Number((times.reduce((a,b)=>a+b,0)/times.length).toFixed(3)),
    medianMs: Number(percentile(times, 0.5).toFixed(3)),
    p95Ms: Number(percentile(times, 0.95).toFixed(3)),
    lastStatus: last?.status,
    lastPartial: last?.partial,
    lastScore: last?.metrics?.extractionCompleteness?.score,
    lastSource: last?.metrics?.source,
  };
}

try {
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/api/scrape')) return jsonResponse({ status: 200, results: { cells_titles: ['Cotação'], cells_values: ['R$ 32,45'] } });
    if (u.includes('investidor10.com.br')) return new Response(weakInvestorHtml(), { status: 200, headers: { 'content-type': 'text/html' } });
    if (u.includes('statusinvest.com.br')) return new Response(richStatusInvestHtml(), { status: 200, headers: { 'content-type': 'text/html' } });
    return jsonResponse({ chart: { result: [] } }, { status: 404 });
  };

  clearValoraeCaches('all');
  const turboNoResultCache = await bench('turbo-complement-no-result-cache', 25, () => ValoraeEngine.fetchAtivo('PETR4', 'ACAO', {
    profile: 'turbo', view: 'app', valoraeScrapeUrl: 'https://proxy.local/api/scrape', cache: false, useYahooFallback: false, adaptiveCompletionTimeoutMs: 1600, statusInvestComplement: true,
  }));

  clearValoraeCaches('all');
  const first = await ValoraeEngine.fetchAtivo('PETR4', 'ACAO', {
    profile: 'turbo', view: 'app', valoraeScrapeUrl: 'https://proxy.local/api/scrape', cache: true, useYahooFallback: false, adaptiveCompletionTimeoutMs: 1600, statusInvestComplement: true,
  });
  const turboResultCacheHit = await bench('turbo-result-cache-hit', 50, () => ValoraeEngine.fetchAtivo('PETR4', 'ACAO', {
    profile: 'turbo', view: 'app', valoraeScrapeUrl: 'https://proxy.local/api/scrape', cache: true, useYahooFallback: false, adaptiveCompletionTimeoutMs: 1600, statusInvestComplement: true,
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    network: 'mocked/local-only',
    version: '21.12.51-post-benchmark-performance-hardening',
    baseline: { firstStatus: first.status, firstPartial: first.partial, firstScore: first.metrics?.extractionCompleteness?.score },
    cases: [turboNoResultCache, turboResultCacheHit],
    cacheStats: ValoraeEngine.cacheStats().caches,
  };
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/benchmark-extraction-turbo-v21.12.51.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  globalThis.fetch = originalFetch;
}
