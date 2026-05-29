import { ValoraeEngine, canonicalizeTicker, inferAssetType, validarTicker } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, boolParam, clampNumber, resolveSelfScrapeUrl, sendRouteError } from '../../lib/http/route.js';
import { resolvePerformanceOptions } from '../../lib/performance/profile.js';

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET'], route: 'asset/action-plan', rateMax: Number(process.env.VALORAE_RATE_LIMIT_ASSET_MAX || 120), profile: 'asset-action-plan', cacheControl: 'private, max-age=30, stale-while-revalidate=180' });
  if (route.done) return;
  const input = route.input;
  try {
    const ticker = canonicalizeTicker(input.ticker);
    const validation = validarTicker(ticker);
    if (validation) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, status: 'ERROR', error: validation }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'asset-action-plan' });
    const type = input.type || inferAssetType(ticker);
    const perfOptions = resolvePerformanceOptions({
      mode: input.mode || 'super', includeNews: false, newsLimit: 0,
      useYahooFallback: input.yahoo === undefined ? true : boolParam(input.yahoo, true),
      timeoutMs: input.timeoutMs ? clampNumber(input.timeoutMs, undefined, 1000, 20000) : undefined,
      valoraeScrapeUrl: resolveSelfScrapeUrl(req, input),
      cache: !boolParam(input.nocache || input.refresh), bypassCache: boolParam(input.nocache || input.refresh),
      view: 'app', includeQuality: true, profile: input.profile || 'fast', contracts: 'lite',
    }, { endpoint: 'asset-action-plan', ticker, type });
    const payload = await ValoraeEngine.fetchAtivo(ticker, type, perfOptions);
    return sendJson(req, res, {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      endpoint: 'asset/action-plan',
      ticker: payload.ticker,
      type: payload.type,
      status: payload.status,
      assetActionPlan: payload.assetActionPlan,
      fieldConsistencyGuard: payload.fieldConsistencyGuard,
      payloadBudget: payload.payloadBudget,
      endpointCoverage: payload.endpointCoverage,
      appResponseIntegrity: payload.appResponseIntegrity,
      integrationHint: 'Use este endpoint para decidir, em uma única leitura, se o app renderiza, mantém snapshot anterior ou mostra aviso de dados parciais.',
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'asset-action-plan', cacheControl: 'private, max-age=30, stale-while-revalidate=180' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'asset-action-plan' });
  }
}
