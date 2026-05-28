// Negative cache curto para falhas de scraping repetidas.
// Evita martelar fonte externa em Vercel Free quando a última tentativa acabou de falhar.

export const VALORAE_FAILURE_CACHE_VERSION = '21.11.9-short-negative-cache';

const ENABLED = !['0', 'false', 'no', 'off'].includes(String(process.env.VALORAE_FAILURE_CACHE_ENABLED ?? 'true').toLowerCase());
const TTL_MS = Math.max(0, Number(process.env.VALORAE_FAILURE_CACHE_TTL_MS || 12_000));
const MAX_ENTRIES = Math.max(10, Number(process.env.VALORAE_FAILURE_CACHE_MAX_ENTRIES || 80));
const cache = new Map();
const metrics = { hits: 0, misses: 0, sets: 0, evictions: 0 };

function clone(v) { try { return structuredClone(v); } catch { return JSON.parse(JSON.stringify(v)); } }
function touch(key, entry) { cache.delete(key); cache.set(key, entry); }

export function getFailureCache(key) {
  if (!ENABLED || !TTL_MS || !key) return null;
  const entry = cache.get(key);
  if (!entry) { metrics.misses += 1; return null; }
  if (Date.now() > entry.expiresAt) { cache.delete(key); metrics.misses += 1; return null; }
  metrics.hits += 1;
  touch(key, entry);
  const value = clone(entry.value);
  value.cache = 'NEGATIVE_HIT';
  value.cacheLayers = { ...(value.cacheLayers || {}), result: 'MISS', html: 'NEGATIVE_HIT', network: 'SKIPPED' };
  value.network = { ...(value.network || {}), skippedByFailureCache: true, failureCacheAgeMs: Math.max(0, Date.now() - entry.createdAt) };
  return value;
}

export function setFailureCache(key, value, ttlMs = TTL_MS) {
  if (!ENABLED || !ttlMs || !key || !value || value.ok === true) return false;
  while (cache.size >= MAX_ENTRIES) { const oldest = cache.keys().next().value; cache.delete(oldest); metrics.evictions += 1; }
  cache.set(key, { value: clone(value), createdAt: Date.now(), expiresAt: Date.now() + ttlMs });
  metrics.sets += 1;
  return true;
}

export function clearFailureCache() { cache.clear(); }
export function failureCacheStats() { return { enabled: ENABLED, version: VALORAE_FAILURE_CACHE_VERSION, ttlMs: TTL_MS, entries: cache.size, metrics: { ...metrics } }; }
