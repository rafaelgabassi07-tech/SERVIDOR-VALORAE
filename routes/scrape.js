import { ValoraeEngine } from '../lib/Valorae-engine.js';
import { sendJson, sendPreparedJson } from '../lib/performance/http.js';
import { beginRoute, sendRouteError } from '../lib/http/route.js';
import { extractCustomSelectors, parseSelectorsInput } from '../lib/scrape/custom-selectors.js';
import { canUseFastSelectors, extractFastSelectors } from '../lib/scrape/fast-selectors.js';
import { normalizeScrapeInput, buildResultKey, buildFetchKey } from '../lib/scrape/scrape-input.js';
import { getScrapeResult, setScrapeResult, shapeScrapeResultCacheHit, getScrapePreparedResponse, setScrapePreparedResponse, SCRAPE_RESPONSE_REQUEST_ID_TOKEN } from '../lib/cache/scrape-result-cache.js';
import { startScrapeMetrics, markMetric, finishScrapeMetrics, mergeFetchMetrics } from '../lib/performance/scrape-metrics.js';
import { shapeResponsePayload } from '../lib/http/response-shape.js';
import { buildExtractionPrecisionReport } from '../lib/quality/extraction-precision.js';
import { buildNormalizedChartSeries } from '../lib/quality/chart-series.js';
import { coalesce } from '../lib/resilience/inflight.js';

function selectorKeys(results = {}) {
  return Object.keys(results || {}).filter(k => Array.isArray(results[k]) ? results[k].length > 0 : results[k]);
}

function canUsePreparedResponseCache(req = {}, normalized = {}) {
  const q = req?.query || {};
  if (normalized.cache === false || normalized.cacheBypassed) return false;
  if (q.lean || q.envelope || q.apiVersion === 'v2' || q.dataFields || q.maxItems || q.limitItems) return false;
  return true;
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
    version: '21.12.52-light-precision-scrape-fast',
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
    chartReadiness: { ready: false, numericPoints: 0, score: 0, recommendations: ['profile=scrape-fast não calcula gráficos por padrão.'] },
    warnings: (warnings || []).slice(0, 4),
    sourceDrift: Boolean(sourceDrift?.sourceDrift),
    confidence: Math.round((score / 100) * 1000) / 1000,
    recommendations: [],
    lightweight: true,
  };
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

