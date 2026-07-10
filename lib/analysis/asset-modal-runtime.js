import { coalesce, getCache, setCache, stableKey } from '../core/cache.js';

export const ASSET_MODAL_RUNTIME_VERSION = '26.asset-modal.runtime.v8-fast-preview-context-cache';

function boolish(value) {
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value ?? '').toLowerCase());
}


function modalStage(payload = {}) {
  const raw = String(payload.stage || payload.mode || payload.priority || '').toLowerCase();
  if (raw.includes('fast') || raw.includes('initial') || raw.includes('essential')) return 'fast';
  return 'full';
}

function assetModalDeadlineMs(payload = {}) {
  const stage = modalStage(payload);
  const fallback = stage === 'fast' ? 3800 : 12000;
  const requested = Number(payload.routeDeadlineMs || payload.modalDeadlineMs || payload.deadlineMs || payload.timeoutMs || fallback);
  const safe = Number.isFinite(requested) ? requested : fallback;
  if (stage === 'fast') return Math.min(4500, Math.max(1800, safe));
  // Retorna antes do teto típico da hospedagem/serverless, evitando 504/expiração abrupta.
  // O APK preserva o fast já renderizado e uma nova abertura aproveita caches de fonte aquecidos.
  return Math.min(12500, Math.max(7000, safe));
}

function modalTimeoutPayload({ family = 'asset', ticker = '', stage = 'fast', deadlineMs = 0, elapsedMs = 0, error } = {}) {
  const cleanFamily = String(family || 'asset').toLowerCase();
  const cleanTicker = String(ticker || '').trim().toUpperCase();
  const cleanStage = String(stage || 'fast').toLowerCase() === 'full' ? 'full' : 'fast';
  return {
    ok: false,
    status: 'PARTIAL',
    partial: true,
    ticker: cleanTicker,
    assetType: cleanFamily === 'fii' ? 'FII' : cleanFamily === 'stock' ? 'ACAO' : cleanFamily.toUpperCase(),
    updatedAt: new Date().toISOString(),
    stage: cleanStage,
    mode: cleanStage,
    fullOnly: cleanStage === 'full',
    progressive: true,
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

/**
 * Limits only how long the fast contract waits for a non-essential source.
 * The original promise is intentionally not cancelled: it can finish warming the shared
 * source cache while the APK receives quote/chart data and the full stage keeps loading.
 */
export async function settleFastModalSource(promise, waitMs = 2600, fallbackValue = null) {
  const safeWaitMs = Math.min(4200, Math.max(50, Number(waitMs) || 2600));
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => {
      resolve(typeof fallbackValue === 'function' ? fallbackValue() : fallbackValue);
    }, safeWaitMs);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
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
  return modalStage(payload);
}

function modalCacheKeyWithMode({ family = 'asset', ticker = '', payload = {}, mode } = {}) {
  const relevant = {
    family: String(family || 'asset').toLowerCase(),
    ticker: String(ticker || '').toUpperCase(),
    // O período do gráfico é definido pelo próprio stage do contrato. Não deve fragmentar
    // o cache entre 1M/1Y no FII nem impedir o reaproveitamento full -> fast.
    mobile: boolish(payload.mobile),
    surface: normalizeModalCacheSurface(payload),
    mode: mode || normalizeModalCacheMode(payload)
  };
  return `asset-modal:${stableKey(relevant)}`;
}

function modalCacheKey({ family = 'asset', ticker = '', payload = {} } = {}) {
  return modalCacheKeyWithMode({ family, ticker, payload });
}

function modalCrossStageCacheKey({ family = 'asset', ticker = '', payload = {} } = {}) {
  if (normalizeModalCacheMode(payload) !== 'fast') return '';
  return modalCacheKeyWithMode({ family, ticker, payload, mode: 'full' });
}

function hasMeaningfulDisplayValue(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return false;
  return ![
    '—', '-', '--', 'n/a', 'na', 'null',
    '0', '0,00', '0.00', 'r$ 0,00',
    '0%', '0,00%', '0.00%', '+0,00%', '+0.00%', '-0,00%', '-0.00%'
  ].includes(text);
}

function hasPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function countArray(value) {
  return Array.isArray(value) ? value.length : 0;
}

function hasMeaningfulValueItems(value) {
  return Array.isArray(value) && value.some(item =>
    hasMeaningfulDisplayValue(item?.value ?? item?.displayValue ?? item?.detailedValue) ||
    (Number.isFinite(Number(item?.numericValue)) && Number(item.numericValue) !== 0)
  );
}

function hasResolvedChecklistItems(value) {
  return Array.isArray(value?.items) && value.items.some(item =>
    typeof item?.passed === 'boolean' || ['PASSED', 'FAILED'].includes(String(item?.status || '').toUpperCase())
  );
}

function anyArrayMapValue(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some(entry => Array.isArray(entry) && entry.length > 0);
}


function hasObjectEntries(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(value).length > 0);
}

