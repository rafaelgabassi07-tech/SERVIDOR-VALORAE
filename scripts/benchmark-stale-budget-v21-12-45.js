import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { ValoraeEngine, clearValoraeCaches, getValoraeRuntimeStats } from '../lib/Valorae-engine.js';

const originalFetch = globalThis.fetch;

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), { status: init.status || 200, headers: { 'content-type': 'application/json' } });
}

function richInvaloraerHtml(price = '32,45') {
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

async function bench(name, loops, fn) {
  const times = [];
  let last = null;
  for (let i = 0; i < loops; i += 1) {
    const started = performance.now();
    last = await fn(i);
    times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);
  const avg = times.reduce((sum, v) => sum + v, 0) / times.length;
  return {
    name,
    loops,
    avgMs: Number(avg.toFixed(3)),
    medianMs: Number(times[Math.floor(times.length / 2)].toFixed(3)),
    p95Ms: Number(times[Math.floor(times.length * 0.95)].toFixed(3)),
    lastCacheStatus: last?.cacheStatus,
    lastStatus: last?.status,
    lastPartial: last?.partial,
  };
}

try {
  clearValoraeCaches('all');
  let sourceMode = 'fresh';
  let liveCalls = 0;
  globalThis.fetch = async (url, init = {}) => {
    liveCalls += 1;
    const u = String(url);
    if (sourceMode === 'slow-fail') {
      await new Promise(resolve => setTimeout(resolve, 45));
      return jsonResponse({ error: 'simulated slow source' }, { status: 503 });
    }
    if (u.includes('/api/scrape')) return jsonResponse({ status: 200, html: richInvaloraerHtml() });
    if (u.includes('investidor10.com.br')) return new Response(richInvaloraerHtml(), { status: 200, headers: { 'content-type': 'text/html' } });
    return jsonResponse({ chart: { result: [] } }, { status: 404 });
  };

  const options = {
    profile: 'fast',
    view: 'app',
    valoraeScrapeUrl: 'https://proxy.local/api/scrape',
    cache: true,
    useYahooFallback: false,
    adaptiveCompletion: true,
    resultCacheTtlMs: 8,
    staleResultCacheMs: 60_000,
  };

  const cold = await bench('cold-fresh-fill', 1, () => ValoraeEngine.fetchAtivo('PETR4', 'ACAO', options));
  await new Promise(resolve => setTimeout(resolve, 20));
  sourceMode = 'slow-fail';
  const beforeStaleCalls = liveCalls;
  const stale = await bench('stale-while-revalidate-low-latency', 30, () => ValoraeEngine.fetchAtivo('PETR4', 'ACAO', { ...options, timeoutMs: 500, lowLatencyBudget: true }));
  const report = {
    generatedAt: new Date().toISOString(),
    network: 'mocked/local-only',
    version: '21.12.48-monitor-responsive-settings-theme',
    cases: [cold, stale],
    sourceCallsDuringStaleBench: liveCalls - beforeStaleCalls,
    runtimeCacheStats: getValoraeRuntimeStats().caches.assetResult,
  };
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/benchmark-stale-budget-v21.12.48.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  clearValoraeCaches('all');
}
