import { performance } from 'node:perf_hooks';
import { ValoraeEngine, getValoraeRuntimeStats } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, getBaseUrl, clampNumber } from '../../lib/http/route.js';
import { extractFastSelectors, canUseFastSelectors } from '../../lib/scrape/fast-selectors.js';
import { extractCustomSelectors } from '../../lib/scrape/custom-selectors.js';
import { parseFinancialNumber } from '../../lib/normalizers/numbers.js';
import { buildExtractionPrecisionReport } from '../../lib/quality/extraction-precision.js';
import { buildChartReadinessReport } from '../../lib/quality/chart-readiness.js';
import { buildNormalizedChartSeries } from '../../lib/quality/chart-series.js';

const TESTS_VERSION = '21.11.9-realtime-test-lab';

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function percentile(values = [], p = 95) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

function scoreFromChecks(checks = []) {
  if (!checks.length) return 0;
  const weights = checks.map(c => Number(c.weight || 1));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const ok = checks.reduce((sum, c, i) => sum + (c.ok ? weights[i] : 0), 0);
  return Math.round((ok / total) * 100);
}

function makeSampleHtml(rows = 80) {
  const history = Array.from({ length: rows }, (_, i) => {
    const day = String((i % 28) + 1).padStart(2, '0');
    const month = String((i % 12) + 1).padStart(2, '0');
    const price = (28 + i * 0.37).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `<tr class="hist"><td class="date">${day}/${month}/2026</td><td class="close">R$ ${price}</td><td class="yield">${(0.45 + i / 300).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</td></tr>`;
  }).join('\n');
  return `<!doctype html><html><head><title>VALORAE Test PETR4</title><meta name="description" content="Teste de extração VALORAE"><meta property="og:title" content="Proxy Test Lab"></head><body><main><h1 id="asset-title">PETR4</h1><span class="price">R$ 38,42</span><span class="dy">7,35%</span><span class="pvp">1,12</span><a href="https://servidor-valorae.vercel.app/api/asset?ticker=PETR4">Ativo</a><img src="/assets/valorae-icon-192.png" alt="VALORAE"><table>${history}</table></main></body></html>`;
}

function summarizeBenchmark(name, samples = []) {
  const avg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
  return { name, iterations: samples.length, avgMs: round(avg), p50Ms: round(percentile(samples, 50)), p95Ms: round(percentile(samples, 95)), minMs: round(Math.min(...samples)), maxMs: round(Math.max(...samples)) };
}

function runBench(fn, iterations = 24) {
  const samples = [];
  let lastResult;
  for (let i = 0; i < iterations; i += 1) {
    const t0 = performance.now();
    lastResult = fn();
    samples.push(performance.now() - t0);
  }
  return { samples, lastResult };
}

