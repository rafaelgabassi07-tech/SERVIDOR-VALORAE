import { coalesce, getCache, setCache, stableKey } from '../core/cache.js';
import { VALORAE_MOBILE_CACHE_POLICY_SECONDS } from '../core/mobile-protocol.js';

export const ASSET_MODAL_RUNTIME_VERSION = '26.asset-modal.runtime.v17-late-arrival-settlement';

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
    ['revenueProfitChart', revenueProfitReady],
    ['profitQuoteChart', profitQuoteReady],
    ['equityEvolutionChart', equityEvolutionReady],
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
  const revenueProfitReady = countArray(payload.revenueProfitChart?.points) > 0;
  const profitQuoteReady = countArray(payload.profitQuoteChart?.points) > 0;
  const equityEvolutionReady = countArray(payload.equityEvolutionChart?.points) > 0;
  return [
    ['quote', hasPositiveNumber(payload.quoteSummary?.price) || hasMeaningfulDisplayValue(payload.quoteSummary?.priceDisplay)],
    ['chart', countArray(payload.chart?.points) >= 2],
    ['metrics', hasMeaningfulValueItems(payload.metrics)],
    ['fundamentalIndicators', countArray(payload.fundamentalIndicators?.items) > 0 || (Array.isArray(payload.fundamentalIndicators?.groups) && payload.fundamentalIndicators.groups.some(group => countArray(group?.items) > 0))],
    ['historicalIndicators', countArray(payload.historicalIndicators?.rows) > 0 || hasObjectEntries(payload.historicalIndicators?.tablesByPeriod)],
    ['revenueProfitChart', revenueProfitReady],
    ['profitQuoteChart', profitQuoteReady],
    ['equityEvolutionChart', equityEvolutionReady],
    ['checklist', hasResolvedChecklistItems(payload.checklist)],
    ['dividends', countArray(payload.dividendHistory?.events) > 0 || anyArrayMapValue(payload.dividendHistory?.yieldSeriesByFrequency) || anyArrayMapValue(payload.dividendHistory?.dividendSeriesByFrequency)],
    ['peerComparison', countArray(payload.peerComparison?.rows) > 0],
    ['indexComparison', countArray(payload.indexComparison?.items) > 0 || countArray(payload.indexComparison?.series) > 0 || hasObjectEntries(payload.indexComparison?.seriesByPeriod)],
    ['company', hasMeaningfulValueItems(payload.companyProfile?.facts) || countArray(payload.companyProfile?.sections) > 0 || hasMeaningfulValueItems(payload.companyData?.facts) || hasMeaningfulValueItems(payload.companyInformation?.facts) || (Array.isArray(payload.companyInformation?.groups) && payload.companyInformation.groups.some(group => hasMeaningfulValueItems(group?.facts)))],
    ['revenueBreakdown', countArray(payload.revenueByRegion?.items) > 0 || countArray(payload.revenueByBusiness?.items) > 0],
    ['shareholdingPosition', countArray(payload.shareholdingPosition?.rows) > 0],
    ['financialCharts', revenueProfitReady && profitQuoteReady && equityEvolutionReady],
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


const STOCK_CRITICAL_SECTIONS = Object.freeze([
  'historicalIndicators',
  'revenueProfitChart',
  'profitQuoteChart',
  'equityEvolutionChart',
  'indexComparison',
  'announcements'
]);

const FII_CRITICAL_SECTIONS = Object.freeze([
  'historicalIndicators',
  'patrimonialInfo',
  'indexComparison',
  'announcements'
]);

const SECTION_ALIASES = Object.freeze({
  financialCharts: ['revenueProfitChart', 'profitQuoteChart', 'equityEvolutionChart'],
  financialStatements: ['resultsStatement', 'balanceSheetStatement'],
  revenueBreakdown: ['revenueByRegion', 'revenueByBusiness'],
  company: ['companyProfile', 'companyData', 'companyInformation'],
  dividends: ['dividendHistory', 'dividendRadar', 'payoutChart']
});

function parseSectionList(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  const text = String(value ?? '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(item => String(item || '').trim()).filter(Boolean);
    } catch {
      // Compact comma-separated query format remains supported.
    }
  }
  return text.split(',').map(item => item.trim()).filter(Boolean);
}