function stockModalSections(payload = {}) {
  return [
    ['quote', hasPositiveNumber(payload.quoteSummary?.price) || hasMeaningfulDisplayValue(payload.quoteSummary?.priceDisplay)],
    ['chart', countArray(payload.chart?.points) >= 2],
    ['metrics', hasMeaningfulValueItems(payload.metrics)],
    ['fundamentalIndicators', countArray(payload.fundamentalIndicators?.items) > 0],
    ['historicalIndicators', countArray(payload.historicalIndicators?.rows) > 0 || hasObjectEntries(payload.historicalIndicators?.tablesByPeriod)],
    ['checklist', hasResolvedChecklistItems(payload.checklist)],
    ['dividends', countArray(payload.dividendHistory?.events) > 0 || anyArrayMapValue(payload.dividendHistory?.yieldSeriesByFrequency) || anyArrayMapValue(payload.dividendHistory?.dividendSeriesByFrequency)],
    ['peerComparison', countArray(payload.peerComparison?.rows) > 0],
    ['indexComparison', countArray(payload.indexComparison?.items) > 0 || countArray(payload.indexComparison?.series) > 0 || hasObjectEntries(payload.indexComparison?.seriesByPeriod)],
    ['company', hasMeaningfulValueItems(payload.companyProfile?.facts) || countArray(payload.companyProfile?.sections) > 0 || hasMeaningfulValueItems(payload.companyData?.facts) || hasMeaningfulValueItems(payload.companyInformation?.facts)],
    ['revenueBreakdown', countArray(payload.revenueByRegion?.items) > 0 || countArray(payload.revenueByBusiness?.items) > 0],
    ['shareholdingPosition', countArray(payload.shareholdingPosition?.rows) > 0],
    ['financialCharts', countArray(payload.revenueProfitChart?.points) > 0 || countArray(payload.profitQuoteChart?.points) > 0 || countArray(payload.equityEvolutionChart?.points) > 0],
    ['financialStatements', countArray(payload.resultsStatement?.rows) > 0 || countArray(payload.balanceSheetStatement?.rows) > 0 || hasObjectEntries(payload.resultsStatement?.tablesByPeriod) || hasObjectEntries(payload.balanceSheetStatement?.tablesByPeriod)],
    ['announcements', countArray(payload.announcements?.items) > 0],
    ['returns', countArray(payload.returns?.rows) > 0]
  ];
}

function fiiModalSections(payload = {}) {
  return [
    ['quote', hasPositiveNumber(payload.quoteSummary?.price) || hasMeaningfulDisplayValue(payload.quoteSummary?.priceDisplay)],
    ['chart', countArray(payload.chart?.points) >= 2],
    ['metrics', hasMeaningfulValueItems(payload.metrics)],
    ['indexComparison', countArray(payload.comparison?.items) > 0 || countArray(payload.comparison?.series) > 0 || hasObjectEntries(payload.comparison?.seriesByPeriod)],
    ['peerComparison', countArray(payload.peerComparison?.rows) > 0],
    ['checklist', hasResolvedChecklistItems(payload.checklist)],
    ['distributions12m', countArray(payload.distributions12m?.items) > 0 || countArray(payload.distributions12m?.months) > 0],
    ['dividendCharts', countArray(payload.dividendCharts?.events) > 0 || anyArrayMapValue(payload.dividendCharts?.yieldSeriesByFrequency) || anyArrayMapValue(payload.dividendCharts?.dividendSeriesByFrequency)],
    ['aboutFund', countArray(payload.aboutFund?.sections) > 0 || countArray(payload.aboutFund?.highlights) > 0 || hasMeaningfulDisplayValue(payload.aboutFund?.summary)],
    ['propertyPortfolio', countArray(payload.propertyPortfolio?.properties) > 0 || countArray(payload.propertyPortfolio?.states) > 0],
    ['vacancyHistory', countArray(payload.vacancyHistory?.points) > 0],
    ['patrimonialInfo', countArray(payload.patrimonialInfo?.metrics) > 0 || countArray(payload.patrimonialInfo?.bars) > 0],
    ['announcements', countArray(payload.announcements?.items) > 0],
    ['returns', countArray(payload.returns?.rows) > 0],
    ['information', Array.isArray(payload.infoSections) && payload.infoSections.some(section => countArray(section?.items) > 0)],
    ['historicalIndicators', countArray(payload.historicalIndicators?.rows) > 0 || hasObjectEntries(payload.historicalIndicators?.tablesByPeriod)]
  ];
}

