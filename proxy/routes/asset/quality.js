import { ValoraeEngine, canonicalizeTicker, inferAssetType, validarTicker } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, boolParam, clampNumber, resolveSelfScrapeUrl, sendRouteError } from '../../lib/http/route.js';
import { resolvePerformanceOptions } from '../../lib/performance/profile.js';

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET'], route: 'asset/quality', rateMax: Number(process.env.VALORAE_RATE_LIMIT_ASSET_MAX || 120), profile: 'asset-quality', cacheControl: 'private, max-age=30, stale-while-revalidate=180' });
  if (route.done) return;
  const input = route.input;
  try {
    const ticker = canonicalizeTicker(input.ticker);
    const validation = validarTicker(ticker);
    if (validation) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, status: 'ERROR', error: validation }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'asset-quality' });
    const type = input.type || inferAssetType(ticker);
    const perfOptions = resolvePerformanceOptions({
      mode: input.mode || 'super', includeNews: false, newsLimit: 0,
      useYahooFallback: input.yahoo === undefined ? true : boolParam(input.yahoo, true),
      timeoutMs: input.timeoutMs ? clampNumber(input.timeoutMs, undefined, 1000, 20000) : undefined,
      valoraeScrapeUrl: resolveSelfScrapeUrl(req, input),
      cache: !boolParam(input.nocache || input.refresh), bypassCache: boolParam(input.nocache || input.refresh),
      view: 'standard', includeQuality: true, profile: input.profile || 'fast', contracts: 'lite',
    }, { endpoint: 'asset-quality', ticker, type });
    const payload = await ValoraeEngine.fetchAtivo(ticker, type, perfOptions);
    return sendJson(req, res, {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      endpoint: 'asset/quality',
      ticker: payload.ticker,
      type: payload.type,
      status: payload.status,
      partial: payload.partial,
      fieldConsistencyGuard: payload.fieldConsistencyGuard,
      payloadBudget: payload.payloadBudget,
      assetIndicatorCoverage: payload.assetIndicatorCoverage,
      assetClassContract: {
        version: payload.assetClassContract?.version,
        score: payload.assetClassContract?.score,
        state: payload.assetClassContract?.state,
        missingCriticalFields: payload.assetClassContract?.missingCriticalFields,
        summary: payload.assetClassContract?.summary,
      },
      engineMaturityBooster: payload.engineMaturityBooster,
      appResponseIntegrity: payload.appResponseIntegrity,
      sourceReport: payload.sourceReport,
      integrationHint: 'Use este endpoint para auditar precisão, peso do payload, campos suspeitos e segurança antes de substituir o cache do app.',
      links: {
        app: `/api/v1/asset?ticker=${encodeURIComponent(payload.ticker || ticker)}&view=app`,
        actionPlan: `/api/v1/asset/action-plan?ticker=${encodeURIComponent(payload.ticker || ticker)}`,
        indicators: `/api/v1/${payload.type === 'FII' ? 'fii' : 'asset'}/indicators?ticker=${encodeURIComponent(payload.ticker || ticker)}`,
        sourceMap: `/api/v1/asset/source-map?ticker=${encodeURIComponent(payload.ticker || ticker)}`,
      },
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'asset-quality', cacheControl: 'private, max-age=30, stale-while-revalidate=180' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'asset-quality' });
  }
}
