import { buildPortfolioHistory, normalizePortfolioPositions, normalizePortfolioTransactions } from '../../lib/portfolio/history.js';
import { ValoraeEngine } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, clampNumber, sendRouteError, withRouteDeadline } from '../../lib/http/route.js';

const MAX_POSITIONS = Number(process.env.VALORAE_PORTFOLIO_HISTORY_MAX_POSITIONS || 30);

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET', 'POST'], route: 'portfolio-history', rateMax: Number(process.env.VALORAE_RATE_LIMIT_PORTFOLIO_MAX || 60), profile: 'portfolio-history' });
  if (route.done) return;
  try {
    const q = route.input;
    const positions = normalizePortfolioPositions(q);
    const transactions = normalizePortfolioTransactions(q);
    if (!positions.length) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: 'Envie positions[] ou tickers, quantities e avgPrices.' }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'portfolio-history' });
    if (positions.length > MAX_POSITIONS) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: `Máximo de ${MAX_POSITIONS} posições.` }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'portfolio-history' });
    const compactMode = ['mobile','fast','compact','boot'].includes(String(q.mode || q.profile || '').toLowerCase());
    const routeDeadlineMs = clampNumber(q.routeDeadlineMs || q.deadlineMs, compactMode ? 4800 : 9000, 1200, 20000);
    const data = await withRouteDeadline(
      () => buildPortfolioHistory(positions, {
        range: q.range || '1Y',
        interval: q.interval,
        timeoutMs: clampNumber(q.timeoutMs, compactMode ? 3500 : 9000, 1000, 20000),
        maxConcurrency: clampNumber(q.maxConcurrency || q.concurrency, compactMode ? 3 : 4, 1, 8),
        limit: clampNumber(q.limit, undefined, 1, 1500),
        transactions,
      }),
      routeDeadlineMs,
      () => ({ ok: false, partial: true, points: [], history: [], warnings: [`Histórico da carteira excedeu ${routeDeadlineMs}ms; use fallback local do APK.`] })
    );
    return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, endpoint: 'portfolio-history', deadlineMs: routeDeadlineMs, ...data }, { status: data.ok || data.partial ? 200 : 502, engineVersion: ValoraeEngine.version, profile: 'portfolio-history', cacheControl: data.ok ? 'private, max-age=60, stale-while-revalidate=300' : 'private, max-age=10, stale-while-revalidate=120' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'portfolio-history' });
  }
}
