// Performance profiles for Valorae Engine.
// The goal is to let the API trade richness vs latency explicitly.

export const VALORAE_PERFORMANCE_VERSION = '21.12.52-news-reliability-upgrade';

export const PROFILE_ALIASES = Object.freeze({
  instant: 'instant',
  ultra: 'instant',
  tiny: 'instant',
  ultrafast: 'instant',
  quote: 'fast',
  card: 'fast',
  fast: 'fast',
  wallet: 'portfolio',
  carteira: 'portfolio',
  portfolio: 'portfolio',
  balanced: 'standard',
  standard: 'standard',
  detail: 'deep',
  detailed: 'deep',
  analysis: 'deep',
  complete: 'turbo',
  completo: 'turbo',
  max: 'turbo',
  maxima: 'turbo',
  máximo: 'turbo',
  turbo: 'turbo',
  supreme: 'turbo',
  deep: 'deep',
});

const PROFILES = {
  instant: {
    timeoutMs: 3000,
    valoraeScrapeTimeoutMs: 3000,
    adaptiveCompletionTimeoutMs: 1800,
    maxHtmlChars: 250_000,
    resultCacheTtlMs: 30 * 60 * 1000,
    staleResultCacheMs: 6 * 60 * 60 * 1000,
    includeNewsDefault: false,
    enableInternalApis: false,
    useYahooFallback: true,
    returnHtml: false,
    adaptiveCompletion: false,
    maxConcurrency: 8,
    description: 'Ultra-fast para apps e dashboards: prioriza cache/Yahoo/seletores leves e evita parsing pesado.'
  },
  fast: {
    timeoutMs: 6500,
    valoraeScrapeTimeoutMs: 6500,
    adaptiveCompletionTimeoutMs: 3800,
    maxHtmlChars: 900_000,
    resultCacheTtlMs: 15 * 60 * 1000,
    staleResultCacheMs: 60 * 60 * 1000,
    includeNewsDefault: false,
    enableInternalApis: false,
    useYahooFallback: true,
    returnHtml: false,
    adaptiveCompletion: true,
    maxConcurrency: 6,
    description: 'Baixa latência com completude adaptativa: usa seletores/Yahoo e só busca HTML completo quando a extração rápida ficaria PARTIAL.'
  },
  standard: {
    timeoutMs: 12_000,
    valoraeScrapeTimeoutMs: 12_000,
    adaptiveCompletionTimeoutMs: 5000,
    maxHtmlChars: 2_400_000,
    resultCacheTtlMs: 7 * 60 * 1000,
    staleResultCacheMs: 45 * 60 * 1000,
    includeNewsDefault: false,
    enableInternalApis: true,
    useYahooFallback: true,
    returnHtml: true,
    adaptiveCompletion: true,
    maxConcurrency: 4,
    description: 'Equilíbrio entre riqueza de dados e tempo de resposta.'
  },
  turbo: {
    timeoutMs: 10_000,
    valoraeScrapeTimeoutMs: 9000,
    adaptiveCompletionTimeoutMs: 6500,
    maxHtmlChars: 3_200_000,
    resultCacheTtlMs: 10 * 60 * 1000,
    staleResultCacheMs: 90 * 60 * 1000,
    includeNewsDefault: false,
    enableInternalApis: true,
    useYahooFallback: true,
    returnHtml: true,
    adaptiveCompletion: true,
    statusInvestComplement: true,
    hedgedStatusInvest: true,
    maxConcurrency: 4,
    description: 'Modo turbo de extração: busca maior completude com HTML, APIs internas, Yahoo e complemento StatusInvest em paralelo quando necessário, preservando cache forte para velocidade percebida.'
  },
  deep: {
    timeoutMs: 18_000,
    valoraeScrapeTimeoutMs: 18_000,
    adaptiveCompletionTimeoutMs: 8000,
    maxHtmlChars: 4_000_000,
    resultCacheTtlMs: 3 * 60 * 1000,
    staleResultCacheMs: 30 * 60 * 1000,
    includeNewsDefault: false,
    enableInternalApis: true,
    useYahooFallback: true,
    returnHtml: true,
    adaptiveCompletion: true,
    maxConcurrency: 2,
    description: 'Máxima completude: HTML completo, APIs internas e parsing mais amplo.'
  },
  portfolio: {
    timeoutMs: 7500,
    valoraeScrapeTimeoutMs: 7500,
    adaptiveCompletionTimeoutMs: 3000,
    maxHtmlChars: 900_000,
    resultCacheTtlMs: 12 * 60 * 1000,
    staleResultCacheMs: 60 * 60 * 1000,
    includeNewsDefault: false,
    enableInternalApis: false,
    useYahooFallback: true,
    returnHtml: false,
    adaptiveCompletion: false,
    maxConcurrency: 6,
    description: 'Otimizado para carteira e listas: muitos ativos, payload compacto e menor custo; use complete=1 para completar casos críticos.'
  }
};

function boolish(v, fallback = false) {
  if (v === undefined || v === null || v === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(v).toLowerCase());
}

