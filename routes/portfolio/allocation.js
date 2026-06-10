import { analyzePortfolio, parseBoolean } from '../../lib/portfolio/analytics.js';
import { ValoraeEngine } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, clampNumber, resolveSelfScrapeUrl, sendRouteError, withRouteDeadline } from '../../lib/http/route.js';

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET', 'POST'], route: 'portfolio-allocation', rateMax: Number(process.env.VALORAE_RATE_LIMIT_PORTFOLIO_MAX || 60), profile: 'portfolio' });
  if (route.done) return;
  try {
    const input = route.input;
    const compactMode = ['mobile','fast','compact','boot'].includes(String(input.mode || input.profile || input.performance || '').toLowerCase());
    const routeDeadlineMs = clampNumber(input.routeDeadlineMs || input.deadlineMs, compactMode ? 3000 : 6500, 900, 15000);
    const data = await withRouteDeadline(
      () => analyzePortfolio(input, {
        view: 'full',
        assetView: input.assetView || 'compact',
        cache: !parseBoolean(input.nocache || input.refresh, false),
        bypassCache: parseBoolean(input.nocache || input.refresh, false),
        maxConcurrency: clampNumber(input.maxConcurrency || input.concurrency, compactMode ? 3 : 4, 1, 6),
        valoraeScrapeUrl: resolveSelfScrapeUrl(req, input),
        profile: input.profile || input.performance || (compactMode ? 'mobile' : 'portfolio'),
      }),
      routeDeadlineMs,
      () => ({ status: 'PARTIAL', partial: true, summary: {}, allocation: { byTicker: [], byType: [], bySector: [], byAccount: [], byIssuer: [], byIndexer: [], byObjective: [] }, insights: [], diagnostics: { warnings: [`Alocação excedeu ${routeDeadlineMs}ms; APK deve preservar cálculo local/cache.`] } })
    );
    return sendJson(req, res, { requestId: route.requestId, deadlineMs: routeDeadlineMs, ...{version:data.version,engineVersion:data.engineVersion,status:data.status,generatedAt:data.generatedAt,summary:data.summary,allocation:data.allocation,insights:data.insights?.filter(i=>/DIVERSIFICATION|CONCENTRATION|CLASS|SECTOR/.test(i.code || ''))||[],diagnostics:data.diagnostics,partial:data.partial||false} }, { status: data.status === 'EMPTY' ? 400 : 200, engineVersion: ValoraeEngine.version, profile: 'portfolio', cacheControl: 'private, max-age=10, stale-while-revalidate=120' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'portfolio' });
  }
}
