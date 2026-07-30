const store = new Map();
const inFlight = new Map();
const metrics = { hits: 0, staleHits: 0, misses: 0, sets: 0, inFlightJoins: 0, evictions: 0, expiredPurges: 0, rejectedInFlight: 0 };
const MAX_ENTRIES = Math.max(16, Math.min(5000, Number(process.env.VALORAE_CACHE_MAX_ENTRIES || 500)));
const MAX_BYTES = Math.max(1024 * 1024, Math.min(256 * 1024 * 1024, Number(process.env.VALORAE_CACHE_MAX_BYTES || 32 * 1024 * 1024)));
const MAX_IN_FLIGHT = Math.max(16, Math.min(2048, Number(process.env.VALORAE_CACHE_MAX_IN_FLIGHT || 256)));
let totalBytes = 0;
let operations = 0;

function now() { return Date.now(); }

export function stableKey(value) {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableKey(value[k])}`).join(',')}}`;
}

function estimateBytes(value) {
  try { return Buffer.byteLength(JSON.stringify(value), 'utf8'); } catch { return 1024; }
}

function deleteEntry(key, reason = '') {
  const item = store.get(key);
  if (!item) return false;
  totalBytes = Math.max(0, totalBytes - Number(item.bytes || 0));
  store.delete(key);
  if (reason === 'eviction') metrics.evictions += 1;
  if (reason === 'expired') metrics.expiredPurges += 1;
  return true;
}

function purgeExpired(timestamp = now(), budget = 64) {
  let checked = 0;
  for (const [key, item] of store) {
    if (checked++ >= budget) break;
    if (item.staleAt < timestamp) deleteEntry(key, 'expired');
  }
}

function maintain() {
  operations += 1;
  if (operations % 64 === 0) purgeExpired(now(), 128);
  while (store.size >= MAX_ENTRIES || totalBytes > MAX_BYTES) {
    const key = store.keys().next().value;
    if (key === undefined || !deleteEntry(key, 'eviction')) break;
  }
}

export function getCache(key, { allowStale = true } = {}) {
  maintain();
  const item = store.get(key);
  if (!item) { metrics.misses++; return null; }
  const timestamp = now();
  if (item.staleAt < timestamp) { deleteEntry(key, 'expired'); metrics.misses++; return null; }
  // Map insertion order is used as a compact LRU queue.
  store.delete(key);
  store.set(key, item);
  if (item.expireAt >= timestamp) { metrics.hits++; return { value: item.value, status: 'HIT', ageMs: timestamp - item.createdAt }; }
  if (allowStale) { metrics.staleHits++; return { value: item.value, status: 'STALE', ageMs: timestamp - item.createdAt }; }
  metrics.misses++;
  return null;
}

export function setCache(key, value, ttlMs = 60_000, staleMs = ttlMs * 4) {
  const timestamp = now();
  const bytes = estimateBytes(value);
  if (store.has(key)) deleteEntry(key);
  if (bytes > MAX_BYTES) return value;
  store.set(key, { value, bytes, createdAt: timestamp, expireAt: timestamp + ttlMs, staleAt: timestamp + ttlMs + staleMs });
  totalBytes += bytes;
  metrics.sets++;
  maintain();
  return value;
}

export async function coalesce(key, producer) {
  if (inFlight.has(key)) { metrics.inFlightJoins++; return inFlight.get(key); }
  if (inFlight.size >= MAX_IN_FLIGHT) {
    metrics.rejectedInFlight += 1;
    return Promise.resolve().then(producer);
  }
  const p = Promise.resolve().then(producer).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

export function cacheStats() {
  return { ...metrics, entries: store.size, bytes: totalBytes, maxEntries: MAX_ENTRIES, maxBytes: MAX_BYTES, inFlight: inFlight.size, maxInFlight: MAX_IN_FLIGHT, policy: 'bounded-byte-lru-stale-if-error' };
}

export function clearCache() {
  store.clear();
  inFlight.clear();
  totalBytes = 0;
}

export const _test = { purgeExpired, estimateBytes, limits: { MAX_ENTRIES, MAX_BYTES, MAX_IN_FLIGHT } };
