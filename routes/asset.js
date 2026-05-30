import { ValoraeEngine, canonicalizeTicker, inferAssetType, validarTicker } from '../lib/Valorae-engine.js';
import { resolvePerformanceOptions } from '../lib/performance/profile.js';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute, boolParam, falseParam, clampNumber, resolveSelfScrapeUrl, sendRouteError } from '../lib/http/route.js';
import { attachPartialDataGuidance } from '../lib/quality/partial-data-guidance.js';

export default async function handler(req, res) {
  const route = beginRoute(req, res, {
    version: ValoraeEngine.version,
    methods: ['GET', 'POST'],
    route: 'asset',
    rateMax: Number(process.env.VALORAE_RATE_LIMIT_ASSET_MAX || 120),
    profile: 'asset',
  });
  if (route.done) return;
  const input = route.input;

  try {
    const ticker = canonicalizeTicker(input.ticker);
    const validation = validarTicker(ticker);
    if (validation) {
      return sendJson(req, res, {
        version: ValoraeEngine.version,
        requestId: route.requestId,
        error: validation,
        hint: 'Use tickers de ativos, por exemplo PETR4, VALE3, GARE11, VISC11, BOVA11.',
      }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'asset' });
    }

    const type = input.type || inferAssetType(ticker);
    const view = input.view || process.env.VALORAE_DEFAULT_ASSET_VIEW || 'app';
    const requestedTimeoutMs = input.timeoutMs ? clampNumber(input.timeoutMs, undefined, 500, 20000) : undefined;
    const requestedScrapeTimeoutMs = input.valoraeScrapeTimeoutMs
      ? clampNumber(input.valoraeScrapeTimeoutMs, undefined, 500, 20000)
      : requestedTimeoutMs;
    const requestedAdaptiveTimeoutMs = input.adaptiveCompletionTimeoutMs
      ? clampNumber(input.adaptiveCompletionTimeoutMs, undefined, 500, 12000)
      : requestedTimeoutMs;

    const hasExplicitScrapeUrl = Boolean(input.valoraeScrapeUrl || input.scrapeUrl);
    const lowLatencyBudget = requestedTimeoutMs !== undefined
      && requestedTimeoutMs <= 1000
      && input.complete === undefined
      && input.adaptiveCompletion === undefined;

    const perfOptions = resolvePerformanceOptions({
      mode: input.mode || 'super',
      includeNews: boolParam(input.includeNews ?? input.news, false),
      newsLimit: clampNumber(input.newsLimit || input.limit, 8, 0, 25),
      useYahooFallback: lowLatencyBudget ? false : (input.yahoo === undefined ? true : boolParam(input.yahoo, true)),
      adaptiveCompletion: lowLatencyBudget ? false : (input.complete !== undefined ? boolParam(input.complete, true) : (input.adaptiveCompletion === undefined ? undefined : boolParam(input.adaptiveCompletion, true))),
      adaptiveCompletionTimeoutMs: requestedAdaptiveTimeoutMs,
      valoraeScrapeTimeoutMs: requestedScrapeTimeoutMs,
      internalApiTimeoutMs: requestedTimeoutMs,
      statusInvestTimeoutMs: requestedTimeoutMs,
      statusInvestComplement: lowLatencyBudget ? false : (input.statusInvestComplement === undefined ? undefined : boolParam(input.statusInvestComplement, true)),
      returnHtml: lowLatencyBudget ? false : undefined,
      enableInternalApis: lowLatencyBudget ? false : undefined,
      lowLatencyBudget,
      timeoutMs: requestedTimeoutMs,
      maxHtmlChars: input.maxHtmlChars ? clampNumber(input.maxHtmlChars, undefined, 10000, 4500000) : undefined,
      valoraeScrapeUrl: lowLatencyBudget && !hasExplicitScrapeUrl ? undefined : resolveSelfScrapeUrl(req, input),
      cache: !(boolParam(input.nocache || input.refresh) || falseParam(input.cache)),
      bypassCache: boolParam(input.nocache || input.refresh),
      debug: boolParam(input.debug),
      view,
      includeQuality: input.includeQuality === undefined ? true : boolParam(input.includeQuality, true),
      profile: input.profile || input.performance,
    }, { endpoint: 'asset', ticker, type });

    const payload = attachPartialDataGuidance(await ValoraeEngine.fetchAtivo(ticker, type, perfOptions), { endpoint: 'asset', ticker, view });
    return sendJson(req, res, payload, {
      status: 200,
      engineVersion: ValoraeEngine.version,
      profile: payload?.performance?.profile || perfOptions.performanceProfile,
      cachePolicy: perfOptions.cachePolicy,
      cacheControl: perfOptions.performanceProfile === 'fast' || view === 'compact'
        ? 'private, max-age=15, stale-while-revalidate=60'
        : 'no-store, no-cache, max-age=0, must-revalidate',
    });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'asset' });
  }
}
