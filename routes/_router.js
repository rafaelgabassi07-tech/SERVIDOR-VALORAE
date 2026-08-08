import { createHash } from 'node:crypto';
import { RELEASE } from '../lib/core/release.js';
import { APK_COMPATIBILITY, apkVersionFromRequest, evaluateApkCompatibility } from '../lib/core/apk-compatibility.js';
import { beginRequestObservation, requestMetricsSnapshot } from '../lib/observability/request-metrics.js';
import { sendJson, queryObject, readJsonBody } from '../lib/core/http.js';
import { cacheStats, clearCache, getCache, setCache, stableKey } from '../lib/core/cache.js';
import { buildDividendsContract } from '../lib/portfolio/dividends-contract.js';
import { buildPortfolioHistory, normalizePortfolioPositions, normalizePortfolioTransactions } from '../lib/portfolio/history.js';
import { buildEquilibriumContract } from '../lib/portfolio/equilibrium-metadata.js';
import { mobileAlertDividendSymbols } from '../lib/portfolio/mobile-history-contracts.js';
import { normalizePositions, normalizeTransactions } from '../lib/portfolio/positions.js';
import { normalizeTicker, classifyTicker, uniqueTickers } from '../lib/core/tickers.js';
import { OFFICIAL_ASSET_LOGO_VERSION, fetchOfficialAssetLogo } from '../lib/market/official-logo.js';
import { buildContractBaselineManifest } from '../lib/contract/baseline.js';
import { contractContinuityStats, stabilizeContractPayloadShared } from '../lib/contract/continuity-store.js';
import {
  buildFormalSchemaManifest,
  formalRequestSchemaMode,
  validateFormalRequestPayload,
} from '../lib/contract/formal-schema-validation.js';
import {
  applyRateLimitHeaders,
  applySecurityHeaders,
  assertBodySize,
  assertUrlAndQueryBudget,
  checkRateLimit,
  getRequestId,
  requireAdmin,
  sanitizeError,
} from '../lib/security/guard.js';
import {
  isCanonicalValoraeApkRequest,
  isValoraeApkIdentityAttempt,
  resolveClientAuth,
  shouldRequireClientAuth,
  shouldRequireValoraeApkRequest,
} from '../lib/security/client-auth.js';
import { coalesce } from '../lib/resilience/inflight.js';
import {
  VALORAE_ASSET_MODAL_DELIVERY_SCHEMA_VERSION,
  VALORAE_MOBILE_CACHE_POLICY_SECONDS,
  VALORAE_MOBILE_PROTOCOL_VERSION,
  corsMethodsCsv,
} from '../lib/core/mobile-protocol.js';

const lazyFeatureModules = globalThis.__VALORAE_ROUTER_LAZY_FEATURE_MODULES__ || new Map();
globalThis.__VALORAE_ROUTER_LAZY_FEATURE_MODULES__ = lazyFeatureModules;

const PRODUCTION_ROUTE_ALLOWLIST = new Set([
  '/ready', '/sync', '/mobile/alerts', '/mobile/daily-close', '/dividends/batch',
  '/assets', '/asset/quote', '/quotes', '/asset/history',
  '/asset/modal', '/asset/logo',
  '/market/indices', '/market/rankings', '/analysis/rankings', '/news', '/news/article',
  '/portfolio/equilibrium', '/portfolio/history', '/portfolio/returns',
]);

// Public resources that cannot carry the APK header set (for example Coil image requests)
// must remain readable. Version negotiation is advisory for read-only market data and
// blocking only for financial synchronization, where contract drift can mutate user data.
const PUBLIC_HEADERLESS_ROUTES = new Set(['/ready', '/asset/logo']);
const APK_COMPATIBILITY_BLOCKING_ROUTES = new Set(['/sync']);

function shouldBlockApkCompatibility(path = '', evaluation = {}) {
  return Boolean(evaluation?.reject) && APK_COMPATIBILITY_BLOCKING_ROUTES.has(String(path || ''));
}

function acceptsLegacyApkIdentity(path = '', apkIdentityAttempt = false) {
  return Boolean(apkIdentityAttempt) && PRODUCTION_ROUTE_ALLOWLIST.has(String(path || ''));
}


function ecosystemContractFromRequest(req = {}) {
  return String(req?.headers?.['x-valorae-ecosystem-contract'] || '').trim();
}

function evaluateEcosystemContract(req = {}) {
  const received = ecosystemContractFromRequest(req);
  const compatible = RELEASE.compatibleEcosystemContracts || [RELEASE.ecosystemContract];
  return {
    received,
    expected: RELEASE.ecosystemContract,
    compatible: [...compatible],
    explicit: Boolean(received),
    ok: !received || compatible.includes(received),
  };
}

function productionRuntime() {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

function internalRoutesEnabled() {
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(process.env.VALORAE_ENABLE_INTERNAL_ROUTES || '').trim().toLowerCase());
}

function routeAllowedInCurrentRuntime(path = '/') {
  return !productionRuntime() || internalRoutesEnabled() || PRODUCTION_ROUTE_ALLOWLIST.has(path);
}

function loadFeatureModule(key, loader) {
  let promise = lazyFeatureModules.get(key);
  if (!promise) {
    promise = Promise.resolve().then(loader).catch(error => {
      lazyFeatureModules.delete(key);
      throw error;
    });
    lazyFeatureModules.set(key, promise);
  }
  return promise;
}

async function buildLazyFeatureManifest(key, loader, exportName, options) {
  const module = await loadFeatureModule(key, loader);
  return module[exportName](options);
}

async function runLazyDefaultHandler(key, loader, req, res) {
  const module = await loadFeatureModule(key, loader);
  return module.default(req, res);
}

async function buildMobilePortfolioSync(...args) {
  const module = await loadFeatureModule('contracts-mobile', () => import('../lib/contracts/mobile.js'));
  return module.buildMobilePortfolioSync(...args);
}

async function buildAssetsPayload(...args) {
  const module = await loadFeatureModule('source-quotes', () => import('../lib/sources/quotes.js'));
  return module.buildAssetsPayload(...args);
}

async function buildMarketMovers(...args) {
  const module = await loadFeatureModule('source-quotes', () => import('../lib/sources/quotes.js'));
  return module.buildMarketMovers(...args);
}

async function getQuote(...args) {
  const module = await loadFeatureModule('source-quotes', () => import('../lib/sources/quotes.js'));
  return module.getQuote(...args);
}

async function fetchInvestidor10Rankings(...args) {
  const module = await loadFeatureModule('source-adapters', () => import('../lib/sources/adapters/index.js'));
  return module.fetchInvestidor10Rankings(...args);
}

async function fetchInvestidor10AnalysisRanking(...args) {
  const module = await loadFeatureModule('source-adapters', () => import('../lib/sources/adapters/index.js'));
  return module.fetchInvestidor10AnalysisRanking(...args);
}

async function getInvestidor10AnalysisRankingCatalog(...args) {
  const module = await loadFeatureModule('source-adapters', () => import('../lib/sources/adapters/index.js'));
  return module.getInvestidor10AnalysisRankingCatalog(...args);
}

async function getIpcaSeries(...args) {
  const module = await loadFeatureModule('source-adapters', () => import('../lib/sources/adapters/index.js'));
  return module.getIpcaSeries(...args);
}

async function buildSourceAdapterManifest(...args) {
  const module = await loadFeatureModule('source-adapters', () => import('../lib/sources/adapters/index.js'));
  return module.buildSourceAdapterManifest(...args);
}

async function getNews(...args) {
  const module = await loadFeatureModule('source-news', () => import('../lib/sources/news.js'));
  return module.getNews(...args);
}

async function getArticleContent(...args) {
  const module = await loadFeatureModule('source-news', () => import('../lib/sources/news.js'));
  return module.getArticleContent(...args);
}

async function fetchAllowedScrapeText(...args) {
  const module = await loadFeatureModule('safe-target-fetch', () => import('../lib/scrape/safe-target-fetch.js'));
  return module.fetchAllowedScrapeText(...args);
}

async function buildPortfolioReturns(...args) {
  const module = await loadFeatureModule('portfolio-analysis', () => import('../lib/portfolio/analysis.js'));
  return module.buildPortfolioReturns(...args);
}

async function getAssetHistory(...args) {
  const module = await loadFeatureModule('asset-details', () => import('../lib/sources/asset-details.js'));
  return module.getAssetHistory(...args);
}

async function buildAssetModalContract(...args) {
  const module = await loadFeatureModule('asset-modal-contract', () => import('../lib/analysis/asset-modal-contract.js'));
  return module.buildAssetModalContract(...args);
}

function contractIdentity(endpoint, payload = {}) {
  const ticker = normalizeTicker(payload.ticker || payload.symbol || payload.q || payload.query || '');
  const positions = Array.isArray(payload.positions) ? payload.positions : [];
  const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];
  const positionSignature = positions
    .map(item => [normalizeTicker(item?.ticker || item?.symbol), Number(item?.quantity || item?.qty || 0), Number(item?.avgPrice || item?.averagePrice || 0)].join(':'))
    .sort()
    .join('|');
  const transactionSignature = transactions
    .map(item => [normalizeTicker(item?.ticker || item?.symbol), String(item?.date || item?.timestamp || ''), String(item?.side || item?.operation || ''), Number(item?.quantity || item?.qty || 0), Number(item?.price || 0)].join(':'))
    .sort()
    .join('|');
  const dividendEvents = Array.isArray(payload.dividendEvents) ? payload.dividendEvents : [];
  const dividendSignature = dividendEvents
    .map(item => [normalizeTicker(item?.ticker || item?.symbol), String(item?.paymentDate || item?.datePayment || item?.date || ''), Number(item?.valuePerShare || item?.amount || 0), Number(item?.quantityAtDate || item?.quantity || 0)].join(':'))
    .sort()
    .join('|');
  const ownerIdentity = String(payload.userId || payload.accountId || payload.portfolioId || payload.ownerId || payload.deviceId || 'anonymous');
  const rawIdentity = [
    endpoint,
    ownerIdentity,
    ticker,
    String(payload.stage || payload.mode || ''),
    String(payload.range || payload.period || ''),
    String(payload.interval || ''),
    String(payload.assetFilter || ''),
    positionSignature,
    transactionSignature,
    dividendSignature,
  ].join('::');
  return `${endpoint}:${ticker || 'portfolio'}:${createHash('sha256').update(rawIdentity).digest('hex')}`;
}

const REMOVED_ASSET_MODAL_FIELDS = new Set([
  'analysisChanges',
  'analysisChange',
  'whatChanged',
  'changesSinceLastAnalysis',
  'changesSincePreviousAnalysis',
]);

function stripRemovedAssetModalFields(value, depth = 0) {
  if (depth > 14 || value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => stripRemovedAssetModalFields(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !REMOVED_ASSET_MODAL_FIELDS.has(key))
      .map(([key, item]) => [key, stripRemovedAssetModalFields(item, depth + 1)])
  );
}

