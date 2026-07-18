import { ValoraeEngine, getValoraeRuntimeStats } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute } from '../../lib/http/route.js';
import { getServerMetricsSnapshot } from '../../lib/observability/server-metrics.js';
import { loadPersistedMonitorEvents } from '../../lib/observability/monitor-persistence.js';

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
  const forcePersistenceRefresh = (() => {
    try {
      const url = new URL(req.url || '/', 'https://valorae.local');
      return ['1', 'true', 'yes'].includes(String(url.searchParams.get('refreshPersistence') || '').toLowerCase());
    } catch { return false; }
  })();
  const history = await loadPersistedMonitorEvents({ force: forcePersistenceRefresh });
  const snapshot = getServerMetricsSnapshot({
    persistedEvents: history.events,
    persistedTotal: history.total,
    persistence: history.status,
  });
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
