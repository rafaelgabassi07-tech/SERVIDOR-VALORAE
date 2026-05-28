import { ValoraeEngine } from '../lib/Valorae-engine.js';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute, sendRouteError } from '../lib/http/route.js';
import { extractCustomSelectors, parseSelectorsInput } from '../lib/scrape/custom-selectors.js';
import { canUseFastSelectors, extractFastSelectors } from '../lib/scrape/fast-selectors.js';
import { normalizeScrapeInput, buildResultKey } from '../lib/scrape/scrape-input.js';
import { getScrapeResult, setScrapeResult, shapeScrapeResultCacheHit } from '../lib/cache/scrape-result-cache.js';
import { startScrapeMetrics, markMetric, finishScrapeMetrics, mergeFetchMetrics } from '../lib/performance/scrape-metrics.js';
import { shapeResponsePayload } from '../lib/http/response-shape.js';
import { buildExtractionPrecisionReport } from '../lib/quality/extraction-precision.js';
import { buildNormalizedChartSeries } from '../lib/quality/chart-series.js';

function selectorKeys(results = {}) {
  return Object.keys(results || {}).filter(k => Array.isArray(results[k]) ? results[k].length > 0 : results[k]);
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

  try {
    const selectors = parseSelectorsInput(rawInput.selectors);
    const normalized = normalizeScrapeInput({ ...rawInput, selectors }, { provider: 'direct' });
    if (!normalized.url) {
      return sendJson(req, res, {
        version: ValoraeEngine.version,
        requestId: route.requestId,
        error: 'Envie uma URL HTTPS permitida.',
        example: '/api/scrape?url=https://investidor10.com.br/acoes/petr4/&includeHtml=0',
      }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'scrape' });
    }

    const resultKey = buildResultKey(normalized);
    if (normalized.cache) {
      const cached = getScrapeResult(resultKey);
      if (cached) {
        const hit = shapeScrapeResultCacheHit(cached, { requestId: route.requestId, elapsedMs: performance.now() - scrapeMetrics.startedAt });
        return sendJson(req, res, shapeResponsePayload(hit, normalized), { status: 200, engineVersion: ValoraeEngine.version, profile: 'scrape', cacheStatus: 'RESULT_HIT', cacheControl: 'private, max-age=20, stale-while-revalidate=60' });
      }
    }

    markMetric(scrapeMetrics, 'fetchStart');
    const result = await ValoraeEngine.scrapeUrl(normalized.url, {
      provider: normalized.provider,
      timeoutMs: normalized.timeoutMs,
      maxChars: normalized.maxChars,
      cache: normalized.cache,
      returnHtml: true,
      headers: normalized.headers,
    });
    markMetric(scrapeMetrics, 'fetchEnd');

    markMetric(scrapeMetrics, 'extractStart');
    const extraction = buildExtraction(result.html || '', selectors, normalized, result);
    markMetric(scrapeMetrics, 'extractEnd');

    const mergedResults = selectors ? { ...(result.selectorResults || {}), ...extraction.results } : (result.selectorResults || {});
    const keys = selectorKeys(mergedResults);
    const precision = buildExtractionPrecisionReport({
      results: mergedResults,
      selectors: selectors || {},
      htmlLength: result.htmlLength,
      strategy: extraction.strategy,
      warnings: extraction.warnings || [],
      sourceDrift: extraction.sourceDrift,
    });
    const chartSeries = buildNormalizedChartSeries(mergedResults);
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

    if (normalized.cache && payload.ok) setScrapeResult(resultKey, payload);
    return sendJson(req, res, shapeResponsePayload(payload, normalized), { status: 200, engineVersion: ValoraeEngine.version, profile: 'scrape', cacheStatus: payload.cache, cacheControl: 'private, max-age=10, stale-while-revalidate=60' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'scrape' });
  }
}
