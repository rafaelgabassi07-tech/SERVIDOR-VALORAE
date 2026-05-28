import { performance } from 'node:perf_hooks';

export const VALORAE_SCRAPE_METRICS_VERSION = '21.11.7-scrape-metrics';

export function startScrapeMetrics() {
  return { version: VALORAE_SCRAPE_METRICS_VERSION, startedAt: performance.now(), marks: {}, counters: {} };
}

export function markMetric(metrics, name) {
  if (!metrics?.startedAt || !name) return metrics;
  metrics.marks[name] = performance.now();
  return metrics;
}

export function addMetricCounter(metrics, name, amount = 1) {
  if (!metrics || !name) return metrics;
  metrics.counters[name] = (metrics.counters[name] || 0) + Number(amount || 0);
  return metrics;
}

function diff(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round(end - start));
}

export function finishScrapeMetrics(metrics, extra = {}) {
  const now = performance.now();
  const started = metrics?.startedAt || now;
  const marks = metrics?.marks || {};
  const fetchStart = marks.fetchStart || started;
  const fetchEnd = marks.fetchEnd || marks.extractStart || now;
  const extractStart = marks.extractStart || fetchEnd;
  const extractEnd = marks.extractEnd || now;
  const serializeStart = marks.serializeStart || extractEnd;
  return {
    routeTimeMs: diff(started, now),
    fetchTimeMs: Number.isFinite(extra.fetchTimeMs) ? Math.round(extra.fetchTimeMs) : diff(fetchStart, fetchEnd),
    htmlCacheTimeMs: Number(extra.htmlCacheTimeMs || 0),
    parseTimeMs: Number(extra.parseTimeMs || 0),
    selectorTimeMs: Number.isFinite(extra.selectorTimeMs) ? Math.round(extra.selectorTimeMs) : diff(extractStart, extractEnd),
    serializeTimeMs: diff(serializeStart, now),
    totalTimeMs: diff(started, now),
    htmlSizeKb: Math.round(Number(extra.htmlLength || extra.htmlSize || 0) / 1024 * 100) / 100,
    nodesFound: Number(extra.nodesFound || 0),
    selectorCount: Number(extra.selectorCount || 0),
    resultKeys: Number(extra.resultKeys || 0),
    parseStrategy: extra.parseStrategy || 'none',
    cacheStatus: extra.cacheStatus || 'MISS',
    ...extra,
  };
}

export function mergeFetchMetrics(metrics, fetchResult = {}) {
  return {
    fetchTimeMs: Number(fetchResult.elapsedMs || 0),
    htmlLength: Number(fetchResult.htmlLength || 0),
    cacheStatus: fetchResult.cache || 'MISS',
  };
}