function buildModalDelivery(payload = {}, runtime = {}) {
  const family = String(runtime.family || payload.assetType || 'asset').toLowerCase();
  const requestedStage = String(runtime.requestedMode || runtime.mode || 'full').toLowerCase() === 'fast' ? 'fast' : 'full';
  const deliveredRaw = String(payload.stage || payload.mode || runtime.deliveredMode || runtime.mode || requestedStage).toLowerCase();
  const deliveredStage = deliveredRaw === 'fast' ? 'fast' : 'full';
  const sections = family === 'fii' ? fiiModalSections(payload) : stockModalSections(payload);
  const availableSections = sections.filter(([, available]) => available).map(([id]) => id);
  const missingSections = sections.filter(([, available]) => !available).map(([id]) => id);
  const isFinal = deliveredStage === 'full';
  const status = String(payload.status || '').toUpperCase();
  const completenessPercent = sections.length ? Math.round((availableSections.length / sections.length) * 100) : 0;
  return {
    schemaVersion: '2',
    requestId: runtime.requestId || undefined,
    requestedStage,
    deliveredStage,
    isFinal,
    completenessPercent,
    availableSections,
    deferredSections: isFinal ? [] : missingSections,
    unavailableSections: isFinal ? missingSections : [],
    retryable: status === 'PARTIAL' || status === 'ERROR' || (isFinal && missingSections.length > 0),
    cacheStatus: runtime.cacheStatus || undefined
  };
}

function modalPayloadHasUsefulData(payload = {}) {
  if (!payload || typeof payload !== 'object') return false;
  const status = String(payload.status || '').toUpperCase();
  if (['NOT_FII', 'NOT_STOCK'].includes(status)) return true;
  const quote = payload.quoteSummary || {};
  if (hasPositiveNumber(quote.price) || hasMeaningfulDisplayValue(quote.priceDisplay)) return true;
  if (countArray(payload.chart?.points) >= 2) return true;
  if (hasMeaningfulValueItems(payload.metrics)) return true;
  if (countArray(payload.fundamentalIndicators?.items) > 0) return true;
  if (countArray(payload.historicalIndicators?.rows) > 0 || Object.keys(payload.historicalIndicators?.tablesByPeriod || {}).length > 0) return true;
  if (hasResolvedChecklistItems(payload.checklist)) return true;
  if (countArray(payload.returns?.rows) > 0) return true;
  if (countArray(payload.peerComparison?.rows) > 0) return true;
  if (countArray(payload.indexComparison?.items) > 0 || countArray(payload.indexComparison?.series) > 0 || hasObjectEntries(payload.indexComparison?.seriesByPeriod)) return true;
  if (hasMeaningfulValueItems(payload.companyProfile?.facts) || countArray(payload.companyProfile?.sections) > 0) return true;
  if (hasMeaningfulValueItems(payload.companyData?.facts) || hasMeaningfulValueItems(payload.companyInformation?.facts)) return true;
  if (countArray(payload.revenueByRegion?.items) > 0 || countArray(payload.revenueByBusiness?.items) > 0) return true;
  if (countArray(payload.shareholdingPosition?.rows) > 0) return true;
  if (countArray(payload.revenueProfitChart?.points) > 0 || countArray(payload.profitQuoteChart?.points) > 0 || countArray(payload.equityEvolutionChart?.points) > 0) return true;
  if (countArray(payload.resultsStatement?.rows) > 0 || countArray(payload.balanceSheetStatement?.rows) > 0 || hasObjectEntries(payload.resultsStatement?.tablesByPeriod) || hasObjectEntries(payload.balanceSheetStatement?.tablesByPeriod)) return true;
  if (countArray(payload.payoutChart?.points) > 0) return true;
  if (countArray(payload.dividendHistory?.events) > 0 || anyArrayMapValue(payload.dividendHistory?.yieldSeriesByFrequency) || anyArrayMapValue(payload.dividendHistory?.dividendSeriesByFrequency)) return true;
  if (countArray(payload.comparison?.items) > 0 || countArray(payload.comparison?.series) > 0 || Object.values(payload.comparison?.seriesByPeriod || {}).some(series => Array.isArray(series) && series.some(item => countArray(item?.points) > 0))) return true;
  if (countArray(payload.distributions12m?.items) > 0 || countArray(payload.distributions12m?.months) > 0) return true;
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
  if (['ERROR', 'EMPTY'].includes(status)) return false;
  if (status === 'PARTIAL' && normalizeModalCacheMode(payload) !== 'fast') return false;
  return modalPayloadHasUsefulData(payload);
}