async function withContractBaseline(endpoint, payload, requestPayload = {}) {
  const assetModalEndpoint = endpoint === 'assetModal' || endpoint === 'stockModal' || endpoint === 'fiiModal';
  const contractPayload = assetModalEndpoint ? stripRemovedAssetModalFields(payload) : payload;
  const stable = await stabilizeContractPayloadShared(endpoint, contractIdentity(endpoint, requestPayload), contractPayload);
  const observabilityEnabled = boolParamLocal(process.env.VALORAE_FIELD_OBSERVABILITY_ENABLED, false)
    && boolParamLocal(requestPayload.includeObservability ?? requestPayload.observability, false);
  if (!observabilityEnabled) return assetModalEndpoint ? stripRemovedAssetModalFields(stable) : stable;
  const module = await loadFeatureModule('field-observability', () => import('../lib/observability/field-observability.js'));
  const observed = module.attachFieldObservability(endpoint, stable, {
    traceId: requestPayload.requestId || stable?.requestId,
  });
  return assetModalEndpoint ? stripRemovedAssetModalFields(observed) : observed;
}

function safeRequestId(value = '') {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function stripApi(pathname) {
  let path = pathname || '/';
  if (path === '/api') return '/';
  if (path.startsWith('/api/')) path = path.slice(4);
  const m = path.match(/^\/(v[12])(?:\/(.*))?$/);
  if (m) path = `/${m[2] || ''}`;
  path = path.replace(/\/+$/, '') || '/';
  return path;
}

function stripApiPrefix(pathname) {
  let path = pathname || '/';
  if (path === '/api') return '/';
  if (path.startsWith('/api/')) return path.slice(4) || '/';
  return path;
}

function applyRuntimeCors(req, res, path = '/') {
  const methods = routeMethods(path);
  const effectiveMethods = methods.includes('GET') ? [...new Set([...methods, 'HEAD'])] : methods;
  return applySecurityHeaders(req, res, {
    methods: [...new Set([...effectiveMethods, 'OPTIONS'])].join(', '),
    cacheControl: false,
  });
}

function sendCorsPreflight(req, res) {
  res.statusCode = 200;
  res.setHeader('Cache-Control', 'private, max-age=600');
  return res.end('');
}

function routeMethods(path = '') {
  const normalized = String(path || '').replace(/^\/api(?:\/v[12])?/, '') || '/';
  if (normalized === '/sync') return ['GET', 'POST', 'DELETE'];
  if (normalized === '/portfolio/history' || normalized === '/compare') return ['GET', 'POST'];
  if (normalized === '/admin/cache' || normalized === '/cache/clear') return ['POST', 'DELETE'];
  const postRoutes = new Set([
    '/mobile/bootstrap', '/app/bootstrap',
    '/mobile/practical-sync', '/app/practical-sync',
    '/mobile/portfolio-sync', '/app/portfolio-sync', '/portfolio/insights-bundle',
    '/mobile/alerts', '/app/alerts', '/mobile/daily-close', '/app/daily-close',
    '/dividends/batch',
    '/portfolio/dividends', '/portfolio/next-dividends', '/portfolio/events',
    '/portfolio/returns', '/portfolio/analyze', '/portfolio/allocation', '/portfolio/equilibrium',
    '/portfolio/balance', '/portfolio/history', '/portfolio/income', '/portfolio/rebalance',
    '/portfolio/risk', '/portfolio/summary', '/portfolio/transactions',
    '/watchlist/analyze', '/batch-scrape', '/news/article'
  ]);
  return postRoutes.has(normalized) ? ['POST'] : ['GET'];
}

function routeMethod(path = '') {
  const methods = routeMethods(path);
  return methods.includes('POST') ? 'POST' : methods[0];
}

function openApiOperationForRoute(route = '') {
  return Object.fromEntries(routeMethods(route).map(method => [
    method.toLowerCase(),
    {
      summary: route,
      description: method === 'GET'
        ? 'Rota consultiva via query string.'
        : 'Aceita query string e/ou JSON body.',
      responses: { '200': { description: 'Resposta VALORAE JSON' } }
    }
  ]));
}

function boolParamLocal(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value).toLowerCase());
}