function expandSectionAliases(values = []) {
  const expanded = [];
  const seen = new Set();
  const add = id => {
    const clean = String(id || '').trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    expanded.push(clean);
  };
  for (const id of values) {
    add(id);
    for (const alias of SECTION_ALIASES[id] || []) add(alias);
  }
  return expanded;
}

function requestedCriticalSections(payload = {}, family = '') {
  const resolvedFamily = String(family || payload.assetType || '').toLowerCase().includes('fii') ? 'fii' : 'stock';
  // The mandatory delivery contract is immutable per family. required/missing/deferred query
  // fields only steer producers toward absent sections; they must neither weaken the full modal
  // nor promote optional blocks to critical requirements.
  return [...(resolvedFamily === 'fii' ? FII_CRITICAL_SECTIONS : STOCK_CRITICAL_SECTIONS)];
}

function criticalSectionStatus(payload = {}, family = '', requestPayload = {}) {
  const sections = family === 'fii' ? fiiModalSections(payload) : stockModalSections(payload);
  const available = new Map(sections);
  const requiredSections = requestedCriticalSections(requestPayload, family);
  const missingRequiredSections = requiredSections.filter(id => available.get(id) !== true);
  return { requiredSections, missingRequiredSections };
}

function sectionPayloadFieldMap(family = '') {
  if (String(family).toLowerCase() === 'fii') {
    return {
      quote: ['quoteSummary'], chart: ['chart'], metrics: ['metrics'], indexComparison: ['comparison'],
      peerComparison: ['peerComparison'], checklist: ['checklist'], distributions12m: ['distributions12m'],
      dividendCharts: ['dividendCharts'], aboutFund: ['aboutFund'], propertyPortfolio: ['propertyPortfolio'],
      vacancyHistory: ['vacancyHistory'], patrimonialInfo: ['patrimonialInfo'], announcements: ['announcements'],
      returns: ['returns'], information: ['infoSections'], historicalIndicators: ['historicalIndicators']
    };
  }
  return {
    quote: ['quoteSummary'], chart: ['chart'], metrics: ['metrics'], fundamentalIndicators: ['fundamentalIndicators'],
    historicalIndicators: ['historicalIndicators'], checklist: ['checklist'], dividends: ['dividendHistory', 'dividendRadar', 'payoutChart'],
    peerComparison: ['peerComparison'], indexComparison: ['indexComparison'], company: ['companyProfile', 'companyData', 'companyInformation'],
    revenueBreakdown: ['revenueByRegion', 'revenueByBusiness', 'stockRevenueByRegion', 'stockRevenueByBusiness'],
    shareholdingPosition: ['shareholdingPosition'], revenueProfitChart: ['revenueProfitChart'], profitQuoteChart: ['profitQuoteChart'],
    equityEvolutionChart: ['equityEvolutionChart'], financialCharts: ['revenueProfitChart', 'profitQuoteChart', 'equityEvolutionChart'],
    financialStatements: ['resultsStatement', 'balanceSheetStatement'], announcements: ['announcements'], returns: ['returns']
  };
}

