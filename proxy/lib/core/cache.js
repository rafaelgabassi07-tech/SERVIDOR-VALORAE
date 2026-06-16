const store = new Map();
const inFlight = new Map();
const metrics = { hits: 0, staleHits: 0, misses: 0, sets: 0, inFlightJoins: 0 };

function now() { return Date.now(); }

export function stableKey(value) {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableKey(value[k])}`).join(',')}}`;
}

export function getCache(key, { allowStale = true } = {}) {
  const item = store.get(key);
  if (!item) { metrics.misses++; return null; }
  if (item.expireAt >= now()) { metrics.hits++; return { value: item.value, status: 'HIT', ageMs: now() - item.createdAt }; }
  if (allowStale && item.staleAt >= now()) { metrics.staleHits++; return { value: item.value, status: 'STALE', ageMs: now() - item.createdAt }; }
  store.delete(key); metrics.misses++; return null;
}

export function setCache(key, value, ttlMs = 60_000, staleMs = ttlMs * 4) {
  if (store.size > 500) store.delete(store.keys().next().value);
  store.set(key, { value, createdAt: now(), expireAt: now() + ttlMs, staleAt: now() + ttlMs + staleMs });
  metrics.sets++;
  return value;
}

export async function coalesce(key, producer) {
  if (inFlight.has(key)) { metrics.inFlightJoins++; return inFlight.get(key); }
  const p = Promise.resolve().then(producer).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

export function cacheStats() {
  return { ...metrics, entries: store.size, inFlight: inFlight.size };
}

export function clearCache() {
  store.clear();
}
