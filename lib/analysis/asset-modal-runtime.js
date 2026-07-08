import { coalesce, getCache, setCache, stableKey } from '../core/cache.js';

export const ASSET_MODAL_RUNTIME_VERSION = '26.asset-modal.runtime.v4-deadline';

function boolish(value) {
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value ?? '').toLowerCase());
}


function assetModalDeadlineMs(payload = {}) {
  const raw = payload.routeDeadlineMs ?? payload.deadlineMs ?? payload.modalDeadlineMs ?? payload.timeoutMs;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1500, Math.min(Math.floor(n), 15000));
}

function modalTimeoutPayload({ family = 'asset', ticker = '', deadlineMs = 0, elapsedMs = 0, error } = {}) {
  const cleanFamily = String(family || 'asset').toLowerCase();
  const cleanTicker = String(ticker || '').trim().toUpperCase();
  return {
    ok: false,
    status: 'PARTIAL',
    partial: true,
    ticker: cleanTicker,
    assetType: cleanFamily === 'fii' ? 'FII' : cleanFamily === 'stock' ? 'ACAO' : cleanFamily.toUpperCase(),
    updatedAt: new Date().toISOString(),
    sourcePolicy: 'deadline-fallback',
    message: `Tempo esgotado ao consultar dados do modal (${deadlineMs}ms).`,
    diagnostics: {
      modalDeadline: {
        timeout: true,
        deadlineMs,
        elapsedMs,
        error: error?.message || String(error || 'deadline')
      }
    }
  };
}

function isModalDeadlineError(error) {
  return Boolean(error && (error.name === 'AssetModalDeadlineError' || error.code === 'ASSET_MODAL_DEADLINE'));
}

async function withModalDeadline(promiseFactory, deadlineMs, { family, ticker } = {}) {
  if (!deadlineMs) return promiseFactory();
  const startedAt = Date.now();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`asset modal deadline ${deadlineMs}ms exceeded`);
      error.name = 'AssetModalDeadlineError';
      error.code = 'ASSET_MODAL_DEADLINE';
      error.deadlineMs = deadlineMs;
      error.elapsedMs = Date.now() - startedAt;
      error.family = family;
      error.ticker = ticker;
      reject(error);
    }, deadlineMs);
  });
  try {
    return await Promise.race([promiseFactory(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function modalCacheKey({ family = 'asset', ticker = '', payload = {} } = {}) {
  const relevant = {
    family: String(family || 'asset').toLowerCase(),
    ticker: String(ticker || '').toUpperCase(),
    range: String(payload.range || '').toLowerCase(),
    interval: String(payload.interval || '').toLowerCase(),
    mobile: boolish(payload.mobile),
    surface: String(payload.surface || payload.consumer || payload.consumerId || '').toLowerCase(),
    mode: String(payload.mode || payload.priority || '').toLowerCase()
  };
  return `asset-modal:${stableKey(relevant)}`;
}

function isModalPayloadCacheable(payload = {}) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.ok === false) return false;
  const status = String(payload.status || '').toUpperCase();
  return !['ERROR', 'EMPTY'].includes(status);
}

function decorateModalPayload(payload = {}, runtime = {}) {
  const diagnostics = payload && typeof payload === 'object' && payload.diagnostics && typeof payload.diagnostics === 'object'
    ? payload.diagnostics
    : {};
  const modalRuntime = {
    version: ASSET_MODAL_RUNTIME_VERSION,
    family: runtime.family,
    cacheStatus: runtime.cacheStatus,
    elapsedMs: runtime.elapsedMs,
    cached: runtime.cached,
    coalesced: runtime.coalesced,
    storedAt: runtime.storedAt || new Date().toISOString()
  };
  if (runtime.fallbackReason) modalRuntime.fallbackReason = runtime.fallbackReason;
  return {
    ...payload,
    diagnostics: {
      ...diagnostics,
      modalRuntime
    }
  };
}

export async function withAssetModalRuntime({ family, ticker, payload = {}, ttlMs = 45_000, staleMs = 120_000, producer }) {
  if (typeof producer !== 'function') throw new Error('withAssetModalRuntime requer producer.');
  const key = modalCacheKey({ family, ticker, payload });
  const refresh = boolish(payload.refresh) || boolish(payload.nocache) || boolish(payload.noCache) || Boolean(payload._ts);
  let staleSnapshot = null;
  const deadlineMs = assetModalDeadlineMs(payload);

  if (!refresh) {
    const cached = getCache(key, { allowStale: true });
    if (cached?.value && cached.status === 'HIT') {
      return decorateModalPayload(cached.value, {
        family,
        cacheStatus: cached.status,
        elapsedMs: 0,
        cached: true,
        coalesced: false,
        storedAt: cached.value?.updatedAt
      });
    }
    if (cached?.value && cached.status === 'STALE') staleSnapshot = cached;
  }

  return coalesce(key, async () => {
    if (!refresh) {
      const joinedCached = getCache(key, { allowStale: true });
      if (joinedCached?.value && joinedCached.status === 'HIT') {
        return decorateModalPayload(joinedCached.value, {
          family,
          cacheStatus: joinedCached.status,
          elapsedMs: 0,
          cached: true,
          coalesced: true,
          storedAt: joinedCached.value?.updatedAt
        });
      }
      if (joinedCached?.value && joinedCached.status === 'STALE') staleSnapshot = joinedCached;
    }

    const startedAt = Date.now();
    try {
      const fresh = await withModalDeadline(() => producer(), deadlineMs, { family, ticker });
      const elapsedMs = Date.now() - startedAt;
      const decorated = decorateModalPayload(fresh, {
        family,
        cacheStatus: refresh ? 'BYPASS' : 'MISS',
        elapsedMs,
        cached: false,
        coalesced: false
      });
      if (!refresh && isModalPayloadCacheable(decorated)) setCache(key, decorated, ttlMs, staleMs);
      return decorated;
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      if (!refresh && staleSnapshot?.value) {
        return decorateModalPayload(staleSnapshot.value, {
          family,
          cacheStatus: 'STALE_FALLBACK',
          elapsedMs,
          cached: true,
          coalesced: false,
          storedAt: staleSnapshot.value?.updatedAt,
          fallbackReason: error?.message || String(error)
        });
      }
      if (isModalDeadlineError(error)) {
        return decorateModalPayload(modalTimeoutPayload({ family, ticker, deadlineMs, elapsedMs, error }), {
          family,
          cacheStatus: refresh ? 'BYPASS_DEADLINE' : 'MISS_DEADLINE',
          elapsedMs,
          cached: false,
          coalesced: false,
          fallbackReason: error?.message || String(error)
        });
      }
      throw error;
    }
  });
}

export const _test = {
  modalCacheKey,
  isModalPayloadCacheable,
  decorateModalPayload,
  assetModalDeadlineMs,
  modalTimeoutPayload,
  withModalDeadline,
  isModalDeadlineError
};
