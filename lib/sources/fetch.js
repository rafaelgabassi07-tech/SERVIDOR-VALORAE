import { getCache, setCache, coalesce, stableKey } from '../core/cache.js';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  Accept: 'text/html,application/json;q=0.9,*/*;q=0.8'
};

export async function fetchText(url, { timeoutMs = 7000, ttlMs = 120000, staleMs = 600000, headers = {}, method = 'GET', body } = {}) {
  const key = `fetch:${method}:${url}:${stableKey(headers)}:${body || ''}`;
  if (process.env.VALORAE_DISABLE_EXTERNAL === '1') {
    const stale = getCache(key, { allowStale: true });
    if (stale) return { text: stale.value.text, status: stale.value.status, cacheStatus: 'STALE', url, error: 'external-disabled' };
    return { text: '', status: 0, cacheStatus: 'DISABLED', url, error: 'external-disabled' };
  }
  const cached = getCache(key);
  if (cached) return { text: cached.value.text, status: cached.value.status, cacheStatus: cached.status, url };
  return coalesce(key, async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, headers: { ...DEFAULT_HEADERS, ...headers }, body, signal: controller.signal });
      const text = await res.text();
      const payload = { text, status: res.status };
      if (res.ok || text) setCache(key, payload, ttlMs, staleMs);
      return { ...payload, cacheStatus: res.ok ? 'LIVE' : 'LIVE_ERROR', url };
    } catch (error) {
      const stale = getCache(key, { allowStale: true });
      if (stale) return { text: stale.value.text, status: stale.value.status, cacheStatus: 'STALE', url, error: error?.message };
      return { text: '', status: 0, cacheStatus: 'ERROR', url, error: error?.message || 'fetch failed' };
    } finally {
      clearTimeout(timeout);
    }
  });
}

export async function fetchJson(url, options = {}) {
  const res = await fetchText(url, { ...options, headers: { Accept: 'application/json,text/plain,*/*', ...(options.headers || {}) } });
  try { return { json: res.text ? JSON.parse(res.text) : null, ...res }; }
  catch { return { json: null, ...res, parseError: true }; }
}