function modalCacheTtlMs(payload = {}, defaultTtlMs = 45_000) {
  const requested = Number(defaultTtlMs) || 45_000;
  const status = String(payload?.status || '').toUpperCase();
  // O full contém blocos pesados e não precisa ser recomputado a cada abertura.
  // O fast continua curto; ambos preservam cotação suficientemente fresca.
  const mode = normalizeModalCacheMode(payload);
  if (!['ERROR', 'EMPTY'].includes(status) && mode === 'fast') {
    return Math.max(requested, 35_000);
  }
  const rawMode = String(payload?.mode || payload?.stage || payload?.priority || '').toLowerCase();
  const explicitFull = payload?.fullOnly || rawMode.includes('full');
  if (!['ERROR', 'EMPTY', 'PARTIAL'].includes(status) && explicitFull) {
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
    mode: runtime.mode || 'full',
    requestedMode: runtime.requestedMode || runtime.mode || 'full',
    cacheStatus: runtime.cacheStatus,
    elapsedMs: runtime.elapsedMs,
    cached: runtime.cached,
    coalesced: runtime.coalesced,
    requestId: runtime.requestId,
    storedAt: runtime.storedAt || new Date().toISOString()
  };
  if (runtime.fallbackReason) modalRuntime.fallbackReason = runtime.fallbackReason;
  const delivery = buildModalDelivery(payload, runtime);
  return {
    ...payload,
    progressive: true,
    delivery,
    contractCapabilities: {
      progressiveStages: ['fast', 'full'],
      sectionDelivery: true,
      cancellableClientRequest: true,
      staleFallback: true
    },
    diagnostics: {
      ...diagnostics,
      modalRuntime
    }
  };
}

function rebindModalRequestContext(payload = {}, { requestedMode = 'full', requestId } = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  const requestedStage = String(requestedMode || '').toLowerCase() === 'fast' ? 'fast' : 'full';
  const currentDelivery = payload.delivery && typeof payload.delivery === 'object'
    ? payload.delivery
    : buildModalDelivery(payload, { requestedMode: requestedStage, requestId });
  const effectiveRequestId = requestId || currentDelivery.requestId;
  const diagnostics = payload.diagnostics && typeof payload.diagnostics === 'object' ? payload.diagnostics : {};
  const modalRuntime = diagnostics.modalRuntime && typeof diagnostics.modalRuntime === 'object'
    ? diagnostics.modalRuntime
    : {};
  return {
    ...payload,
    ...(effectiveRequestId ? { requestId: effectiveRequestId } : {}),
    delivery: {
      ...currentDelivery,
      requestedStage,
      ...(effectiveRequestId ? { requestId: effectiveRequestId } : {})
    },
    diagnostics: {
      ...diagnostics,
      modalRuntime: {
        ...modalRuntime,
        requestedMode: requestedStage,
        ...(effectiveRequestId ? { requestId: effectiveRequestId } : {})
      }
    }
  };
}

