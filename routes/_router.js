import { ValoraeEngine } from '../lib/Valorae-engine.js';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute } from '../lib/http/route.js';
import { attachProxyMetricsInterceptor } from '../lib/observability/server-metrics.js';

const ROUTES = {
  '/health': () => import('./health.js'),
  '/ready': () => import('./ready.js'),
  '/manifest': () => import('./manifest.js'),
  '/env': () => import('./env.js'),
  '/schema': () => import('./schema.js'),
  '/source/status': () => import('./source/status.js'),
  '/release/readiness': () => import('./release/readiness.js'),
  '/personal/readiness': () => import('./release/readiness.js'),
  '/cache/stats': () => import('./cache/stats.js'),
  '/server/metrics': () => import('./server/metrics.js'),
  '/observability': () => import('./server/metrics.js'),
  '/server/tests': () => import('./server/tests.js'),
  '/deploy/status': () => import('./deploy/status.js'),
  '/asset': () => import('./asset.js'),
  '/asset/coverage': () => import('./asset/coverage.js'),
  '/asset/fundamentals': () => import('./asset/fundamentals.js'),
  '/asset/profile': () => import('./asset/profile.js'),
  '/asset/valuation': () => import('./asset/valuation.js'),
  '/asset/profitability': () => import('./asset/profitability.js'),
  '/asset/debt': () => import('./asset/debt.js'),
  '/asset/statements': () => import('./asset/statements.js'),
  '/asset/peers': () => import('./asset/peers.js'),
  '/asset/source-map': () => import('./asset/source-map.js'),
  '/asset/indicators': () => import('./asset/indicators.js'),
  '/asset/quality': () => import('./asset/quality.js'),
  '/asset/action-plan': () => import('./asset/action-plan.js'),
  '/fii/profile': () => import('./fii/profile.js'),
  '/fii/income': () => import('./fii/income.js'),
  '/fii/patrimonial': () => import('./fii/patrimonial.js'),
  '/fii/portfolio': () => import('./fii/portfolio.js'),
  '/fii/vacancy': () => import('./fii/vacancy.js'),
  '/fii/communications': () => import('./fii/communications.js'),
  '/fii/checklist': () => import('./fii/checklist.js'),
  '/fii/indicators': () => import('./fii/indicators.js'),
  '/assets': () => import('./assets.js'),
  '/compare': () => import('./compare.js'),
  '/scrape': () => import('./scrape.js'),
  '/batch-scrape': () => import('./batch-scrape.js'),
  '/news': () => import('./news.js'),
  '/mobile/bootstrap': () => import('./mobile/bootstrap.js'),
  '/app/bootstrap': () => import('./mobile/bootstrap.js'),
  '/mobile/portfolio-sync': () => import('./mobile/portfolio-sync.js'),
  '/app/portfolio-sync': () => import('./mobile/portfolio-sync.js'),
  '/sync': () => import('./sync.js'),
  '/openapi': () => import('./openapi.js'),
  '/fields': () => import('./fields.js'),
  '/integration/sdk': () => import('./integration/sdk.js'),
  '/integration/prompts': () => import('./integration/prompts.js'),
  '/integration/manifest': () => import('./integration/manifest.js'),
  '/engine/maturity': () => import('./engine/maturity.js'),
  '/engine/performance': () => import('./engine/performance.js'),
  '/errors': () => import('./errors.js'),
  '/asset/history': () => import('./asset/history.js'),
  '/asset/dividends': () => import('./asset/dividends.js'),
  '/dividends/batch': () => import('./dividends/batch.js'),
  '/asset/next-dividend': () => import('./asset/next-dividend.js'),
  '/market/indices': () => import('./market/indices.js'),
  '/market/ipca': () => import('./market/ipca.js'),
  '/market/rankings': () => import('./market/rankings.js'),
  '/portfolio/analyze': () => import('./portfolio/analyze.js'),
  '/portfolio/insights-bundle': () => import('./portfolio/insights-bundle.js'),
  '/portfolio/allocation': () => import('./portfolio/allocation.js'),
  '/portfolio/dividends': () => import('./portfolio/dividends.js'),
  '/portfolio/events': () => import('./portfolio/events.js'),
  '/portfolio/history': () => import('./portfolio/history.js'),
  '/portfolio/income': () => import('./portfolio/income.js'),
  '/portfolio/next-dividends': () => import('./portfolio/next-dividends.js'),
  '/portfolio/rebalance': () => import('./portfolio/rebalance.js'),
  '/portfolio/risk': () => import('./portfolio/risk.js'),
  '/portfolio/summary': () => import('./portfolio/summary.js'),
  '/portfolio/transactions': () => import('./portfolio/transactions.js'),
  '/watchlist/analyze': () => import('./watchlist/analyze.js'),
  '/admin/status': () => import('./admin/status.js'),
  '/admin/cache': () => import('./admin/cache.js'),
  '/compat/scraper4': () => import('./compat/scraper4.js'),
};