export default async function handler(req, res) {
  const route = beginRoute(req, res, {
    version: ValoraeEngine.version,
    methods: ['GET', 'POST'],
    route: 'scrape',
    rateMax: Number(process.env.VALORAE_RATE_LIMIT_SCRAPE_MAX || 60),
    profile: 'scrape',
  });
  if (route.done) return;
  const rawInput = route.input;
  const scrapeMetrics = startScrapeMetrics();
  const handlerStartedAt = performance.now();
  let validationMs = 0;
  let cacheLookupMs = 0;
  let engineMs = 0;
  let shapeMs = 0;
  let serializeMs = 0;

  try {
    const selectors = parseSelectorsInput(rawInput.selectors);
    const normalized = normalizeScrapeInput({ ...rawInput, selectors }, { provider: 'direct' });
    validationMs = performance.now() - handlerStartedAt;
    if (!normalized.url) {
      return sendJson(req, res, {
        version: ValoraeEngine.version,
        status: 'ERROR',
        requestId: route.requestId,
        code: 'MISSING_TARGET_URL',
        error: 'Envie uma URL HTTPS permitida.',
        allowedByDefault: ['investidor10.com.br', 'www.investidor10.com.br', 'statusinvest.com.br', 'www.statusinvest.com.br'],
        example: '/api/scrape?url=https://investidor10.com.br/acoes/petr4/&includeHtml=0',
      }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'scrape' });
    }

    const resultKey = buildResultKey(normalized);
    if (canUsePreparedResponseCache(req, normalized)) {
      const tCache = performance.now();
      const prepared = getScrapePreparedResponse(resultKey, { requestId: route.requestId, handlerTotalMs: performance.now() - handlerStartedAt });
      cacheLookupMs += performance.now() - tCache;
      if (prepared) {
        return sendPreparedJson(req, res, prepared, { status: 200, engineVersion: ValoraeEngine.version, profile: normalized.profile || 'scrape', cacheStatus: 'RESULT_RESPONSE_HIT', cacheControl: prepared.cacheControl || 'private, max-age=20, stale-while-revalidate=60' });
      }
    }
    if (normalized.cache) {
      const tCache = performance.now();
      const cached = getScrapeResult(resultKey);
      cacheLookupMs += performance.now() - tCache;
      if (cached) {
        const hit = shapeScrapeResultCacheHit(cached, { requestId: route.requestId, elapsedMs: performance.now() - scrapeMetrics.startedAt });
        const shapedHit = shapeResponsePayload(hit, normalized);
        return sendJson(req, res, shapedHit, { status: 200, engineVersion: ValoraeEngine.version, profile: normalized.profile || 'scrape', cacheStatus: 'RESULT_HIT', cacheControl: 'private, max-age=20, stale-while-revalidate=60' });
      }
    }

    markMetric(scrapeMetrics, 'fetchStart');
    const engineStartedAt = performance.now();
    const fetchKey = buildFetchKey(normalized);
    const result = await coalesce(fetchKey, () => ValoraeEngine.scrapeUrl(normalized.url, {
      provider: normalized.provider,
      timeoutMs: normalized.timeoutMs,
      maxChars: normalized.maxChars,
      cache: normalized.cache,
      returnHtml: true,
      headers: normalized.headers,
    }));
    markMetric(scrapeMetrics, 'fetchEnd');
    engineMs = performance.now() - engineStartedAt;

    markMetric(scrapeMetrics, 'extractStart');
    const extraction = buildExtraction(result.html || '', selectors, normalized, result);
    markMetric(scrapeMetrics, 'extractEnd');

    const mergedResults = selectors ? { ...(result.selectorResults || {}), ...extraction.results } : (result.selectorResults || {});
    const keys = selectorKeys(mergedResults);
    const precisionInput = {
      results: mergedResults,
      selectors: selectors || {},
      htmlLength: result.htmlLength,
      strategy: extraction.strategy,
      warnings: extraction.warnings || [],
      sourceDrift: extraction.sourceDrift,
    };
    const precision = normalized.includeDiagnostics ? buildExtractionPrecisionReport(precisionInput) : lightPrecisionReport(precisionInput);
    const chartSeries = normalized.includeCharts ? buildNormalizedChartSeries(mergedResults) : { count: 0 };
    markMetric(scrapeMetrics, 'serializeStart');
    const metrics = normalized.metrics ? finishScrapeMetrics(scrapeMetrics, {
      ...mergeFetchMetrics(scrapeMetrics, result),
      parseTimeMs: extraction.strategy === 'single-pass' ? 0 : extraction.metrics?.selectorTimeMs || 0,
      selectorTimeMs: extraction.metrics?.selectorTimeMs || 0,
      nodesFound: extraction.metrics?.nodesFound || keys.length,
      selectorCount: selectors ? Object.keys(selectors).length : 0,
      resultKeys: keys.length,
      parseStrategy: extraction.strategy,
      cacheStatus: result.cache || 'MISS',
      htmlLength: result.htmlLength,
      extractionCoveragePercent: precision.coveragePercent,
      extractionScore: precision.score,
      chartReady: precision.chartReadiness.ready,
      chartNumericPoints: precision.chartReadiness.numericPoints,
      validationMs: Math.round(validationMs),
      cacheLookupMs: Math.round(cacheLookupMs),
      engineTimeMs: Math.round(engineMs),
      shapeTimeMs: 0,
      serializeTimeMs: 0,
      handlerTotalMs: Math.round(performance.now() - handlerStartedAt),
    }) : undefined;

    const payload = {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      ok: result.ok,
      status: result.status,
      blocked: result.blocked,
      error: result.error,
      url: result.url,
      finalUrl: result.finalUrl,
      hostname: result.hostname,
      contentType: result.contentType,
      htmlLength: result.htmlLength,
      rawHtmlLength: result.rawHtmlLength,
      provider: result.provider,
      selectorResultKeys: keys,
      results: mergedResults,
      precision,
      chartReadiness: precision.chartReadiness,
      chartSeries: chartSeries.count ? chartSeries : undefined,
      customSelectorWarnings: extraction.warnings?.length ? extraction.warnings : undefined,
      sourceDrift: extraction.sourceDrift,
      elapsedMs: result.elapsedMs,
      cache: result.cache || 'MISS',
      cacheLayers: { result: 'MISS', ...(result.cacheLayers || {}) },
      metrics,
      limits: {
        maxSelectors: normalized.maxSelectors,
        maxPerSelector: normalized.maxPerSelector,
        maxHtmlChars: normalized.maxChars,
        truncated: Boolean(result.truncated),
        returnedHtml: normalized.includeHtml,
        previewChars: normalized.previewChars,
      },
      network: result.network,
      attempts: result.attempts,
      htmlPreview: result.html ? result.html.slice(0, normalized.previewChars || 0) : undefined,
      html: normalized.includeHtml ? result.html : undefined,
    };

    const shapeStartedAt = performance.now();
    const shapedPayload = shapeResponsePayload(payload, normalized);
    shapeMs = performance.now() - shapeStartedAt;
    serializeMs = Math.max(0, performance.now() - shapeStartedAt - shapeMs);
    const responseBytes = Buffer.byteLength(JSON.stringify(shapedPayload ?? null), 'utf8');
    if (payload.metrics) {
      payload.metrics.shapeTimeMs = Math.round(shapeMs);
      payload.metrics.serializeTimeMs = Math.round(serializeMs);
      payload.metrics.responseBytes = responseBytes;
      payload.metrics.handlerTotalMs = Math.round(performance.now() - handlerStartedAt);
    }
    if (shapedPayload.metrics) {
      shapedPayload.metrics.shapeTimeMs = Math.round(shapeMs);
      shapedPayload.metrics.serializeTimeMs = Math.round(serializeMs);
      shapedPayload.metrics.responseBytes = responseBytes;
      shapedPayload.metrics.handlerTotalMs = Math.round(performance.now() - handlerStartedAt);
    }
    if (normalized.cache && payload.ok) {
      setScrapeResult(resultKey, payload);
      if (canUsePreparedResponseCache(req, normalized)) {
        const preparedPayload = shapeResponsePayload(shapeScrapeResultCacheHit(payload, { requestId: SCRAPE_RESPONSE_REQUEST_ID_TOKEN, elapsedMs: 0 }), normalized);
        if (preparedPayload?.metrics) {
          preparedPayload.metrics.handlerTotalMs = 0;
          preparedPayload.metrics.engineTimeMs = 0;
          preparedPayload.metrics.shapeTimeMs = 0;
          preparedPayload.metrics.serializeTimeMs = 0;
          preparedPayload.metrics.responseBytes = Buffer.byteLength(JSON.stringify(preparedPayload ?? null), 'utf8');
        }
        setScrapePreparedResponse(resultKey, preparedPayload, { statusCode: 200, cacheControl: 'private, max-age=20, stale-while-revalidate=60' });
      }
    }
    return sendJson(req, res, shapedPayload, { status: 200, engineVersion: ValoraeEngine.version, profile: normalized.profile || 'scrape', cacheStatus: payload.cache, cacheControl: 'private, max-age=10, stale-while-revalidate=60' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'scrape' });
  }
}
