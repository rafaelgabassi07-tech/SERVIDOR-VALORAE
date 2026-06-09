import { ValoraeEngine, canonicalizeTicker, validarTicker } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, boolParam, parseList, clampNumber, resolveSelfScrapeUrl, sendRouteError, withRouteDeadline } from '../../lib/http/route.js';

export default async function handler(req, res) {
  const route = beginRoute(req, res, {
    version: ValoraeEngine.version,
    methods: ['GET', 'POST'],
    route: 'mobile-bootstrap',
    rateMax: Number(process.env.VALORAE_RATE_LIMIT_BOOTSTRAP_MAX || 90),
    profile: 'mobile',
  });
  if (route.done) return;
  try {
    const q = route.input;
    const deadlineMs = clampNumber(q.routeDeadlineMs || q.deadlineMs || q.timeoutMs, 3200, 1000, 8000);
    const raw = parseList(q.tickers || q.ticker).map(t => String(t).trim()).filter(Boolean).slice(0, 20);
    const tickers = [];
    const inputErrors = [];
    for (const item of raw) {
      const ticker = canonicalizeTicker(item);
      const err = validarTicker(ticker);
      if (err) inputErrors.push({ ticker: item, error: err });
      else tickers.push(ticker);
    }

    const assetFallback = (reason = 'bootstrap-deadline') => ({
      assets: [],
      stats: { partial: true, timeout: String(reason).includes('deadline'), scope: 'assets' },
      errors: tickers.map(ticker => ({ ticker, error: String(reason || 'bootstrap-assets-fallback').slice(0, 120) }))
    });
    const newsFallback = (reason = 'bootstrap-news-deadline') => ({
      items: [],
      news: [],
      warnings: [`News fallback no bootstrap: ${String(reason || 'timeout').slice(0, 120)}. APK deve preservar feed anterior.`],
      partial: true
    });

    const assetsPromise = tickers.length
      ? withRouteDeadline(
          async () => {
            try {
              return await ValoraeEngine.fetchAtivosBatch(tickers, {
                mode: 'turbo',
                profile: 'fast',
                view: 'compact',
                includeNews: false,
                maxConcurrency: clampNumber(q.maxConcurrency || q.concurrency, 3, 1, 5),
                cache: !boolParam(q.nocache || q.refresh),
                bypassCache: boolParam(q.nocache || q.refresh),
                timeoutMs: clampNumber(q.assetTimeoutMs || q.timeoutMs, 2200, 500, 6000),
                valoraeScrapeUrl: resolveSelfScrapeUrl(req, q),
                continueOnError: true,
              });
            } catch (err) {
              return assetFallback(err?.message || err?.code || 'bootstrap-assets-error');
            }
          },
          Math.max(700, deadlineMs - 700),
          () => assetFallback('bootstrap-deadline')
        )
      : Promise.resolve({ assets: [], stats: {}, errors: [] });

    const newsPromise = boolParam(q.includeNews, true)
      ? withRouteDeadline(
          async () => {
            try {
              return await ValoraeEngine.fetchNews('', [], {
                limit: clampNumber(q.newsLimit || q.limit, 8, 0, 20),
                timeoutMs: clampNumber(q.newsTimeoutMs || q.timeoutMs, 1400, 350, 4000),
                newsTimeoutMs: clampNumber(q.newsTimeoutMs || q.timeoutMs, 1400, 350, 4000),
                refresh: boolParam(q.refresh || q.nocache),
                nocache: boolParam(q.nocache),
                bypassCache: boolParam(q.refresh || q.nocache),
                lowLatencyBudget: true,
              });
            } catch (err) {
              return newsFallback(err?.message || err?.code || 'bootstrap-news-error');
            }
          },
          Math.max(500, Math.min(1800, deadlineMs - 900)),
          () => newsFallback('bootstrap-news-deadline')
        )
      : Promise.resolve({ items: [], news: [] });

    const [assets, news] = await Promise.all([assetsPromise, newsPromise]);
    return sendJson(req, res, {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      endpoint: 'mobile-bootstrap',
      ok: true,
      source: (assets.stats?.partial || news.partial) ? 'partial' : 'live-or-cache',
      partial: !!assets.stats?.partial || !!news.partial,
      deadlineMs,
      market: { rankings: null },
      assets: assets.assets || [],
      news: news.items || news.news || [],
      uiHints: {
        renderPolicy: 'cache-first-stale-while-revalidate',
        emptyStatePolicy: 'keep-last-good-content',
        recommendedAppAction: 'render-local-snapshot-and-revalidate-missing-blocks',
        nonBlockingBlocks: ['news', 'rankings', 'diagnostics', 'chartBundles'],
      },
      cache: {
        generatedAt: new Date().toISOString(),
        stale: !!assets.stats?.partial || !!news.partial,
      },
      diagnostics: {
        assetCount: (assets.assets || []).length,
        newsCount: (news.items || news.news || []).length,
        assetStats: assets.stats || {},
        errors: [...inputErrors, ...(assets.errors || [])],
        warnings: [...(news.warnings || []), ...((assets.stats?.warnings) || [])],
      },
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'mobile', cacheControl: 'private, max-age=20, stale-while-revalidate=120' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'mobile' });
  }
}
