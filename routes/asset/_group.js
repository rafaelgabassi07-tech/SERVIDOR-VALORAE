import { ValoraeEngine, canonicalizeTicker, inferAssetType, validarTicker } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, boolParam, clampNumber, resolveSelfScrapeUrl, sendRouteError } from '../../lib/http/route.js';
import { resolvePerformanceOptions } from '../../lib/performance/profile.js';
import { buildAssetGroupView, buildAssetSourceMapView, buildFiiChecklistView } from '../../lib/quality/asset-class-contract.js';
import { buildIndicatorEndpointView } from '../../lib/quality/asset-indicator-taxonomy.js';
import { attachPartialDataGuidance } from '../../lib/quality/partial-data-guidance.js';

const FII_GROUP_ALIASES = {
  profile: 'profile', income: 'income', patrimonial: 'patrimonial', portfolio: 'portfolio', vacancy: 'vacancy', communications: 'communications', checklist: 'checklist', indicators: 'indicators', peers: 'peers'
};
const STOCK_GROUP_ALIASES = {
  profile: 'profile', valuation: 'valuation', profitability: 'profitability', debt: 'debt', statements: 'statements', peers: 'peers', dividends: 'dividends', indicators: 'indicators', sourceMap: 'source-map'
};

export async function handleAssetGroup(req, res, config = {}) {
  const routeName = config.route || `asset/${config.group || 'group'}`;
  const route = beginRoute(req, res, {
    version: ValoraeEngine.version,
    methods: ['GET'],
    route: routeName,
    rateMax: Number(process.env.VALORAE_RATE_LIMIT_ASSET_MAX || 120),
    profile: routeName,
  });
  if (route.done) return;
  const input = route.input;
  try {
    const ticker = canonicalizeTicker(input.ticker);
    const validation = validarTicker(ticker);
    if (validation) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, status: 'ERROR', error: validation }, { status: 400, engineVersion: ValoraeEngine.version, profile: routeName });
    const inferred = inferAssetType(ticker);
    const type = config.forceType || input.type || inferred;
    const perfOptions = resolvePerformanceOptions({
      mode: input.mode || 'super',
      includeNews: config.includeNews ?? false,
      newsLimit: 0,
      useYahooFallback: input.yahoo === undefined ? true : boolParam(input.yahoo, true),
      timeoutMs: input.timeoutMs ? clampNumber(input.timeoutMs, undefined, 1000, 20000) : undefined,
      valoraeScrapeUrl: resolveSelfScrapeUrl(req, input),
      cache: !boolParam(input.nocache || input.refresh),
      bypassCache: boolParam(input.nocache || input.refresh),
      debug: false,
      view: 'standard',
      includeQuality: true,
      profile: input.profile || 'fast',
      contracts: 'lite',
    }, { endpoint: routeName, ticker, type });
    const payload = attachPartialDataGuidance(await ValoraeEngine.fetchAtivo(ticker, type, perfOptions), { endpoint: routeName, ticker, view: 'standard' });
    let view;
    if (config.kind === 'source-map') view = buildAssetSourceMapView(payload);
    else if (config.kind === 'fii-checklist') view = buildFiiChecklistView(payload);
    else if (config.kind === 'indicators') view = buildIndicatorEndpointView(payload);
    else view = buildAssetGroupView(payload, config.group);
    return sendJson(req, res, {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      endpoint: routeName,
      ...view,
      links: buildLinks(ticker, payload.type),
      partialDataGuidance: payload.partialDataGuidance,
      integrationHint: 'Use estes endpoints especializados para telas específicas; para tela principal continue usando /api/v1/asset?ticker=...&view=app.',
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: routeName, cacheControl: 'private, max-age=30, stale-while-revalidate=180' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: routeName });
  }
}

function buildLinks(ticker, type) {
  const encoded = encodeURIComponent(ticker || '');
  const stock = Object.keys(STOCK_GROUP_ALIASES).map(k => `/api/v1/asset/${k === 'sourceMap' ? 'source-map' : k}?ticker=${encoded}`);
  const fii = Object.keys(FII_GROUP_ALIASES).map(k => `/api/v1/fii/${k}?ticker=${encoded}`);
  return { app: `/api/v1/asset?ticker=${encoded}&view=app`, coverage: `/api/v1/asset/coverage?ticker=${encoded}`, fundamentals: `/api/v1/asset/fundamentals?ticker=${encoded}`, sourceMap: `/api/v1/asset/source-map?ticker=${encoded}`, indicators: `/api/v1/asset/indicators?ticker=${encoded}`, specialized: type === 'FII' ? fii : stock };
}