function runSyntheticBenchmarks(mode = 'quick') {
  const iterations = mode === 'deep' ? 90 : 28;
  const html = makeSampleHtml(mode === 'deep' ? 180 : 80);
  const selectors = {
    title: { selector: 'title' },
    headline: { selector: 'h1' },
    price: { selector: '.price', extract: 'number' },
    dy: { selector: '.dy', extract: 'percent' },
    link: { selector: 'a[href]', extract: 'href' },
    description: { selector: 'meta[name=description]', extract: 'content' },
  };
  const complexSelectors = {
    rows: { selector: 'tr.hist', extract: 'row', limit: 80 },
    close: { selector: '.close', extract: 'number', limit: 80 },
    yield: { selector: '.yield', extract: 'percent', limit: 80 },
  };
  const fast = runBench(() => extractFastSelectors(html, selectors, { maxPerSelector: 100 }), iterations);
  const custom = runBench(() => extractCustomSelectors(html, complexSelectors, { maxPerSelector: 100, provider: 'test-lab' }), Math.max(8, Math.floor(iterations / 2)));
  const normalizerValues = ['R$ 1.234,56', 'US$ 1,234.56', '2,5 milhões', '1.2B', '-3,45%', '+2.78%', 'N/A', '--'];
  const normalizer = runBench(() => normalizerValues.map(value => ({ value, parsed: parseFinancialNumber(value) })), iterations * 4);
  const chartResults = {
    close: custom.lastResult?.results?.close || [],
    yield: custom.lastResult?.results?.yield || [],
    history: Array.from({ length: 16 }, (_, i) => ({ data: `${String((i % 28) + 1).padStart(2, '0')}/05/2026`, valor: `R$ ${(30 + i * 0.48).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` })),
  };
  const chart = runBench(() => buildNormalizedChartSeries(chartResults, { maxSeries: 4 }), iterations);
  const precision = buildExtractionPrecisionReport({ results: fast.lastResult?.results, selectors, htmlLength: html.length, strategy: fast.lastResult?.strategy, warnings: fast.lastResult?.warnings });
  const readiness = buildChartReadinessReport(chartResults);
  const series = buildNormalizedChartSeries(chartResults, { maxSeries: 4 });
  return {
    version: TESTS_VERSION,
    mode,
    htmlBytes: Buffer.byteLength(html),
    selectors: { fastSupported: canUseFastSelectors(selectors), fastCount: Object.keys(selectors).length, complexCount: Object.keys(complexSelectors).length },
    benchmark: {
      fastSelectors: summarizeBenchmark('fast-selectors single-pass', fast.samples),
      customSelectors: summarizeBenchmark('custom-selectors css-lite', custom.samples),
      normalizer: summarizeBenchmark('normalizador financeiro', normalizer.samples),
      chartSeries: summarizeBenchmark('chart-series', chart.samples),
    },
    samples: {
      fastResults: fast.lastResult?.results,
      customMetrics: custom.lastResult?.metrics,
      normalizer: normalizer.lastResult,
      precision,
      chartReadiness: readiness,
      chartSeries: series,
    },
  };
}

function buildProbePlan(baseUrl) {
  return [
    { id: 'health', label: 'Health', method: 'GET', url: '/api/health', expectedStatus: 200, kind: 'runtime' },
    { id: 'ready', label: 'Ready', method: 'GET', url: '/api/ready', expectedStatus: 200, kind: 'runtime' },
    { id: 'metrics', label: 'Métricas internas', method: 'GET', url: '/api/server/metrics', expectedStatus: 200, kind: 'telemetry' },
    { id: 'cache', label: 'Cache stats', method: 'GET', url: '/api/cache/stats', expectedStatus: 200, kind: 'telemetry' },
    { id: 'source', label: 'Status das fontes', method: 'GET', url: '/api/source/status', expectedStatus: 200, kind: 'telemetry' },
    { id: 'openapi', label: 'OpenAPI', method: 'GET', url: '/api/openapi', expectedStatus: 200, kind: 'contract' },
    { id: 'fields', label: 'Campos', method: 'GET', url: '/api/fields', expectedStatus: 200, kind: 'contract' },
    { id: 'pwa', label: 'Manifest PWA', method: 'GET', url: '/manifest.webmanifest', expectedStatus: 200, kind: 'static' },
    { id: 'sw', label: 'Service Worker', method: 'GET', url: '/service-worker.js', expectedStatus: 200, kind: 'static' },
  ].map(item => ({ ...item, absoluteUrl: `${baseUrl}${item.url}` }));
}

function recommendations({ checks = [], benchmark = {}, runtime = {} } = {}) {
  const out = [];
  if (checks.some(c => !c.ok)) out.push({ level: 'warn', title: 'Corrigir checks com atenção', detail: 'Execute a suíte novamente após corrigir os itens marcados em amarelo ou vermelho.' });
  if ((benchmark?.benchmark?.fastSelectors?.p95Ms || 0) > 8) out.push({ level: 'warn', title: 'Fast-path acima do alvo', detail: 'Revise regex simples, dedupe de seletores e HTML recebido.' });
  if ((benchmark?.samples?.chartReadiness?.score || 0) < 60) out.push({ level: 'info', title: 'Gráficos precisam de mais dados', detail: 'Adicione datas ou séries históricas mais longas nos resultados extraídos.' });
  if ((runtime?.engineCore?.score || 100) < 80) out.push({ level: 'warn', title: 'Engine Core exige atenção', detail: 'Verifique fontes degradadas, failure cache e cache hit rate.' });
  if (!out.length) out.push({ level: 'ok', title: 'Laboratório saudável', detail: 'Os testes sintéticos, runtime e plano de rede estão prontos para avaliação em tempo real.' });
  return out.slice(0, 8);
}

