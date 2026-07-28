import { ValoraeEngine, getValoraeRuntimeStats } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute } from '../../lib/http/route.js';
import { getServerMetricsSnapshot } from '../../lib/observability/server-metrics.js';

// Captura efêmera, criada somente quando esta rota recebe uma chamada HTTP.
// O nome legado da variável de ambiente continua aceito apenas por compatibilidade.
const METRICS_CAPTURE_TTL_MS = Math.max(
  15_000,
  Math.min(10 * 60_000, Number(process.env.VALORAE_METRICS_CAPTURE_TTL_MS || process.env.VALORAE_METRICS_SNAPSHOT_TTL_MS || 60_000))
);

let cachedCapture = null;
let cachedAt = 0;
let capturePromise = null;

function requestOptions(req) {
  try {
    const url = new URL(req.url || '/', 'https://valorae.local');
    const fresh = ['1', 'true', 'yes'].includes(String(url.searchParams.get('fresh') || '').toLowerCase());
    return { fresh };
  } catch {
    return { fresh: false };
  }
}

function cachedCaptureIsFresh(now = Date.now()) {
  return cachedCapture && now - cachedAt < METRICS_CAPTURE_TTL_MS;
}

async function buildMetricsCapture() {
  const capture = getServerMetricsSnapshot();
  const engine = getValoraeRuntimeStats();
  return { ...capture, engine, engineCore: engine.engineCore };
}

async function getMetricsCapture({ fresh = false } = {}) {
  const now = Date.now();
  if (!fresh && cachedCaptureIsFresh(now)) return { payload: cachedCapture, cacheStatus: 'HIT' };
  if (!fresh && capturePromise) return { payload: await capturePromise, cacheStatus: 'COALESCED' };

  const task = buildMetricsCapture()
    .then(payload => {
      cachedCapture = payload;
      cachedAt = Date.now();
      return payload;
    })
    .finally(() => {
      if (capturePromise === task) capturePromise = null;
    });
  if (!fresh) capturePromise = task;
  return { payload: await task, cacheStatus: fresh ? 'BYPASS' : 'MISS' };
}

export default async function handler(req, res) {
  // Telemetria interna: esta rota alimenta o painel e não pode inflar os próprios contadores.
  req.__valoraeInternalTelemetry = true;
  const route = beginRoute(req, res, {
    version: ValoraeEngine.version,
    methods: ['GET'],
    route: 'server/metrics',
    profile: 'server-metrics',
    rateMax: Number(process.env.VALORAE_RATE_LIMIT_METRICS_MAX || 30),
    cacheControl: 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
  });
  if (route.done) return;

  const options = requestOptions(req);
  const { payload, cacheStatus } = await getMetricsCapture(options);
  const cacheControl = options.fresh
    ? 'no-store'
    : 'public, max-age=30, s-maxage=60, stale-while-revalidate=300';
  return sendJson(req, res, payload, {
    status: 200,
    engineVersion: ValoraeEngine.version,
    profile: 'server-metrics',
    cachePolicy: 'manual-capture-cache',
    cacheStatus,
    cacheControl,
  });
}

export const _test = {
  METRICS_CAPTURE_TTL_MS,
  requestOptions,
  cachedCaptureIsFresh,
  getMetricsCapture,
};
