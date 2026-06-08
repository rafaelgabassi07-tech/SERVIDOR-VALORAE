import { ValoraeEngine, getValoraeRuntimeStats } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute } from '../../lib/http/route.js';
import { buildSourceReliabilityMatrix } from '../../lib/quality/data-quality.js';
import { getServerMetricsSnapshot } from '../../lib/observability/server-metrics.js';
import { buildPersonalReleaseReadiness } from '../../lib/release/personal-maturity.js';

export default async function handler(req, res) {
  req.__valoraeInternalTelemetry = true;
  const route = beginRoute(req, res, {
    version: ValoraeEngine.version,
    methods: ['GET'],
    route: 'release-readiness',
    rateMax: Number(process.env.VALORAE_RATE_LIMIT_HEALTH_MAX || 180),
    profile: 'release-readiness',
    cacheControl: 'private, max-age=10'
  });
  if (route.done) return;
  const runtime = getValoraeRuntimeStats();
  const providers = buildSourceReliabilityMatrix(runtime);
  const metrics = getServerMetricsSnapshot();
  const readiness = buildPersonalReleaseReadiness({ runtime, providers, metrics, proxyOutputMonitor: metrics.proxyOutputMonitor, deliveryHarmony: metrics.deliveryHarmony });
  return sendJson(req, res, {
    version: ValoraeEngine.version,
    requestId: route.requestId,
    endpoint: 'release/readiness',
    releasePatch: '21.12.70-valorae-financial-charts-deep-fix',
    status: readiness.status,
    readiness,
  }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'release-readiness', cacheControl: 'private, max-age=10' });
}
