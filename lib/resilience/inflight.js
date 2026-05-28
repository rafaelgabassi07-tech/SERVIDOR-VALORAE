export const VALORAE_INFLIGHT_VERSION = '21.12.0-inflight-coalescing';

const groups = globalThis.__VALORAE_INFLIGHT_GROUPS__ || new Map();
globalThis.__VALORAE_INFLIGHT_GROUPS__ = groups;
const metrics = globalThis.__VALORAE_INFLIGHT_METRICS__ || { joins: 0, starts: 0, failures: 0, completed: 0 };
globalThis.__VALORAE_INFLIGHT_METRICS__ = metrics;

export async function coalesce(key, fn) {
  const safeKey = String(key || 'default');
  if (groups.has(safeKey)) { metrics.joins += 1; return groups.get(safeKey); }
  metrics.starts += 1;
  const promise = Promise.resolve()
    .then(fn)
    .then(value => { metrics.completed += 1; return value; }, err => { metrics.failures += 1; throw err; })
    .finally(() => groups.delete(safeKey));
  groups.set(safeKey, promise);
  return promise;
}

export function inflightStats(prefix = '') {
  const keys = [...groups.keys()];
  const filtered = prefix ? keys.filter(k => k.startsWith(prefix)) : keys;
  return { size: filtered.length, totalSize: groups.size, metrics: { ...metrics } };
}
