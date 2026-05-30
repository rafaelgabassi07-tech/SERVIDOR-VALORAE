import { ValoraeEngine } from '../lib/Valorae-engine.js';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute, sendRouteError } from '../lib/http/route.js';
import { extractCustomSelectors, parseSelectorsInput } from '../lib/scrape/custom-selectors.js';
import { canUseFastSelectors, extractFastSelectors } from '../lib/scrape/fast-selectors.js';
import { normalizeScrapeInput, buildFetchKey, buildResultKey } from '../lib/scrape/scrape-input.js';
import { getScrapeResult, setScrapeResult, shapeScrapeResultCacheHit } from '../lib/cache/scrape-result-cache.js';
import { startScrapeMetrics, markMetric, finishScrapeMetrics, mergeFetchMetrics } from '../lib/performance/scrape-metrics.js';
import { shapeResponsePayload } from '../lib/http/response-shape.js';
import { buildExtractionPrecisionReport } from '../lib/quality/extraction-precision.js';
import { buildNormalizedChartSeries } from '../lib/quality/chart-series.js';

const MAX_JOBS = Number(process.env.VALORAE_MAX_BATCH_JOBS || 20);
const MAX_CONCURRENCY = Number(process.env.VALORAE_BATCH_SCRAPE_CONCURRENCY || 4);

function selectorKeys(results = {}) {
  return Object.keys(results || {}).filter(k => Array.isArray(results[k]) ? results[k].length > 0 : results[k]);
}

function lightPrecisionReport({ results = {}, selectors = {}, htmlLength = 0, strategy = 'unknown', warnings = [], sourceDrift = null } = {}) {
  const expected = selectors && typeof selectors === 'object' ? Object.keys(selectors).length : Object.keys(results || {}).length;
  const matched = Object.keys(results || {}).filter(k => {
    const v = results[k];
    if (Array.isArray(v)) return v.some(x => x !== undefined && x !== null && String(x).trim() !== '');
    return v !== undefined && v !== null && String(v).trim() !== '';
  }).length;
  const coverageRatio = expected ? matched / expected : 1;
  const coveragePercent = Math.max(0, Math.min(100, Math.round(coverageRatio * 10000) / 100));
  const score = Math.max(0, Math.min(100, Math.round(coveragePercent - Math.min(20, (warnings || []).length * 4) - (sourceDrift?.sourceDrift ? 15 : 0))));
  return {
    version: '21.12.51-light-precision-batch-fast',
    score,
    level: score >= 85 ? 'high' : score >= 70 ? 'medium' : score >= 50 ? 'low' : 'critical',
    coveragePercent,
    coverageRatio: Math.round(coverageRatio * 10000) / 10000,
    expectedKeys: expected,
    matchedKeys: matched,
    emptyKeys: [],
    numericScore: 100,
    shapeConsistencyScore: 100,
    numericFields: 0,
    suspicious: [],
    parseStrategy: strategy,
    chartReadiness: { ready: false, numericPoints: 0, score: 0, recommendations: ['batchProfile=fast não calcula gráficos por padrão.'] },
    warnings: (warnings || []).slice(0, 4),
    sourceDrift: Boolean(sourceDrift?.sourceDrift),
    confidence: Math.round((score / 100) * 1000) / 1000,
    recommendations: [],
    lightweight: true,
  };
}

function batchProfile(input = {}) {
  return String(input.batchProfile || input.profile || 'app').trim().toLowerCase() || 'app';
}

function buildExtraction(html, selectors, normalized, result) {
  if (!selectors) return { results: result.selectorResults || {}, warnings: [], sourceDrift: undefined, metrics: { selectorTimeMs: 0, nodesFound: 0, parseStrategy: 'none' }, strategy: 'none' };
  if (canUseFastSelectors(selectors, normalized)) {
    const fast = extractFastSelectors(html || '', selectors, normalized);
    if (fast.ok && fast.safe) return { results: fast.results, warnings: fast.warnings || [], sourceDrift: undefined, metrics: fast.metrics || {}, strategy: 'single-pass' };
  }
  const custom = extractCustomSelectors(html || '', selectors, {
    maxSelectors: normalized.maxSelectors,
    maxPerSelector: normalized.maxPerSelector,
    provider: normalized.provider || 'direct',
    url: result.url || normalized.url,
    minCoverage: normalized.minCoverage,
  });
  return { results: custom.results || {}, warnings: custom.warnings || [], sourceDrift: custom.sourceDrift, metrics: custom.metrics || {}, strategy: custom.metrics?.parseStrategy || 'css-lite' };
}

async function mapWithConcurrency(items, concurrency, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return out;
}

