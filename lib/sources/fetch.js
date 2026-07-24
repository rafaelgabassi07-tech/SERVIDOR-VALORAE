import { getCache, setCache, coalesce, stableKey } from '../core/cache.js';
import { buildNativeRequestHeaders, conditionalValidatorHeaders, isRetryableHttpStatus, readTextLimited, responseRetryAfterMs, responseValidators, retryDelayMs } from '../http/native-adaptive-fetch.js';
import { providerFetch } from '../http/provider-transport.js';

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

function sleep(ms, signal) {
  if (!signal?.addEventListener) return new Promise(resolve => setTimeout(() => resolve(true), ms));
  if (signal.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    const finish = continued => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve(continued);
    };
    const onAbort = () => finish(false);
    const timer = setTimeout(() => finish(true), ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function attemptFetch(url, { timeoutMs, headers, method, body, signal, validators, redirect = 'follow' }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || 1));
  const abortFromParent = () => controller.abort();
  try {
    if (signal?.aborted) controller.abort();
    else if (signal?.addEventListener) signal.addEventListener('abort', abortFromParent, { once: true });
    // A mesclagem precisa acontecer antes da sanitização; caso contrário, headers
    // fornecidos pelo chamador poderiam reintroduzir Connection/Host após o filtro.
    const baseHeaders = buildNativeRequestHeaders(url, { ...hostHeaders(url), ...headers });
    const finalHeaders = { ...baseHeaders, ...conditionalValidatorHeaders(validators, baseHeaders) };
    const res = await providerFetch(url, { method, headers: finalHeaders, body, redirect, signal: controller.signal, valoraeTransport: { totalTimeoutMs: timeoutMs } });
    if (res.status === 304) return { text: '', status: res.status, ok: true, revalidated: true, validators: responseValidators(res), retryAfterMs: responseRetryAfterMs(res), location: res.headers.get('location') || '' };
    const bodyLimit = Number(process.env.VALORAE_FETCH_BODY_LIMIT_BYTES || process.env.VALORAE_MAX_REMOTE_BODY_BYTES || 6_000_000);
    const payload = await readTextLimited(res, { maxBytes: bodyLimit });
    return { text: payload.text, status: res.status, ok: res.ok, validators: responseValidators(res), rawBytes: payload.rawBytes, finalUrl: res.url, contentType: res.headers.get('content-type') || '', location: res.headers.get('location') || '', retryAfterMs: responseRetryAfterMs(res) };
  } finally {
    clearTimeout(timeout);
    if (signal?.removeEventListener) signal.removeEventListener('abort', abortFromParent);
  }
}

export async function fetchText(url, { timeoutMs = 7000, ttlMs = 120000, staleMs = 600000, headers = {}, method = 'GET', body, retries, signal, redirect = 'follow' } = {}) {
  const effectiveHeaders = { ...hostHeaders(url), ...headers };
  const key = `fetch:${method}:${redirect}:${url}:${stableKey(effectiveHeaders)}:${body || ''}`;
  if (process.env.VALORAE_DISABLE_EXTERNAL === '1') {
    const stale = getCache(key, { allowStale: true });
    if (stale) return { text: stale.value.text, status: stale.value.status, cacheStatus: 'STALE', url, error: 'external-disabled' };
    return { text: '', status: 0, cacheStatus: 'DISABLED', url, error: 'external-disabled' };
  }
  const cached = getCache(key);
  if (cached && cached.status !== 'STALE') return { text: cached.value.text, status: cached.value.status, cacheStatus: cached.status, url, finalUrl: cached.value.finalUrl || url, contentType: cached.value.contentType || '' };
  return coalesce(key, async () => {
    const maxRetries = retryCount({ retries });
    let lastError = '';
    let lastPayload = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const payload = await attemptFetch(url, { timeoutMs, headers, method, body, signal, validators: cached?.value?.validators, redirect });
        lastPayload = payload;
        if (payload.revalidated && cached?.value) setCache(key, cached.value, ttlMs, staleMs);
        // Nunca transformar 4xx/5xx com corpo HTML em cache fresco. Isso evita que
        // uma página de WAF/429 continue sendo servida depois que a origem se recupera.
        else if (payload.ok) setCache(key, { text: payload.text, status: payload.status, validators: payload.validators, finalUrl: payload.finalUrl, contentType: payload.contentType }, ttlMs, staleMs);
        if (payload.ok || !isRetryableHttpStatus(payload.status) || attempt >= maxRetries) {
          return payload.revalidated && cached?.value
            ? { text: cached.value.text, status: cached.value.status, cacheStatus: 'REVALIDATED', url, finalUrl: cached.value.finalUrl || url, contentType: cached.value.contentType || '', attempts: attempt + 1 }
            : { text: payload.text, status: payload.status, cacheStatus: payload.ok ? 'LIVE' : 'LIVE_ERROR', url, finalUrl: payload.finalUrl || url, contentType: payload.contentType || '', location: payload.location || '', attempts: attempt + 1 };
        }
      } catch (error) {
        lastError = error?.name === 'AbortError' ? 'timeout-or-aborted' : (error?.message || 'fetch failed');
        if (signal?.aborted) break;
        if (attempt >= maxRetries) break;
      }
      const backoffMs = retryDelayMs(attempt, { baseMs: 150, maxMs: 1800 });
      const serverDelayMs = Math.min(Number(lastPayload?.retryAfterMs || 0), 5_000);
      const continued = await sleep(Math.max(backoffMs, serverDelayMs), signal);
      if (!continued) break;
    }
    const stale = getCache(key, { allowStale: true });
    if (stale) return { text: stale.value.text, status: stale.value.status, cacheStatus: 'STALE', url, finalUrl: stale.value.finalUrl || url, contentType: stale.value.contentType || '', error: lastError || `status-${lastPayload?.status || 0}` };
    return { text: lastPayload?.text || '', status: lastPayload?.status || 0, cacheStatus: 'ERROR', url, error: lastError || `status-${lastPayload?.status || 0}` };
  });
}

export async function fetchJson(url, options = {}) {
  const res = await fetchText(url, { ...options, headers: { Accept: 'application/json,text/plain,*/*', ...(options.headers || {}) } });
  try { return { json: res.text ? JSON.parse(res.text) : null, ...res }; }
  catch { return { json: null, ...res, parseError: true }; }
}
