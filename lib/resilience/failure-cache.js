// Negative cache curto para falhas de scraping repetidas.
// Checkpoint 114: o backoff também pode ser compartilhado entre instâncias via Supabase,
// mantendo memória local e fallback não bloqueante quando o armazenamento remoto falha.

import { getSharedState, setSharedState, sharedStateKeyHash } from '../state/shared-runtime-state.js';

export const VALORAE_FAILURE_CACHE_VERSION = '21.12.0-shared-short-negative-cache';

const ENABLED = !['0', 'false', 'no', 'off'].includes(String(process.env.VALORAE_FAILURE_CACHE_ENABLED ?? 'true').toLowerCase());
const TTL_MS = Math.max(0, Number(process.env.VALORAE_FAILURE_CACHE_TTL_MS || 12_000));
const MAX_ENTRIES = Math.max(10, Number(process.env.VALORAE_FAILURE_CACHE_MAX_ENTRIES || 80));
const cache = globalThis.__VALORAE_FAILURE_CACHE__ || new Map();
globalThis.__VALORAE_FAILURE_CACHE__ = cache;
const metrics = globalThis.__VALORAE_FAILURE_CACHE_METRICS__ || { hits: 0, misses: 0, sets: 0, evictions: 0, sharedHits: 0, sharedSets: 0, sharedErrors: 0 };
globalThis.__VALORAE_FAILURE_CACHE_METRICS__ = metrics;

function clone(v) { try { return structuredClone(v); } catch { return JSON.parse(JSON.stringify(v)); } }
function touch(key, entry) { cache.delete(key); cache.set(key, entry); }
function sharedKey(key) { return sharedStateKeyHash(String(key || '')).slice(0, 64); }

function decorateHit(entry, layer = 'NEGATIVE_HIT') {
  const value = clone(entry.value);
  value.cache = layer;
  value.cacheLayers = { ...(value.cacheLayers || {}), result: 'MISS', html: layer, network: 'SKIPPED' };
  value.network = {
    ...(value.network || {}),
    skippedByFailureCache: true,
    sharedFailureCache: layer === 'SHARED_NEGATIVE_HIT',
    failureCacheAgeMs: Math.max(0, Date.now() - entry.createdAt),
  };
  return value;
}

export function getFailureCache(key) {
  if (!ENABLED || !TTL_MS || !key) return null;
  const entry = cache.get(key);
  if (!entry) { metrics.misses += 1; return null; }
  if (Date.now() > entry.expiresAt) { cache.delete(key); metrics.misses += 1; return null; }
  metrics.hits += 1;
  touch(key, entry);
  return decorateHit(entry);
}

export async function getFailureCacheShared(key) {
  const local = getFailureCache(key);
  if (local || !ENABLED || !TTL_MS || !key) return local;
  try {
    const record = await getSharedState('negative-failure-cache', sharedKey(key));
    const payload = record?.value;
    if (!payload || payload.ok === true) return null;
    const expiresAt = Math.min(new Date(record.expiresAt || Date.now() + TTL_MS).getTime(), Date.now() + TTL_MS);
    const entry = { value: clone(payload), createdAt: Date.parse(record.createdAt || record.updatedAt || '') || Date.now(), expiresAt };
    cache.set(key, entry);
    metrics.hits += 1;
    metrics.sharedHits += 1;
    return decorateHit(entry, 'SHARED_NEGATIVE_HIT');
  } catch {
    metrics.sharedErrors += 1;
    return null;
  }
}

export function setFailureCache(key, value, ttlMs = TTL_MS) {
  if (!ENABLED || !ttlMs || !key || !value || value.ok === true) return false;
  while (cache.size >= MAX_ENTRIES) { const oldest = cache.keys().next().value; cache.delete(oldest); metrics.evictions += 1; }
  const boundedTtl = Math.max(1000, Number(ttlMs || TTL_MS));
  cache.set(key, { value: clone(value), createdAt: Date.now(), expiresAt: Date.now() + boundedTtl });
  metrics.sets += 1;
  void setSharedState('negative-failure-cache', sharedKey(key), clone(value), { ttlMs: boundedTtl })
    .then(result => { if (result?.stored) metrics.sharedSets += 1; })
    .catch(() => { metrics.sharedErrors += 1; });
  return true;
}

export async function setFailureCacheShared(key, value, ttlMs = TTL_MS) {
  const stored = setFailureCache(key, value, ttlMs);
  if (!stored) return false;
  return true;
}

export function clearFailureCache() { cache.clear(); }
export function failureCacheStats() {
  return {
    enabled: ENABLED,
    version: VALORAE_FAILURE_CACHE_VERSION,
    ttlMs: TTL_MS,
    entries: cache.size,
    shared: true,
    metrics: { ...metrics },
  };
}
