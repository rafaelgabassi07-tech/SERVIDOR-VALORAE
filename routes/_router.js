import { RELEASE } from '../lib/core/release.js';
import { sendJson, queryObject, readJsonBody } from '../lib/core/http.js';
import { cacheStats, clearCache } from '../lib/core/cache.js';
import { buildMobilePortfolioSync } from '../lib/contracts/mobile.js';
import { buildDividendsContract } from '../lib/portfolio/dividends-contract.js';
import { buildPortfolioAnalysis, buildHistory, buildRankings } from '../lib/portfolio/analysis.js';
import { buildAssetsPayload, buildIndicesPayload, buildMarketMovers, getQuote } from '../lib/sources/quotes.js';
import { getNews } from '../lib/sources/news.js';
import { getIpcaSeries } from '../lib/sources/ipca.js';
import { fetchText } from '../lib/sources/fetch.js';
import { normalizeTicker, classifyTicker, uniqueTickers } from '../lib/core/tickers.js';
import { getConfirmedDividendsByTicker } from '../lib/sources/status-dividends.js';
import { buildAssetDetails, getAssetHistory } from '../lib/sources/asset-details.js';

function stripApi(pathname) {
  let path = pathname || '/';
  if (path === '/api') return '/';
  if (path.startsWith('/api/')) path = path.slice(4);
  const m = path.match(/^\/(v[12])(?:\/(.*))?$/);
  if (m) path = `/${m[2] || ''}`;
  path = path.replace(/\/+$/, '') || '/';
  return path;
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
    routes: ['/api/v1/mobile/portfolio-sync', '/api/v1/mobile/bootstrap', '/api/v1/dividends/batch', '/api/v1/assets', '/api/v1/news', '/api/v1/market/rankings', '/api/v1/monitor/summary', '/api/v1/monitor/self-test', '/api/v1/asset', '/api/v1/market/ipca', '/api/v1/health'],
    monitor: '/server.html'
  };
}