const LEGACY_ALIASES = {
  '/cotacao': '/asset',
  '/ativo': '/asset',
  '/ativos': '/assets',
  '/ranking': '/market/rankings',
  '/rankings': '/market/rankings',
  '/carteira': '/portfolio/analyze',
  '/portfolio': '/portfolio/analyze',
  '/scraper4': '/compat/scraper4',
  '/scraper': '/compat/scraper4',
};

function parseUrl(req) {
  return new URL(req?.url || '/api', 'https://valorae.local');
}

function stripApiPrefix(pathname) {
  if (pathname === '/api') return '/';
  if (pathname.startsWith('/api/')) return pathname.slice('/api'.length) || '/';
  return pathname || '/';
}

function normalizePath(req) {
  const parsed = parseUrl(req);
  let path = stripApiPrefix(parsed.pathname);
  if (path === '/' || path === '') return { path: '/', apiVersion: 'v1', parsed };
  const m = path.match(/^\/(v[12])(?:\/(.*))?$/);
  let apiVersion = 'v1';
  if (m) {
    apiVersion = m[1];
    path = `/${m[2] || ''}`;
  }
  path = path.replace(/\/+$/, '') || '/';
  return { path: LEGACY_ALIASES[path] || path, apiVersion, parsed };
}

function queryFromSearchParams(params) {
  const out = {};
  for (const [key, value] of params.entries()) {
    if (out[key] === undefined) out[key] = value;
    else if (Array.isArray(out[key])) out[key].push(value);
    else out[key] = [out[key], value];
  }
  return out;
}

function mergeQuery(req, apiVersion, parsed) {
  const fromUrl = queryFromSearchParams((parsed || parseUrl(req)).searchParams);
  req.query = { ...fromUrl, ...(req.query || {}) };
  if (apiVersion === 'v2') {
    req.query.envelope = req.query.envelope ?? '1';
    req.query.apiVersion = 'v2';
  }
}

export async function dispatchRoute(req, res) {
  const { path, apiVersion, parsed } = normalizePath(req);
  const metricRoute = path === '/' ? '/api' : `/api${path}`;
  attachProxyMetricsInterceptor(req, res, { route: metricRoute });
  if (path === '/') {
    mergeQuery(req, apiVersion, parsed);
    const route = beginRoute(req, res, {
      version: ValoraeEngine.version,
      methods: ['GET'],
      route: 'index',
      rateMax: Number(process.env.VALORAE_RATE_LIMIT_HEALTH_MAX || 180),
      profile: 'index',
      cacheControl: 'private, max-age=30',
    });
    if (route.done) return;
    return sendJson(req, res, {
      name: 'VALORAE Proxy Server API',
      version: ValoraeEngine.version,
      status: 'online',
      compatibility: 'GitHub/Vercel serverless proxy',
      dashboard: '/server.html',
      tests: '/server.html#tests',
      router: { version: 'internal-v1-v2-consolidated', ...routeManifest() },
      examples: {
        asset: '/api/asset?ticker=PETR4&mode=super&includeNews=1',
        assets: '/api/assets?tickers=PETR4,GARE11,VISC11&mode=super',
        scrape: '/api/scrape?url=https://investidor10.com.br/acoes/petr4/',
        news: '/api/news?ticker=PETR4',
        batchScrape: '/api/batch-scrape',
        health: '/api/health',
        ready: '/api/ready',
        metrics: '/api/server/metrics',
        portfolioInsightsBundle: '/api/v1/portfolio/insights-bundle',
        testsLab: '/api/server/tests?mode=quick',
        cacheStats: '/api/cache/stats',
        sourceStatus: '/api/source/status',
        engineMaturity: '/api/v1/engine/maturity?ticker=PETR4',
        enginePerformance: '/api/v1/engine/performance?ticker=PETR4',
        assetIndicators: '/api/v1/asset/indicators?ticker=PETR4',
        assetQuality: '/api/v1/asset/quality?ticker=PETR4',
        assetActionPlan: '/api/v1/asset/action-plan?ticker=PETR4',
        integrationManifest: '/api/v1/integration/manifest',
        releaseReadiness: '/api/v1/release/readiness',
        fields: '/api/fields',
        errors: '/api/errors',
        openapi: '/api/openapi',
      },
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'index', cacheControl: 'private, max-age=30' });
  }
  const load = ROUTES[path];
  if (!load) {
    return sendJson(req, res, {
      version: ValoraeEngine.version,
      status: 'NOT_FOUND',
      error: 'Rota não encontrada no router interno Valorae.',
      path,
      hint: 'Consulte /api/openapi, /api/fields e /api/errors.',
    }, { status: 404, engineVersion: ValoraeEngine.version, profile: 'router', cacheControl: 'private, max-age=30' });
  }
  mergeQuery(req, apiVersion, parsed);
  const mod = await load();
  return mod.default(req, res);
}

export function routeManifest() {
  return { routes: Object.keys(ROUTES).sort(), legacyAliases: LEGACY_ALIASES, physicalFunctions: ['api/router.js'] };
}

export const _test = { parseUrl, queryFromSearchParams, stripApiPrefix };
