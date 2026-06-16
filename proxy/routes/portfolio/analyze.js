import { analyzePortfolio, parseBoolean } from '../../lib/portfolio/analytics.js';
import { ValoraeEngine } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, clampNumber, resolveSelfScrapeUrl, sendRouteError, withRouteDeadline } from '../../lib/http/route.js';

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET', 'POST'], route: 'portfolio-analyze', rateMax: Number(process.env.VALORAE_RATE_LIMIT_PORTFOLIO_MAX || 60), profile: 'portfolio' });
  if (route.done) return;
  try {
    const input = route.input;
    const compactMode = ['mobile', 'fast', 'compact', 'boot'].includes(String(input.mode || input.profile || input.performance || '').toLowerCase());
    const routeDeadlineMs = clampNumber(input.routeDeadlineMs || input.deadlineMs, compactMode ? 3600 : 8000, 1000, 18000);
    const data = await withRouteDeadline(
      () => analyzePortfolio(input, {
        view: input.view || (compactMode ? 'standard' : 'full'),
        assetView: input.assetView || 'compact',
        cache: !parseBoolean(input.nocache || input.refresh, false),
        bypassCache: parseBoolean(input.nocache || input.refresh, false),
        maxConcurrency: clampNumber(input.maxConcurrency || input.concurrency, compactMode ? 3 : 4, 1, 6),
        valoraeScrapeUrl: resolveSelfScrapeUrl(req, input),
        profile: input.profile || input.performance || (compactMode ? 'mobile' : 'portfolio'),
      }),
      routeDeadlineMs,
      () => ({ ok: false, partial: true, status: 'PARTIAL', warnings: [`Análise excedeu ${routeDeadlineMs}ms; APK deve manter análise local e dados anteriores.`] })
    );
    return sendJson(req, res, { requestId: route.requestId, deadlineMs: routeDeadlineMs, ...data }, { status: data.status === 'EMPTY' ? 400 : 200, engineVersion: ValoraeEngine.version, profile: input.profile || input.performance || 'portfolio', cachePolicy: 'memory-lru-stale-if-error', cacheControl: 'private, max-age=10, stale-while-revalidate=60' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'portfolio' });
  }
}
