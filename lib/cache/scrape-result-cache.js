import { TtlLruCache, structuredCloneSafe } from './memory.js';

export const VALORAE_SCRAPE_RESULT_CACHE_VERSION = '21.11.3-result-cache';

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

export function scrapeResultCacheStats() {
  return { enabled: isScrapeResultCacheEnabled(), version: VALORAE_SCRAPE_RESULT_CACHE_VERSION, ...scrapeResultCache.stats() };
}

export function clearScrapeResultCache() { scrapeResultCache.clear(); }