function intish(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function resolvePerformanceProfile(rawProfile = '') {
  const requested = String(rawProfile || '').toLowerCase().trim();
  if (!requested) return { requested: '', profile: '', aliased: false, supported: false };
  const profile = PROFILE_ALIASES[requested] || '';
  return { requested, profile, aliased: Boolean(profile && requested !== profile), supported: Boolean(profile) };
}

function chooseProfile(raw = {}, context = {}) {
  const explicit = String(raw.profile || raw.performance || '').toLowerCase().trim();
  const resolvedExplicit = resolvePerformanceProfile(explicit);
  if (resolvedExplicit.profile) return resolvedExplicit.profile;
  const view = String(raw.view || raw.assetView || '').toLowerCase();
  const endpoint = String(context.endpoint || '').toLowerCase();
  if (endpoint.includes('portfolio') || endpoint === 'assets' || endpoint === 'batch') return 'portfolio';
  if (['instant','ultra','tiny'].includes(view)) return 'instant';
  if (['quote','card','compact'].includes(view)) return 'fast';
  if (['wallet','portfolio','standard'].includes(view)) return 'portfolio';
  if (['detail','analysis','full'].includes(view) && boolish(raw.debug, false)) return 'deep';
  return 'standard';
}

export function resolvePerformanceOptions(raw = {}, context = {}) {
  const requestedProfile = String(raw.profile || raw.performance || '').toLowerCase().trim();
  const alias = resolvePerformanceProfile(requestedProfile);
  const profile = chooseProfile(raw, context);
  const preset = PROFILES[profile] || PROFILES.standard;
  const includeNewsExplicit = raw.includeNews !== undefined || raw.news !== undefined;
  const maxHtmlChars = intish(raw.maxHtmlChars, preset.maxHtmlChars);
  const maxHtmlHardLimit = intish(process.env.VALORAE_MAX_HTML_HARD_LIMIT, 4_500_000);
  const resolvedTimeoutMs = intish(raw.timeoutMs, preset.timeoutMs);
  const resolvedScrapeTimeoutMs = intish(raw.valoraeScrapeTimeoutMs, raw.timeoutMs === undefined ? preset.valoraeScrapeTimeoutMs : resolvedTimeoutMs);
  const resolvedAdaptiveTimeoutMs = intish(raw.adaptiveCompletionTimeoutMs, raw.timeoutMs === undefined ? (preset.adaptiveCompletionTimeoutMs || preset.timeoutMs) : resolvedTimeoutMs);

  return {
    ...raw,
    requestedProfile: requestedProfile || undefined,
    profileAlias: alias.aliased ? { requested: alias.requested, resolved: alias.profile } : undefined,
    profile,
    performanceProfile: profile,
    timeoutMs: resolvedTimeoutMs,
    valoraeScrapeTimeoutMs: resolvedScrapeTimeoutMs,
    adaptiveCompletionTimeoutMs: resolvedAdaptiveTimeoutMs,
    maxHtmlChars: Math.min(maxHtmlChars, maxHtmlHardLimit),
    resultCacheTtlMs: intish(raw.resultCacheTtlMs, preset.resultCacheTtlMs),
    staleResultCacheMs: intish(raw.staleResultCacheMs, preset.staleResultCacheMs),
    enableInternalApis: raw.enableInternalApis === undefined ? preset.enableInternalApis : boolish(raw.enableInternalApis, preset.enableInternalApis),
    useYahooFallback: raw.useYahooFallback === undefined ? preset.useYahooFallback : raw.useYahooFallback,
    returnHtml: raw.returnHtml === undefined ? preset.returnHtml : boolish(raw.returnHtml, preset.returnHtml),
    adaptiveCompletion: raw.adaptiveCompletion === undefined ? preset.adaptiveCompletion : boolish(raw.adaptiveCompletion, preset.adaptiveCompletion),
    statusInvestComplement: raw.statusInvestComplement === undefined ? (preset.statusInvestComplement !== false) : boolish(raw.statusInvestComplement, true),
    includeNews: includeNewsExplicit ? boolish(raw.includeNews ?? raw.news, false) : preset.includeNewsDefault,
    maxConcurrency: intish(raw.maxConcurrency || raw.concurrency, preset.maxConcurrency),
    cachePolicy: raw.cachePolicy || 'memory-lru-stale-if-error',
    hedgedStatusInvest: raw.hedgedStatusInvest === undefined ? Boolean(preset.hedgedStatusInvest) : boolish(raw.hedgedStatusInvest, Boolean(preset.hedgedStatusInvest)),
    performanceHints: {
      profile,
      requestedProfile: requestedProfile || undefined,
      profileAlias: alias.aliased ? { requested: alias.requested, resolved: alias.profile } : undefined,
      description: preset.description,
      selectorOnly: preset.returnHtml === false,
      internalApis: raw.enableInternalApis === undefined ? preset.enableInternalApis : boolish(raw.enableInternalApis, preset.enableInternalApis),
      adaptiveCompletion: raw.adaptiveCompletion === undefined ? preset.adaptiveCompletion : boolish(raw.adaptiveCompletion, preset.adaptiveCompletion),
      adaptiveCompletionTimeoutMs: resolvedAdaptiveTimeoutMs,
      statusInvestComplement: raw.statusInvestComplement === undefined ? (preset.statusInvestComplement !== false) : boolish(raw.statusInvestComplement, true),
      hedgedStatusInvest: raw.hedgedStatusInvest === undefined ? Boolean(preset.hedgedStatusInvest) : boolish(raw.hedgedStatusInvest, Boolean(preset.hedgedStatusInvest)),
      cacheTtlMs: intish(raw.resultCacheTtlMs, preset.resultCacheTtlMs),
      staleMs: intish(raw.staleResultCacheMs, preset.staleResultCacheMs)
    }
  };
}

export function performanceCapabilities() {
  return {
    version: VALORAE_PERFORMANCE_VERSION,
    profiles: PROFILES,
    profileAliases: PROFILE_ALIASES,
    queryParams: ['profile=instant|ultra|tiny|quote|card|wallet|analysis|fast|standard|turbo|deep|portfolio', 'view=instant|ultra|tiny|quote|card|wallet|detail|analysis|compact|standard|full', 'complete=1', 'adaptiveCompletion=1|0', 'hedgedStatusInvest=1|0', 'dedupeBatch=1|0', 'staleWhileRevalidate=1|0', 'nocache=1', 'debug=1', 'contracts=full|lite|auto']
  };
}
