import { ValoraeEngine, canonicalizeTicker, inferAssetType, validarTicker } from '../lib/Valorae-engine.js';
import { resolvePerformanceOptions } from '../lib/performance/profile.js';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute, boolParam, falseParam, clampNumber, resolveSelfScrapeUrl, sendRouteError, withRouteDeadline } from '../lib/http/route.js';
import { attachPartialDataGuidance } from '../lib/quality/partial-data-guidance.js';

export function buildAssetRouteTimeoutPayload({ ticker, type, view, routeDeadlineMs, requestId, profile } = {}) {
  return {
    ok: false,
    status: 'PARTIAL',
    partial: true,
    timeout: true,
    retryable: true,
    requestId,
    ticker,
    symbol: ticker,
    type,
    assetClass: type,
    view,
    source: 'VALORAE_ROUTE_DEADLINE',
    error: `Deadline da rota asset atingido em ${routeDeadlineMs}ms.`,
    message: 'A coleta profunda continua limitada pelo orçamento da rota; preserve o último snapshot válido e revalide em segundo plano.',
    performance: {
      profile,
      routeDeadlineMs,
      timedOut: true,
    },
    appResponseIntegrity: {
      renderSafe: true,
      cacheSafe: false,
      canReplacePreviousSnapshot: false,
    },
    appDataContract: {
      canReplacePreviousSnapshot: false,
      preservePreviousSnapshot: true,
    },
  };
}

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
    const ticker = canonicalizeTicker(input.ticker || input.symbol || input.q || input.query);
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
    const completeRequested = boolParam(input.complete || input.full || input.fullCapture || input.precise) || ['complete','full','deep','precise','max'].includes(String(input.mode || input.captureMode || input.profile || input.performance || '').toLowerCase());
    const view = input.view || (completeRequested ? 'full' : (process.env.VALORAE_DEFAULT_ASSET_VIEW || 'app'));
    const requestedTimeoutMs = input.timeoutMs ? clampNumber(input.timeoutMs, undefined, 500, 25000) : (completeRequested ? 18000 : undefined);
    const requestedScrapeTimeoutMs = input.valoraeScrapeTimeoutMs
      ? clampNumber(input.valoraeScrapeTimeoutMs, undefined, 500, 25000)
      : requestedTimeoutMs;
    const requestedAdaptiveTimeoutMs = input.adaptiveCompletionTimeoutMs
      ? clampNumber(input.adaptiveCompletionTimeoutMs, undefined, 500, 16000)
      : (completeRequested ? 12000 : requestedTimeoutMs);
    const requestedNewsTimeoutMs = input.newsTimeoutMs
      ? clampNumber(input.newsTimeoutMs, undefined, 350, 12000)
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
      adaptiveCompletion: completeRequested ? true : (lowLatencyBudget ? false : (input.complete !== undefined ? boolParam(input.complete, true) : (input.adaptiveCompletion === undefined ? undefined : boolParam(input.adaptiveCompletion, true)))),
      adaptiveCompletionTimeoutMs: requestedAdaptiveTimeoutMs,
      valoraeScrapeTimeoutMs: requestedScrapeTimeoutMs,
      internalApiTimeoutMs: requestedTimeoutMs,
      newsTimeoutMs: requestedNewsTimeoutMs,
      statusInvestTimeoutMs: requestedTimeoutMs,
      statusInvestComplement: completeRequested ? true : (lowLatencyBudget ? false : (input.statusInvestComplement === undefined ? undefined : boolParam(input.statusInvestComplement, true))),
      returnHtml: completeRequested ? true : (lowLatencyBudget ? false : undefined),
      enableInternalApis: completeRequested ? true : (lowLatencyBudget ? false : undefined),
      lowLatencyBudget,
      timeoutMs: requestedTimeoutMs,
      maxHtmlChars: input.maxHtmlChars ? clampNumber(input.maxHtmlChars, undefined, 10000, 4500000) : (completeRequested ? 4500000 : undefined),
      valoraeScrapeUrl: lowLatencyBudget && !hasExplicitScrapeUrl ? undefined : resolveSelfScrapeUrl(req, input),
      cache: !(boolParam(input.nocache || input.refresh) || falseParam(input.cache)),
      bypassCache: boolParam(input.nocache || input.refresh),
      debug: boolParam(input.debug),
      view,
      includeQuality: input.includeQuality === undefined ? true : boolParam(input.includeQuality, true),
      complete: completeRequested,
      fullCapture: completeRequested,
      profile: input.profile || input.performance || (completeRequested ? 'deep' : undefined),
    }, { endpoint: 'asset', ticker, type });

    const routeDeadlineMs = clampNumber(
      input.routeDeadlineMs || input.deadlineMs || input.timeoutMs,
      completeRequested ? 22_000 : 8_500,
      500,
      completeRequested ? 28_000 : 15_000
    );
    const fetched = await withRouteDeadline(
      () => ValoraeEngine.fetchAtivo(ticker, type, perfOptions),
      routeDeadlineMs,
      () => buildAssetRouteTimeoutPayload({
        ticker,
        type,
        view,
        routeDeadlineMs,
        requestId: route.requestId,
        profile: perfOptions.performanceProfile,
      })
    );
    const payload = attachPartialDataGuidance(fetched, { endpoint: 'asset', ticker, view });
    const degradedPayload = Boolean(
      payload?.timeout || payload?.partial || String(payload?.status || '').toUpperCase() === 'PARTIAL' || payload?.appResponseIntegrity?.cacheSafe === false
    );
    return sendJson(req, res, payload, {
      status: 200,
      engineVersion: ValoraeEngine.version,
      profile: payload?.performance?.profile || perfOptions.performanceProfile,
      cachePolicy: perfOptions.cachePolicy,
      cacheControl: degradedPayload
        ? 'no-store, no-cache, max-age=0, must-revalidate'
        : (['fast','chartfast','portfolio'].includes(perfOptions.performanceProfile) || view === 'compact'
          ? 'private, max-age=15, stale-while-revalidate=60'
          : 'no-store, no-cache, max-age=0, must-revalidate'),
    });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'asset' });
  }
}
