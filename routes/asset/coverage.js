import { ValoraeEngine, canonicalizeTicker, inferAssetType, validarTicker } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, boolParam, clampNumber, resolveSelfScrapeUrl, sendRouteError } from '../../lib/http/route.js';
import { resolvePerformanceOptions } from '../../lib/performance/profile.js';
import { buildCoverageView } from '../../lib/quality/asset-launch-readiness.js';

export default async function handler(req, res) {
  const route = beginRoute(req, res, {
    version: ValoraeEngine.version,
    methods: ['GET'],
    route: 'asset/coverage',
    rateMax: Number(process.env.VALORAE_RATE_LIMIT_ASSET_MAX || 120),
    profile: 'asset-coverage',
  });
  if (route.done) return;
  const input = route.input;
  try {
    const ticker = canonicalizeTicker(input.ticker);
    const validation = validarTicker(ticker);
    if (validation) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, status: 'ERROR', error: validation }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'asset-coverage' });
    const type = input.type || inferAssetType(ticker);
    const perfOptions = resolvePerformanceOptions({
      mode: input.mode || 'super',
      includeNews: false,
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
    }, { endpoint: 'asset-coverage', ticker, type });
    const payload = await ValoraeEngine.fetchAtivo(ticker, type, perfOptions);
    const coverage = buildCoverageView(payload);
    return sendJson(req, res, {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      endpoint: 'asset/coverage',
      ...coverage,
      integrationHint: 'Use este endpoint para saber se o app pode mostrar cotação, fundamentos, dividendos e gráficos sem abrir o payload completo.',
      recommendedNext: coverage.launchState === 'ready' ? `/api/v1/asset?ticker=${ticker}&view=app` : `/api/v1/asset/fundamentals?ticker=${ticker}`,
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'asset-coverage', cacheControl: 'private, max-age=30, stale-while-revalidate=120' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'asset-coverage' });
  }
}
