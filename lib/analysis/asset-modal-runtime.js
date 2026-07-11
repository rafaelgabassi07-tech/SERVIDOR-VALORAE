import { coalesce, getCache, setCache, stableKey } from '../core/cache.js';
import { VALORAE_MOBILE_CACHE_POLICY_SECONDS } from '../core/mobile-protocol.js';

export const ASSET_MODAL_RUNTIME_VERSION = '26.asset-modal.runtime.v16-section-complete-skeleton';

// O deadline HTTP não deve cancelar nem esquecer a captura profunda. Esta tabela mantém
// o producer real vivo até terminar, permitindo que uma nova tentativa se conecte ao mesmo
// trabalho e que o resultado concluído aqueça o cache mesmo após a primeira resposta.
const modalProducerFlights = new Map();

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
  const dividendHistoryReady = countArray(payload.dividendHistory?.events) > 0 ||
    anyArrayMapValue(payload.dividendHistory?.yieldSeriesByFrequency) ||
    anyArrayMapValue(payload.dividendHistory?.dividendSeriesByFrequency);
  const dividendRadarReady = String(payload.dividendRadar?.status || '').toUpperCase() === 'OK' &&
    Array.isArray(payload.dividendRadar?.months) && payload.dividendRadar.months.some(month =>
      month?.activeDateCom === true || month?.activePayment === true || Number(month?.dateComCount) > 0 || Number(month?.paymentCount) > 0
    );
  const payoutReady = countArray(payload.payoutChart?.points) > 0;
  const companyProfileReady = countArray(payload.companyProfile?.sections) > 0 || hasMeaningfulValueItems(payload.companyProfile?.facts);
  const companyDataReady = hasMeaningfulValueItems(payload.companyData?.facts) ||
    countArray(payload.companyData?.companyPapers) > 0 || countArray(payload.companyData?.fractionalPapers) > 0 ||
    (Array.isArray(payload.companyData?.sections) && payload.companyData.sections.some(section => countArray(section?.values) > 0));
  const companyInformationReady = hasMeaningfulValueItems(payload.companyInformation?.facts) ||
    (Array.isArray(payload.companyInformation?.groups) && payload.companyInformation.groups.some(group => hasMeaningfulValueItems(group?.facts)));
  const regionReady = countArray(payload.revenueByRegion?.items) > 0;
  const businessReady = countArray(payload.revenueByBusiness?.items) > 0;
  const revenueProfitReady = countArray(payload.revenueProfitChart?.points) > 0;
  const profitQuoteReady = countArray(payload.profitQuoteChart?.points) > 0;
  const equityEvolutionReady = countArray(payload.equityEvolutionChart?.points) > 0;
  const resultsReady = countArray(payload.resultsStatement?.rows) > 0 || hasObjectEntries(payload.resultsStatement?.tablesByPeriod);
  const balanceReady = countArray(payload.balanceSheetStatement?.rows) > 0 || hasObjectEntries(payload.balanceSheetStatement?.tablesByPeriod);
  return [
    ['quote', hasPositiveNumber(payload.quoteSummary?.price) || hasMeaningfulDisplayValue(payload.quoteSummary?.priceDisplay)],
    ['chart', countArray(payload.chart?.points) >= 2],
    ['metrics', hasMeaningfulValueItems(payload.metrics)],
    ['fundamentalIndicators', countArray(payload.fundamentalIndicators?.items) > 0 || (Array.isArray(payload.fundamentalIndicators?.groups) && payload.fundamentalIndicators.groups.some(group => countArray(group?.items) > 0))],
    ['historicalIndicators', countArray(payload.historicalIndicators?.rows) > 0 || hasObjectEntries(payload.historicalIndicators?.tablesByPeriod)],
    ['checklist', hasResolvedChecklistItems(payload.checklist)],
    // O APK renderiza três blocos independentes. O grupo só deixa de ser deferred quando
    // histórico, radar e payout têm dados reais, evitando finalizar o full com cards vazios.
    ['dividends', dividendHistoryReady && dividendRadarReady && payoutReady],
    ['peerComparison', countArray(payload.peerComparison?.rows) > 0],
    ['indexComparison', countArray(payload.indexComparison?.items) > 0 || countArray(payload.indexComparison?.series) > 0 || hasObjectEntries(payload.indexComparison?.seriesByPeriod)],
    // O grupo de empresa cobre os três cards consumidos pelo APK; uma única subseção não deve
    // marcar todo o conjunto como concluído.
    ['company', companyProfileReady && companyDataReady && companyInformationReady],
    ['revenueBreakdown', regionReady && businessReady],
    ['shareholdingPosition', countArray(payload.shareholdingPosition?.rows) > 0],
    ['financialCharts', revenueProfitReady && profitQuoteReady && equityEvolutionReady],
    ['financialStatements', resultsReady && balanceReady],
    ['announcements', countArray(payload.announcements?.items) > 0],
    ['returns', countArray(payload.returns?.rows) > 0]
  ];
}