function health() {
  return { status: 'OK', online: true, version: RELEASE.version, release: RELEASE.patch, now: new Date().toISOString() };
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
      primary: ['/api/v1/mobile/portfolio-sync', '/api/v1/mobile/bootstrap', '/api/v1/assets', '/api/v1/news', '/api/v1/market/rankings', '/api/v1/market/ipca', '/api/v1/dividends/batch', '/api/v1/health'],
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

async function handleAssetDividends(payload = {}) {
  const ticker = normalizeTicker(payload.ticker || payload.symbol || (payload.tickers || '').split(',')[0]);
  const result = await getConfirmedDividendsByTicker(ticker, { timeoutMs: Number(payload.timeoutMs || 5500) });
  return { status: 'OK', ticker, events: result.events, dividends: result.events, dividendEvents: result.events, diagnostics: result.diagnostics };
}

function emptyCompatible(status = 'OK') {
  return { status, items: [], events: [], data: [], partial: false, source: 'VALORAE Proxy' };
}

export async function dispatchRoute(req, res) {
  const parsed = new URL(req.url || '/api', 'https://valorae.local');
  const path = stripApi(parsed.pathname);
  const payload = await bodyOrQuery(req, parsed);

  try {
    if (path === '/') return sendJson(req, res, rootPayload());
    if (path === '/health' || path === '/ready') return sendJson(req, res, health(), { cacheControl: 'private, max-age=10' });
    if (path === '/env') return sendJson(req, res, { status: 'OK', env: { node: process.version, runtime: 'node' }, version: RELEASE.version });
    if (path === '/manifest' || path === '/integration/manifest' || path === '/schema' || path === '/source/status' || path === '/release/readiness' || path === '/deploy/status' || path === '/personal/readiness') return sendJson(req, res, manifest());
    if (path === '/cache/stats') return sendJson(req, res, { status: 'OK', cache: cacheStats() });
    if (path === '/monitor/summary' || path === '/server/summary') return sendJson(req, res, monitorSummary(), { cacheControl: 'private, max-age=5' });
    if (path === '/monitor/self-test' || path === '/server/self-test') return sendJson(req, res, await monitorSelfTest(), { cacheControl: 'no-store' });
    if (path === '/fields') return sendJson(req, res, { status: 'OK', fields: ['positions','dividendPositions','transactions','tickers','includeAnalysis','includeHistory','includeIpca','includeDividends','includeRankings'] });
    if (path === '/errors') return sendJson(req, res, { status: 'OK', errors: ['INVALID_JSON','PAYLOAD_TOO_LARGE','ROUTE_ERROR','NOT_FOUND'] });
    if (path === '/openapi') return sendJson(req, res, { status: 'OK', openapi: '3.0.0', info: { title: 'VALORAE Proxy API', version: RELEASE.version }, paths: Object.fromEntries(routeManifest().routes.map(r => [`/api/v1${r}`, { get: { summary: r } }])) });
    if (path === '/sync') return sendJson(req, res, { status: 'OK', endpoint: 'sync', contract: RELEASE.contract });
    if (path === '/integration/sdk' || path === '/integration/prompts') return sendJson(req, res, { status: 'OK', version: RELEASE.version, contract: RELEASE.contract, items: [] });
    if (path === '/admin/status') return sendJson(req, res, { status: 'OK', admin: false, version: RELEASE.version, cache: cacheStats() });
    if (path === '/compat/scraper4' || path === '/scraper4') return sendJson(req, res, { status: 'OK', compatibility: true, endpoint: '/api/v1/scrape' });
    if (path === '/cache/clear' || path === '/admin/cache') { clearCache(); return sendJson(req, res, { status: 'OK', cleared: true }); }

    if (path === '/mobile/bootstrap' || path === '/app/bootstrap') return sendJson(req, res, await mobileBootstrap(payload), { cacheControl: 'private, max-age=45' });
    if (path === '/mobile/portfolio-sync' || path === '/app/portfolio-sync' || path === '/portfolio/insights-bundle') return sendJson(req, res, await buildMobilePortfolioSync(payload), { cacheControl: 'private, max-age=20' });

    if (path === '/dividends/batch') return sendJson(req, res, await buildDividendsContract(payload), { cacheControl: 'private, max-age=60' });
    if (path === '/portfolio/dividends' || path === '/portfolio/next-dividends' || path === '/portfolio/events') return sendJson(req, res, await buildDividendsContract(payload), { cacheControl: 'private, max-age=60' });
    if (path === '/asset/dividends' || path === '/asset/next-dividend') return sendJson(req, res, await handleAssetDividends(payload), { cacheControl: 'private, max-age=60' });

    if (path === '/portfolio/analyze' || path === '/portfolio/allocation' || path === '/portfolio/rebalance' || path === '/portfolio/risk' || path === '/portfolio/income' || path === '/portfolio/summary' || path === '/portfolio/transactions') return sendJson(req, res, buildPortfolioAnalysis(payload));
    if (path === '/portfolio/history') return sendJson(req, res, buildHistory(payload));
    if (path === '/asset/history') return sendJson(req, res, await getAssetHistory(payload), { cacheControl: 'private, max-age=45' });
    if (path === '/market/ipca') return sendJson(req, res, await getIpcaSeries(payload.months || 12), { cacheControl: 'private, max-age=300' });
    if (path === '/market/rankings') return sendJson(req, res, await buildMarketMovers(payload), { cacheControl: 'private, max-age=45' });
    if (path === '/market/indices') return sendJson(req, res, await buildIndicesPayload(), { cacheControl: 'private, max-age=45' });

    if (path === '/asset/quote' || path === '/quote' || path === '/quotes') return sendJson(req, res, await getQuote(payload.ticker || payload.symbol || payload.q), { cacheControl: 'private, max-age=30' });
    if (path === '/asset' || path === '/asset/coverage' || path === '/asset/fundamentals' || path === '/asset/profile' || path === '/asset/valuation' || path === '/asset/profitability' || path === '/asset/debt' || path === '/asset/statements' || path === '/asset/peers' || path === '/asset/source-map' || path === '/asset/indicators' || path === '/asset/quality' || path === '/asset/action-plan') {
      const enriched = await buildAssetDetails(payload);
      return sendJson(req, res, { ...assetPayload(payload), ...enriched }, { cacheControl: 'private, max-age=60' });
    }
    if (path.startsWith('/fii/')) return sendJson(req, res, { ...assetPayload(payload), fii: true });
    if (path === '/assets') return sendJson(req, res, await buildAssetsPayload(payload), { cacheControl: 'private, max-age=45' });
    if (path === '/compare') return sendJson(req, res, { status: 'OK', items: uniqueTickers(payload.tickers || []).map(t => assetPayload({ ticker: t })) });
    if (path === '/news') return sendJson(req, res, await getNews(payload), { cacheControl: 'private, max-age=120' });
    if (path === '/watchlist/analyze') return sendJson(req, res, emptyCompatible('OK'));
    if (path === '/scrape') {
      const url = String(payload.url || '');
      if (!/^https?:\/\//i.test(url)) return sendJson(req, res, { status: 'ERROR', error: 'URL inválida.' }, { status: 400 });
      const fetched = await fetchText(url, { timeoutMs: Number(payload.timeoutMs || 5500), ttlMs: 60000 });
      return sendJson(req, res, { status: fetched.status ? 'OK' : 'ERROR', url, html: payload.returnHtml ? fetched.text : undefined, text: fetched.text?.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0, Number(payload.limit || 5000)), metrics: { cacheStatus: fetched.cacheStatus, status: fetched.status } });
    }
    if (path === '/batch-scrape') return sendJson(req, res, { status: 'OK', results: [], data: [] });
    if (path === '/server/metrics' || path === '/observability' || path === '/engine/maturity' || path === '/engine/performance') return sendJson(req, res, { status: 'OK', version: RELEASE.version, metrics: { cache: cacheStats() } });

    return sendJson(req, res, { status: 'NOT_FOUND', error: 'Rota não encontrada no contrato enxuto VALORAE.', path, available: routeManifest().routes }, { status: 404, cacheControl: 'no-store' });
  } catch (error) {
    const status = Number(error?.status || 500);
    return sendJson(req, res, { status: 'ERROR', code: error?.code || 'ROUTE_ERROR', error: status >= 500 ? 'Erro interno no Proxy VALORAE.' : error?.message, path }, { status, cacheControl: 'no-store' });
  }
}

export function routeManifest() {
  return { routes: [
    '/health','/ready','/manifest','/env','/schema','/source/status','/release/readiness','/personal/readiness','/cache/stats','/monitor/summary','/monitor/self-test','/server/summary','/server/self-test','/server/metrics','/observability','/deploy/status','/fields','/errors','/openapi','/sync','/integration/sdk','/integration/prompts','/integration/manifest','/mobile/bootstrap','/mobile/portfolio-sync','/portfolio/insights-bundle','/dividends/batch','/portfolio/analyze','/portfolio/allocation','/portfolio/dividends','/portfolio/events','/portfolio/history','/portfolio/income','/portfolio/next-dividends','/portfolio/rebalance','/portfolio/risk','/portfolio/summary','/portfolio/transactions','/market/ipca','/market/rankings','/market/indices','/asset','/asset/quote','/quote','/quotes','/asset/history','/asset/dividends','/asset/next-dividend','/asset/coverage','/asset/fundamentals','/asset/profile','/asset/valuation','/asset/profitability','/asset/debt','/asset/statements','/asset/peers','/asset/source-map','/asset/indicators','/asset/quality','/asset/action-plan','/fii/profile','/fii/income','/fii/patrimonial','/fii/portfolio','/fii/vacancy','/fii/communications','/fii/checklist','/fii/indicators','/assets','/compare','/news','/watchlist/analyze','/scrape','/batch-scrape','/admin/status','/admin/cache','/compat/scraper4'
  ].sort() };
}

export const _test = { stripApi, assetPayload };