function mergeModalPayloadSections(existing = {}, candidate = {}, family = '') {
  if (!existing || typeof existing !== 'object') return candidate;
  if (!candidate || typeof candidate !== 'object') return existing;
  const resolvedFamily = String(family || candidate.assetType || existing.assetType || '').toLowerCase().includes('fii') ? 'fii' : 'stock';
  const existingSections = new Map((resolvedFamily === 'fii' ? fiiModalSections(existing) : stockModalSections(existing)));
  const candidateSections = new Map((resolvedFamily === 'fii' ? fiiModalSections(candidate) : stockModalSections(candidate)));
  const fieldMap = sectionPayloadFieldMap(resolvedFamily);
  const statusScore = value => {
    const status = String(value || '').trim().toUpperCase();
    if (['OK', 'SUCCESS', 'READY'].includes(status)) return 4;
    if (['PARTIAL', 'DEGRADED'].includes(status)) return 3;
    if (status === 'EMPTY') return 2;
    if (['ERROR', 'TIMEOUT'].includes(status)) return 1;
    return 0;
  };
  const preferredStatus = statusScore(candidate.status) >= statusScore(existing.status)
    ? candidate.status
    : existing.status;
  const merged = {
    ...existing,
    ...candidate,
    ok: existing.ok === true || candidate.ok === true,
    status: preferredStatus || candidate.status || existing.status
  };
  for (const [sectionId, fields] of Object.entries(fieldMap)) {
    if (candidateSections.get(sectionId) === true || existingSections.get(sectionId) !== true) continue;
    for (const field of fields) {
      if (existing[field] !== undefined) merged[field] = existing[field];
    }
  }
  const existingDiagnostics = existing.diagnostics && typeof existing.diagnostics === 'object' ? existing.diagnostics : {};
  const candidateDiagnostics = candidate.diagnostics && typeof candidate.diagnostics === 'object' ? candidate.diagnostics : {};
  merged.diagnostics = { ...existingDiagnostics, ...candidateDiagnostics, sectionMerge: { preservedFromCache: true, at: new Date().toISOString() } };
  return merged;
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
  const critical = criticalSectionStatus(payload, quality.family, runtime.requestPayload || runtime.payload || {});
  const completenessPercent = quality.completenessPercent;
  // A entrega só fica final quando as seções críticas solicitadas estão presentes. Blocos
  // opcionais legitimamente ausentes ficam em unavailableSections e não prendem o modal em
  // recuperação infinita. Cache full continua estrito para nunca estabilizar os gráficos
  // financeiros ou o histórico fundamentalista vazios.
  const completeForDelivery = quality.completeForDelivery && critical.missingRequiredSections.length === 0;
  const isFinal = deliveredStage === 'full' && !deadlineTimeout && !explicitlyPartial && completeForDelivery;
  const optionalMissingSections = missingSections.filter(id => !critical.requiredSections.includes(id));
  // `isFinal` mantém o contrato funcional: as seções críticas já permitem usar o modal.
  // Ainda assim, uma resposta full pode ter blocos opcionais lentos que chegam após a primeira
  // coleta. O sinal de settlement mantém uma revalidação curta no APK sem transformar esses
  // blocos em requisitos críticos nem exigir que o usuário feche e reabra o modal.
  const settlementPending = isFinal && optionalMissingSections.length > 0;
  const qualityTier = completeForDelivery
    ? 'complete'
    : quality.stableForCache
      ? 'expanded'
      : quality.qualityTier;
  return {
    schemaVersion: '3',
    requestId: runtime.requestId || undefined,
    requestedStage,
    deliveredStage,
    isFinal,
    completenessPercent,
    availableSections,
    requiredSections: critical.requiredSections,
    missingRequiredSections: critical.missingRequiredSections,
    deferredSections: isFinal ? [] : [...new Set([...critical.missingRequiredSections, ...missingSections])],
    unavailableSections: isFinal ? optionalMissingSections : [],
    retryable: deadlineTimeout || explicitlyPartial || !completeForDelivery,
    settlementPending,
    settlementSections: settlementPending ? optionalMissingSections : [],
    settlementAttemptAfterMs: settlementPending ? 850 : undefined,
    qualityTier,
    stableForCache: quality.stableForCache && critical.missingRequiredSections.length === 0,
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
    : ['fundamentalIndicators', 'historicalIndicators', 'revenueProfitChart', 'profitQuoteChart', 'equityEvolutionChart', 'checklist', 'dividends', 'peerComparison', 'indexComparison', 'company', 'revenueBreakdown', 'shareholdingPosition', 'financialStatements', 'returns'];
  const deepSectionCount = deepIds.filter(id => available.has(id)).length;
  const baseReady = available.has('quote') || available.has('chart') || available.has('metrics');
  const stableThreshold = resolvedFamily === 'fii' ? 58 : 62;
  const recoveryTargetPercent = resolvedFamily === 'fii' ? 76 : 82;
  const minimumDeepSections = 4;
  const deliveryMinimumDeepSections = resolvedFamily === 'fii' ? 6 : 7;
  const required = resolvedFamily === 'fii' ? FII_CRITICAL_SECTIONS : STOCK_CRITICAL_SECTIONS;
  const missingCriticalSections = required.filter(id => !available.has(id));
  const stableForCache = baseReady && completenessPercent >= stableThreshold && deepSectionCount >= minimumDeepSections && missingCriticalSections.length === 0;
  const completeForDelivery = baseReady && missingCriticalSections.length === 0 && deepSectionCount >= deliveryMinimumDeepSections && (
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
    missingCriticalSections,
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
  const missingSections = new Set(parseSectionList(payload.knownMissingSections ?? payload.missingSections ?? payload.requiredSections));
  const supplied = Number.isFinite(completeness) || Number.isFinite(deepSectionCount) || availableSections.size > 0 || missingSections.size > 0;
  return {
    supplied,
    completenessPercent: Number.isFinite(completeness) ? Math.min(100, Math.max(0, completeness)) : 0,
    deepSectionCount: Number.isFinite(deepSectionCount) ? Math.max(0, deepSectionCount) : 0,
    availableSections,
    missingSections
  };
}

function recoveryCacheUpgrade(cachePayload = {}, family = '', requestPayload = {}) {
  const known = recoveryClientQuality(requestPayload);
  // O snapshot incremental pode ainda não ser elegível ao cache full, mas é válido para
  // melhorar imediatamente uma seção específica enquanto as demais continuam carregando.
  if (!known.supplied || !modalPayloadHasUsefulData(cachePayload)) {
    return { upgraded: false, known, profile: modalPayloadQualityProfile(cachePayload, family), newSections: [] };
  }
  const profile = modalPayloadQualityProfile(cachePayload, family);
  const sections = (profile.family === 'fii' ? fiiModalSections(cachePayload) : stockModalSections(cachePayload))
    .filter(([, present]) => present)
    .map(([id]) => id);
  const newSections = sections.filter(id => !known.availableSections.has(id));
  const resolvedMissingSections = [...known.missingSections].filter(id => sections.includes(id));
  // Um cache apenas `completeForDelivery` não é necessariamente uma melhoria: ele pode ser
  // exatamente a resposta final prematura que deixou blocos lentos ausentes. Só interrompemos
  // a recuperação quando houve ganho mensurável ou uma seção conhecida como ausente apareceu.
  const upgraded = resolvedMissingSections.length > 0 ||
    profile.completenessPercent > known.completenessPercent ||
    profile.deepSectionCount > known.deepSectionCount ||
    newSections.length > 0;
  return { upgraded, known, profile, newSections, resolvedMissingSections };
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
    const profile = modalPayloadQualityProfile(payload, family);
    if (!profile.stableForCache || profile.missingCriticalSections.length > 0) return false;
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
  const delivery = buildModalDelivery(payload, { ...runtime, requestPayload: runtime.requestPayload || {} });
  return {
    ...payload,
    progressive: true,
    delivery,
    contractCapabilities: {
      progressiveStages: ['fast', 'full'],
      sectionDelivery: true,
      cancellableClientRequest: true,
      staleFallback: true,
      lateProducerCache: true,
      lateArrivalSettlement: true
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
    profile.missingCriticalSections?.length === 0 ? 1 : 0,
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

function modalSectionSnapshotKey(key = '') {
  return `${key}:section-snapshot`;
}

function modalSectionSnapshot({ key, allowStale = true } = {}) {
  if (!key) return null;
  return getCache(modalSectionSnapshotKey(key), { allowStale });
}

function promoteModalSectionSnapshot({ key, fresh, family, ttlMs, staleMs, payload = {} } = {}) {
  if (!fresh || typeof fresh !== 'object' || !modalPayloadHasUsefulData(fresh)) return fresh;
  const snapshotKey = modalSectionSnapshotKey(key);
  const current = getCache(snapshotKey, { allowStale: true });
  const merged = current?.value ? mergeModalPayloadSections(current.value, fresh, family) : fresh;
  const snapshotTtlMs = Math.max(
    modalCacheTtlMs(merged, ttlMs),
    VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetModalFull * 1000
  );
  const snapshotStaleMs = Math.max(
    modalCacheStaleGraceMs(payload, staleMs),
    VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetModalFullStaleGrace * 1000
  );
  setCache(snapshotKey, merged, snapshotTtlMs, snapshotStaleMs);
  return merged;
}

function mergeModalRuntimeSnapshots({ key, family, primary } = {}) {
  const section = modalSectionSnapshot({ key, allowStale: true });
  if (!section?.value) return primary || null;
  if (!primary) return section.value;
  return mergeModalPayloadSections(primary, section.value, family);
}

function promoteModalCache({ key, fresh, family, ttlMs, staleMs, payload = {} } = {}) {
  const current = getCache(key, { allowStale: true });
  const existing = current?.value;
  const existingCacheable = isModalPayloadCacheable(existing, family);
  const freshCacheable = isModalPayloadCacheable(fresh, family);

  // Uma resposta parcial de recuperação nunca pode rebaixar um full já estável nem trocar
  // cotação/nome/logo por valores mais antigos. Ela continua acumulada no snapshot por seção
  // e só volta a concorrer ao cache full quando o conjunto incremental se torna estável.
  if (existingCacheable && !freshCacheable) return false;

  const merged = existing ? mergeModalPayloadSections(existing, fresh, family) : fresh;
  if (!isModalPayloadCacheable(merged, family)) return false;
  if (existingCacheable && freshCacheable && !shouldPromoteModalCache(fresh, existing, family)) return false;
  if (!existingCacheable && !shouldPromoteModalCache(merged, existing, family)) return false;

  setCache(key, merged, modalCacheTtlMs(merged, ttlMs), modalCacheStaleGraceMs(payload, staleMs));
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

  const promise = Promise.resolve()
    .then(producer)
    .then(fresh => promoteModalSectionSnapshot({ key, fresh, family, ttlMs, staleMs, payload }));
  modalProducerFlights.set(flightKey, promise);

  // Anexa tratamento independente do request HTTP. Assim, se a corrida com o deadline
  // terminar primeiro, a conclusão tardia ainda é armazenada e nunca vira rejection solta.
  // Cada conclusão também atualiza o snapshot incremental por seção antes de tentar promover
  // o contrato full, permitindo montar uma resposta completa através de tentativas sucessivas.
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

function rebindModalRequestContext(payload = {}, { requestedMode = 'full', requestId, requestPayload = {} } = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  const requestedStage = String(requestedMode || '').toLowerCase() === 'fast' ? 'fast' : 'full';
  const rebuiltDelivery = buildModalDelivery(payload, { requestedMode: requestedStage, requestId, requestPayload });
  const currentDelivery = payload.delivery && typeof payload.delivery === 'object'
    ? { ...payload.delivery, ...rebuiltDelivery, cacheStatus: payload.delivery.cacheStatus || rebuiltDelivery.cacheStatus }
    : rebuiltDelivery;
  const effectiveRequestId = requestId || currentDelivery.requestId;
  const staleDelivery = String(currentDelivery.cacheStatus || '').toUpperCase().includes('STALE');
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
      ...(staleDelivery ? { isFinal: false, retryable: true } : {}),
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
    const sectionCached = modalSectionSnapshot({ key, allowStale: true });
    const mergedValue = mergeModalRuntimeSnapshots({ key, family, primary: cached?.value });
    if (!mergedValue) return null;
    const upgrade = recoveryCacheUpgrade(mergedValue, family, payload);
    if (!upgrade.upgraded) return null;

    const staleUpgrade = cached?.status === 'STALE' || sectionCached?.status === 'STALE';
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
    const decorated = decorateModalPayload(mergedValue, {
      family,
      requestPayload: payload,
      requestedMode,
      requestId,
      cacheStatus,
      mode: normalizeModalCacheMode(mergedValue),
      elapsedMs: 0,
      cached: true,
      coalesced: backgroundJoined,
      storedAt: mergedValue?.updatedAt
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
    return rebindModalRequestContext(immediateRecoveryUpgrade, { requestedMode, requestId, requestPayload: payload });
  }

  if (!bypassCache) {
    const cached = getCache(key, { allowStale: true });
    const crossStageKey = modalCrossStageCacheKey({ family, ticker, payload });
    const fullCached = crossStageKey ? getCache(crossStageKey, { allowStale: true }) : null;
    if (fullCached?.value && fullCached.status === 'HIT' && isModalPayloadCacheable(fullCached.value, family)) {
      return rebindModalRequestContext(decorateModalPayload(fullCached.value, {
        family,
        requestPayload: payload,
        requestedMode,
        requestId,
        cacheStatus: 'HIT_FULL_FOR_FAST',
        mode: 'full',
        elapsedMs: 0,
        cached: true,
        coalesced: false,
        storedAt: fullCached.value?.updatedAt
      }), { requestedMode, requestId, requestPayload: payload });
    }
    if (cached?.value && cached.status === 'HIT' && isModalPayloadCacheable(cached.value, family)) {
      return rebindModalRequestContext(decorateModalPayload(cached.value, {
        family,
        requestPayload: payload,
        requestedMode,
        requestId,
        cacheStatus: cached.status,
        mode: normalizeModalCacheMode(payload),
        elapsedMs: 0,
        cached: true,
        coalesced: false,
        storedAt: cached.value?.updatedAt
      }), { requestedMode, requestId, requestPayload: payload });
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
    const sectionCached = modalSectionSnapshot({ key, allowStale: true });
    const primary = recoveryFullCached?.value || recoveryCached?.value || null;
    const mergedCandidate = mergeModalRuntimeSnapshots({ key, family, primary });
    if (mergedCandidate && modalPayloadHasUsefulData(mergedCandidate)) {
      staleSnapshot = {
        value: mergedCandidate,
        status: recoveryFullCached?.status || recoveryCached?.status || sectionCached?.status || 'SECTION_SNAPSHOT'
      };
    }
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
          requestPayload: payload,
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
          requestPayload: payload,
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
        requestPayload: payload,
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
      const latestPrimary = getCache(key, { allowStale: true })?.value || staleSnapshot?.value || null;
      const latestFallback = mergeModalRuntimeSnapshots({ key, family, primary: latestPrimary });
      if (!forcedRefresh && latestFallback && modalPayloadHasUsefulData(latestFallback)) {
        return decorateModalPayload(latestFallback, {
          family,
          requestPayload: payload,
          requestedMode,
          requestId,
          cacheStatus: 'STALE_FALLBACK',
          mode: normalizeModalCacheMode(payload),
          elapsedMs,
          cached: true,
          coalesced: false,
          storedAt: latestFallback?.updatedAt,
          fallbackReason: error?.message || String(error)
        });
      }
      if (isModalDeadlineError(error)) {
        return decorateModalPayload(modalTimeoutPayload({ family, ticker, stage: requestedMode, deadlineMs, elapsedMs, error }), {
          family,
          requestPayload: payload,
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
  return rebindModalRequestContext(coalescedResult, { requestedMode, requestId, requestPayload: payload });
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
  stockModalQualitySections,
  fiiModalSections,
  requestedCriticalSections,
  criticalSectionStatus,
  mergeModalPayloadSections,
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
  modalSectionSnapshotKey,
  promoteModalSectionSnapshot,
  mergeModalRuntimeSnapshots,
  modalRuntimeCoalesceKey,
  isModalDeadlineError,
  modalProducerFlightCount: () => modalProducerFlights.size
};
