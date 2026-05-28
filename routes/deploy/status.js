import { ValoraeEngine } from '../../lib/Valorae-engine.js';
import { routeManifest } from '../_router.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute } from '../../lib/http/route.js';

export default async function handler(req, res) {
  req.__valoraeInternalTelemetry = true;
  const route = beginRoute(req, res, {
    version: ValoraeEngine.version,
    methods: ['GET'],
    route: 'deploy/status',
    profile: 'deploy-status',
    cacheControl: 'private, no-store',
  });
  if (route.done) return;
  return sendJson(req, res, {
    ok: true,
    name: 'VALORAE Proxy deploy status',
    version: ValoraeEngine.version,
    expectedDashboardMetrics: '/api/server/metrics',
    ready: '/api/ready',
    tests: '/server.html#tests',
    routeManifest: routeManifest(),
    build: {
      vercelSafe: true,
      serverlessFunctions: ['api/[...path].js', 'api/server/metrics.js', 'api/server/tests.js', 'api/cache/stats.js', 'api/source/status.js', 'api/ready.js', 'api/deploy/status.js'],
      note: 'Se /server.html carrega mas /api/server/metrics retorna 404, a função serverless publicada está desatualizada ou o deploy não publicou a pasta api completa.',
    },
    checkedAt: new Date().toISOString(),
  }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'deploy-status', cacheControl: 'private, no-store' });
}
