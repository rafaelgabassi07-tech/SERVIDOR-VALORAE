import { RELEASE } from '../lib/core/release.js';
import { sendJson, queryObject, readJsonBody } from '../lib/core/http.js';
import { cacheStats, clearCache } from '../lib/core/cache.js';
import { buildMobilePortfolioSync } from '../lib/contracts/mobile.js';
import { buildDividendsContract } from '../lib/portfolio/dividends-contract.js';
import { buildPortfolioAnalysis, buildRealMarketHistory, buildPortfolioReturns, buildRankings } from '../lib/portfolio/analysis.js';
import { buildPortfolioHistory, normalizePortfolioPositions, normalizePortfolioTransactions } from '../lib/portfolio/history.js';
import { buildEquilibriumContract } from '../lib/portfolio/equilibrium-metadata.js';
import { buildAssetsPayload, buildIndicesPayload, buildMarketMovers, getQuote } from '../lib/sources/quotes.js';
import { fetchInvestidor10Rankings } from '../lib/market/rankings-i10.js';
import { getNews } from '../lib/sources/news.js';
import { getIpcaSeries } from '../lib/sources/ipca.js';
import { fetchText } from '../lib/sources/fetch.js';
import { normalizeTicker, classifyTicker, uniqueTickers } from '../lib/core/tickers.js';
import { getConfirmedDividendsByTicker } from '../lib/sources/status-dividends.js';
import { getAgendaDividends } from '../lib/sources/agenda-dividends.js';
import { buildAssetDetails, getAssetHistory } from '../lib/sources/asset-details.js';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';
import { buildFiiModalContract } from '../lib/analysis/fii-modal-contract.js';
import { buildStockModalContract } from '../lib/analysis/stock-modal-contract.js';
import { buildAssetModalContract } from '../lib/analysis/asset-modal-contract.js';
import { fetchYahooLogo } from '../lib/market/yahoo.js';
import { fetchOfficialStatusInvestLogo, officialStatusInvestLogoCandidates } from '../lib/market/official-logo.js';
import integrationManifestHandler from './integration/manifest.js';
import integrationSdkHandler from './integration/sdk.js';
import integrationPromptsHandler from './integration/prompts.js';
import releaseReadinessHandler from './release/readiness.js';
import assetsHandler from './assets.js';
import assetHistoryHandler from './asset/history.js';
import marketIndicesHandler from './market/indices.js';
import compatScraperHandler from './compat/scraper4.js';
import syncHandler from './sync.js';
import serverMetricsHandler from './server/metrics.js';
import { TtlLruCache } from '../lib/cache/memory.js';
import { getRequestId } from '../lib/security/guard.js';
import { attachProxyMetricsInterceptor } from '../lib/observability/server-metrics.js';
import { coalesce } from '../lib/resilience/inflight.js';
import {
  VALORAE_ASSET_MODAL_DELIVERY_SCHEMA_VERSION,
  VALORAE_MOBILE_CACHE_POLICY_SECONDS,
  VALORAE_MOBILE_PROTOCOL_VERSION,
  corsMethodsCsv,
  exposeHeadersCsv,
  requestHeadersCsv,
} from '../lib/core/mobile-protocol.js';

const analysisRouteCache = globalThis.__VALORAE_ANALYSIS_ROUTE_CACHE__ || new TtlLruCache({
  name: 'analysis-route-response-cache',
  maxEntries: 96,
  maxBytes: 14 * 1024 * 1024,
  ttlMs: 60 * 1000
});
globalThis.__VALORAE_ANALYSIS_ROUTE_CACHE__ = analysisRouteCache;

function analysisRouteCacheKey(ticker, payload = {}) {
  const pick = (value, fallback = '') => String(value ?? fallback).trim().toLowerCase();
  return [
    'analysis',
    String(ticker || '').toUpperCase(),
    pick(payload.surface || payload.consumer || payload.consumerId, 'page'),
    pick(payload.mode || payload.priority, 'full'),
    pick(payload.range, 'auto'),
    pick(payload.fastMode || payload.fast || '', ''),
    pick(payload.chartPointLimit, ''),
    pick(payload.maxCharts, ''),
    pick(payload.maxItems, '')
  ].join(':');
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

function applyRuntimeCors(req, res) {
  const origin = req?.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin === '*' ? '*' : String(origin));
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', corsMethodsCsv());
  res.setHeader('Access-Control-Allow-Headers', requestHeadersCsv());
  res.setHeader('Access-Control-Expose-Headers', exposeHeadersCsv());
  res.setHeader('Access-Control-Max-Age', '600');
}

function sendCorsPreflight(req, res) {
  applyRuntimeCors(req, res);
  res.statusCode = 200;
  res.setHeader('Cache-Control', 'private, max-age=600');
  return res.end('');
}