function stockModalQualitySections(payload = {}) {
  return [
    ['quote', hasPositiveNumber(payload.quoteSummary?.price) || hasMeaningfulDisplayValue(payload.quoteSummary?.priceDisplay)],
    ['chart', countArray(payload.chart?.points) >= 2],
    ['metrics', hasMeaningfulValueItems(payload.metrics)],
    ['fundamentalIndicators', countArray(payload.fundamentalIndicators?.items) > 0 || (Array.isArray(payload.fundamentalIndicators?.groups) && payload.fundamentalIndicators.groups.some(group => countArray(group?.items) > 0))],
    ['historicalIndicators', countArray(payload.historicalIndicators?.rows) > 0 || hasObjectEntries(payload.historicalIndicators?.tablesByPeriod)],
    ['checklist', hasResolvedChecklistItems(payload.checklist)],
    ['dividends', countArray(payload.dividendHistory?.events) > 0 || anyArrayMapValue(payload.dividendHistory?.yieldSeriesByFrequency) || anyArrayMapValue(payload.dividendHistory?.dividendSeriesByFrequency)],
    ['peerComparison', countArray(payload.peerComparison?.rows) > 0],
    ['indexComparison', countArray(payload.indexComparison?.items) > 0 || countArray(payload.indexComparison?.series) > 0 || hasObjectEntries(payload.indexComparison?.seriesByPeriod)],
    ['company', hasMeaningfulValueItems(payload.companyProfile?.facts) || countArray(payload.companyProfile?.sections) > 0 || hasMeaningfulValueItems(payload.companyData?.facts) || hasMeaningfulValueItems(payload.companyInformation?.facts) || (Array.isArray(payload.companyInformation?.groups) && payload.companyInformation.groups.some(group => hasMeaningfulValueItems(group?.facts)))],
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
    ['patrimonialInfo', countArray(payload.patrimonialInfo?.metrics) > 0 || countArray(payload.patrimonialInfo?.bars) > 0 || countArray(payload.patrimonialInfo?.segmentAverage?.rows) > 0],
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
  const status = String(payload.status || '').toUpperCase();
  const deadlineTimeout = Boolean(payload?.diagnostics?.modalDeadline?.timeout);
  const explicitlyPartial = payload.partial === true || status === 'PARTIAL' || status === 'ERROR';
  const quality = modalPayloadQualityProfile(payload, family);
  const completenessPercent = quality.completenessPercent;
  // A qualidade de cache continua tolerante a fontes legitimamente incompletas, mas a entrega
  // visual só é final quando todas as seções renderizadas pelo modal têm conteúdo real.
  const sectionCompleteForDelivery = missingSections.length === 0;
  const completeForDelivery = quality.completeForDelivery && sectionCompleteForDelivery;
  const isFinal = deliveredStage === 'full' && !deadlineTimeout && !explicitlyPartial && completeForDelivery;
  const qualityTier = completeForDelivery
    ? 'complete'
    : quality.stableForCache
      ? 'expanded'
      : quality.qualityTier;
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
    retryable: deadlineTimeout || explicitlyPartial || !completeForDelivery,
    qualityTier,
    stableForCache: quality.stableForCache,
    completeForDelivery,
    deepSectionCount: quality.deepSectionCount,
    minimumDeepSections: quality.deliveryMinimumDeepSections,
    recoveryTargetPercent: quality.recoveryTargetPercent,
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

function modalPayloadCompletenessPercent(payload = {}, family = '') {
  const resolvedFamily = String(family || payload.assetType || '').toLowerCase().includes('fii') || payload.aboutFund || payload.propertyPortfolio
    ? 'fii'
    : 'stock';
  const sections = resolvedFamily === 'fii' ? fiiModalSections(payload) : stockModalQualitySections(payload);
  if (!sections.length) return 0;
  return Math.round((sections.filter(([, available]) => available).length / sections.length) * 100);
}

function modalPayloadQualityProfile(payload = {}, family = '') {
  const resolvedFamily = String(family || payload.assetType || '').toLowerCase().includes('fii') || payload.aboutFund || payload.propertyPortfolio
    ? 'fii'
    : 'stock';
  const sections = resolvedFamily === 'fii' ? fiiModalSections(payload) : stockModalQualitySections(payload);
  const available = new Set(sections.filter(([, present]) => present).map(([id]) => id));
  const completenessPercent = sections.length ? Math.round((available.size / sections.length) * 100) : 0;
  const deepIds = resolvedFamily === 'fii'
    ? ['indexComparison', 'peerComparison', 'checklist', 'distributions12m', 'dividendCharts', 'aboutFund', 'propertyPortfolio', 'vacancyHistory', 'patrimonialInfo', 'historicalIndicators', 'information', 'returns']
    : ['fundamentalIndicators', 'historicalIndicators', 'checklist', 'dividends', 'peerComparison', 'indexComparison', 'company', 'revenueBreakdown', 'shareholdingPosition', 'financialCharts', 'financialStatements', 'returns'];
  const deepSectionCount = deepIds.filter(id => available.has(id)).length;
  const baseReady = available.has('quote') || available.has('chart') || available.has('metrics');
  const stableThreshold = resolvedFamily === 'fii' ? 58 : 62;
  const recoveryTargetPercent = resolvedFamily === 'fii' ? 76 : 82;
  const minimumDeepSections = 4;
  const deliveryMinimumDeepSections = resolvedFamily === 'fii' ? 6 : 7;
  const stableForCache = baseReady && completenessPercent >= stableThreshold && deepSectionCount >= minimumDeepSections;
  const completeForDelivery = baseReady && deepSectionCount >= deliveryMinimumDeepSections && (
    completenessPercent >= recoveryTargetPercent || deepSectionCount >= deliveryMinimumDeepSections + 1
  );
  const qualityTier = completeForDelivery
    ? 'complete'
    : stableForCache
      ? 'expanded'
      : baseReady
        ? 'basic'
        : 'empty';
  return {
    family: resolvedFamily,
    completenessPercent,
    deepSectionCount,
    minimumDeepSections,
    deliveryMinimumDeepSections,
    stableThreshold,
    recoveryTargetPercent,
    stableForCache,
    completeForDelivery,
    qualityTier
  };
}


function parseRecoveryAvailableSections(payload = {}) {
  const raw = payload.knownAvailableSections ?? payload.currentAvailableSections ?? payload.availableSections;
  if (Array.isArray(raw)) return new Set(raw.map(value => String(value || '').trim()).filter(Boolean));
  const text = String(raw ?? '').trim();
  if (!text) return new Set();
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return new Set(parsed.map(value => String(value || '').trim()).filter(Boolean));
    } catch {
      // Fall through to the compact comma-separated representation used by the APK.
    }
  }
  return new Set(text.split(',').map(value => value.trim()).filter(Boolean));
}

