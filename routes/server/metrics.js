import { ValoraeEngine } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute } from '../../lib/http/route.js';
import { getServerMetricsSnapshot } from '../../lib/observability/server-metrics.js';

export default async function handler(req, res) {
  const route = beginRoute(req, res, {
    version: ValoraeEngine.version,
    methods: ['GET'],
    route: 'server/metrics',
    profile: 'server-metrics',
    rateMax: Number(process.env.VALORAE_RATE_LIMIT_METRICS_MAX || 120),
    cacheControl: 'no-store',
  });
  if (route.done) return;
  const snapshot = getServerMetricsSnapshot();
  return sendJson(req, res, snapshot, {
    status: 200,
    engineVersion: ValoraeEngine.version,
    profile: 'server-metrics',
    cachePolicy: 'no-store',
    cacheControl: 'no-store',
    volatileEtag: true,
  });
}