function buildIntegrationSdkPayload() {
  const jsClient = `export async function getValoraeAsset(ticker, options = {}) {
  const baseUrl = (options.baseUrl || 'https://servidor-valorae.vercel.app').replace(/\\/$/, '');
  const url = new URL(baseUrl + '/api/v1/asset');
  const controller = new AbortController();
  const timeoutMs = Math.max(1500, Math.min(Number(options.timeoutMs || 12000), 30000));
  const timer = setTimeout(() => controller.abort(new Error('VALORAE_TIMEOUT')), timeoutMs);
  url.searchParams.set('ticker', String(ticker || '').toUpperCase());
  url.searchParams.set('view', options.view || 'app');
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json', 'x-request-id': options.requestId || globalThis.crypto?.randomUUID?.() || String(Date.now()), 'x-valorae-app': options.app || 'Meu App', 'x-valorae-channel': options.channel || 'web', 'x-valorae-app-version': options.appVersion || '1.0.0', 'x-valorae-build': options.build || 'release', 'x-valorae-app-id': options.appId || 'valorae-web-client' } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.code || 'Erro Valorae');
    return data;
  } finally { clearTimeout(timer); }
}
export function shouldReplaceLocalCache(data) {
  if (!data || data.status === 'ERROR') return false;
  if (data.appResponseIntegrity?.cacheSafe === false) return false;
  if (data.engineLaunchGate?.decision === 'hold_previous_snapshot') return false;
  return true;
}`;
  return {
    status: 'OK',
    version: RELEASE.version,
    endpoint: 'integration/sdk',
    recommendedView: 'app',
    stableRoots: ['appMobileSnapshot', 'appPayload', 'appSyncEnvelope', 'appResponseIntegrity', 'engineLaunchGate', 'engineRuntimeProfiler'],
    headers: requestHeadersCsv().split(', ').map(header => header.toLowerCase()),
    mobileProtocolVersion: VALORAE_MOBILE_PROTOCOL_VERSION,
    mobileCachePolicySeconds: VALORAE_MOBILE_CACHE_POLICY_SECONDS,
    cachePolicySemantics: { freshness: 'seconds', staleGrace: 'seconds-after-freshness' },
    minimumMobileProtocolVersion: VALORAE_MOBILE_PROTOCOL_VERSION,
    examples: { javascript: jsClient, kotlinAndroid: 'Use OkHttp/HttpURLConnection com TLS e timeout explícito.' },
    rules: ['Use view=app em produção.', 'Preserve o último snapshot bom em respostas parciais.']
  };
}

