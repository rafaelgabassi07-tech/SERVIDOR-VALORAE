import { TtlLruCache, structuredCloneSafe } from './memory.js';

export const VALORAE_SCRAPE_RESULT_CACHE_VERSION = '21.12.51-result-response-cache';

const ENABLED = !['0', 'false', 'no', 'off'].includes(String(process.env.VALORAE_SCRAPE_RESULT_CACHE_ENABLED ?? 'true').toLowerCase());
const TTL_MS = Number(process.env.VALORAE_SCRAPE_RESULT_CACHE_TTL_MS || 60_000);
const MAX_ENTRIES = Number(process.env.VALORAE_SCRAPE_RESULT_CACHE_MAX_ENTRIES || 250);
const MAX_BYTES = Number(process.env.VALORAE_SCRAPE_RESULT_CACHE_MAX_BYTES || 16 * 1024 * 1024);

export const scrapeResultCache = new TtlLruCache({
  name: 'scrapeResult',
  maxEntries: MAX_ENTRIES,
  maxBytes: MAX_BYTES,
  ttlMs: TTL_MS,
});

export const scrapeResponseCache = new TtlLruCache({
  name: 'scrapePreparedResponse',
  maxEntries: Math.max(40, Math.floor(MAX_ENTRIES / 2)),
  maxBytes: Math.max(1024 * 1024, Math.floor(MAX_BYTES / 2)),
  ttlMs: Math.min(TTL_MS, Number(process.env.VALORAE_SCRAPE_RESPONSE_CACHE_TTL_MS || 30_000)),
});

export const SCRAPE_RESPONSE_REQUEST_ID_TOKEN = '__VALORAE_REQUEST_ID__';

const VOLATILE_KEYS = new Set(['requestId', 'generatedAt', 'checkedAt']);

function stripVolatile(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripVolatile);
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (VOLATILE_KEYS.has(key)) continue;
    out[key] = stripVolatile(val);
  }
  return out;
}

export function isScrapeResultCacheEnabled() { return ENABLED && TTL_MS > 0; }

export function getScrapeResult(key) {
  if (!isScrapeResultCacheEnabled() || !key) return undefined;
  return scrapeResultCache.get(key);
}

export function shapeScrapeResultCacheHit(cached, { requestId, elapsedMs = 0 } = {}) {
  const payload = structuredCloneSafe(cached || {});
  return {
    ...payload,
    requestId,
    cache: 'RESULT_HIT',
    cacheLayers: { ...(payload.cacheLayers || {}), result: 'HIT', html: 'SKIPPED', network: 'SKIPPED' },
    metrics: {
      ...(payload.metrics || {}),
      routeTimeMs: Math.round(elapsedMs),
      fetchTimeMs: 0,
      parseTimeMs: 0,
      selectorTimeMs: 0,
      totalTimeMs: Math.round(elapsedMs),
      cacheStatus: 'RESULT_HIT',
    },
  };
}

export function setScrapeResult(key, value, ttlMs = TTL_MS) {
  if (!isScrapeResultCacheEnabled() || !key || !value || value.ok === false) return false;
  const stripped = stripVolatile(value);
  if (stripped?.html && stripped?.limits?.returnedHtml !== true) delete stripped.html;
  return scrapeResultCache.set(key, stripped, ttlMs);
}


function makeWeakEtagFromBody(body = '') {
  let h = 2166136261;
  for (let i = 0; i < body.length; i += 1) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `"sr-${(h >>> 0).toString(36)}-${body.length.toString(36)}"`;
}

export function getScrapePreparedResponse(key, { requestId = SCRAPE_RESPONSE_REQUEST_ID_TOKEN, handlerTotalMs = 0 } = {}) {
  if (!isScrapeResultCacheEnabled() || !key) return undefined;
  const cached = scrapeResponseCache.get(key);
  if (!cached?.bodyTemplate) return undefined;
  const elapsed = Math.max(0, Math.round(Number(handlerTotalMs || 0)));
  const body = String(cached.bodyTemplate)
    .replaceAll(SCRAPE_RESPONSE_REQUEST_ID_TOKEN, String(requestId || 'cached'))
    .replaceAll('__VALORAE_HANDLER_TOTAL_MS__', String(elapsed));
  return {
    ...cached,
    body,
    cacheStatus: 'RESULT_RESPONSE_HIT',
    payloadForMetrics: {
      ok: true,
      status: 'OK',
      requestId,
      cache: 'RESULT_RESPONSE_HIT',
      metrics: {
        cacheStatus: 'RESULT_RESPONSE_HIT',
        handlerTotalMs: elapsed,
        engineTimeMs: 0,
        shapeTimeMs: 0,
        serializeTimeMs: 0,
        responseBytes: Buffer.byteLength(body, 'utf8'),
      },
    },
  };
}

export function setScrapePreparedResponse(key, payload, { statusCode = 200, cacheControl = 'private, max-age=20, stale-while-revalidate=60', ttlMs, schemaVersion, sourceStatus } = {}) {
  if (!isScrapeResultCacheEnabled() || !key || !payload || payload.ok === false) return false;
  const bodyTemplate = JSON.stringify(payload ?? null)
    .replaceAll(String(payload.requestId || ''), SCRAPE_RESPONSE_REQUEST_ID_TOKEN)
    .replace(/"handlerTotalMs"\s*:\s*\d+(?:\.\d+)?/g, '"handlerTotalMs":__VALORAE_HANDLER_TOTAL_MS__')
    .replace(/"totalTimeMs"\s*:\s*\d+(?:\.\d+)?/g, '"totalTimeMs":__VALORAE_HANDLER_TOTAL_MS__')
    .replace(/"routeTimeMs"\s*:\s*\d+(?:\.\d+)?/g, '"routeTimeMs":__VALORAE_HANDLER_TOTAL_MS__');
  const responseBytes = Buffer.byteLength(bodyTemplate, 'utf8');
  const entry = {
    statusCode,
    bodyTemplate,
    etag: makeWeakEtagFromBody(bodyTemplate.replaceAll(SCRAPE_RESPONSE_REQUEST_ID_TOKEN, '')),
    contentLength: responseBytes,
    responseBytes,
    cacheControl,
    schemaVersion,
    sourceStatus,
    cacheStatus: 'RESULT_RESPONSE_HIT',
    createdAt: Date.now(),
  };
  return scrapeResponseCache.set(key, entry, ttlMs);
}

export function scrapeResultCacheStats() {
  return {
    enabled: isScrapeResultCacheEnabled(),
    version: VALORAE_SCRAPE_RESULT_CACHE_VERSION,
    result: scrapeResultCache.stats(),
    response: scrapeResponseCache.stats(),
    ...scrapeResultCache.stats(),
  };
}

export function clearScrapeResultCache() { scrapeResultCache.clear(); scrapeResponseCache.clear(); }