export async function withAssetModalRuntime({ family, ticker, payload = {}, ttlMs = 45_000, staleMs = 120_000, producer }) {
  if (typeof producer !== 'function') throw new Error('withAssetModalRuntime requer producer.');
  const key = modalCacheKey({ family, ticker, payload });
  const refresh = boolish(payload.refresh) || boolish(payload.nocache) || boolish(payload.noCache) || Boolean(payload._ts);
  let staleSnapshot = null;
  const deadlineMs = assetModalDeadlineMs(payload);
  const requestedMode = normalizeModalCacheMode(payload);
  const requestId = String(payload.requestId || payload.clientRequestId || '').trim() || undefined;

  if (!refresh) {
    const cached = getCache(key, { allowStale: true });
    const crossStageKey = modalCrossStageCacheKey({ family, ticker, payload });
    const fullCached = crossStageKey ? getCache(crossStageKey, { allowStale: true }) : null;
    if (fullCached?.value && fullCached.status === 'HIT' && modalPayloadHasUsefulData(fullCached.value)) {
      return rebindModalRequestContext(decorateModalPayload(fullCached.value, {
        family,
        requestedMode,
        requestId,
        cacheStatus: 'HIT_FULL_FOR_FAST',
        mode: 'full',
        elapsedMs: 0,
        cached: true,
        coalesced: false,
        storedAt: fullCached.value?.updatedAt
      }), { requestedMode, requestId });
    }
    if (cached?.value && cached.status === 'HIT') {
      return rebindModalRequestContext(decorateModalPayload(cached.value, {
        family,
        requestedMode,
        requestId,
        cacheStatus: cached.status,
        mode: normalizeModalCacheMode(payload),
        elapsedMs: 0,
        cached: true,
        coalesced: false,
        storedAt: cached.value?.updatedAt
      }), { requestedMode, requestId });
    }
    if (fullCached?.value && fullCached.status === 'STALE' && modalPayloadHasUsefulData(fullCached.value)) {
      staleSnapshot = { ...fullCached, status: 'STALE_FULL_FOR_FAST' };
    } else if (cached?.value && cached.status === 'STALE') {
      staleSnapshot = cached;
    }
  }

  const coalescedResult = await coalesce(key, async () => {
    if (!refresh) {
      const joinedCached = getCache(key, { allowStale: true });
      const joinedCrossStageKey = modalCrossStageCacheKey({ family, ticker, payload });
      const joinedFullCached = joinedCrossStageKey ? getCache(joinedCrossStageKey, { allowStale: true }) : null;
      if (joinedFullCached?.value && joinedFullCached.status === 'HIT' && modalPayloadHasUsefulData(joinedFullCached.value)) {
        return decorateModalPayload(joinedFullCached.value, {
          family,
          requestedMode,
          requestId,
          cacheStatus: 'HIT_FULL_FOR_FAST',
          mode: 'full',
          elapsedMs: 0,
          cached: true,
          coalesced: true,
          storedAt: joinedFullCached.value?.updatedAt
        });
      }
      if (joinedCached?.value && joinedCached.status === 'HIT') {
        return decorateModalPayload(joinedCached.value, {
          family,
          requestedMode,
          requestId,
          cacheStatus: joinedCached.status,
          mode: normalizeModalCacheMode(payload),
          elapsedMs: 0,
          cached: true,
          coalesced: true,
          storedAt: joinedCached.value?.updatedAt
        });
      }
      if (joinedFullCached?.value && joinedFullCached.status === 'STALE' && modalPayloadHasUsefulData(joinedFullCached.value)) {
        staleSnapshot = { ...joinedFullCached, status: 'STALE_FULL_FOR_FAST' };
      } else if (joinedCached?.value && joinedCached.status === 'STALE') {
        staleSnapshot = joinedCached;
      }
    }

    const startedAt = Date.now();
    try {
      const fresh = await withModalDeadline(() => producer(), deadlineMs, { family, ticker });
      const elapsedMs = Date.now() - startedAt;
      const decorated = decorateModalPayload(fresh, {
        family,
        requestedMode,
        requestId,
        cacheStatus: refresh ? 'BYPASS' : 'MISS',
        mode: normalizeModalCacheMode(payload),
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
          requestedMode,
          requestId,
          cacheStatus: 'STALE_FALLBACK',
          mode: normalizeModalCacheMode(payload),
          elapsedMs,
          cached: true,
          coalesced: false,
          storedAt: staleSnapshot.value?.updatedAt,
          fallbackReason: error?.message || String(error)
        });
      }
      if (isModalDeadlineError(error)) {
        return decorateModalPayload(modalTimeoutPayload({ family, ticker, stage: requestedMode, deadlineMs, elapsedMs, error }), {
          family,
          requestedMode,
          requestId,
          mode: requestedMode,
          cacheStatus: 'DEADLINE',
          elapsedMs,
          cached: false,
          coalesced: false,
          fallbackReason: error?.message || String(error)
        });
      }
      throw error;
    }
  });
  return rebindModalRequestContext(coalescedResult, { requestedMode, requestId });
}

export const _test = {
  modalCacheKey,
  modalCacheKeyWithMode,
  modalCrossStageCacheKey,
  isModalPayloadCacheable,
  modalPayloadHasUsefulData,
  buildModalDelivery,
  stockModalSections,
  fiiModalSections,
  modalCacheTtlMs,
  normalizeModalCacheSurface,
  normalizeModalCacheMode,
  modalStage,
  decorateModalPayload,
  assetModalDeadlineMs,
  modalTimeoutPayload,
  withModalDeadline,
  settleFastModalSource,
  rebindModalRequestContext,
  isModalDeadlineError
};
