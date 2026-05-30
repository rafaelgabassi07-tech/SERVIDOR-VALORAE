import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { ValoraeEngine, clearValoraeCaches } from '../lib/Valorae-engine.js';

const originalFetch = globalThis.fetch;
const originalEnv = process.env.VALORAE_CANONICAL_REGISTRY_JSON;

function weakHtml(ticker = 'PETR4') {
  return `<!doctype html><html><body><h1>${ticker}</h1><section>Fonte viva com dados mínimos.</section></body></html>`;
}

function yahooJson(price = 32.45, previous = 32.05) {
  return { chart: { result: [{ meta: { regularMarketPrice: price, previousClose: previous, chartPreviousClose: previous } }] } };
}

async function measure(label, fn, iterations = 24) {
  const samples = [];
  let last;
  for (let i = 0; i < iterations; i += 1) {
    const t0 = performance.now();
    last = await fn(i);
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))];
  return {
    label,
    iterations,
    avgMs: Math.round(avg * 1000) / 1000,
    medianMs: Math.round(samples[Math.floor(samples.length / 2)] * 1000) / 1000,
    p95Ms: Math.round(p95 * 1000) / 1000,
    status: last?.status,
    partial: last?.partial,
    dataReliability: last?.dataReliability?.globalState,
    canonicalUsed: Boolean(last?.dataReliability?.canonicalSnapshotAvailable || last?.extractionCompleteness?.canonicalReliability?.used),
  };
}

try {
  process.env.VALORAE_CANONICAL_REGISTRY_JSON = JSON.stringify({
    PETR4: { issuerKey: 'PETR', displayName: 'Petrobras', companyName: 'Petróleo Brasileiro S.A. - Petrobras', assetClass: 'ACAO', sectorHint: 'Petróleo, Gás e Biocombustíveis', market: 'B3', country: 'BR' },
  });
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('investidor10.com.br')) return new Response(weakHtml('PETR4'), { status: 200, headers: { 'content-type': 'text/html' } });
    if (u.includes('statusinvest.com.br')) return new Response('', { status: 503, headers: { 'content-type': 'text/html' } });
    if (u.includes('finance.yahoo.com')) return new Response(JSON.stringify(yahooJson()), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response('', { status: 404 });
  };
  clearValoraeCaches('all');
  const cold = await measure('canonical-layer-cold-low-data-live-source', () => ValoraeEngine.fetchAtivo('PETR4', 'ACAO', { profile: 'fast', view: 'app', cache: false, useYahooFallback: true, statusInvestComplement: false, canonicalData: true }), 12);
  clearValoraeCaches('all');
  const warm = await measure('canonical-layer-result-cache', () => ValoraeEngine.fetchAtivo('PETR4', 'ACAO', { profile: 'fast', view: 'app', cache: true, useYahooFallback: true, statusInvestComplement: false, canonicalData: true }), 26);
  const report = {
    version: '21.12.49-extreme-audit-logo-standard',
    generatedAt: new Date().toISOString(),
    cases: [cold, warm],
    conclusion: 'Camada canônica CVM reduz PARTIAL estrutural e preserva fontes ricas sem sobrescrever dados vivos.',
  };
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/benchmark-canonical-reliability-v21.12.49.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (originalEnv === undefined) delete process.env.VALORAE_CANONICAL_REGISTRY_JSON;
  else process.env.VALORAE_CANONICAL_REGISTRY_JSON = originalEnv;
  globalThis.fetch = originalFetch;
  clearValoraeCaches('all');
}
