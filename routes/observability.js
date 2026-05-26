import { ValoraeEngine } from '../lib/Valorae-engine.js';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute, clampNumber } from '../lib/http/route.js';
import { observabilitySnapshot, OBSERVABILITY_VERSION } from '../lib/observability/metrics.js';

export default async function handler(req, res) {
  const route = beginRoute(req, res, {
    version: ValoraeEngine.version,
    methods: ['GET'],
    route: 'observability',
    rateMax: Number(process.env.VALORAE_OBSERVABILITY_RATE_LIMIT_MAX || 240),
    profile: 'observability',
    cacheControl: 'no-store',
  });
  if (route.done) return;
  const minutes = clampNumber(req.query?.minutes || req.query?.window || 60, 60, 5, 10080);
  const payload = observabilitySnapshot({ minutes });
  return sendJson(req, res, {
    ok: true,
    name: 'Valorae Proxy Observability',
    version: ValoraeEngine.version,
    observabilityVersion: OBSERVABILITY_VERSION,
    ...payload,
  }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'observability', cachePolicy: 'no-store', cacheControl: 'no-store' });
}