function recoveryClientQuality(payload = {}) {
  const completeness = Number(payload.knownCompletenessPercent ?? payload.currentCompletenessPercent);
  const deepSectionCount = Number(payload.knownDeepSectionCount ?? payload.currentDeepSectionCount);
  const availableSections = parseRecoveryAvailableSections(payload);
  const supplied = Number.isFinite(completeness) || Number.isFinite(deepSectionCount) || availableSections.size > 0;
  return {
    supplied,
    completenessPercent: Number.isFinite(completeness) ? Math.min(100, Math.max(0, completeness)) : 0,
    deepSectionCount: Number.isFinite(deepSectionCount) ? Math.max(0, deepSectionCount) : 0,
    availableSections
  };
}

function recoveryCacheUpgrade(cachePayload = {}, family = '', requestPayload = {}) {
  const known = recoveryClientQuality(requestPayload);
  if (!known.supplied || !isModalPayloadCacheable(cachePayload, family)) {
    return { upgraded: false, known, profile: modalPayloadQualityProfile(cachePayload, family), newSections: [] };
  }
  const profile = modalPayloadQualityProfile(cachePayload, family);
  const sections = (profile.family === 'fii' ? fiiModalSections(cachePayload) : stockModalSections(cachePayload))
    .filter(([, present]) => present)
    .map(([id]) => id);
  const newSections = sections.filter(id => !known.availableSections.has(id));
  const upgraded = profile.completeForDelivery ||
    profile.completenessPercent > known.completenessPercent ||
    profile.deepSectionCount > known.deepSectionCount ||
    newSections.length > 0;
  return { upgraded, known, profile, newSections };
}

