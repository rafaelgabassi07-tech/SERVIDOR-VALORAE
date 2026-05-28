import { ValoraeEngine, getValoraeRuntimeStats } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute } from '../../lib/http/route.js';
import { getServerMetricsSnapshot } from '../../lib/observability/server-metrics.js';

export default async function handler(req, res) {
  // Telemetria interna: esta rota alimenta o painel e não pode inflar os próprios contadores.
  req.__valoraeInternalTelemetry = true;
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
  const engine = getValoraeRuntimeStats();
  return sendJson(req, res, { ...snapshot, engine, engineCore: engine.engineCore }, {
    status: 200,
    engineVersion: ValoraeEngine.version,
    profile: 'server-metrics',
    cachePolicy: 'no-store',
    cacheControl: 'no-store',
    volatileEtag: true,
  });
}
