import { ValoraeEngine, canonicalizeTicker } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, boolParam, clampNumber, resolveSelfScrapeUrl, sendRouteError } from '../../lib/http/route.js';
import { resolvePerformanceOptions } from '../../lib/performance/profile.js';

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET'], route: 'engine/performance', rateMax: Number(process.env.VALORAE_RATE_LIMIT_ASSET_MAX || 120), profile: 'engine/performance', cacheControl: 'private, max-age=20, stale-while-revalidate=120' });
  if (route.done) return;
  const input = route.input;
  try {
    const ticker = canonicalizeTicker(input.ticker || 'PETR4') || 'PETR4';
    const perfOptions = resolvePerformanceOptions({
      mode: input.mode || 'super',
      includeNews: boolParam(input.includeNews),
      newsLimit: input.newsLimit ? clampNumber(input.newsLimit, undefined, 0, 5) : 0,
      timeoutMs: input.timeoutMs ? clampNumber(input.timeoutMs, undefined, 1000, 20000) : undefined,
      valoraeScrapeUrl: resolveSelfScrapeUrl(req, input),
      cache: !boolParam(input.nocache || input.refresh),
      bypassCache: boolParam(input.nocache || input.refresh),
      view: input.view || 'app',
      includeQuality: true,
      profile: input.profile || 'fast',
      contracts: input.contracts || 'lite',
    }, { endpoint: 'engine/performance', ticker });
    const payload = await ValoraeEngine.fetchAtivo(ticker, input.type, perfOptions);
    return sendJson(req, res, {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      endpoint: 'engine/performance',
      ticker: payload.ticker,
      type: payload.type,
      status: payload.status,
      cacheStatus: payload.cacheStatus,
      engineRuntimeProfiler: payload.engineRuntimeProfiler,
      engineLaunchGate: payload.engineLaunchGate,
      payloadBudget: payload.payloadBudget,
      engineMaturityBooster: payload.engineMaturityBooster,
      appResponseIntegrity: payload.appResponseIntegrity,
      hints: {
        productionView: 'app',
        fastProfile: 'fast',
        firstPaintRoot: 'appMobileSnapshot',
        useFullOnlyForAudit: true,
      },
      links: {
        app: `/api/v1/asset?ticker=${encodeURIComponent(payload.ticker || ticker)}&view=app`,
        maturity: `/api/v1/engine/maturity?ticker=${encodeURIComponent(payload.ticker || ticker)}&view=app`,
        actionPlan: `/api/v1/asset/action-plan?ticker=${encodeURIComponent(payload.ticker || ticker)}`,
      }
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'engine/performance', cacheControl: 'private, max-age=20, stale-while-revalidate=120' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'engine/performance' });
  }
}