function isModalPayloadCacheable(payload = {}, family = '') {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.ok === false) return false;
  const status = String(payload.status || '').toUpperCase();
  if (['ERROR', 'EMPTY'].includes(status)) return false;
  if (status === 'PARTIAL' && normalizeModalCacheMode(payload) !== 'fast') return false;
  if (!modalPayloadHasUsefulData(payload)) return false;
  const terminalClassification = ['NOT_FII', 'NOT_STOCK'].includes(status);
  if (!terminalClassification && normalizeModalCacheMode(payload) === 'full') {
    // O cache full só pode estabilizar uma resposta realmente expandida. Contratos básicos
    // permanecem recuperáveis e não bloqueiam as tentativas seguintes por vários minutos.
    if (!modalPayloadQualityProfile(payload, family).stableForCache) return false;
  }
  return true;
}

function modalCacheTtlMs(payload = {}, defaultTtlMs = 45_000) {
  const requested = Number(defaultTtlMs) || 45_000;
  const status = String(payload?.status || '').toUpperCase();
  // Fresh payloads use the exact TTL advertised to the APK. Partial/error payloads keep
  // the shorter caller budget and never become fresher than the shared protocol.
  const mode = normalizeModalCacheMode(payload);
  if (!['ERROR', 'EMPTY'].includes(status) && mode === 'fast') {
    return VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetModalFast * 1000;
  }
  const rawMode = String(payload?.mode || payload?.stage || payload?.priority || '').toLowerCase();
  const explicitFull = payload?.fullOnly || rawMode.includes('full');
  if (!['ERROR', 'EMPTY', 'PARTIAL'].includes(status) && explicitFull) {
    return VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetModalFull * 1000;
  }
  return Math.min(requested, mode === 'fast'
    ? VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetModalFast * 1000
    : VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetModalFull * 1000);
}

function modalCacheStaleGraceMs(payload = {}, requestedStaleMs) {
  const mode = normalizeModalCacheMode(payload);
  const protocolGrace = (mode === 'fast'
    ? VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetModalFastStaleGrace
    : VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetModalFullStaleGrace) * 1000;
  const requested = Number(requestedStaleMs);
  return Number.isFinite(requested) && requested >= 0 ? Math.min(requested, protocolGrace) : protocolGrace;
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
      staleFallback: true,
      lateProducerCache: true
    },
    diagnostics: {
      ...diagnostics,
      modalRuntime
    }
  };
}

function modalPayloadPromotionScore(payload = {}, family = '') {
  const profile = modalPayloadQualityProfile(payload, family);
  return [
    profile.completeForDelivery ? 1 : 0,
    profile.stableForCache ? 1 : 0,
    profile.deepSectionCount,
    profile.completenessPercent
  ];
}

