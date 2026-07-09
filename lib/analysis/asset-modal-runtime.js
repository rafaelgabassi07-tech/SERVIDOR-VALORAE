import { coalesce, getCache, setCache, stableKey } from '../core/cache.js';

export const ASSET_MODAL_RUNTIME_VERSION = '26.asset-modal.runtime.v5-full-only';

function boolish(value) {
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value ?? '').toLowerCase());
}


function assetModalDeadlineMs(payload = {}) {
  // Os modais de Ação/FII voltaram a ser full-only: timeout de rota não pode
  // transformar contrato completo em payload PARTIAL/leve. Timeouts internos
  // de fontes continuam existindo dentro dos coletores, mas a orquestração
  // pública do modal não encerra a resposta antecipadamente.
  return 0;
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

function normalizeModalCacheSurface(payload = {}) {
  const raw = String(payload.surface || payload.consumer || payload.consumerId || payload.uiSurface || '').toLowerCase();
  if (!raw) return 'asset_modal';
  if (raw.includes('modal')) return 'asset_modal';
  return raw;
}

function normalizeModalCacheMode(payload = {}) {
  const raw = String(payload.mode || payload.priority || payload.stage || '').toLowerCase();
  if (!raw) return 'full';
  if (raw.includes('full')) return 'full';
  if (raw.includes('modal_fast') || raw.includes('essential')) return 'full';
  return raw;
}

function modalCacheKey({ family = 'asset', ticker = '', payload = {} } = {}) {
  const relevant = {
    family: String(family || 'asset').toLowerCase(),
    ticker: String(ticker || '').toUpperCase(),
    range: String(payload.range || '').toLowerCase(),
    interval: String(payload.interval || '').toLowerCase(),
    mobile: boolish(payload.mobile),
    surface: normalizeModalCacheSurface(payload),
    mode: normalizeModalCacheMode(payload)
  };
  return `asset-modal:${stableKey(relevant)}`;
}

function hasMeaningfulDisplayValue(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return false;
  return !['—', '-', '--', 'n/a', 'na', 'null', '0', '0,00', '0.00', 'r$ 0,00'].includes(text);
}

function hasPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function countArray(value) {
  return Array.isArray(value) ? value.length : 0;
}

function anyArrayMapValue(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some(entry => Array.isArray(entry) && entry.length > 0);
}

function modalPayloadHasUsefulData(payload = {}) {
  if (!payload || typeof payload !== 'object') return false;
  const status = String(payload.status || '').toUpperCase();
  if (['NOT_FII', 'NOT_STOCK'].includes(status)) return true;
  const quote = payload.quoteSummary || {};
  if (hasPositiveNumber(quote.price) || hasMeaningfulDisplayValue(quote.priceDisplay)) return true;
  if (countArray(payload.chart?.points) >= 2) return true;
  if (countArray(payload.metrics) > 0 && payload.metrics.some(item => hasMeaningfulDisplayValue(item?.value) || hasPositiveNumber(item?.numericValue))) return true;
  if (countArray(payload.fundamentalIndicators?.items) > 0) return true;
  if (countArray(payload.historicalIndicators?.rows) > 0 || Object.keys(payload.historicalIndicators?.tablesByPeriod || {}).length > 0) return true;
  if (countArray(payload.checklist?.items) > 0) return true;
  if (countArray(payload.returns?.rows) > 0) return true;
  if (countArray(payload.companyProfile?.facts) > 0 || countArray(payload.companyProfile?.sections) > 0) return true;
  if (countArray(payload.companyData?.facts) > 0 || countArray(payload.companyInformation?.facts) > 0) return true;
  if (countArray(payload.revenueByRegion?.items) > 0 || countArray(payload.revenueByBusiness?.items) > 0) return true;
  if (countArray(payload.revenueProfitChart?.points) > 0 || countArray(payload.profitQuoteChart?.points) > 0 || countArray(payload.equityEvolutionChart?.points) > 0) return true;
  if (countArray(payload.dividendHistory?.events) > 0 || anyArrayMapValue(payload.dividendHistory?.yieldSeriesByFrequency) || anyArrayMapValue(payload.dividendHistory?.dividendSeriesByFrequency)) return true;
  if (countArray(payload.comparison?.items) > 0 || countArray(payload.comparison?.series) > 0 || Object.values(payload.comparison?.seriesByPeriod || {}).some(series => Array.isArray(series) && series.some(item => countArray(item?.points) > 0))) return true;
  if (countArray(payload.peerComparison?.rows) > 0) return true;
  if (countArray(payload.distributions12m?.months) > 0) return true;
  if (countArray(payload.dividendCharts?.events) > 0 || anyArrayMapValue(payload.dividendCharts?.yieldSeriesByFrequency) || anyArrayMapValue(payload.dividendCharts?.dividendSeriesByFrequency)) return true;
  if (countArray(payload.aboutFund?.sections) > 0 || countArray(payload.aboutFund?.highlights) > 0 || hasMeaningfulDisplayValue(payload.aboutFund?.summary)) return true;
  if (countArray(payload.propertyPortfolio?.properties) > 0 || countArray(payload.propertyPortfolio?.states) > 0) return true;
  if (countArray(payload.vacancyHistory?.points) > 0) return true;
  if (countArray(payload.patrimonialInfo?.metrics) > 0 || countArray(payload.patrimonialInfo?.bars) > 0) return true;
  if (countArray(payload.announcements?.items) > 0) return true;
  if (Array.isArray(payload.infoSections) && payload.infoSections.some(section => countArray(section?.items) > 0)) return true;
  return false;
}

function isModalPayloadCacheable(payload = {}) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.ok === false) return false;
  const status = String(payload.status || '').toUpperCase();
  if (['ERROR', 'EMPTY', 'PARTIAL'].includes(status)) return false;
  return modalPayloadHasUsefulData(payload);
}

function modalCacheTtlMs(payload = {}, defaultTtlMs = 45_000) {
  const requested = Number(defaultTtlMs) || 45_000;
  const status = String(payload?.status || '').toUpperCase();
  // Modais Ação/FII estão full-only; dados fundamentais e blocos pesados não precisam
  // ser recomputados a cada abertura. Mantém cotação suficientemente fresca e evita
  // fragmentação/lentidão ao abrir o mesmo ativo em Carteira, Ranking ou Análise.
  if (!['ERROR', 'EMPTY', 'PARTIAL'].includes(status) && (payload?.fullOnly || String(payload?.mode || '').toLowerCase() === 'full')) {
    return Math.max(requested, 180_000);
  }
  return requested;
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
      if (!refresh && isModalPayloadCacheable(decorated)) setCache(key, decorated, modalCacheTtlMs(decorated, ttlMs), staleMs);
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
      // Full-only: não devolver payload PARTIAL de timeout para os modais.
      // Sem snapshot stale útil, o erro sobe para a rota e o APK não mistura dados leves/pesados.
      throw error;
    }
  });
}

export const _test = {
  modalCacheKey,
  isModalPayloadCacheable,
  modalPayloadHasUsefulData,
  modalCacheTtlMs,
  normalizeModalCacheSurface,
  normalizeModalCacheMode,
  decorateModalPayload,
  assetModalDeadlineMs,
  modalTimeoutPayload,
  withModalDeadline,
  isModalDeadlineError
};
