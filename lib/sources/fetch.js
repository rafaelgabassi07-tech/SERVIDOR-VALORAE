import { getCache, setCache, coalesce, stableKey } from '../core/cache.js';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; pt-BR) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  Accept: 'text/html,application/json;q=0.9,*/*;q=0.8'
};

function hostHeaders(url = '') {
  const lower = String(url || '').toLowerCase();
  if (lower.includes('statusinvest.com.br')) {
    return {
      Referer: 'https://statusinvest.com.br/',
      Origin: 'https://statusinvest.com.br',
      'X-Requested-With': 'XMLHttpRequest'
    };
  }
  if (lower.includes('investidor10.com.br')) {
    return {
      Referer: 'https://investidor10.com.br/',
      Origin: 'https://investidor10.com.br'
    };
  }
  if (lower.includes('api.bcb.gov.br')) {
    return { Accept: 'application/json,text/plain,*/*' };
  }
  return {};
}

function retryCount(options = {}) {
  const n = Number(options.retries ?? process.env.VALORAE_FETCH_RETRIES ?? 1);
  return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.floor(n))) : 1;
}

function retryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function attemptFetch(url, { timeoutMs, headers, method, body }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const finalHeaders = { ...DEFAULT_HEADERS, ...hostHeaders(url), ...headers };
    const res = await fetch(url, { method, headers: finalHeaders, body, signal: controller.signal });
    const text = await res.text();
    return { text, status: res.status, ok: res.ok };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchText(url, { timeoutMs = 7000, ttlMs = 120000, staleMs = 600000, headers = {}, method = 'GET', body, retries } = {}) {
  const effectiveHeaders = { ...hostHeaders(url), ...headers };
  const key = `fetch:${method}:${url}:${stableKey(effectiveHeaders)}:${body || ''}`;
  if (process.env.VALORAE_DISABLE_EXTERNAL === '1') {
    const stale = getCache(key, { allowStale: true });
    if (stale) return { text: stale.value.text, status: stale.value.status, cacheStatus: 'STALE', url, error: 'external-disabled' };
    return { text: '', status: 0, cacheStatus: 'DISABLED', url, error: 'external-disabled' };
  }
  const cached = getCache(key);
  if (cached) return { text: cached.value.text, status: cached.value.status, cacheStatus: cached.status, url };
  return coalesce(key, async () => {
    const maxRetries = retryCount({ retries });
    let lastError = '';
    let lastPayload = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const payload = await attemptFetch(url, { timeoutMs, headers, method, body });
        lastPayload = payload;
        if (payload.ok || payload.text) setCache(key, { text: payload.text, status: payload.status }, ttlMs, staleMs);
        if (payload.ok || !retryableStatus(payload.status) || attempt >= maxRetries) {
          return { text: payload.text, status: payload.status, cacheStatus: payload.ok ? 'LIVE' : 'LIVE_ERROR', url, attempts: attempt + 1 };
        }
      } catch (error) {
        lastError = error?.message || 'fetch failed';
        if (attempt >= maxRetries) break;
      }
      await sleep(150 * (attempt + 1));
    }
    const stale = getCache(key, { allowStale: true });
    if (stale) return { text: stale.value.text, status: stale.value.status, cacheStatus: 'STALE', url, error: lastError || `status-${lastPayload?.status || 0}` };
    return { text: lastPayload?.text || '', status: lastPayload?.status || 0, cacheStatus: 'ERROR', url, error: lastError || `status-${lastPayload?.status || 0}` };
  });
}

export async function fetchJson(url, options = {}) {
  const res = await fetchText(url, { ...options, headers: { Accept: 'application/json,text/plain,*/*', ...(options.headers || {}) } });
  try { return { json: res.text ? JSON.parse(res.text) : null, ...res }; }
  catch { return { json: null, ...res, parseError: true }; }
}
