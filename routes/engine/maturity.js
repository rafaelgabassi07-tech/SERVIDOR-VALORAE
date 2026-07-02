import { ValoraeEngine, canonicalizeTicker } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, boolParam, clampNumber, resolveSelfScrapeUrl, sendRouteError } from '../../lib/http/route.js';
import { resolvePerformanceOptions } from '../../lib/performance/profile.js';

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET'], route: 'engine/maturity', rateMax: Number(process.env.VALORAE_RATE_LIMIT_ASSET_MAX || 120), profile: 'engine/maturity', cacheControl: 'private, max-age=30, stale-while-revalidate=180' });
  if (route.done) return;
  const input = route.input;
  try {
    const ticker = canonicalizeTicker(input.ticker || 'PETR4') || 'PETR4';
    const perfOptions = resolvePerformanceOptions({
      mode: input.mode || 'super',
      includeNews: false,
      newsLimit: 0,
      timeoutMs: input.timeoutMs ? clampNumber(input.timeoutMs, undefined, 1000, 20000) : undefined,
      valoraeScrapeUrl: resolveSelfScrapeUrl(req, input),
      cache: !boolParam(input.nocache || input.refresh),
      bypassCache: boolParam(input.nocache || input.refresh),
      view: input.view || 'app',
      includeQuality: true,
      profile: input.profile || 'fast',
      contracts: 'lite',
    }, { endpoint: 'engine/maturity', ticker });
    const payload = await ValoraeEngine.fetchAtivo(ticker, input.type, perfOptions);
    return sendJson(req, res, {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      endpoint: 'engine/maturity',
      ticker: payload.ticker,
      type: payload.type,
      status: payload.status,
      engineMaturityBooster: payload.engineMaturityBooster,
      engineEfficiency: payload.engineEfficiency,
      engineRuntimeProfiler: payload.engineRuntimeProfiler,
      engineLaunchGate: payload.engineLaunchGate,
      assetIndicatorCoverage: payload.assetIndicatorCoverage,
      endpointCoverage: payload.endpointCoverage,
      appResponseIntegrity: payload.appResponseIntegrity,
      integrationHint: 'Use este endpoint para auditar maturidade por ticker antes de liberar telas no Web/APK.',
      links: {
        app: `/api/v1/asset?ticker=${encodeURIComponent(payload.ticker || ticker)}&view=app`,
        indicators: `/api/v1/asset/indicators?ticker=${encodeURIComponent(payload.ticker || ticker)}`,
        sourceMap: `/api/v1/asset/source-map?ticker=${encodeURIComponent(payload.ticker || ticker)}`,
        performance: `/api/v1/engine/performance?ticker=${encodeURIComponent(payload.ticker || ticker)}&view=app`,
      }
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'engine/maturity', cacheControl: 'private, max-age=30, stale-while-revalidate=180' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'engine/maturity' });
  }
}