export default async function handler(req, res) {
  const route = beginRoute(req, res, {
    version: ValoraeEngine.version,
    methods: ['POST'],
    route: 'batch-scrape',
    rateMax: Number(process.env.VALORAE_RATE_LIMIT_BATCH_SCRAPE_MAX || 40),
    profile: 'batch-scrape',
  });
  if (route.done) return;
  const input = route.input;
  const batchStart = performance.now();

  try {
    const jobs = Array.isArray(input.jobs) ? input.jobs : [];
    if (!jobs.length) {
      return sendJson(req, res, {
        version: ValoraeEngine.version,
        requestId: route.requestId,
        error: 'Envie jobs: [{ "id": "petr4", "url": "https://investidor10.com.br/acoes/petr4/" }]',
      }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'batch-scrape' });
    }
    if (jobs.length > MAX_JOBS) {
      return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: `Máximo de ${MAX_JOBS} jobs por requisição.` }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'batch-scrape' });
    }

    const concurrency = Math.max(1, Math.min(Number(input.concurrency || MAX_CONCURRENCY), MAX_CONCURRENCY, jobs.length));
    const results = new Array(jobs.length);
    const pending = [];
    const logicalResultKeys = [];
    const logicalFetchKeys = [];
    const logicalErrors = [];
    const profile = batchProfile(input);
    const lightweightProfile = ['fast', 'scrape-fast', 'batch-fast'].includes(profile);
    let resultCacheHits = 0;
    let resultCacheMisses = 0;

    jobs.forEach((job, index) => {
      const selectors = parseSelectorsInput(job.selectors || input.selectors);
      try {
        const normalized = normalizeScrapeInput({ ...input, ...job, selectors }, input);
        if (!normalized.url) throw new Error('Job sem URL válida.');
        const resultKey = buildResultKey(normalized);
        logicalResultKeys[index] = resultKey;
        logicalFetchKeys[index] = buildFetchKey(normalized);
        const cached = normalized.cache ? getScrapeResult(resultKey) : null;
        if (cached) {
          resultCacheHits += 1;
          results[index] = { ...shapeScrapeResultCacheHit(cached, { requestId: route.requestId, elapsedMs: 0 }), id: job.id || String(index) };
        } else {
          resultCacheMisses += 1;
          pending.push({ index, id: job.id || String(index), job, selectors, normalized, fetchKey: logicalFetchKeys[index], resultKey });
        }
      } catch (err) {
        logicalErrors.push({ index, id: job.id || String(index), error: err?.message || 'Job inválido.' });
        results[index] = { id: job.id || String(index), ok: false, error: err?.message || 'Job inválido.' };
      }
    });

    const fetchGroups = new Map();
    for (const item of pending) {
      if (!fetchGroups.has(item.fetchKey)) fetchGroups.set(item.fetchKey, []);
      fetchGroups.get(item.fetchKey).push(item);
    }

    let networkFetches = 0;
    let htmlCacheHits = 0;
    let parseRuns = 0;
    let selectorRuns = 0;
    let maxGroupSize = 0;
    const groupEntries = [...fetchGroups.entries()];

    await mapWithConcurrency(groupEntries, concurrency, async ([, group]) => {
      maxGroupSize = Math.max(maxGroupSize, group.length);
      const first = group[0];
      const metric = startScrapeMetrics();
      markMetric(metric, 'fetchStart');
      const fetched = await ValoraeEngine.scrapeUrl(first.normalized.url, {
        provider: first.normalized.provider,
        timeoutMs: first.normalized.timeoutMs,
        maxChars: first.normalized.maxChars,
        cache: first.normalized.cache,
        returnHtml: true,
        headers: first.normalized.headers,
      });
      markMetric(metric, 'fetchEnd');
      if (/HIT/.test(String(fetched.cache || ''))) htmlCacheHits += 1;
      else networkFetches += 1;

      const resultGroups = new Map();
      for (const item of group) {
        if (!resultGroups.has(item.resultKey)) resultGroups.set(item.resultKey, []);
        resultGroups.get(item.resultKey).push(item);
      }

      for (const sameResultItems of resultGroups.values()) {
        const item = sameResultItems[0];
        markMetric(metric, 'extractStart');
        const extraction = buildExtraction(fetched.html || '', item.selectors, item.normalized, fetched);
        markMetric(metric, 'extractEnd');
        parseRuns += extraction.strategy === 'single-pass' || extraction.strategy === 'none' ? 0 : 1;
        selectorRuns += 1;
        const mergedResults = item.selectors ? { ...(fetched.selectorResults || {}), ...extraction.results } : (fetched.selectorResults || {});
        const keys = selectorKeys(mergedResults);
        const precisionInput = {
          results: mergedResults,
          selectors: item.selectors || {},
          htmlLength: fetched.htmlLength,
          strategy: extraction.strategy,
          warnings: extraction.warnings || [],
          sourceDrift: extraction.sourceDrift,
        };
        const precision = item.normalized.includeDiagnostics === false || lightweightProfile ? lightPrecisionReport(precisionInput) : buildExtractionPrecisionReport(precisionInput);
        const chartSeries = item.normalized.includeCharts === false || lightweightProfile ? { count: 0 } : buildNormalizedChartSeries(mergedResults);
        markMetric(metric, 'serializeStart');
        const metrics = item.normalized.metrics ? finishScrapeMetrics(metric, {
          ...mergeFetchMetrics(metric, fetched),
          parseTimeMs: extraction.strategy === 'single-pass' ? 0 : extraction.metrics?.selectorTimeMs || 0,
          selectorTimeMs: extraction.metrics?.selectorTimeMs || 0,
          nodesFound: extraction.metrics?.nodesFound || keys.length,
          selectorCount: item.selectors ? Object.keys(item.selectors).length : 0,
          resultKeys: keys.length,
          parseStrategy: extraction.strategy,
          cacheStatus: fetched.cache || 'MISS',
          htmlLength: fetched.htmlLength,
          extractionCoveragePercent: precision.coveragePercent,
          extractionScore: precision.score,
          chartReady: precision.chartReadiness.ready,
          chartNumericPoints: precision.chartReadiness.numericPoints,
        }) : undefined;
        const base = {
          id: item.id,
          ok: fetched.ok,
          status: fetched.status,
          blocked: fetched.blocked,
          error: fetched.error,
          url: fetched.url,
          finalUrl: fetched.finalUrl,
          hostname: fetched.hostname,
          contentType: fetched.contentType,
          htmlLength: fetched.htmlLength,
          provider: fetched.provider,
          selectorResultKeys: keys,
          results: mergedResults,
          precision,
          chartReadiness: precision.chartReadiness,
      chartSeries: chartSeries.count ? chartSeries : undefined,
          customSelectorWarnings: extraction.warnings?.length ? extraction.warnings : undefined,
          sourceDrift: extraction.sourceDrift,
          elapsedMs: fetched.elapsedMs,
          cache: fetched.cache || 'MISS',
          cacheLayers: { result: 'MISS', ...(fetched.cacheLayers || {}) },
          metrics,
          limits: { maxSelectors: item.normalized.maxSelectors, maxPerSelector: item.normalized.maxPerSelector, maxHtmlChars: item.normalized.maxChars, truncated: Boolean(fetched.truncated), returnedHtml: item.normalized.includeHtml, previewChars: item.normalized.previewChars },
          htmlPreview: fetched.html ? fetched.html.slice(0, item.normalized.previewChars || 0) : undefined,
          html: item.normalized.includeHtml ? fetched.html : undefined,
        };
        if (item.normalized.cache && base.ok) setScrapeResult(item.resultKey, base);
        sameResultItems.forEach((replica, replicaIndex) => {
          results[replica.index] = { ...shapeResponsePayload({ ...base, id: replica.id, dedupedFrom: replicaIndex === 0 ? undefined : sameResultItems[0].index }, replica.normalized) };
        });
      }
    });

    const logicalValidKeys = logicalResultKeys.filter(Boolean);
    const logicalUniqueResultKeys = new Set(logicalValidKeys);
    const logicalUniqueFetchKeys = new Set(logicalFetchKeys.filter(Boolean));
    const executionUniqueResultKeys = new Set(pending.map(x => x.resultKey));
    const totalTimeMs = Math.round(performance.now() - batchStart);
    const logical = {
      inputCount: jobs.length,
      validJobs: logicalValidKeys.length,
      invalidJobs: logicalErrors.length,
      uniqueRequestKeys: logicalUniqueResultKeys.size,
      uniqueFetchKeys: logicalUniqueFetchKeys.size,
      dedupedCount: Math.max(0, logicalValidKeys.length - logicalUniqueResultKeys.size),
    };
    const execution = {
      networkFetches,
      htmlCacheHits,
      resultCacheHits,
      resultCacheMisses,
      parseRuns,
      selectorRuns,
      resultCacheHitRatePercent: logicalValidKeys.length ? Math.round((resultCacheHits / logicalValidKeys.length) * 10000) / 100 : 0,
    };
    const coalescing = {
      byUrl: logicalUniqueFetchKeys.size < logicalValidKeys.length,
      byResultKey: logicalUniqueResultKeys.size < logicalValidKeys.length,
      servedFromCache: resultCacheHits > 0 && resultCacheMisses === 0,
    };
    const payload = {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      ok: results.some(r => r?.ok),
      count: results.length,
      uniqueCount: logical.uniqueRequestKeys,
      dedupedCount: logical.dedupedCount,
      concurrency,
      coalesced: coalescing.byUrl || coalescing.byResultKey,
      resultCacheHits,
      resultCacheMisses,
      htmlCacheHits,
      networkFetches,
      logical,
      execution,
      coalescing,
      batchMetrics: {
        totalTimeMs,
        logical,
        execution,
        coalescing,
        fetchGroups: fetchGroups.size,
        resultGroups: executionUniqueResultKeys.size,
        parseRuns,
        selectorRuns,
        maxGroupSize,
        coalescedByUrl: coalescing.byUrl,
        coalescedByResult: coalescing.byResultKey,
      },
      results,
    };

    return sendJson(req, res, shapeResponsePayload(payload, input), { status: 200, engineVersion: ValoraeEngine.version, profile: `batch-scrape-${profile}`, cacheControl: 'private, max-age=10, stale-while-revalidate=60' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'batch-scrape' });
  }
}