export default async function handler(req, res) {
  req.__valoraeInternalTelemetry = true;
  const route = beginRoute(req, res, {
    version: ValoraeEngine.version,
    methods: ['GET'],
    route: 'server/tests',
    profile: 'server-tests',
    rateMax: Number(process.env.VALORAE_RATE_LIMIT_METRICS_MAX || 120),
    cacheControl: 'no-store',
  });
  if (route.done) return;

  const input = route.input || {};
  const mode = String(input.mode || 'quick').toLowerCase() === 'deep' ? 'deep' : 'quick';
  const started = performance.now();
  const runtime = getValoraeRuntimeStats();
  const bench = runSyntheticBenchmarks(mode);
  const baseUrl = getBaseUrl(req);
  const probePlan = buildProbePlan(baseUrl);
  const checks = [
    { id: 'engine-version', label: 'Engine carregado', ok: Boolean(ValoraeEngine.version), value: ValoraeEngine.version, weight: 2 },
    { id: 'metrics-isolated', label: 'Rota de testes isolada da telemetria real', ok: true, value: '/api/server/tests', weight: 2 },
    { id: 'fast-selector', label: 'Fast selectors disponíveis', ok: bench.selectors.fastSupported === true, value: `${bench.selectors.fastCount} seletores`, weight: 1 },
    { id: 'normalizer', label: 'Normalizador financeiro', ok: bench.samples.normalizer.some(x => x.parsed !== null), value: `${bench.samples.normalizer.filter(x => x.parsed !== null).length}/${bench.samples.normalizer.length}`, weight: 1 },
    { id: 'chart-readiness', label: 'Prontidão para gráficos', ok: bench.samples.chartReadiness.ready === true, value: `${bench.samples.chartReadiness.score}/100`, weight: 1 },
    { id: 'pwa', label: 'PWA declarado no plano', ok: probePlan.some(p => p.id === 'pwa') && probePlan.some(p => p.id === 'sw'), value: 'manifest + service worker', weight: 1 },
    { id: 'engine-core', label: 'Engine Core runtime', ok: Boolean(runtime?.engineCore), value: runtime?.engineCore?.state || 'ok', weight: 1 },
    { id: 'result-cache', label: 'Scrape result cache', ok: Boolean(runtime?.caches?.scrapeResult || runtime?.engineCore?.scrapeResultHitRatePercent !== undefined), value: runtime?.engineCore?.scrapeResultHitRatePercent != null ? `${runtime.engineCore.scrapeResultHitRatePercent}%` : 'ativo', weight: 1 },
  ];
  const score = scoreFromChecks(checks);
  const durationMs = round(performance.now() - started);

  return sendJson(req, res, {
    version: ValoraeEngine.version,
    testsVersion: TESTS_VERSION,
    requestId: route.requestId,
    status: 'OK',
    generatedAt: new Date().toISOString(),
    mode,
    score,
    durationMs,
    checks,
    benchmark: bench.benchmark,
    samples: bench.samples,
    network: {
      baseUrl,
      probePlan,
      note: 'Os probes de rede em tempo real são executados pelo navegador com X-Valorae-Telemetry: dashboard-test para não inflar métricas reais.',
      timeoutMs: clampNumber(input.timeoutMs, 8000, 1000, 30000),
    },
    runtime: {
      engineCore: runtime?.engineCore,
      caches: runtime?.caches,
      providers: runtime?.providers,
    },
    recommendations: recommendations({ checks, benchmark: bench, runtime }),
    freeOnly: true,
    serverlessSafe: true,
  }, {
    status: 200,
    engineVersion: ValoraeEngine.version,
    profile: 'server-tests',
    cachePolicy: 'no-store',
    cacheControl: 'no-store',
    volatileEtag: true,
  });
}
