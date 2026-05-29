import { ValoraeEngine, getValoraeRuntimeStats } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute } from '../../lib/http/route.js';
import { buildSourceReliabilityMatrix } from '../../lib/quality/data-quality.js';
import { buildPersonalReleaseReadiness } from '../../lib/release/personal-maturity.js';

export default async function handler(req, res) {
  req.__valoraeInternalTelemetry = true;
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET'], route: 'source-status', rateMax: Number(process.env.VALORAE_RATE_LIMIT_HEALTH_MAX || 180), profile: 'source-status', cacheControl: 'private, max-age=5' });
  if (route.done) return;
  const runtime = getValoraeRuntimeStats();
  const providers = buildSourceReliabilityMatrix(runtime);
  const degraded = providers.filter(p => ['cooldown','degraded'].includes(p.status));
  const classes = {
    api: providers.filter(p => /Yahoo|BCB|BancoCentral|GoogleNews/i.test(p.name || p.provider || '')).map(p => p.name || p.provider),
    scrape: providers.filter(p => /Investidor|StatusInvest|ValoraeScrape/i.test(p.name || p.provider || '')).map(p => p.name || p.provider),
    fallback: ['YahooChart', 'cached_stale_if_error', 'failure_cache'],
    experimental: ['HTML selectors', 'internal Investidor10 APIs quando disponíveis'],
  };
  const personalReleaseReadiness = buildPersonalReleaseReadiness({ runtime, providers });
  const launchReadiness = {
    status: degraded.length ? 'attention' : 'ready',
    freeOnly: true,
    persistence: 'memory_per_serverless_instance',
    auth: process.env.VALORAE_CLIENT_KEYS ? 'optional_keys_configured' : 'open_no_keys_configured',
    recommendedProductionView: 'app',
    requiredAppHeaders: ['x-valorae-app', 'x-valorae-channel', 'x-valorae-app-version'],
    hardenedEndpoints: ['/api/v1/asset?view=app', '/api/v1/asset/coverage', '/api/v1/asset/fundamentals', '/api/v1/source/status'],
  };
  return sendJson(req, res, {
    version: ValoraeEngine.version,
    requestId: route.requestId,
    status: degraded.length ? 'DEGRADED' : 'OK',
    freeOnly: true,
    checkedAt: new Date().toISOString(),
    providers,
    sourceClasses: classes,
    launchReadiness,
    personalReleaseReadiness,
    sourceReliability: {
      okCount: providers.filter(p => !['cooldown','degraded'].includes(p.status)).length,
      degradedCount: degraded.length,
      note: 'Status é local da instância quente e não faz chamadas externas; pode resetar quando a Function esfriar.'
    }
  }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'source-status', cacheControl: 'private, max-age=5', sourceStatus: degraded.length ? 'degraded' : 'ok' });
}