function clampInt(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function rankingArraysFrom(payload = {}) {
  const rankings = payload?.rankings && typeof payload.rankings === 'object' ? payload.rankings : {};
  const highs = payload?.altas || payload?.highs || payload?.gainers || payload?.maioresAltas || rankings.altas || rankings.highs || rankings.gainers || rankings.maioresAltas || [];
  const lows = payload?.baixas || payload?.lows || payload?.losers || payload?.maioresBaixas || rankings.baixas || rankings.lows || rankings.losers || rankings.maioresBaixas || [];
  return { highs: Array.isArray(highs) ? highs : [], lows: Array.isArray(lows) ? lows : [] };
}

function mergeRankingRows(primary = [], fallback = [], limit = 6) {
  const out = [];
  const seen = new Set();
  for (const row of [...(primary || []), ...(fallback || [])]) {
    const symbol = String(row?.ticker || row?.symbol || row?.code || '').trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({ ...row, ticker: symbol, symbol, rank: out.length + 1 });
    if (out.length >= limit) break;
  }
  return out;
}

function withRankingAliases(highs = [], lows = []) {
  return {
    highs,
    lows,
    altas: highs,
    baixas: lows,
    maioresAltas: highs,
    maioresBaixas: lows,
    gainers: highs,
    losers: lows,
    topGainers: highs,
    topLosers: lows,
  };
}

function operationalRankingFallback(kind = 'ACAO', limit = 6) {
  const defaults = String(kind || 'ACAO').toUpperCase() === 'FII'
    ? ['GARE11','HGLG11','TRXF11','MXRF11','KNRI11','VISC11']
    : ['PETR4','VALE3','ITUB4','BBAS3','PRIO3','WEGE3'];
  const rows = defaults.slice(0, Math.max(1, Math.min(Number(limit || 6), defaults.length))).map((ticker, index) => ({
    ticker,
    symbol: ticker,
    name: ticker,
    price: 0,
    changePercent: 0,
    variationPercent: 0,
    rank: index + 1,
    fallback: true,
    source: 'VALORAE_OPERATIONAL_STATIC_FALLBACK'
  }));
  const midpoint = Math.max(1, Math.ceil(rows.length / 2));
  return withRankingAliases(rows.slice(0, midpoint), rows.slice(midpoint).length ? rows.slice(midpoint) : rows.slice(0, midpoint));
}

function rankingTickerInput(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(/[;,\s]+/).filter(Boolean);
  if (value && typeof value === 'object') return [value.ticker || value.symbol || value.code || ''].filter(Boolean);
  return [];
}

async function buildCanonicalMarketRankings(payload = {}) {
  const kind = String(payload.type || payload.kind || 'ACAO').toUpperCase();
  const sourceMode = String(payload.source || 'home').toLowerCase();
  const rankingMode = String(payload.mode || payload.captureMode || (boolParamLocal(payload.complete || payload.full || payload.precise) ? 'complete' : 'auto')).toLowerCase();
  const completeMode = ['complete', 'full', 'deep', 'precise', 'max'].includes(rankingMode) || boolParamLocal(payload.complete || payload.fullCapture || payload.precise);
  const requestedLimit = clampInt(payload.limit || payload.max || payload.maxItems, 6, 1, 30);
  const minRows = clampInt(payload.minRows || payload.completeMinRows, Math.min(6, requestedLimit), 1, requestedLimit);
  const explicitTickers = uniqueTickers([
    ...rankingTickerInput(payload.tickers),
    ...rankingTickerInput(payload.positions),
    ...rankingTickerInput(payload.assets),
  ]);

  // A Home do APK deve seguir o ranking real publicado pelo Investidor10.
  // A comparação por cesta/Yahoo só permanece disponível quando o cliente pede source=compare
  // ou envia uma lista explícita de tickers.
  if (!explicitTickers.length && kind === 'ACAO' && sourceMode !== 'compare') {
    const preferredSource = ['dedicated', 'pages', 'ranking-pages'].includes(sourceMode) ? 'dedicated' : 'home';
    const live = await fetchInvestidor10Rankings({
      bypassCache: boolParamLocal(payload.nocache || payload.refresh),
      timeoutMs: clampInt(payload.timeoutMs, completeMode ? 14000 : 5200, 1000, 25000),
      mode: rankingMode,
      requireComplete: completeMode && boolParamLocal(payload.strict, false),
      limit: requestedLimit,
      minRows,
      preferredSource,
    });
    const liveRows = rankingArraysFrom(live);
    const liveComplete = liveRows.highs.length >= minRows && liveRows.lows.length >= minRows;
    const liveSourceLabel = preferredSource === 'home'
      ? (completeMode ? 'investidor10-home-live-complete' : 'investidor10-home-live')
      : (completeMode ? 'investidor10-dedicated-live-complete' : 'investidor10-dedicated-live');

    if (liveComplete || (liveRows.highs.length + liveRows.lows.length > 0 && boolParamLocal(payload.strictLive))) {
      return {
        status: live?.status || (live?.ok ? 'OK' : 'PARTIAL'),
        endpoint: 'market-rankings',
        type: kind,
        rankingSource: liveSourceLabel,
        fallbackUsed: false,
        fallbackPolicy: 'live-investidor10-home-rankings',
        captureMode: rankingMode,
        ...live,
      };
    }

    let fallback;
    try {
      fallback = await buildMarketMovers({
        ...payload,
        source: 'compare',
        limit: requestedLimit,
        timeoutMs: clampInt(payload.fallbackTimeoutMs || payload.quoteTimeoutMs || payload.timeoutMs, 2600, 700, 8000),
      });
    } catch (err) {
      fallback = {
        ok: true,
        status: 'FALLBACK',
        fallbackUsed: true,
        source: 'VALORAE_OPERATIONAL_STATIC_FALLBACK',
        warning: err?.message || 'Fallback operacional estático ativado.',
        rankings: operationalRankingFallback(kind, requestedLimit)
      };
    }
    const fallbackRows = rankingArraysFrom(fallback);
    const highs = mergeRankingRows(liveRows.highs, fallbackRows.highs, requestedLimit);
    const lows = mergeRankingRows(liveRows.lows, fallbackRows.lows, requestedLimit);
    const hasRows = highs.length > 0 || lows.length > 0;
    const aliases = withRankingAliases(highs, lows);
    const liveWarnings = [live?.warning, ...(Array.isArray(live?.warnings) ? live.warnings : []), ...(Array.isArray(live?.errors) ? live.errors : [])].filter(Boolean);
    const fallbackWarnings = [fallback?.warning, ...(Array.isArray(fallback?.warnings) ? fallback.warnings : [])].filter(Boolean);

    return {
      status: hasRows ? (fallback?.fallbackUsed ? 'FALLBACK' : 'OK') : 'EMPTY',
      ok: hasRows,
      endpoint: 'market-rankings',
      type: kind,
      rankingSource: `${liveSourceLabel}+valorae-quote-fallback`,
      fallbackUsed: true,
      fallbackPolicy: 'live-investidor10-first-then-proxy-quote-operational-fallback',
      captureMode: rankingMode,
      partial: true,
      source: fallback?.source || live?.source || 'VALORAE Fonte Oficial',
      generatedAt: new Date().toISOString(),
      requestedLimit,
      rankings: aliases,
      ...aliases,
      warnings: [...liveWarnings, ...fallbackWarnings].slice(0, 8),
      warning: liveWarnings[0] || fallbackWarnings[0] || 'Ranking ao vivo não retornou linhas suficientes; usando fallback operacional via Proxy.',
      liveStatus: live?.status || null,
      fallbackStatus: fallback?.status || null,
      attempts: live?.attempts || [],
      errors: live?.errors || [],
    };
  }

  return {
    ...(await buildMarketMovers({ ...payload, tickers: explicitTickers.join(',') })),
    endpoint: 'market-rankings',
    rankingSource: 'valorae-compare-explicit-tickers',
  };
}

function scrapeError(code, message, status = 400, extras = {}) {
  return { status: 'ERROR', code, error: message, ...extras, retryable: false };
}

function allowedScrapeHosts() {
  const env = String(process.env.VALORAE_SCRAPE_ALLOWED_HOSTS || '')
    .split(',')
    .map(value => value.trim().replace(/^\.+|\.+$/g, '').toLowerCase())
    .filter(Boolean);
  return env.length
    ? [...new Set(env)]
    : ['investidor10.com.br', 'statusinvest.com.br', 'fundamentus.com.br', 'dados.cvm.gov.br'];
}

async function bodyOrQuery(req, parsed) {
  const query = queryObject(parsed.searchParams);
  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET') return { ...query };
  const maxBodyBytes = clampInt(
    process.env.MAX_LOCAL_BODY_BYTES || process.env.VALORAE_MAX_BODY_BYTES,
    512 * 1024,
    1024,
    10 * 1024 * 1024
  );
  const body = await readJsonBody(req, maxBodyBytes);
  return typeof body === 'object' && !Array.isArray(body) ? { ...query, ...body } : { ...query, body };
}

function rootPayload() {
  return {
    name: RELEASE.name,
    version: RELEASE.publicVersion,
    coreVersion: RELEASE.version,
    status: 'online',
    contract: RELEASE.contract,
    ecosystemContract: RELEASE.ecosystemContract,
    compatibleEcosystemContracts: RELEASE.compatibleEcosystemContracts,
    apkCompatibility: APK_COMPATIBILITY,
    routes: [...PRODUCTION_ROUTE_ALLOWLIST].sort().map(route => `/api/v1${route}`),
    router: routeManifest()
  };
}

function health() {
  return {
    ok: true,
    status: 'OK',
    online: true,
    version: RELEASE.publicVersion,
    coreVersion: RELEASE.version,
    publicVersion: RELEASE.publicVersion,
    release: RELEASE.patch,
    mobileProtocol: VALORAE_MOBILE_PROTOCOL_VERSION,
    ecosystemContract: RELEASE.ecosystemContract,
    compatibleEcosystemContracts: RELEASE.compatibleEcosystemContracts,
    apkCompatibility: APK_COMPATIBILITY,
    runtimeMetrics: (() => { const snapshot = requestMetricsSnapshot(); return { version: snapshot.version, routeCount: snapshot.routeCount, recentCount: snapshot.recentCount }; })(),
    now: new Date().toISOString(),
  };
}

function manifest() {
  return { status: 'OK', name: RELEASE.name, version: RELEASE.publicVersion, coreVersion: RELEASE.version, publicVersion: RELEASE.publicVersion, release: RELEASE.patch, contract: RELEASE.contract, ecosystemContract: RELEASE.ecosystemContract, compatibleEcosystemContracts: RELEASE.compatibleEcosystemContracts, apkCompatibility: APK_COMPATIBILITY, endpoints: routeManifest().routes };
}

async function assetLogoHandler(req, res, payload = {}) {
  const ticker = normalizeTicker(payload.ticker || payload.symbol || payload.q || payload.query || '');
  if (!ticker) return sendJson(req, res, { ok: false, status: 'ERROR', error: 'Informe ticker ou symbol.', endpoint: 'asset/logo' }, { status: 400, cacheControl: 'no-store' });
  const explicitAssetType = String(payload.assetType || payload.type || payload.assetClass || '').toUpperCase();
  const inferredAssetClass = classifyTicker(ticker);
  const assetClass = /(?:^|\b)(?:FII|FIAGRO|FI[ _-]?INFRA)(?:\b|$)/.test(explicitAssetType) ? 'FII' : inferredAssetClass;
  if (assetClass === 'FII') {
    const notApplicable = {
      ok: true,
      status: 'NOT_APPLICABLE',
      endpoint: 'asset/logo',
      contractVersion: OFFICIAL_ASSET_LOGO_VERSION,
      ticker,
      symbol: ticker,
      assetClass,
      logoUrl: '',
      reason: 'Fundos imobiliários não usam logotipo oficial no VALORAE.'
    };
    if (payload.format === 'json' || payload.json === '1') {
      return sendJson(req, res, notApplicable, { cacheControl: 'public, max-age=86400, stale-while-revalidate=604800' });
    }
    res.statusCode = 204;
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('X-Valorae-Logo-Contract', OFFICIAL_ASSET_LOGO_VERSION);
    res.setHeader('X-Valorae-Logo-Ticker', ticker);
    res.setHeader('X-Valorae-Logo-Asset-Class', assetClass);
    res.setHeader('X-Valorae-Logo-Status', 'NOT_APPLICABLE');
    return res.end('');
  }
  const timeoutMs = clampInt(payload.timeoutMs || 6500, 6500, 1800, 9000);
  const useCache = payload.cache !== 'false';
  const logo = await fetchOfficialAssetLogo(ticker, { timeoutMs, cache: useCache });

  if (payload.format === 'json' || payload.json === '1') {
    return sendJson(req, res, {
      ok: Boolean(logo?.bytes?.length),
      status: logo?.bytes?.length ? 'OK' : 'EMPTY',
      endpoint: 'asset/logo',
      contractVersion: OFFICIAL_ASSET_LOGO_VERSION,
      ticker,
      symbol: ticker,
      logoUrl: logo?.bytes?.length ? `/api/v1/asset/logo?ticker=${encodeURIComponent(ticker)}&v=5` : '',
      logoSource: logo?.source || '',
      sourceUrl: logo?.sourceUrl || '',
      contentType: logo?.contentType || '',
      dimensions: logo?.width && logo?.height ? { width: logo.width, height: logo.height } : undefined,
      fingerprint: logo?.fingerprint || '',
      cache: logo?.cache || 'MISS',
      providerKey: logo?.providerKey || '',
      providerTier: logo?.providerTier || '',
      providerStrategy: logo?.providerStrategy || '',
      providerAttempts: Array.isArray(logo?.providerAttempts) ? logo.providerAttempts : [],
      elapsedMs: Number(logo?.elapsedMs || 0),
      error: logo?.bytes?.length ? '' : 'Logo oficial indisponível nas fontes validadas.'
    }, { cacheControl: logo?.bytes?.length ? 'public, max-age=604800, stale-while-revalidate=2592000, immutable' : 'private, max-age=90' });
  }

  if (logo?.bytes?.length) {
    const etag = logo.fingerprint ? `"${logo.fingerprint}"` : '';
    res.setHeader('Content-Type', logo.contentType || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Valorae-Logo-Contract', OFFICIAL_ASSET_LOGO_VERSION);
    res.setHeader('X-Valorae-Logo-Ticker', ticker);
    res.setHeader('X-Valorae-Logo-Source', logo.source || 'official-asset-logo-resolver');
    res.setHeader('X-Valorae-Logo-Provider', logo.providerKey || 'unknown');
    res.setHeader('X-Valorae-Logo-Tier', logo.providerTier || 'unknown');
    res.setHeader('X-Valorae-Logo-Cache', logo.cache || 'MISS');
    res.setHeader('X-Valorae-Logo-Elapsed-Ms', String(Math.max(0, Number(logo.elapsedMs || 0))));
    res.setHeader('Server-Timing', `logo;dur=${Math.max(0, Number(logo.elapsedMs || 0))}`);
    if (etag) res.setHeader('ETag', etag);
    const ifNoneMatch = String(req?.headers?.['if-none-match'] || req?.headers?.['If-None-Match'] || '');
    if (etag && ifNoneMatch.split(',').map(value => value.trim()).includes(etag)) {
      res.statusCode = 304;
      return res.end('');
    }
    res.statusCode = 200;
    res.setHeader('Content-Length', String(logo.bytes.length));
    if (String(req.method || 'GET').toUpperCase() === 'HEAD') return res.end('');
    return res.end(logo.bytes);
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'private, max-age=90');
  res.setHeader('X-Valorae-Logo-Contract', OFFICIAL_ASSET_LOGO_VERSION);
  res.setHeader('X-Valorae-Logo-Ticker', ticker);
  return res.end('logo oficial indisponível');
}

async function mobileBootstrap(payload = {}) {
  const assets = await buildAssetsPayload(payload);
  const includeNews = payload.includeNews === undefined ? true : !['0','false','no','off'].includes(String(payload.includeNews).toLowerCase());
  const news = includeNews ? await getNews({ ...payload, limit: payload.newsLimit || payload.limit || 12 }) : { status: 'SKIPPED', items: [] };
  return {
    status: (assets.assets?.length || 0) > 0 || (news.items?.length || news.news?.length || 0) > 0 ? 'OK' : 'EMPTY',
    endpoint: 'mobile-bootstrap',
    version: RELEASE.version,
    source: 'VALORAE Fonte Oficial',
    assets: assets.assets || [],
    news: news.items || news.news || [],
    partial: assets.partial || news.status === 'EMPTY',
    blockStatus: { assets: assets.status, news: news.status },
    diagnostics: { assetCount: assets.assets?.length || 0, newsCount: news.items?.length || 0 }
  };
}

function uniqueDividendItemCount(payload = {}) {
  const keys = ['portfolioUpcoming', 'upcoming', 'upcomingEvents', 'officialUpcomingEvents', 'allOfficialFuturePayments', 'portfolioReceived', 'received', 'historyEvents', 'events', 'dividends'];
  const unique = new Set();
  for (const key of keys) {
    const rows = Array.isArray(payload?.[key]) ? payload[key] : [];
    for (const item of rows) {
      const ticker = normalizeTicker(item?.ticker || item?.symbol || item?.codigo || '');
      const date = String(item?.paymentDate || item?.datePayment || item?.comDate || item?.exDate || item?.date || '').slice(0, 24);
      const kind = String(item?.kind || item?.type || item?.dividendType || '').trim().toUpperCase();
      const value = Number(item?.valuePerShare ?? item?.amount ?? item?.value ?? 0);
      const quantity = Number(item?.quantityAtDate ?? item?.eligibilityQuantity ?? item?.quantity ?? 0);
      if (ticker || date || value || quantity) unique.add([ticker, date, kind, value.toFixed(8), quantity.toFixed(8)].join('|'));
    }
  }
  return unique.size;
}

async function buildMobileAlerts(payload = {}) {
  const includeQuotes = boolParamLocal(payload.includeQuotes, false);
  const includeDividends = boolParamLocal(payload.includeDividends, false);
  const includeNews = boolParamLocal(payload.includeNews, false);
  const includeRankings = boolParamLocal(payload.includeRankings, false);
  const requestedBlocks = { quotes: includeQuotes, dividends: includeDividends, news: includeNews, rankings: includeRankings };
  const requestSource = String(payload.source || 'apk-notifications').trim().slice(0, 48) || 'apk-notifications';
  const symbols = uniqueTickers([
    ...(Array.isArray(payload.symbols) ? payload.symbols : String(payload.symbols || '').split(/[,;\s]+/)),
    ...(Array.isArray(payload.tickers) ? payload.tickers : String(payload.tickers || '').split(/[,;\s]+/)),
    ...(Array.isArray(payload.positions) ? payload.positions : []),
  ]).slice(0, 180);
  const positions = Array.isArray(payload.positions) ? payload.positions : [];
  const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];
  const dividendSymbols = mobileAlertDividendSymbols(
    positions,
    transactions,
    Array.isArray(payload.dividendTickers) ? payload.dividendTickers : []
  );
  const effectiveBlocks = {
    quotes: includeQuotes && symbols.length > 0,
    dividends: includeDividends && dividendSymbols.length > 0,
    news: includeNews && symbols.length > 0,
    rankings: includeRankings,
  };

  if (!includeQuotes && !includeDividends && !includeNews && !includeRankings) {
    return {
      status: 'EMPTY',
      endpoint: 'mobile-alerts',
      version: RELEASE.version,
      requestedBlocks,
      effectiveBlocks: { quotes: false, dividends: false, news: false, rankings: false },
      blockStatus: { quotes: 'SKIPPED', dividends: 'SKIPPED', news: 'SKIPPED', rankings: 'SKIPPED' },
      quotes: [],
      dividends: null,
      news: [],
      rankings: null,
      partial: false,
      generatedAt: new Date().toISOString(),
    };
  }

  const jobs = {
    quotes: effectiveBlocks.quotes
      ? buildAssetsPayload({
          symbols,
          tickers: symbols,
          max: Math.min(180, Math.max(1, Number(payload.max || symbols.length || 80))),
          mode: 'background_alerts_fast',
          source: requestSource,
          includeFundamentals: false,
          refresh: false,
          nocache: false,
          forceRefresh: false,
          cache: true,
          timeoutMs: Math.min(8000, Math.max(2500, Number(payload.quotesTimeoutMs || 6000))),
        })
      : Promise.resolve({ status: 'SKIPPED', assets: [] }),
    dividends: effectiveBlocks.dividends
      ? buildDividendsContract({
          positions,
          transactions,
          mode: 'mobile-notification-alerts',
          source: requestSource,
          tickers: dividendSymbols,
          symbols: dividendSymbols,
          includeCalendar: true,
          includeAgenda: true,
          futureMonths: Math.min(24, Math.max(1, Number(payload.futureMonths ?? 6))),
          historyMonths: Math.min(180, Math.max(0, Number(payload.historyMonths ?? 12))),
          timeoutMs: Math.min(14000, Math.max(4500, Number(payload.dividendsTimeoutMs || payload.timeoutMs || 11000))),
          agendaTimeoutMs: Math.min(10000, Math.max(3500, Number(payload.agendaTimeoutMs || 8000))),
          transactionCompaction: payload.transactionCompaction && typeof payload.transactionCompaction === 'object'
            ? payload.transactionCompaction
            : undefined,
        })
      : Promise.resolve({ status: 'SKIPPED' }),
    news: effectiveBlocks.news
      ? getNews({
          symbols: symbols.slice(0, 16),
          tickers: symbols.slice(0, 16),
          limit: Math.min(32, Math.max(1, Number(payload.newsLimit || 24))),
          source: requestSource,
          includeArticleBody: false,
          assetOnly: true,
          includeGeneral: false,
          refresh: false,
          nocache: false,
          bypassCache: false,
          timeoutMs: Math.min(7000, Math.max(2500, Number(payload.newsTimeoutMs || 5200))),
        })
      : Promise.resolve({ status: 'SKIPPED', items: [] }),
    rankings: effectiveBlocks.rankings
      ? buildCanonicalMarketRankings({
          limit: Math.min(12, Math.max(2, Number(payload.rankingLimit || 6))),
          source: 'home',
          mode: 'auto',
          timeoutMs: Math.min(8000, Math.max(2500, Number(payload.rankingsTimeoutMs || 6000))),
          refresh: false,
          nocache: false,
        })
      : Promise.resolve({ status: 'SKIPPED', highs: [], lows: [] }),
  };

  const names = ['quotes', 'dividends', 'news', 'rankings'];
  const settled = await Promise.allSettled(names.map(name => jobs[name]));
  const values = {};
  const blockStatus = {};
  const errors = [];
  names.forEach((name, index) => {
    const result = settled[index];
    if (result.status === 'fulfilled') {
      values[name] = result.value || {};
      blockStatus[name] = String(result.value?.status || 'EMPTY').toUpperCase();
    } else {
      values[name] = {};
      blockStatus[name] = 'ERROR';
      errors.push({ block: name, code: result.reason?.code || 'BLOCK_ERROR', error: String(result.reason?.message || result.reason || 'Falha no bloco solicitado.').slice(0, 240) });
    }
  });

  const quotes = Array.isArray(values.quotes?.assets) ? values.quotes.assets : [];
  const news = Array.isArray(values.news?.items) ? values.news.items : (Array.isArray(values.news?.news) ? values.news.news : []);
  const dividendPayload = values.dividends && typeof values.dividends === 'object' ? values.dividends : null;
  const dividendItemCount = dividendPayload ? uniqueDividendItemCount(dividendPayload) : 0;
  const rankings = values.rankings && typeof values.rankings === 'object' ? values.rankings : null;
  const rankingRows = rankings ? rankingArraysFrom(rankings) : { highs: [], lows: [] };
  const rankingItemCount = rankingRows.highs.length + rankingRows.lows.length;
  const produced = quotes.length + news.length + dividendItemCount + rankingItemCount;
  const requestedCount = Object.values(requestedBlocks).filter(Boolean).length;
  const effectiveCount = Object.values(effectiveBlocks).filter(Boolean).length;
  const failedCount = Object.entries(blockStatus).filter(([name, status]) => effectiveBlocks[name] && status === 'ERROR').length;
  const requestedHistoryMonths = Number(payload?.transactionCompaction?.requestedHistoryMonths ?? payload.historyMonths ?? 0);
  const effectiveHistoryMonths = Number(payload?.transactionCompaction?.effectiveHistoryMonths ?? requestedHistoryMonths);
  const transactionHistoryPartial = effectiveBlocks.dividends
    && Number.isFinite(requestedHistoryMonths)
    && Number.isFinite(effectiveHistoryMonths)
    && effectiveHistoryMonths < requestedHistoryMonths;
  if (transactionHistoryPartial && blockStatus.dividends !== 'ERROR') blockStatus.dividends = 'PARTIAL';

  return {
    status: effectiveCount > 0 && failedCount === effectiveCount ? 'ERROR' : (produced > 0 ? (failedCount > 0 || transactionHistoryPartial ? 'PARTIAL' : 'OK') : (failedCount > 0 || transactionHistoryPartial ? 'PARTIAL' : 'EMPTY')),
    endpoint: 'mobile-alerts',
    version: RELEASE.version,
    requestedBlocks,
    effectiveBlocks,
    blockStatus,
    quotes,
    dividends: effectiveBlocks.dividends && blockStatus.dividends !== 'ERROR' ? dividendPayload : null,
    news,
    rankings: effectiveBlocks.rankings && blockStatus.rankings !== 'ERROR' ? rankings : null,
    partial: failedCount > 0 || transactionHistoryPartial || Boolean(values.quotes?.partial) || Boolean(values.dividends?.partial) || Boolean(values.news?.partial) || Boolean(values.rankings?.partial),
    errors,
    diagnostics: { requestedSymbols: symbols.length, dividendSymbols: dividendSymbols.length, quoteCount: quotes.length, dividendItemCount, newsCount: news.length, rankingItemCount, requestedCount, effectiveCount, failedCount, transactionHistoryPartial, requestedHistoryMonths, effectiveHistoryMonths },
    generatedAt: new Date().toISOString(),
  };
}

function mobileAlertsBlockHasData(value = {}, block = '') {
  if (block === 'quotes') return Array.isArray(value.quotes) && value.quotes.length > 0;
  if (block === 'news') return Array.isArray(value.news) && value.news.length > 0;
  if (block === 'dividends') return Boolean(value.dividends && uniqueDividendItemCount(value.dividends) > 0);
  if (block === 'rankings') {
    const rows = rankingArraysFrom(value.rankings || {});
    return rows.highs.length + rows.lows.length > 0;
  }
  return false;
}

function mergeMobileAlertsWithStale(value = {}, staleValue = null) {
  if (!staleValue || typeof staleValue !== 'object') return value;
  const merged = { ...value, blockStatus: { ...(value.blockStatus || {}) } };
  let reused = false;
  for (const block of ['quotes', 'dividends', 'news', 'rankings']) {
    const status = String(merged.blockStatus?.[block] || 'SKIPPED').toUpperCase();
    const shouldReuse = status === 'ERROR' || (status === 'PARTIAL' && !mobileAlertsBlockHasData(merged, block));
    if (!shouldReuse || !mobileAlertsBlockHasData(staleValue, block)) continue;
    if (block === 'quotes') merged.quotes = staleValue.quotes;
    if (block === 'dividends') merged.dividends = staleValue.dividends;
    if (block === 'news') merged.news = staleValue.news;
    if (block === 'rankings') merged.rankings = staleValue.rankings;
    merged.blockStatus[block] = 'STALE';
    reused = true;
  }
  if (!reused) return value;
  const quoteCount = Array.isArray(merged.quotes) ? merged.quotes.length : 0;
  const newsCount = Array.isArray(merged.news) ? merged.news.length : 0;
  const dividendItemCount = merged.dividends ? uniqueDividendItemCount(merged.dividends) : 0;
  const rankingRows = rankingArraysFrom(merged.rankings || {});
  const rankingItemCount = rankingRows.highs.length + rankingRows.lows.length;
  return {
    ...merged,
    status: quoteCount + newsCount + dividendItemCount + rankingItemCount > 0 ? 'PARTIAL' : merged.status,
    partial: true,
    diagnostics: {
      ...(merged.diagnostics || {}),
      quoteCount,
      dividendItemCount,
      newsCount,
      rankingItemCount,
      staleBlocks: Object.entries(merged.blockStatus).filter(([, status]) => status === 'STALE').map(([block]) => block),
    },
  };
}

async function buildMobileAlertsCached(payload = {}) {
  const canonicalPositions = normalizePositions(payload.positions || [])
    .filter(position => position.quantity > 0)
    .map(position => ({
      ticker: position.ticker,
      quantity: Number(position.quantity || 0),
      firstPurchaseDate: String(position.firstPurchaseDate || ''),
      assetClass: String(position.assetClass || ''),
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  const canonicalTransactions = normalizeTransactions(payload.transactions || [])
    .map(transaction => ({
      ticker: transaction.ticker,
      date: String(transaction.date || ''),
      quantity: Number(transaction.quantity || 0),
    }))
    .sort((a, b) => `${a.ticker}|${a.date}|${a.quantity}`.localeCompare(`${b.ticker}|${b.date}|${b.quantity}`));
  const keyPayload = {
    includeQuotes: boolParamLocal(payload.includeQuotes, false),
    includeDividends: boolParamLocal(payload.includeDividends, false),
    includeNews: boolParamLocal(payload.includeNews, false),
    includeRankings: boolParamLocal(payload.includeRankings, false),
    newsLimit: Number(payload.newsLimit || 24),
    rankingLimit: Number(payload.rankingLimit || 6),
    futureMonths: Number(payload.futureMonths ?? 6),
    historyMonths: Number(payload.historyMonths ?? 12),
    symbols: uniqueTickers([...(Array.isArray(payload.symbols) ? payload.symbols : []), ...(Array.isArray(payload.tickers) ? payload.tickers : []), ...canonicalPositions]).slice(0, 180),
    positions: canonicalPositions,
    transactions: canonicalTransactions,
  };
  const cacheKey = `mobile-alerts:${createHash('sha256').update(stableKey(keyPayload)).digest('hex')}`;
  const cached = getCache(cacheKey, { allowStale: true });
  if (cached?.status === 'HIT') return { ...cached.value, cache: 'HIT' };
  const stale = cached?.status === 'STALE' ? cached : null;
  try {
    return await coalesce(cacheKey, async () => {
      const joined = getCache(cacheKey, { allowStale: true });
      if (joined?.status === 'HIT') return { ...joined.value, cache: 'HIT' };
      const freshValue = await buildMobileAlerts(payload);
      const staleEntry = joined?.status === 'STALE' ? joined : stale;
      const value = mergeMobileAlertsWithStale(freshValue, staleEntry?.value || null);
      if (value.status !== 'ERROR') {
        const freshTtlMs = value.status === 'PARTIAL' ? 15_000 : 90_000;
        const staleMaxAgeMs = value.status === 'PARTIAL' ? 3 * 60_000 : 12 * 60_000;
        setCache(cacheKey, value, freshTtlMs, staleMaxAgeMs);
      }
      return { ...value, cache: 'MISS' };
    });
  } catch (error) {
    if (stale) return { ...stale.value, cache: 'STALE', partial: true, staleReason: String(error?.message || error).slice(0, 180) };
    throw error;
  }
}


function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function dailyCloseQuoteMap(quotes = []) {
  return new Map((Array.isArray(quotes) ? quotes : []).map(quote => [normalizeTicker(quote?.ticker || quote?.symbol), quote]).filter(([ticker]) => ticker));
}

function dailyCloseContributionRows(positions = [], quoteMap = new Map()) {
  const rows = [];
  for (const position of positions) {
    const ticker = normalizeTicker(position?.ticker || position?.symbol);
    const quantity = finiteNumber(position?.quantity, 0);
    const quote = quoteMap.get(ticker) || {};
    const price = finiteNumber(quote?.price ?? quote?.currentPrice ?? position?.currentPrice, 0);
    const variationPercent = finiteNumber(quote?.variationPercent ?? quote?.changePercent, Number.NaN);
    if (!ticker || !(quantity > 0) || !(price > 0) || !Number.isFinite(variationPercent) || variationPercent <= -99.99) continue;
    const previousPrice = price / (1 + variationPercent / 100);
    if (!(previousPrice > 0) || !Number.isFinite(previousPrice)) continue;
    const currentValue = price * quantity;
    const previousValue = previousPrice * quantity;
    rows.push({
      ticker,
      quantity,
      price: Number(price.toFixed(6)),
      previousClose: Number(previousPrice.toFixed(6)),
      variationPercent: Number(variationPercent.toFixed(4)),
      currentValue: Number(currentValue.toFixed(2)),
      previousValue: Number(previousValue.toFixed(2)),
      contributionValue: Number((currentValue - previousValue).toFixed(2)),
      source: quote?.source || 'VALORAE Quotes',
      updatedAt: quote?.updatedAt || undefined,
    });
  }
  return rows.sort((left, right) => Math.abs(right.contributionValue) - Math.abs(left.contributionValue) || left.ticker.localeCompare(right.ticker));
}

function brazilTradingDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dailyClosePortfolioIdentity(positions = [], tradingDate = brazilTradingDate()) {
  const canonical = positions.map(position => ({
    ticker: normalizeTicker(position?.ticker || position?.symbol),
    quantity: Number(finiteNumber(position?.quantity, 0).toFixed(8)),
    averagePrice: Number(finiteNumber(position?.averagePrice, 0).toFixed(8)),
  })).filter(position => position.ticker && position.quantity > 0)
    .sort((left, right) => left.ticker.localeCompare(right.ticker));
  const digest = createHash('sha256').update(stableKey({ tradingDate, positions: canonical })).digest('hex');
  return {
    tradingDate,
    cacheKey: `mobile-daily-close:${digest}`,
    idempotencyKey: `daily-close:${tradingDate}:${digest.slice(0, 24)}`,
  };
}

function elapsedMs(started) {
  return Number((Number(process.hrtime.bigint() - started) / 1_000_000).toFixed(2));
}

async function buildDailyClose(payload = {}) {
  const totalStarted = process.hrtime.bigint();
  const positions = normalizePortfolioPositions(payload).slice(0, 45);
  const identity = dailyClosePortfolioIdentity(positions);
  if (!positions.length) {
    return {
      status: 'EMPTY',
      endpoint: 'mobile-daily-close',
      contractVersion: 'valorae-mobile-daily-close-v1',
      tradingDate: identity.tradingDate,
      idempotencyKey: identity.idempotencyKey,
      quotes: [], history: [], contributions: [],
      timings: { totalMs: elapsedMs(totalStarted) },
      generatedAt: new Date().toISOString(),
    };
  }
  const symbols = uniqueTickers(positions.map(position => position.ticker)).slice(0, 45);
  const quotesStarted = process.hrtime.bigint();
  const alerts = await buildMobileAlertsCached({
    ...payload,
    source: payload.source || 'apk-daily-close',
    symbols,
    tickers: symbols,
    positions,
    includeQuotes: true,
    includeDividends: false,
    includeNews: false,
    includeRankings: false,
    timeoutMs: Math.min(Number(payload.timeoutMs || 15000), 20000),
  });
  const quotesMs = elapsedMs(quotesStarted);
  const quotes = Array.isArray(alerts?.quotes) ? alerts.quotes : [];
  const quoteMap = dailyCloseQuoteMap(quotes);
  const effectivePositions = positions.map(position => ({
    ...position,
    currentPrice: finiteNumber(quoteMap.get(position.ticker)?.price, 0) || finiteNumber(position.currentPrice, 0),
    currentPriceSource: quoteMap.has(position.ticker) ? 'daily-close-quotes' : 'payload',
  }));
  const historyStarted = process.hrtime.bigint();
  const history = await buildPortfolioHistory(effectivePositions, {
    ...payload,
    range: '1D',
    interval: '5m',
    liveAlignment: true,
    timeoutMs: Math.min(Number(payload.historyTimeoutMs || payload.timeoutMs || 12000), 18000),
    maxConcurrency: Math.min(Number(payload.maxConcurrency || 4), 6),
  });
  const historyMs = elapsedMs(historyStarted);
  const contributions = dailyCloseContributionRows(effectivePositions, quoteMap);
  const totalTodayValue = Number(contributions.reduce((sum, row) => sum + row.currentValue, 0).toFixed(2));
  const totalPreviousValue = Number(contributions.reduce((sum, row) => sum + row.previousValue, 0).toFixed(2));
  const totalChangeValue = Number((totalTodayValue - totalPreviousValue).toFixed(2));
  const totalPercent = totalPreviousValue > 0 ? Number(((totalChangeValue / totalPreviousValue) * 100).toFixed(4)) : 0;
  const historyRows = (history?.series || []).map(point => ({
    timestamp: finiteNumber(point?.timestamp, 0),
    date: point?.date || undefined,
    totalValue: finiteNumber(point?.totalValue, 0),
    source: point?.source || history?.source || undefined,
    completeValuation: point?.completeValuation === true,
  })).filter(point => point.timestamp > 0 && point.totalValue > 0);
  const quoteCoveragePercent = positions.length ? Number(((contributions.length / positions.length) * 100).toFixed(2)) : 0;
  return {
    status: contributions.length ? (contributions.length === positions.length && historyRows.length >= 2 ? 'OK' : 'PARTIAL') : 'ERROR',
    endpoint: 'mobile-daily-close',
    contractVersion: 'valorae-mobile-daily-close-v1',
    tradingDate: identity.tradingDate,
    idempotencyKey: identity.idempotencyKey,
    summary: { totalTodayValue, totalPreviousValue, totalChangeValue, totalPercent, quotedAssets: contributions.length, positionCount: positions.length },
    quotes,
    contributions,
    history: historyRows,
    quality: {
      quoteCoveragePercent,
      historyCoveragePercent: finiteNumber(history?.historyCoveragePercent, 0),
      historyPointCount: historyRows.length,
      fallbackUsed: Boolean(history?.fallbackUsed),
      partial: contributions.length !== positions.length || historyRows.length < 2,
      alertsCache: alerts?.cache,
      source: history?.source || 'Unavailable',
    },
    timings: { quotesMs, historyMs, totalMs: elapsedMs(totalStarted) },
    generatedAt: new Date().toISOString(),
  };
}

async function buildDailyCloseCached(payload = {}) {
  const positions = normalizePortfolioPositions(payload).slice(0, 45);
  const identity = dailyClosePortfolioIdentity(positions);
  const cacheKey = identity.cacheKey;
  const cached = getCache(cacheKey, { allowStale: true });
  if (cached?.status === 'HIT') return { ...cached.value, cache: 'HIT' };
  const stale = cached?.status === 'STALE' ? cached : null;
  try {
    return await coalesce(cacheKey, async () => {
      const joined = getCache(cacheKey, { allowStale: true });
      if (joined?.status === 'HIT') return { ...joined.value, cache: 'HIT' };
      const value = await buildDailyClose(payload);
      if (value.status !== 'ERROR') setCache(cacheKey, value, value.status === 'OK' ? 5 * 60_000 : 45_000, 30 * 60_000);
      return { ...value, cache: 'MISS' };
    });
  } catch (error) {
    if (stale) return { ...stale.value, status: 'PARTIAL', cache: 'STALE', staleReason: String(error?.message || error).slice(0, 180) };
    throw error;
  }
}

function comparisonPointsFromHistory(history = {}) {
  const rows = history.points || history.history || history.series || [];
  const clean = Array.isArray(rows) ? rows.filter(point => Number(point?.close || point?.price || point?.value || 0) > 0) : [];
  if (clean.length < 2) return [];
  const base = Number(clean[0]?.close || clean[0]?.price || clean[0]?.value || 0);
  if (!(base > 0)) return [];
  return clean.map((point, index) => {
    const current = Number(point?.close || point?.price || point?.value || 0);
    return {
      label: point?.label || point?.date || `P${index + 1}`,
      date: point?.date || point?.timestamp || point?.time || '',
      value: Math.round((((current / base) - 1) * 100) * 10000) / 10000,
      returnPercent: Math.round((((current / base) - 1) * 100) * 10000) / 10000
    };
  });
}

function comparisonTickers(payload = {}) {
  const values = Array.isArray(payload.tickers || payload.symbols || payload.assets)
    ? (payload.tickers || payload.symbols || payload.assets)
    : String(payload.tickers || payload.symbols || payload.assets || payload.ticker || payload.symbol || '').split(/[,;\s]+/);
  const out = [];
  for (const value of values) {
    const raw = String(value?.ticker || value?.symbol || value || '').trim().toUpperCase();
    const special = raw.replace(/[^A-Z0-9]/g, '');
    if (['IBOV', 'BVSP', 'IBOVESPA', 'IFIX', 'IDIV', 'SMLL', 'IPCA', 'CDI', 'USD', 'USDBRL', 'USDBRLX', 'BRLX'].includes(special)) {
      const canonical = ['BVSP', 'IBOVESPA'].includes(special) ? 'IBOV' : (['USD', 'USDBRL', 'USDBRLX', 'BRLX'].includes(special) ? 'USD' : special);
      if (!out.includes(canonical)) out.push(canonical);
      continue;
    }
    for (const ticker of uniqueTickers([raw])) if (!out.includes(ticker)) out.push(ticker);
  }
  return out;
}

async function buildComparisonPayload(payload = {}) {
  const requested = comparisonTickers(payload);
  const range = payload.range || payload.period || '1Y';
  const timeoutMs = Number(payload.timeoutMs || 3800);
  const series = [];
  const diagnostics = [];
  const marketTickers = requested.filter(ticker => ticker !== 'IPCA' && ticker !== 'CDI');
  const histories = await Promise.all(marketTickers.map(async ticker => {
    const history = await getAssetHistory({ ticker, range, timeoutMs }).catch(error => ({ status: 'ERROR', ticker, points: [], error: error?.message }));
    return [ticker, history];
  }));
  for (const [ticker, history] of histories) {
    const points = comparisonPointsFromHistory(history);
    if (points.length >= 2) series.push({ name: ticker, ticker, points, source: history.source || 'VALORAE Fonte Oficial' });
    diagnostics.push({ ticker, status: history.status, count: points.length, cacheStatus: history.cacheStatus, error: history.error });
  }
  if (requested.includes('IPCA')) {
    const months = String(range).toUpperCase() === 'MAX' ? 120 : (String(range).toUpperCase() === '5Y' ? 60 : 12);
    const ipca = await getIpcaSeries(months).catch(error => ({ status: 'ERROR', points: [], error: error?.message }));
    const points = (ipca.points || ipca.series || []).map(point => ({
      label: point.month || point.date || '',
      date: point.date || '',
      value: Number(point.accumulatedPercent || 0),
      returnPercent: Number(point.accumulatedPercent || 0)
    }));
    if (points.length >= 2) series.push({ name: 'IPCA', ticker: 'IPCA', points, source: ipca.source || 'VALORAE IPCA' });
    diagnostics.push({ ticker: 'IPCA', status: ipca.status, count: points.length, cacheStatus: ipca.cacheStatus, error: ipca.error });
  }
  return {
    status: series.length ? 'OK' : 'EMPTY',
    endpoint: 'compare',
    range,
    source: 'VALORAE Fonte Oficial',
    series,
    comparison: series,
    items: series,
    results: series,
    diagnostics,
    partial: series.length < requested.filter(ticker => ticker !== 'CDI').length
  };
}


function emptyCompatible(status = 'OK') {
  return { status, items: [], events: [], data: [], partial: false, source: 'VALORAE Proxy' };
}

export async function dispatchRoute(req, res) {
  let path = '/';
  let requestId = '';
  try {
    const parsed = new URL(req.url || '/api', 'https://valorae.local');
    path = stripApi(parsed.pathname);
    const securityRequestId = applyRuntimeCors(req, res, path);
    if (String(req.method || 'GET').toUpperCase() === 'OPTIONS') return sendCorsPreflight(req, res);
    assertUrlAndQueryBudget(req);
    const incomingRequestId = String(req?.headers?.['x-request-id'] || '').trim();
    requestId = safeRequestId(incomingRequestId || securityRequestId || getRequestId(req)) || safeRequestId(getRequestId(req));
    res.setHeader('X-Request-Id', requestId);
    req.query = { ...(req.query || {}), ...queryObject(parsed.searchParams) };

    const appVersion = apkVersionFromRequest(req);
    const apkCompatibility = evaluateApkCompatibility(appVersion);
    req.valoraeApkCompatibility = apkCompatibility;
    const ecosystemCompatibility = evaluateEcosystemContract(req);
    req.valoraeEcosystemCompatibility = ecosystemCompatibility;
    beginRequestObservation(req, res, { route: path, requestId, appVersion });

    if (!ecosystemCompatibility.ok && !PUBLIC_HEADERLESS_ROUTES.has(path)) {
      return sendJson(req, res, {
        version: RELEASE.publicVersion,
        coreVersion: RELEASE.version,
        status: 'UPDATE_REQUIRED',
        requestId,
        code: 'ECOSYSTEM_CONTRACT_MISMATCH',
        error: 'O APK e o Proxy informaram contratos de ecossistema incompatíveis.',
        ecosystemCompatibility,
        apkCompatibility,
      }, { status: 426, cacheControl: 'no-store' });
    }

    const canonicalApkRequest = isCanonicalValoraeApkRequest(req);
    const apkIdentityAttempt = isValoraeApkIdentityAttempt(req);
    if (apkIdentityAttempt && shouldBlockApkCompatibility(path, apkCompatibility)) {
      return sendJson(req, res, {
        version: RELEASE.version,
        status: 'UPDATE_REQUIRED',
        requestId,
        code: apkCompatibility.reason === 'below_minimum_supported'
          ? 'APK_VERSION_UNSUPPORTED'
          : apkCompatibility.reason === 'invalid_or_missing_version'
            ? 'APK_VERSION_INVALID'
            : 'APK_VERSION_NOT_TESTED',
        error: apkCompatibility.reason === 'below_minimum_supported'
          ? 'Esta versão do VALORAE precisa ser atualizada antes de sincronizar dados financeiros.'
          : apkCompatibility.reason === 'invalid_or_missing_version'
            ? 'A versão informada pelo APK é inválida para sincronização financeira.'
            : 'Esta versão do VALORAE ainda não foi homologada para sincronização com o Proxy publicado.',
        apkCompatibility,
      }, { status: 426, cacheControl: 'no-store' });
    }
    const headerlessPublicRoute = PUBLIC_HEADERLESS_ROUTES.has(path);
    const acceptedLegacyIdentity = acceptsLegacyApkIdentity(path, apkIdentityAttempt);
    if (shouldRequireValoraeApkRequest() && !canonicalApkRequest && !acceptedLegacyIdentity && !headerlessPublicRoute) {
      return sendJson(req, res, {
        version: RELEASE.version,
        status: 'FORBIDDEN',
        requestId,
        code: 'VALORAE_APK_REQUEST_REQUIRED',
        error: 'Este Proxy aceita dados somente de requisições canônicas do APK VALORAE.',
      }, { status: 403, cacheControl: 'no-store' });
    }
    if (!routeAllowedInCurrentRuntime(path)) {
      return sendJson(req, res, {
        version: RELEASE.version,
        status: 'NOT_FOUND',
        requestId,
        code: 'ROUTE_NOT_AVAILABLE_IN_PRODUCTION',
        error: 'Rota interna ou histórica não publicada no runtime de produção.',
      }, { status: 404, cacheControl: 'no-store' });
    }

    const method = String(req.method || 'GET').toUpperCase();
    const allowedMethods = routeMethods(path);
    const effectiveMethods = allowedMethods.includes('GET') ? [...new Set([...allowedMethods, 'HEAD'])] : allowedMethods;
    if (!effectiveMethods.includes(method)) {
      return sendJson(req, res, {
        version: RELEASE.version,
        status: 'ERROR',
        requestId,
        code: 'METHOD_NOT_ALLOWED',
        error: `Método não permitido. Use ${effectiveMethods.join(' ou ')}.`,
      }, { status: 405, cacheControl: 'no-store' });
    }

    const rate = checkRateLimit(req, {
      route: `router:${path}`,
      max: Number(path.startsWith('/admin/') || path === '/cache/clear'
        ? (process.env.VALORAE_ADMIN_RATE_LIMIT_MAX || 20)
        : (process.env.VALORAE_RATE_LIMIT_MAX || 90)),
      windowMs: Number(process.env.VALORAE_RATE_LIMIT_WINDOW_MS || 60_000),
    });
    applyRateLimitHeaders(res, rate);
    if (rate.limited) {
      return sendJson(req, res, { version: RELEASE.version, status: 'RATE_LIMITED', requestId, rate }, { status: 429, cacheControl: 'no-store' });
    }
    req.valoraeGlobalRateApplied = true;

    const payload = await bodyOrQuery(req, parsed);
    const maxBodyBytes = clampInt(
      process.env.MAX_LOCAL_BODY_BYTES || process.env.VALORAE_MAX_BODY_BYTES,
      512 * 1024,
      1024,
      10 * 1024 * 1024
    );
    if (!['GET', 'HEAD'].includes(method)) {
      const originalBody = req.body;
      req.body = originalBody === undefined ? payload : originalBody;
      assertBodySize(req, maxBodyBytes);
    }
    const payloadRequestId = String(payload?.requestId || '').trim();
    requestId = safeRequestId(incomingRequestId || payloadRequestId || requestId) || requestId;
    res.setHeader('X-Request-Id', requestId);

    const clientAuth = resolveClientAuth(req, {
      requireClientAuth: shouldRequireValoraeApkRequest() && APK_COMPATIBILITY_BLOCKING_ROUTES.has(path),
      path,
      query: req.query,
      payload: ['GET', 'HEAD'].includes(method) ? '' : payload,
    });
    req.valoraeClientAuth = clientAuth;
    res.setHeader('X-Valorae-Auth-Mode', clientAuth.mode || 'open');
    if (clientAuth.appId) res.setHeader('X-Valorae-App-Id', String(clientAuth.appId).slice(0, 80));
    if (shouldRequireClientAuth() && !clientAuth.ok) {
      return sendJson(req, res, {
        version: RELEASE.version,
        status: 'FORBIDDEN',
        requestId,
        code: 'VALORAE_APK_REQUEST_REQUIRED',
        error: 'A requisição não possui a identidade canônica do APK VALORAE.',
        auth: { mode: clientAuth.mode, appId: clientAuth.appId, reason: clientAuth.reason, required: true }
      }, { status: 403, cacheControl: 'no-store' });
    }

    payload.requestId = requestId;
    const formalRequestValidation = validateFormalRequestPayload(path, payload);
    req.valoraeFormalRequestValidation = formalRequestValidation;
    if (formalRequestSchemaMode() === 'enforce' && formalRequestValidation.applicable && !formalRequestValidation.ok) {
      return sendJson(req, res, {
        status: 'ERROR',
        code: 'FORMAL_REQUEST_SCHEMA_INVALID',
        error: 'A requisição não corresponde ao schema formal desta rota.',
        requestId,
        contractSchemaValidation: { ...formalRequestValidation, hiddenFromUi: true, canReplacePrevious: false },
      }, { status: 400, cacheControl: 'no-store' });
    }
    req.query = { ...(req.query || {}), ...payload };
    if (req.body === undefined || req.body === null || (typeof req.body === 'object' && !Array.isArray(req.body) && Object.keys(req.body).length === 0)) req.body = payload;

    if (path === '/') return sendJson(req, res, rootPayload());
    if (path === '/health' || path === '/ready') return sendJson(req, res, health(), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.ready}` });
    if (path === '/env') return sendJson(req, res, { status: 'OK', env: { node: process.version, runtime: 'node' }, version: RELEASE.publicVersion, coreVersion: RELEASE.version });
    if (path === '/contract/baseline') return sendJson(req, res, { ...buildContractBaselineManifest(), release: RELEASE.patch, continuityStore: contractContinuityStats() }, { cacheControl: 'private, max-age=120' });
    if (path === '/contract/source-adapters') return sendJson(req, res, { ...(await buildSourceAdapterManifest()), release: RELEASE.patch }, { cacheControl: 'private, max-age=30' });
    if (path === '/contract/html-parser-shadow') return sendJson(req, res, { ...(await buildLazyFeatureManifest('html-parser-shadow', () => import('../lib/scrape/standard-html-parser.js'), 'buildHtmlParserShadowManifest')), release: RELEASE.patch }, { cacheControl: 'private, max-age=30' });
    if (path === '/contract/structured-data') return sendJson(req, res, { ...(await buildLazyFeatureManifest('structured-data', () => import('../lib/scrape/structured-data-discovery.js'), 'buildStructuredDataManifest')), release: RELEASE.patch }, { cacheControl: 'private, max-age=30' });
    if (path === '/contract/dynamic-render') return sendJson(req, res, { ...(await buildLazyFeatureManifest('dynamic-render', () => import('../lib/scrape/dynamic-render-fallback.js'), 'buildDynamicRenderManifest')), release: RELEASE.patch }, { cacheControl: 'private, max-age=15' });
    if (path === '/contract/extraction-intelligence') return sendJson(req, res, { ...(await buildLazyFeatureManifest('extraction-intelligence', () => import('../lib/scrape/extraction-intelligence.js'), 'buildExtractionIntelligenceManifest')), release: RELEASE.patch }, { cacheControl: 'private, max-age=30' });
    if (path === '/contract/formal-schemas') return sendJson(req, res, { ...buildFormalSchemaManifest({ includeSchemas: String(payload.includeSchemas || payload.full || '').toLowerCase() === 'true' || payload.includeSchemas === '1' }), release: RELEASE.patch }, { cacheControl: 'private, max-age=120' });
    if (path === '/contract/http-transport') return sendJson(req, res, { ...(await buildLazyFeatureManifest('http-transport', () => import('../lib/http/provider-transport.js'), 'buildProviderTransportManifest')), release: RELEASE.patch }, { cacheControl: 'private, max-age=15' });
    if (path === '/contract/shared-state') return sendJson(req, res, { ...(await buildLazyFeatureManifest('shared-state', () => import('../lib/state/shared-runtime-state.js'), 'buildSharedStateManifest')), release: RELEASE.patch }, { cacheControl: 'private, max-age=10' });
    if (path === '/contract/real-canaries') return sendJson(req, res, { ...(await buildLazyFeatureManifest('real-canaries', () => import('../lib/canary/real-canary.js'), 'buildRealCanaryManifest')), release: RELEASE.patch }, { cacheControl: 'private, max-age=10' });
    if (path === '/contract/final-decomposition') return sendJson(req, res, { ...(await buildLazyFeatureManifest('final-decomposition', () => import('../lib/architecture/final-decomposition.js'), 'buildFinalDecompositionManifest')), release: RELEASE.patch }, { cacheControl: 'private, max-age=60' });
    if (path === '/contract/scraping-engine') return sendJson(req, res, { ...(await buildLazyFeatureManifest('scraping-engine', () => import('../lib/scrape/document-context.js'), 'buildHybridDocumentManifest')), release: RELEASE.patch }, { cacheControl: 'private, max-age=30' });
    if (path === '/contract/observability') {
      if (!boolParamLocal(process.env.VALORAE_FIELD_OBSERVABILITY_ENABLED, false)) {
        return sendJson(req, res, { status: 'DISABLED', endpoint: 'contract/observability', release: RELEASE.patch }, { cacheControl: 'private, max-age=300' });
      }
      const module = await loadFeatureModule('field-observability', () => import('../lib/observability/field-observability.js'));
      const trace = module.getFieldObservabilityTrace(payload.traceId || payload.requestId || '');
      return sendJson(req, res, trace
        ? { status: 'OK', endpoint: 'contract/observability/trace', trace, release: RELEASE.patch }
        : { ...module.buildFieldObservabilityManifest(), release: RELEASE.patch, traceStore: module.fieldObservabilityStats() },
      { cacheControl: trace ? 'no-store' : 'private, max-age=120' });
    }
    if (path === '/release/readiness' || path === '/personal/readiness') return runLazyDefaultHandler('route-release-readiness', () => import('./release/readiness.js'), req, res);
    if (path === '/manifest' || path === '/schema' || path === '/source/status' || path === '/deploy/status') return sendJson(req, res, manifest());
    if (path === '/cache/stats') return sendJson(req, res, { status: 'OK', cache: cacheStats(), requests: requestMetricsSnapshot() });
    if (path === '/metrics/runtime') return sendJson(req, res, { status: 'OK', cache: cacheStats(), requests: requestMetricsSnapshot() }, { cacheControl: 'no-store' });
    if (path === '/fields') return sendJson(req, res, { status: 'OK', endpoint: 'fields', fields: ['positions','dividendPositions','transactions','tickers','includeAnalysis','includeHistory','includeIpca','includeDividends','includeRankings'] });
    if (path === '/errors') return sendJson(req, res, { status: 'OK', endpoint: 'errors', errors: ['INVALID_JSON','PAYLOAD_TOO_LARGE','ROUTE_ERROR','NOT_FOUND'] });
    if (path === '/openapi') return sendJson(req, res, { status: 'OK', openapi: '3.0.0', info: { title: 'VALORAE Proxy API', version: RELEASE.publicVersion, 'x-core-version': RELEASE.version }, paths: Object.fromEntries(routeManifest().routes.map(r => [`/api/v1${r}`, openApiOperationForRoute(r)])) });
    if (path === '/sync') return runLazyDefaultHandler('route-sync', () => import('./sync.js'), req, res);
    if (path === '/admin/status') return sendJson(req, res, { status: 'OK', admin: false, version: RELEASE.publicVersion, coreVersion: RELEASE.version, cache: cacheStats() });
    if (path === '/compat/scraper4' || path === '/scraper4' || path === '/scraper') return runLazyDefaultHandler('route-compat-scraper4', () => import('./compat/scraper4.js'), req, res);
    if (path === '/cache/clear' || path === '/admin/cache') {
      requireAdmin(req);
      clearCache();
      return sendJson(req, res, { status: 'OK', cleared: true, requestId }, { cacheControl: 'no-store' });
    }

    if (path === '/mobile/bootstrap' || path === '/app/bootstrap') return sendJson(req, res, await withContractBaseline('mobileSync', await mobileBootstrap(payload), payload), { cacheControl: 'private, max-age=45' });
    if (path === '/mobile/practical-sync' || path === '/app/practical-sync') return sendJson(req, res, await withContractBaseline('mobileSync', await buildMobilePortfolioSync({ ...payload, practicalMode: true, includeDividendsInBundle: payload.includeDividendsInBundle ?? false, includeRankings: payload.includeRankings ?? false }), payload), { cacheControl: 'private, max-age=20' });
    if (path === '/mobile/portfolio-sync' || path === '/app/portfolio-sync' || path === '/portfolio/insights-bundle') return sendJson(req, res, await withContractBaseline('mobileSync', await buildMobilePortfolioSync(payload), payload), { cacheControl: 'private, max-age=20' });

    if (path === '/mobile/alerts' || path === '/app/alerts') return sendJson(req, res, await buildMobileAlertsCached(payload), { cacheControl: 'no-store' });
    if (path === '/mobile/daily-close' || path === '/app/daily-close') return sendJson(req, res, await buildDailyCloseCached(payload), { cacheControl: 'private, max-age=300, stale-while-revalidate=1800' });

    if (path === '/dividends/batch') return sendJson(req, res, await buildDividendsContract(payload), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioDividends}` });
    if (path === '/portfolio/dividends' || path === '/portfolio/next-dividends' || path === '/portfolio/events') return sendJson(req, res, await buildDividendsContract(payload), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioDividends}` });

    if (path === '/portfolio/equilibrium' || path === '/portfolio/balance') return sendJson(req, res, buildEquilibriumContract(payload), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioEquilibrium}` });
    if (path === '/portfolio/analyze' || path === '/portfolio/allocation' || path === '/portfolio/rebalance' || path === '/portfolio/risk' || path === '/portfolio/income' || path === '/portfolio/summary' || path === '/portfolio/transactions') return sendJson(req, res, await buildPortfolioAnalysis(payload), { cacheControl: 'private, max-age=20' });
    if (path === '/portfolio/returns' || path === '/portfolio/return' || path === '/portfolio/performance') return sendJson(req, res, await withContractBaseline('portfolioReturns', await buildPortfolioReturns(payload), payload), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioReturns}` });
    // Compat marker: VALORAE_REALTIME_PORTFOLIO_HISTORY_ENGINE_V291 evoluído para VALORAE_PORTFOLIO_HISTORY_REBUILD_V292.
    if (path === '/portfolio/history') {
      const normalizedPositions = normalizePortfolioPositions({
        ...payload,
        tickers: payload.tickers || payload.ticker || payload.symbols || payload.symbol
      });
      const normalizedTransactions = normalizePortfolioTransactions(payload);
      const hasPositions = normalizedPositions.length > 0;
      const hasTickers = String(payload.tickers || payload.ticker || payload.symbols || payload.symbol || '').trim().length > 0;
      const hasTransactions = normalizedTransactions.length > 0;
      if (hasPositions || hasTickers || hasTransactions) {
        const data = await buildPortfolioHistory(normalizedPositions, {
          ...payload,
          transactions: normalizedTransactions,
          range: payload.range || payload.period || '1M',
          interval: payload.interval,
          timeoutMs: payload.timeoutMs || 12000,
          maxConcurrency: payload.maxConcurrency || 4
        });
        return sendJson(req, res, await withContractBaseline('portfolioHistory', { endpoint: 'portfolio-history', ...data }, payload), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioHistory}, stale-while-revalidate=120` });
      }
      return sendJson(req, res, await withContractBaseline('portfolioHistory', await buildRealMarketHistory(payload), payload), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioHistory}, stale-while-revalidate=120` });
    }
    if (path === '/asset/history') return runLazyDefaultHandler('route-asset-history', () => import('./asset/history.js'), req, res);
    if (path === '/asset/logo' || path === '/asset/yahoo-logo') return assetLogoHandler(req, res, payload);
    if (path === '/asset/modal') {
      const modal = await withContractBaseline('assetModal', await buildAssetModalContract(payload), payload);
      const degraded = Boolean(
        modal?.partial || modal?.timeout ||
        String(modal?.status || '').toUpperCase() === 'PARTIAL' ||
        modal?.delivery?.isFinal === false ||
        modal?.delivery?.stableForCache === false
      );
      const stage = String(payload.stage || modal?.delivery?.deliveredStage || 'full').toLowerCase();
      const maxAge = stage === 'fast' ? 35 : 180;
      return sendJson(req, res, modal, {
        cacheControl: degraded ? 'no-store' : `private, max-age=${maxAge}, stale-while-revalidate=${stage === 'fast' ? 120 : 900}`
      });
    }
    if (path === '/market/ipca') return sendJson(req, res, await getIpcaSeries(payload.historyMonths || payload.months || 12), { cacheControl: 'private, max-age=300' });
    if (path === '/market/rankings') return sendJson(req, res, { version: RELEASE.version, requestId: payload.requestId, ...(await buildCanonicalMarketRankings(payload)) }, { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.marketRankings}, stale-while-revalidate=300` });
    if (path === '/analysis/rankings') {
      const rankingId = String(payload.rankingId || payload.ranking || payload.id || '').trim();
      const result = rankingId
        ? await fetchInvestidor10AnalysisRanking({
            rankingId,
            limit: clampInt(payload.limit || payload.max || payload.maxItems, 40, 1, 60),
            timeoutMs: clampInt(payload.timeoutMs, 7000, 1200, 20000),
            bypassCache: boolParamLocal(payload.refresh || payload.nocache),
          })
        : await getInvestidor10AnalysisRankingCatalog();
      return sendJson(req, res, { version: RELEASE.version, requestId: payload.requestId, endpoint: 'analysis-rankings', ...result }, { cacheControl: 'private, max-age=120, stale-while-revalidate=900' });
    }
    if (path === '/market/indices') return runLazyDefaultHandler('route-market-indices', () => import('./market/indices.js'), req, res);

    if (path === '/asset/quote' || path === '/quote') {
      const bypassQuoteCache = boolParamLocal(payload.refresh || payload.nocache || payload.forceRefresh, false);
      return sendJson(req, res, await getQuote(payload.ticker || payload.symbol || payload.q, {
        timeoutMs: Number(payload.timeoutMs || 3500),
        bypassCache: bypassQuoteCache,
        cache: !bypassQuoteCache
      }), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.quote}, stale-while-revalidate=300` });
    }
    if (path === '/quotes') {
      const rawBatch = payload.tickers || payload.symbols || payload.assets || payload.positions || payload.ticker || payload.symbol || payload.q;
      return sendJson(req, res, await buildAssetsPayload({
        ...payload,
        tickers: rawBatch,
        max: payload.max || 180,
        fundamentalTimeoutMs: payload.fundamentalTimeoutMs || payload.fundamentusTimeoutMs || 6500
      }), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.quotes}, stale-while-revalidate=300` });
    }
    if (path === '/assets') return runLazyDefaultHandler('route-assets', () => import('./assets.js'), req, res);
    if (path === '/compare') {
      const tickers = comparisonTickers(payload);
      if (tickers.length < 2) {
        return sendJson(req, res, { status: 'ERROR', error: 'Informe ao menos dois tickers para comparação.' }, { status: 400, cacheControl: 'no-store' });
      }
      return sendJson(req, res, await buildComparisonPayload(payload), { cacheControl: 'private, max-age=60' });
    }
    if (path === '/news') return sendJson(req, res, await getNews(payload), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.news}, stale-while-revalidate=120` });
    if (path === '/news/article') return sendJson(req, res, await getArticleContent(payload), { cacheControl: 'private, max-age=600, stale-while-revalidate=86400' });
    if (path === '/watchlist/analyze') return sendJson(req, res, emptyCompatible('OK'));
    if (path === '/scrape') {
      const url = String(payload.url || '').trim();
      if (!url) return sendJson(req, res, scrapeError('MISSING_TARGET_URL', 'URL HTTPS permitida obrigatória.'), { status: 400, cacheControl: 'no-store' });
      let fetched;
      try {
        fetched = await fetchAllowedScrapeText(url, {
          allowedHosts: allowedScrapeHosts(),
          timeoutMs: payload.timeoutMs,
          maxRedirects: payload.maxRedirects,
        });
      } catch (error) {
        const status = clampInt(error?.status, 400, 400, 504);
        return sendJson(req, res, scrapeError(error?.code || 'SCRAPE_TARGET_REJECTED', error?.message || 'Destino de scraping rejeitado.', status), { status, cacheControl: 'no-store' });
      }
      const textLimit = clampInt(payload.limit, 5_000, 100, 50_000);
      const htmlLimit = clampInt(payload.htmlLimit, 200_000, 1_000, 500_000);
      const rawText = String(fetched.text || '');
      return sendJson(req, res, {
        status: fetched.status ? 'OK' : 'ERROR',
        url: fetched.diagnosticUrl,
        html: payload.returnHtml ? rawText.slice(0, htmlLimit) : undefined,
        text: rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, textLimit),
        metrics: {
          cacheStatus: fetched.cacheStatus,
          status: fetched.status,
          redirects: fetched.redirectCount || 0,
          htmlTruncated: Boolean(payload.returnHtml && rawText.length > htmlLimit),
          networkSafetyPolicy: fetched.networkSafetyPolicy,
        },
      });
    }
    if (path === '/batch-scrape') return sendJson(req, res, { status: 'OK', results: [], data: [] });

    return sendJson(req, res, { status: 'NOT_FOUND', error: 'Rota não encontrada no contrato enxuto VALORAE.', path, available: routeManifest().routes }, { status: 404, cacheControl: 'no-store' });
  } catch (error) {
    const safe = sanitizeError(error);
    return sendJson(req, res, { status: 'ERROR', requestId, code: safe.code, error: safe.message, path }, { status: safe.status, cacheControl: 'no-store' });
  }
}

export function routeManifest() {
  return {
    physicalFunctions: ['api/router.js'],
    legacyAliases: { '/scraper': '/compat/scraper4', '/api/router?path=...': '/api/v1/{path}' },
    routes: [
    '/health','/ready','/manifest','/env','/schema','/contract/baseline','/contract/observability','/contract/source-adapters','/contract/html-parser-shadow','/contract/structured-data','/contract/dynamic-render','/contract/extraction-intelligence','/contract/formal-schemas','/contract/http-transport','/contract/shared-state','/contract/real-canaries','/contract/final-decomposition','/contract/scraping-engine','/source/status','/release/readiness','/personal/readiness','/cache/stats','/metrics/runtime','/cache/clear','/deploy/status','/fields','/errors','/openapi','/sync','/mobile/bootstrap','/mobile/practical-sync','/mobile/portfolio-sync','/mobile/alerts','/mobile/daily-close','/portfolio/insights-bundle','/dividends/batch','/portfolio/returns','/portfolio/analyze','/portfolio/allocation','/portfolio/equilibrium','/portfolio/balance','/portfolio/dividends','/portfolio/events','/portfolio/history','/portfolio/income','/portfolio/next-dividends','/portfolio/rebalance','/portfolio/risk','/portfolio/summary','/portfolio/transactions','/market/ipca','/market/rankings','/analysis/rankings','/market/indices','/news/article','/asset/quote','/quote','/quotes','/asset/history','/asset/logo','/asset/yahoo-logo','/asset/modal','/assets','/compare','/news','/watchlist/analyze','/scrape','/batch-scrape','/admin/status','/admin/cache','/scraper','/scraper4','/compat/scraper4'
  ].sort() };
}

export const _test = { stripApi, stripApiPrefix, safeRequestId, routeMethod, routeMethods, openApiOperationForRoute, assetLogoHandler, comparisonTickers, buildComparisonPayload, contractIdentity, buildMobileAlerts, mergeMobileAlertsWithStale, buildDailyClose, buildDailyCloseCached, dailyClosePortfolioIdentity, brazilTradingDate, dailyCloseContributionRows, mobileAlertDividendSymbols, uniqueDividendItemCount, routeAllowedInCurrentRuntime, shouldBlockApkCompatibility, acceptsLegacyApkIdentity, PUBLIC_HEADERLESS_ROUTES, APK_COMPATIBILITY_BLOCKING_ROUTES, PRODUCTION_ROUTE_ALLOWLIST };