function routeMethods(path = '') {
  const normalized = String(path || '').replace(/^\/api(?:\/v[12])?/, '') || '/';
  if (normalized === '/sync') return ['GET', 'POST', 'DELETE'];
  const postRoutes = new Set([
    '/mobile/bootstrap', '/app/bootstrap',
    '/mobile/practical-sync', '/app/practical-sync',
    '/mobile/portfolio-sync', '/app/portfolio-sync', '/portfolio/insights-bundle',
    '/dividends/batch',
    '/portfolio/dividends', '/portfolio/next-dividends', '/portfolio/events',
    '/portfolio/returns', '/portfolio/analyze', '/portfolio/allocation', '/portfolio/equilibrium',
    '/portfolio/balance', '/portfolio/history', '/portfolio/income', '/portfolio/rebalance',
    '/portfolio/risk', '/portfolio/summary', '/portfolio/transactions',
    '/compare', '/watchlist/analyze', '/batch-scrape'
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

function buildIntegrationManifestPayload() {
  return {
    status: 'OK',
    version: RELEASE.version,
    endpoint: 'integration/manifest',
    contractVersion: `${RELEASE.patch}-integration-manifest`,
    releasePatch: RELEASE.patch,
    mobileProtocolVersion: VALORAE_MOBILE_PROTOCOL_VERSION,
    assetModalDeliverySchemaVersion: VALORAE_ASSET_MODAL_DELIVERY_SCHEMA_VERSION,
    mobileCachePolicySeconds: VALORAE_MOBILE_CACHE_POLICY_SECONDS,
    cachePolicySemantics: { freshness: 'seconds', staleGrace: 'seconds-after-freshness' },
    minimumMobileProtocolVersion: VALORAE_MOBILE_PROTOCOL_VERSION,
    requestHeaders: requestHeadersCsv().split(', '),
    exposedResponseHeaders: exposeHeadersCsv().split(', '),
    stableRoots: {
      firstPaint: 'appMobileSnapshot', detail: 'appPayload', cacheDecision: 'appSyncEnvelope', safety: 'appResponseIntegrity', quality: 'fieldConsistencyGuard', action: 'assetActionPlan'
    },
    endpoints: routeManifest().routes.map(path => ({
      path: `/api/v1${path}`,
      method: routeMethod(path),
      methods: routeMethods(path)
    }))
  };
}

function buildIntegrationPromptsPayload() {
  return { status: 'OK', version: RELEASE.version, endpoint: 'integration/prompts', prompts: [] };
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

function allowedScrapeHost(hostname = '') {
  const host = String(hostname || '').toLowerCase();
  const env = String(process.env.VALORAE_SCRAPE_ALLOWED_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const allowed = env.length ? env : ['investidor10.com.br', 'www.investidor10.com.br', 'statusinvest.com.br', 'www.statusinvest.com.br', 'fundamentus.com.br', 'www.fundamentus.com.br', 'dados.cvm.gov.br'];
  return allowed.some(base => host === base || host.endsWith(`.${base}`));
}

async function bodyOrQuery(req, parsed) {
  const query = queryObject(parsed.searchParams);
  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET') return { ...query };
  const body = await readJsonBody(req).catch(err => { throw err; });
  return typeof body === 'object' && !Array.isArray(body) ? { ...query, ...body } : { ...query, body };
}

function rootPayload() {
  return {
    name: RELEASE.name,
    version: RELEASE.version,
    status: 'online',
    contract: RELEASE.contract,
    routes: ['/api/v1/mobile/practical-sync', '/api/v1/mobile/portfolio-sync', '/api/v1/mobile/bootstrap', '/api/v1/dividends/batch', '/api/v1/portfolio/equilibrium', '/api/v1/portfolio/returns', '/api/v1/assets', '/api/v1/news', '/api/v1/market/rankings', '/api/v1/analysis', '/api/v1/monitor/summary', '/api/v1/monitor/self-test', '/api/v1/asset', '/api/v1/market/ipca', '/api/v1/health'],
    router: routeManifest(),
    monitor: '/server.html'
  };
}

function health() {
  return { ok: true, status: 'OK', online: true, version: RELEASE.version, release: RELEASE.patch, now: new Date().toISOString() };
}

function manifest() {
  return { status: 'OK', name: RELEASE.name, version: RELEASE.version, release: RELEASE.patch, contract: RELEASE.contract, endpoints: routeManifest().routes };
}
function monitorSummary() {
  const routes = routeManifest().routes;
  const cache = cacheStats();
  return {
    status: 'OK',
    monitor: 'valorae-proxy-monitor',
    version: RELEASE.version,
    release: RELEASE.patch,
    contract: RELEASE.contract,
    now: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime?.() || 0),
    runtime: { node: process.version, platform: process.platform },
    cache,
    routes: {
      total: routes.length,
      primary: ['/api/v1/mobile/practical-sync', '/api/v1/mobile/portfolio-sync', '/api/v1/mobile/bootstrap', '/api/v1/portfolio/equilibrium', '/api/v1/portfolio/returns', '/api/v1/assets', '/api/v1/news', '/api/v1/market/rankings', '/api/v1/market/ipca', '/api/v1/dividends/batch', '/api/v1/health'],
      compatibility: routes.filter(r => r.includes('/portfolio/') || r.includes('/asset/')).length
    },
    checks: {
      health: 'OK',
      contract: RELEASE.contract === 'valorae-mobile-portfolio-sync' ? 'OK' : 'WARN',
      cache: cache.inFlight === 0 ? 'OK' : 'BUSY'
    }
  };
}

async function monitorSelfTest() {
  const samplePosition = { ticker: 'PETR4', quantity: 100, avgPrice: 30, currentPrice: 32, firstPurchaseDate: '2024-01-02' };
  const started = Date.now();
  const contract = await buildMobilePortfolioSync({
    positions: [samplePosition],
    dividendPositions: [samplePosition],
    includeAnalysis: true,
    includeHistory: true,
    includeIpca: false,
    includeDividends: false,
    includeRankings: false
  });
  const emptyDividends = await buildDividendsContract({ positions: [], tickers: [] });
  const assetHistory = await getAssetHistory({ ticker: 'PETR4', range: '1M', timeoutMs: 10 });
  const checks = [
    { name: 'mobileContract', ok: contract?.endpoint === 'mobile-portfolio-sync' && contract?.bundleVersion === RELEASE.version },
    { name: 'analysisBlock', ok: Boolean(contract?.analysis?.summary) },
    { name: 'historyBlock', ok: Array.isArray(contract?.history?.points) },
    { name: 'emptyDividendGuard', ok: emptyDividends?.status === 'EMPTY' && emptyDividends?.officialEvents?.length === 0 },
    { name: 'assetHistoryContract', ok: assetHistory?.ticker === 'PETR4' && Array.isArray(assetHistory?.points) }
  ];
  const failed = checks.filter(check => !check.ok);
  return {
    status: failed.length ? 'WARN' : 'OK',
    endpoint: 'monitor-self-test',
    version: RELEASE.version,
    elapsedMs: Date.now() - started,
    checks,
    diagnostics: failed.length ? failed : [{ name: 'all', ok: true }]
  };
}


function assetPayload(payload = {}) {
  const ticker = normalizeTicker(payload.ticker || payload.symbol || payload.q);
  const assetClass = classifyTicker(ticker);
  return {
    status: ticker ? 'OK' : 'EMPTY',
    ticker,
    symbol: ticker,
    assetClass,
    source: 'VALORAE Fonte Oficial',
    profile: { ticker, assetClass, name: ticker, segment: assetClass === 'FII' ? 'Fundo imobiliário' : 'Renda variável' },
    fundamentals: {},
    indicators: {},
    valuation: {},
    profitability: {},
    debt: {},
    statements: {},
    peers: [],
    quality: { score: ticker ? 70 : 0, status: ticker ? 'available' : 'missing' },
    coverage: { ticker: Boolean(ticker), assetClass: Boolean(assetClass), source: 'normalized' },
    actionPlan: [{ priority: 'normal', text: 'Usar análise de carteira e eventos oficiais normalizados.' }]
  };
}



async function assetLogoHandler(req, res, payload = {}) {
  const ticker = normalizeTicker(payload.ticker || payload.symbol || payload.q || payload.query || '');
  if (!ticker) return sendJson(req, res, { ok: false, status: 'ERROR', error: 'Informe ticker ou symbol.', endpoint: 'asset/logo' }, { status: 400, cacheControl: 'no-store' });
  const timeoutMs = clampInt(payload.timeoutMs || 3500, 3500, 1000, 9000);
  const useCache = payload.cache !== 'false';
  const logo = await fetchYahooLogo(ticker, { timeoutMs, cache: useCache });
  const officialCandidates = officialStatusInvestLogoCandidates(ticker);
  if (payload.format === 'json' || payload.json === '1') {
    const fallbackUrl = officialCandidates[0] || '';
    return sendJson(req, res, {
      ok: Boolean(logo?.logoUrl || fallbackUrl),
      status: logo?.logoUrl || fallbackUrl ? 'OK' : 'EMPTY',
      endpoint: 'asset/logo',
      ticker,
      symbol: logo?.symbol || ticker,
      logoUrl: logo?.logoUrl || fallbackUrl,
      logoSource: logo?.logoUrl ? (logo?.source || 'Yahoo Finance Quote API') : (fallbackUrl ? 'Status Invest company ticker image' : ''),
      candidates: [logo?.logoUrl, ...officialCandidates].filter(Boolean),
      cache: logo?.cache,
      error: logo?.logoUrl || fallbackUrl ? '' : (logo?.error || 'Logo oficial indisponível')
    }, { cacheControl: logo?.logoUrl || fallbackUrl ? 'public, max-age=86400, stale-while-revalidate=604800' : 'private, max-age=300' });
  }
  if (logo?.logoUrl) {
    res.statusCode = 302;
    res.setHeader('Location', logo.logoUrl);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('X-Valorae-Logo-Source', 'Yahoo Finance Quote API');
    return res.end('');
  }
  const officialImage = await fetchOfficialStatusInvestLogo(ticker, { timeoutMs: Math.min(timeoutMs, 2600), cache: useCache });
  if (officialImage?.bytes?.length) {
    res.statusCode = 200;
    res.setHeader('Content-Type', officialImage.contentType || 'image/png');
    res.setHeader('Content-Length', String(officialImage.bytes.length));
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('X-Valorae-Logo-Source', officialImage.source || 'Status Invest company ticker image');
    res.setHeader('X-Valorae-Logo-Cache', officialImage.cache || 'MISS');
    return res.end(officialImage.bytes);
  }
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'private, max-age=300');
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

async function handleAssetDividends(payload = {}) {
  const ticker = normalizeTicker(payload.ticker || payload.symbol || uniqueTickers(payload.tickers || payload.dividendTickers || [])[0]);
  const diagnostics = [];
  const result = await getConfirmedDividendsByTicker(ticker, { timeoutMs: Number(payload.timeoutMs || 9000), htmlTimeoutMs: Number(payload.htmlTimeoutMs || 3500) });
  diagnostics.push(...(Array.isArray(result.diagnostics) ? result.diagnostics : [result.diagnostics].filter(Boolean)));
  let events = result.events || [];

  const includeUpcoming = payload.includeUpcoming === undefined || !['0', 'false', 'no', 'off'].includes(String(payload.includeUpcoming).toLowerCase());
  if (ticker && includeUpcoming) {
    const agenda = await getAgendaDividends([ticker], { timeoutMs: Number(payload.agendaTimeoutMs || payload.timeoutMs || 9000), futureMonths: Number(payload.futureMonths || payload.monthsForward || 18), deadlineAt: Date.now() + Number(payload.agendaTimeoutMs || payload.timeoutMs || 9000), maxPages: Number(payload.agendaMaxPages || 64) });
    diagnostics.push(...(agenda.diagnostics || []));
    const map = new Map();
    for (const event of [...events, ...(agenda.events || [])]) {
      const key = event.eventKey || [event.ticker, event.eligibilityDate || event.dateCom || event.exDate || '', event.paymentDate || '', event.dividendType || '', Number(event.valuePerShare || 0).toFixed(8)].join('|');
      const existing = map.get(key);
      if (!existing || (event.paymentDate && !existing.paymentDate) || (event.valuePerShare && !existing.valuePerShare)) map.set(key, event);
    }
    events = [...map.values()];
  }

  const partial = diagnostics.some(d => d?.status === 0 || d?.status === 'PARTIAL' || String(d?.reason || d?.error || '').toLowerCase().includes('deadline') || String(d?.reason || d?.error || '').toLowerCase().includes('timeout'));
  return {
    status: partial && events.length === 0 ? 'PARTIAL' : 'OK',
    sourceStatus: events.length ? (partial ? 'PARTIAL_LIVE_OR_CACHE' : 'LIVE_OR_CACHE') : (partial ? 'SOURCE_TIMEOUT' : 'EMPTY'),
    ticker,
    sourcePolicy: 'STATUSINVEST_PER_TICKER_PLUS_INVESTIDOR10_CALENDAR_COMPLEMENT_STALE_IF_ERROR',
    partial,
    retryAfterMs: partial && events.length === 0 ? 30000 : undefined,
    events,
    dividends: events,
    dividendEvents: events,
    diagnostics
  };
}

function emptyCompatible(status = 'OK') {
  return { status, items: [], events: [], data: [], partial: false, source: 'VALORAE Proxy' };
}

export async function dispatchRoute(req, res) {
  // Instala a captura antes de CORS, preflight, leitura de body e qualquer handler.
  // Isso garante que JSON, texto, binário, redirect, streaming, HEAD, OPTIONS e erros
  // sejam observados pelo mesmo interceptador central, sem depender de cada rota.
  attachProxyMetricsInterceptor(req, res);
  let path = '/';
  try {
    const parsed = new URL(req.url || '/api', 'https://valorae.local');
    path = stripApi(parsed.pathname);
    applyRuntimeCors(req, res);
    if (String(req.method || 'GET').toUpperCase() === 'OPTIONS') return sendCorsPreflight(req, res);
    const payload = await bodyOrQuery(req, parsed);
    const incomingRequestId = String(req?.headers?.['x-request-id'] || '').trim();
    const payloadRequestId = String(payload?.requestId || '').trim();
    const requestId = safeRequestId(incomingRequestId || payloadRequestId || getRequestId(req)) || safeRequestId(getRequestId(req));
    payload.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    req.query = { ...(req.query || {}), ...payload };
    if (req.body === undefined || req.body === null || (typeof req.body === 'object' && !Array.isArray(req.body) && Object.keys(req.body).length === 0)) req.body = payload;

    if (path === '/') return sendJson(req, res, rootPayload());
    if (path === '/health' || path === '/ready') return sendJson(req, res, health(), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.ready}` });
    if (path === '/env') return sendJson(req, res, { status: 'OK', env: { node: process.version, runtime: 'node' }, version: RELEASE.version });
    if (path === '/integration/manifest') return sendJson(req, res, buildIntegrationManifestPayload(), { cacheControl: 'private, max-age=120' });
    if (path === '/integration/sdk') return sendJson(req, res, buildIntegrationSdkPayload(), { cacheControl: 'private, max-age=120' });
    if (path === '/integration/prompts') return sendJson(req, res, buildIntegrationPromptsPayload(), { cacheControl: 'private, max-age=120' });
    if (path === '/release/readiness' || path === '/personal/readiness') return releaseReadinessHandler(req, res);
    if (path === '/manifest' || path === '/schema' || path === '/source/status' || path === '/deploy/status') return sendJson(req, res, manifest());
    if (path === '/cache/stats') return sendJson(req, res, { status: 'OK', cache: cacheStats() });
    if (path === '/monitor/summary' || path === '/server/summary') return sendJson(req, res, monitorSummary(), { cacheControl: 'private, max-age=5' });
    if (path === '/monitor/self-test' || path === '/server/self-test') return sendJson(req, res, await monitorSelfTest(), { cacheControl: 'no-store' });
    if (path === '/fields') return sendJson(req, res, { status: 'OK', endpoint: 'fields', fields: ['positions','dividendPositions','transactions','tickers','includeAnalysis','includeHistory','includeIpca','includeDividends','includeRankings'] });
    if (path === '/errors') return sendJson(req, res, { status: 'OK', endpoint: 'errors', errors: ['INVALID_JSON','PAYLOAD_TOO_LARGE','ROUTE_ERROR','NOT_FOUND'] });
    if (path === '/openapi') return sendJson(req, res, { status: 'OK', openapi: '3.0.0', info: { title: 'VALORAE Proxy API', version: RELEASE.version }, paths: Object.fromEntries(routeManifest().routes.map(r => [`/api/v1${r}`, openApiOperationForRoute(r)])) });
    if (path === '/sync') return syncHandler(req, res);
    if (path === '/admin/status') return sendJson(req, res, { status: 'OK', admin: false, version: RELEASE.version, cache: cacheStats() });
    if (path === '/compat/scraper4' || path === '/scraper4' || path === '/scraper') return compatScraperHandler(req, res);
    if (path === '/cache/clear' || path === '/admin/cache') { clearCache(); return sendJson(req, res, { status: 'OK', cleared: true }); }

    if (path === '/mobile/bootstrap' || path === '/app/bootstrap') return sendJson(req, res, await mobileBootstrap(payload), { cacheControl: 'private, max-age=45' });
    if (path === '/mobile/practical-sync' || path === '/app/practical-sync') return sendJson(req, res, await buildMobilePortfolioSync({ ...payload, practicalMode: true, includeDividendsInBundle: payload.includeDividendsInBundle ?? false, includeRankings: payload.includeRankings ?? false }), { cacheControl: 'private, max-age=20' });
    if (path === '/mobile/portfolio-sync' || path === '/app/portfolio-sync' || path === '/portfolio/insights-bundle') return sendJson(req, res, await buildMobilePortfolioSync(payload), { cacheControl: 'private, max-age=20' });

    if (path === '/dividends/batch') return sendJson(req, res, await buildDividendsContract(payload), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioDividends}` });
    if (path === '/portfolio/dividends' || path === '/portfolio/next-dividends' || path === '/portfolio/events') return sendJson(req, res, await buildDividendsContract(payload), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioDividends}` });
    if (path === '/asset/dividends' || path === '/asset/next-dividend') return sendJson(req, res, await handleAssetDividends(payload), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioDividends}` });

    if (path === '/portfolio/equilibrium' || path === '/portfolio/balance') return sendJson(req, res, buildEquilibriumContract(payload), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioEquilibrium}` });
    if (path === '/portfolio/analyze' || path === '/portfolio/allocation' || path === '/portfolio/rebalance' || path === '/portfolio/risk' || path === '/portfolio/income' || path === '/portfolio/summary' || path === '/portfolio/transactions') return sendJson(req, res, buildPortfolioAnalysis(payload), { cacheControl: 'private, max-age=20' });
    if (path === '/portfolio/returns' || path === '/portfolio/return' || path === '/portfolio/performance') return sendJson(req, res, await buildPortfolioReturns(payload), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioReturns}` });
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
        return sendJson(req, res, { endpoint: 'portfolio-history', ...data }, { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioHistory}, stale-while-revalidate=120` });
      }
      return sendJson(req, res, await buildRealMarketHistory(payload), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioHistory}, stale-while-revalidate=120` });
    }
    if (path === '/asset/history') return assetHistoryHandler(req, res);
    if (path === '/asset/logo' || path === '/asset/yahoo-logo') return assetLogoHandler(req, res, payload);
    if (path === '/asset/modal') return sendJson(req, res, await buildAssetModalContract(payload), { cacheControl: 'no-store, no-cache, max-age=0, must-revalidate' });
    if (path === '/asset/fii-modal' || path === '/fii/modal') return sendJson(req, res, await buildFiiModalContract(payload), { cacheControl: 'no-store, no-cache, max-age=0, must-revalidate' });
    if (path === '/asset/stock-modal' || path === '/asset/action-modal' || path === '/acao/modal') return sendJson(req, res, await buildStockModalContract(payload), { cacheControl: 'no-store, no-cache, max-age=0, must-revalidate' });
    if (path === '/analysis' || path === '/asset/analysis') {
      const ticker = normalizeTicker(payload.ticker || payload.symbol || payload.q || payload.query);
      if (!ticker) return sendJson(req, res, { status: 'ERROR', ok: false, endpoint: 'analysis', error: 'Informe ticker=PETR4 ou symbol=PETR4.' }, { status: 400, cacheControl: 'no-store' });
      const requestedSurface = String(payload.surface || payload.consumer || payload.consumerId || payload.uiSurface || payload.modalSurface || '').toLowerCase();
      const requestedMode = String(payload.mode || payload.priority || '').toLowerCase();
      const modalFast = requestedMode.includes('modal_fast') || requestedMode.includes('essential') || requestedSurface.includes('modal');
      const cacheKey = analysisRouteCacheKey(ticker, payload);
      const refreshRequested = String(payload.refresh || payload.nocache || '').toLowerCase() === 'true' || payload._ts;
      if (!refreshRequested) {
        const cached = analysisRouteCache.get(cacheKey);
        if (cached) {
          return sendJson(req, res, { ...cached, requestId: payload.requestId || cached.requestId, cache: { ...(cached.cache || {}), routeCache: 'hit' } }, { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.analysis}, stale-while-revalidate=300` });
        }
      }
      const responsePayload = await coalesce(cacheKey, async () => {
        if (!refreshRequested) {
          const joined = analysisRouteCache.get(cacheKey);
          if (joined) return { ...joined, cache: { ...(joined.cache || {}), routeCache: 'joined-hit' } };
        }
        const enriched = await buildAssetDetails({
          ...payload,
          ticker,
          symbol: ticker,
          q: ticker,
          mode: modalFast ? 'modal_fast' : payload.mode,
          timeoutMs: payload.timeoutMs || (modalFast ? 5200 : 12000),
          quoteTimeoutMs: payload.quoteTimeoutMs || (modalFast ? 2400 : 5000),
          fundamentalTimeoutMs: payload.fundamentalTimeoutMs || (modalFast ? 4200 : 9000),
          yahooTimeoutMs: payload.yahooTimeoutMs || (modalFast ? 3200 : 5000),
          dividendTimeoutMs: payload.dividendTimeoutMs || (modalFast ? 3200 : 5000),
          range: payload.range || (modalFast ? '6M' : '1Y')
        });
        const built = buildAnalysisPageResponse(enriched, payload);
        analysisRouteCache.set(cacheKey, built, VALORAE_MOBILE_CACHE_POLICY_SECONDS.analysis * 1000);
        return { ...built, cache: { ...(built.cache || {}), routeCache: 'miss' } };
      });
      return sendJson(req, res, { ...responsePayload, requestId: payload.requestId || responsePayload.requestId }, { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.analysis}, stale-while-revalidate=300` });
    }
    if (path === '/market/ipca') return sendJson(req, res, await getIpcaSeries(payload.historyMonths || payload.months || 12), { cacheControl: 'private, max-age=300' });
    if (path === '/market/rankings') return sendJson(req, res, { version: RELEASE.version, requestId: payload.requestId, ...(await buildCanonicalMarketRankings(payload)) }, { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.marketRankings}, stale-while-revalidate=300` });
    if (path === '/market/indices') return marketIndicesHandler(req, res);

    if (path === '/asset/quote' || path === '/quote') return sendJson(req, res, await getQuote(payload.ticker || payload.symbol || payload.q), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.quote}, stale-while-revalidate=300` });
    if (path === '/quotes') {
      const rawBatch = payload.tickers || payload.symbols || payload.assets || payload.positions || payload.ticker || payload.symbol || payload.q;
      return sendJson(req, res, await buildAssetsPayload({
        ...payload,
        tickers: rawBatch,
        max: payload.max || 180,
        fundamentalTimeoutMs: payload.fundamentalTimeoutMs || payload.fundamentusTimeoutMs || 6500
      }), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.quotes}, stale-while-revalidate=300` });
    }
    if (path === '/asset' || path === '/asset/coverage' || path === '/asset/fundamentals' || path === '/asset/profile' || path === '/asset/valuation' || path === '/asset/profitability' || path === '/asset/debt' || path === '/asset/statements' || path === '/asset/peers' || path === '/asset/source-map' || path === '/asset/indicators' || path === '/asset/quality' || path === '/asset/action-plan') {
      const enriched = await buildAssetDetails(payload);
      return sendJson(req, res, { ...assetPayload(payload), ...enriched }, { cacheControl: 'private, max-age=60' });
    }
    if (path.startsWith('/fii/')) return sendJson(req, res, { ...assetPayload(payload), fii: true });
    if (path === '/assets') return assetsHandler(req, res);
    if (path === '/compare') return sendJson(req, res, await buildComparisonPayload(payload), { cacheControl: 'private, max-age=60' });
    if (path === '/news') return sendJson(req, res, await getNews(payload), { cacheControl: `private, max-age=${VALORAE_MOBILE_CACHE_POLICY_SECONDS.news}, stale-while-revalidate=120` });
    if (path === '/watchlist/analyze') return sendJson(req, res, emptyCompatible('OK'));
    if (path === '/scrape') {
      const url = String(payload.url || '').trim();
      if (!url) return sendJson(req, res, scrapeError('MISSING_TARGET_URL', 'Informe url=https://... para fazer scraping controlado.'), { status: 400, cacheControl: 'no-store' });
      let parsedTarget;
      try { parsedTarget = new URL(url); } catch { return sendJson(req, res, scrapeError('INVALID_TARGET_URL', 'URL inválida.'), { status: 400, cacheControl: 'no-store' }); }
      if (parsedTarget.username || parsedTarget.password) return sendJson(req, res, scrapeError('INVALID_TARGET_URL_CREDENTIALS', 'URL com credenciais embutidas não é aceita.'), { status: 400, cacheControl: 'no-store' });
      if (parsedTarget.protocol !== 'https:') return sendJson(req, res, scrapeError('INVALID_TARGET_URL_PROTOCOL', 'Somente HTTPS é aceito para scraping via proxy.'), { status: 400, cacheControl: 'no-store' });
      if (!allowedScrapeHost(parsedTarget.hostname)) return sendJson(req, res, scrapeError('SCRAPE_HOST_NOT_ALLOWED', 'Host fora da allowlist do Valorae Proxy.', 403, { hostname: parsedTarget.hostname }), { status: 403, cacheControl: 'no-store' });
      const fetched = await fetchText(url, { timeoutMs: Number(payload.timeoutMs || 5500), ttlMs: 60000 });
      return sendJson(req, res, { status: fetched.status ? 'OK' : 'ERROR', url, html: payload.returnHtml ? fetched.text : undefined, text: fetched.text?.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0, Number(payload.limit || 5000)), metrics: { cacheStatus: fetched.cacheStatus, status: fetched.status } });
    }
    if (path === '/batch-scrape') return sendJson(req, res, { status: 'OK', results: [], data: [] });
    if (path === '/server/metrics' || path === '/observability' || path === '/engine/maturity' || path === '/engine/performance') return serverMetricsHandler(req, res);
    if (path === '/server/tests') return sendJson(req, res, await monitorSelfTest(), { cacheControl: 'no-store' });

    return sendJson(req, res, { status: 'NOT_FOUND', error: 'Rota não encontrada no contrato enxuto VALORAE.', path, available: routeManifest().routes }, { status: 404, cacheControl: 'no-store' });
  } catch (error) {
    const status = Number(error?.status || 500);
    return sendJson(req, res, { status: 'ERROR', code: error?.code || 'ROUTE_ERROR', error: status >= 500 ? 'Erro interno no Proxy VALORAE.' : error?.message, path }, { status, cacheControl: 'no-store' });
  }
}

export function routeManifest() {
  return {
    physicalFunctions: ['api/router.js'],
    legacyAliases: { '/ativo': '/asset', '/scraper': '/compat/scraper4', '/api/router?path=...': '/api/v1/{path}' },
    routes: [
    '/health','/ready','/manifest','/env','/schema','/source/status','/release/readiness','/personal/readiness','/cache/stats','/monitor/summary','/monitor/self-test','/server/summary','/server/self-test','/server/metrics','/server/tests','/observability','/engine/maturity','/engine/performance','/deploy/status','/fields','/errors','/openapi','/sync','/integration/sdk','/integration/prompts','/integration/manifest','/mobile/bootstrap','/mobile/practical-sync','/mobile/portfolio-sync','/portfolio/insights-bundle','/dividends/batch','/portfolio/returns','/portfolio/analyze','/portfolio/allocation','/portfolio/equilibrium','/portfolio/balance','/portfolio/dividends','/portfolio/events','/portfolio/history','/portfolio/income','/portfolio/next-dividends','/portfolio/rebalance','/portfolio/risk','/portfolio/summary','/portfolio/transactions','/market/ipca','/market/rankings','/market/indices','/analysis','/asset/analysis','/asset','/asset/quote','/quote','/quotes','/asset/history','/asset/dividends','/asset/next-dividend','/asset/coverage','/asset/fundamentals','/asset/profile','/asset/valuation','/asset/profitability','/asset/debt','/asset/statements','/asset/peers','/asset/source-map','/asset/indicators','/asset/quality','/asset/action-plan','/asset/logo','/asset/yahoo-logo','/fii/profile','/fii/income','/fii/patrimonial','/fii/portfolio','/fii/vacancy','/fii/communications','/fii/checklist','/fii/indicators','/asset/modal','/asset/fii-modal','/fii/modal','/asset/stock-modal','/asset/action-modal','/acao/modal','/assets','/compare','/news','/watchlist/analyze','/scrape','/batch-scrape','/admin/status','/admin/cache','/scraper','/scraper4','/compat/scraper4'
  ].sort() };
}

export const _test = { stripApi, stripApiPrefix, safeRequestId, routeMethod, routeMethods, openApiOperationForRoute, assetPayload, comparisonTickers, buildComparisonPayload };
