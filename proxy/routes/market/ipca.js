import { ValoraeEngine } from '../../lib/Valorae-engine.js';
import { fetchIpca } from '../../lib/market/bcb.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, boolParam, clampNumber, sendRouteError, withRouteDeadline } from '../../lib/http/route.js';

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET'], route: 'market-ipca', rateMax: Number(process.env.VALORAE_RATE_LIMIT_MARKET_MAX || 90), profile: 'market' });
  if (route.done) return;
  try {
    const q = route.input;
    const compactMode = ['mobile', 'fast', 'compact', 'boot'].includes(String(q.mode || q.profile || q.performance || '').toLowerCase());
    const last = clampNumber(q.last || q.months, 24, 1, 120);
    const timeoutMs = clampNumber(q.timeoutMs, compactMode ? 1600 : 8000, 500, 20000);
    const routeDeadlineMs = clampNumber(q.routeDeadlineMs || q.deadlineMs, compactMode ? 1900 : 9000, 700, 22000);
    const data = await withRouteDeadline(
      () => fetchIpca({ last, timeoutMs, bypassCache: boolParam(q.nocache || q.refresh, false), cache: !boolParam(q.nocache || q.refresh, false) }),
      routeDeadlineMs,
      () => ({ ok: false, partial: true, source: 'BancoCentralSGS', points: [], series: [], items: [], warnings: [`IPCA excedeu ${routeDeadlineMs}ms; APK deve preservar cache/fallback local.`] })
    );
    return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, endpoint: 'market-ipca', routeDeadlineMs, ...data }, { status: data.ok || data.partial ? 200 : 502, engineVersion: ValoraeEngine.version, profile: 'market', cacheControl: data.ok ? 'private, max-age=3600, stale-while-revalidate=86400' : 'private, max-age=60, stale-while-revalidate=3600' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'market' });
  }
}