function compareModalPromotionScore(left = [], right = []) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const delta = Number(left[index] || 0) - Number(right[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function shouldPromoteModalCache(candidate = {}, existing = {}, family = '') {
  if (!isModalPayloadCacheable(candidate, family)) return false;
  if (!existing || typeof existing !== 'object' || !isModalPayloadCacheable(existing, family)) return true;
  // Equal quality is intentionally promotable: quote/name/logo may have become fresher even
  // when the section count is unchanged. A lower-quality transient response never replaces
  // a richer snapshot that is already protecting the next modal opening.
  return compareModalPromotionScore(
    modalPayloadPromotionScore(candidate, family),
    modalPayloadPromotionScore(existing, family)
  ) >= 0;
}

function promoteModalCache({ key, fresh, family, ttlMs, staleMs, payload = {} } = {}) {
  const current = getCache(key, { allowStale: true });
  if (!shouldPromoteModalCache(fresh, current?.value, family)) return false;
  setCache(key, fresh, modalCacheTtlMs(fresh, ttlMs), modalCacheStaleGraceMs(payload, staleMs));
  return true;
}

function modalRuntimeCoalesceKey(key, { forcedRefresh = false, recovery = false, requestId } = {}) {
  if (forcedRefresh) return `${key}:refresh:${requestId || 'anonymous'}`;
  // Recovery must re-check the cache independently. Reusing the normal outer coalesce can
  // make it inherit a stale/timeout result produced before the deep cache finished warming.
  // The expensive producer remains deduplicated by modalProducerFlights.
  if (recovery) return `${key}:recovery:${requestId || 'anonymous'}`;
  return key;
}

function startOrJoinModalProducer({ key, family, producer, refresh = false, ttlMs, staleMs, payload = {} } = {}) {
  const flightKey = refresh ? `${key}:refresh` : key;
  const existing = modalProducerFlights.get(flightKey);
  if (existing) return { promise: existing, joined: true };

  const promise = Promise.resolve().then(producer);
  modalProducerFlights.set(flightKey, promise);

  // Anexa tratamento independente do request HTTP. Assim, se a corrida com o deadline
  // terminar primeiro, a conclusão tardia ainda é armazenada e nunca vira rejection solta.
  // Refresh ignora a leitura do cache, mas uma resposta nova e útil deve promovê-lo.
  promise.then(
    fresh => {
      promoteModalCache({ key, fresh, family, ttlMs, staleMs, payload });
    },
    () => undefined
  ).finally(() => {
    if (modalProducerFlights.get(flightKey) === promise) modalProducerFlights.delete(flightKey);
  });

  return { promise, joined: false };
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
  const forcedRefresh = boolish(payload.refresh) || boolish(payload.nocache) || boolish(payload.noCache) || Boolean(payload._ts);
  const recovery = boolish(payload.recovery) || boolish(payload.resume) || boolish(payload.revalidateIncomplete);
  const bypassCache = forcedRefresh || recovery;
  let staleSnapshot = null;
  const deadlineMs = assetModalDeadlineMs(payload);
  const requestedMode = normalizeModalCacheMode(payload);
  const requestId = String(payload.requestId || payload.clientRequestId || '').trim() || undefined;

  const tryRecoveryCacheUpgrade = () => {
    if (!recovery) return null;
    const cached = getCache(key, { allowStale: true });
    if (!cached?.value || !['HIT', 'STALE'].includes(cached.status)) return null;
    const upgrade = recoveryCacheUpgrade(cached.value, family, payload);
    if (!upgrade.upgraded) return null;

    const staleUpgrade = cached.status === 'STALE';
    let backgroundJoined = false;
    if (staleUpgrade || !upgrade.profile.completeForDelivery) {
      const backgroundFlight = startOrJoinModalProducer({ key, family, producer, refresh: false, ttlMs, staleMs, payload });
      backgroundJoined = backgroundFlight.joined;
    }
    const cacheStatus = staleUpgrade
      ? 'RECOVERY_STALE_UPGRADE'
      : upgrade.profile.completeForDelivery
        ? 'RECOVERY_CACHE_COMPLETE'
        : 'RECOVERY_CACHE_UPGRADE';
    const decorated = decorateModalPayload(cached.value, {
      family,
      requestedMode,
      requestId,
      cacheStatus,
      mode: normalizeModalCacheMode(cached.value),
      elapsedMs: 0,
      cached: true,
      coalesced: backgroundJoined,
      storedAt: cached.value?.updatedAt
    });
    if (staleUpgrade && decorated?.delivery) {
      decorated.delivery = {
        ...decorated.delivery,
        isFinal: false,
        retryable: true,
        cacheStatus
      };
    }
    return decorated;
  };

  const immediateRecoveryUpgrade = tryRecoveryCacheUpgrade();
  if (immediateRecoveryUpgrade) {
    return rebindModalRequestContext(immediateRecoveryUpgrade, { requestedMode, requestId });
  }

  if (!bypassCache) {
    const cached = getCache(key, { allowStale: true });
    const crossStageKey = modalCrossStageCacheKey({ family, ticker, payload });
    const fullCached = crossStageKey ? getCache(crossStageKey, { allowStale: true }) : null;
    if (fullCached?.value && fullCached.status === 'HIT' && isModalPayloadCacheable(fullCached.value, family)) {
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
    if (cached?.value && cached.status === 'HIT' && isModalPayloadCacheable(cached.value, family)) {
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
    if (fullCached?.value && fullCached.status === 'STALE' && isModalPayloadCacheable(fullCached.value, family)) {
      staleSnapshot = { ...fullCached, status: 'STALE_FULL_FOR_FAST' };
    } else if (cached?.value && cached.status === 'STALE' && isModalPayloadCacheable(cached.value, family)) {
      staleSnapshot = cached;
    }
  }

  if (recovery && !staleSnapshot) {
    const recoveryCached = getCache(key, { allowStale: true });
    const recoveryCrossKey = modalCrossStageCacheKey({ family, ticker, payload });
    const recoveryFullCached = recoveryCrossKey ? getCache(recoveryCrossKey, { allowStale: true }) : null;
    const candidate = recoveryFullCached?.value ? recoveryFullCached : recoveryCached;
    if (candidate?.value && isModalPayloadCacheable(candidate.value, family)) staleSnapshot = candidate;
  }

  const runtimeCoalesceKey = modalRuntimeCoalesceKey(key, { forcedRefresh, recovery, requestId });
  const coalescedResult = await coalesce(runtimeCoalesceKey, async () => {
    const joinedRecoveryUpgrade = tryRecoveryCacheUpgrade();
    if (joinedRecoveryUpgrade) return joinedRecoveryUpgrade;

    if (!bypassCache) {
      const joinedCached = getCache(key, { allowStale: true });
      const joinedCrossStageKey = modalCrossStageCacheKey({ family, ticker, payload });
      const joinedFullCached = joinedCrossStageKey ? getCache(joinedCrossStageKey, { allowStale: true }) : null;
      if (joinedFullCached?.value && joinedFullCached.status === 'HIT' && isModalPayloadCacheable(joinedFullCached.value, family)) {
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
      if (joinedCached?.value && joinedCached.status === 'HIT' && isModalPayloadCacheable(joinedCached.value, family)) {
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
      if (joinedFullCached?.value && joinedFullCached.status === 'STALE' && isModalPayloadCacheable(joinedFullCached.value, family)) {
        staleSnapshot = { ...joinedFullCached, status: 'STALE_FULL_FOR_FAST' };
      } else if (joinedCached?.value && joinedCached.status === 'STALE' && isModalPayloadCacheable(joinedCached.value, family)) {
        staleSnapshot = joinedCached;
      }
    }

    const startedAt = Date.now();
    try {
      const producerFlight = startOrJoinModalProducer({ key, family, producer, refresh: forcedRefresh, ttlMs, staleMs, payload });
      const fresh = await withModalDeadline(() => producerFlight.promise, deadlineMs, { family, ticker });
      const elapsedMs = Date.now() - startedAt;
      const decorated = decorateModalPayload(fresh, {
        family,
        requestedMode,
        requestId,
        cacheStatus: forcedRefresh ? 'BYPASS' : recovery ? (producerFlight.joined ? 'RECOVERY_JOIN' : 'RECOVERY_MISS') : 'MISS',
        mode: normalizeModalCacheMode(payload),
        elapsedMs,
        cached: false,
        coalesced: producerFlight.joined
      });
      return decorated;
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      if (!forcedRefresh && staleSnapshot?.value) {
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
  modalPayloadCompletenessPercent,
  modalPayloadQualityProfile,
  modalPayloadHasUsefulData,
  buildModalDelivery,
  stockModalSections,
  fiiModalSections,
  modalCacheTtlMs,
  modalCacheStaleGraceMs,
  normalizeModalCacheSurface,
  normalizeModalCacheMode,
  modalStage,
  decorateModalPayload,
  assetModalDeadlineMs,
  modalTimeoutPayload,
  withModalDeadline,
  settleFastModalSource,
  rebindModalRequestContext,
  recoveryClientQuality,
  recoveryCacheUpgrade,
  modalPayloadPromotionScore,
  shouldPromoteModalCache,
  promoteModalCache,
  modalRuntimeCoalesceKey,
  isModalDeadlineError,
  modalProducerFlightCount: () => modalProducerFlights.size
};
