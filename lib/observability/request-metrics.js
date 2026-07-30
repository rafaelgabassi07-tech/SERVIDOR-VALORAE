const routeMetrics = new Map();
const recent = [];
const MAX_ROUTES = Math.max(16, Math.min(512, Number(process.env.VALORAE_METRICS_MAX_ROUTES || 128)));
const MAX_RECENT = Math.max(32, Math.min(4096, Number(process.env.VALORAE_METRICS_MAX_RECENT || 512)));

function truthy(value) {
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value || '').trim().toLowerCase());
}

function percentile(values = [], p = 0.95) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))].toFixed(2));
}

function trimRoutes() {
  while (routeMetrics.size > MAX_ROUTES) routeMetrics.delete(routeMetrics.keys().next().value);
}

function record(sample) {
  const key = `${sample.method} ${sample.route}`;
  const current = routeMetrics.get(key) || { count: 0, errors: 0, bytes: 0, durations: [], statusCodes: {} };
  current.count += 1;
  current.errors += sample.statusCode >= 400 ? 1 : 0;
  current.bytes += sample.responseBytes;
  current.durations.push(sample.durationMs);
  if (current.durations.length > 256) current.durations.shift();
  current.statusCodes[sample.statusCode] = (current.statusCodes[sample.statusCode] || 0) + 1;
  routeMetrics.delete(key);
  routeMetrics.set(key, current);
  trimRoutes();
  recent.push(sample);
  if (recent.length > MAX_RECENT) recent.shift();
  if (truthy(process.env.VALORAE_STRUCTURED_REQUEST_LOGS)) {
    const sampleRate = Math.max(0, Math.min(1, Number(process.env.VALORAE_REQUEST_LOG_SAMPLE_RATE || 0.1)));
    if (sample.statusCode >= 500 || Math.random() <= sampleRate) console.log(JSON.stringify({ type: 'valorae_request', ...sample }));
  }
}

export function beginRequestObservation(req, res, context = {}) {
  const started = process.hrtime.bigint();
  let finalized = false;
  const finalize = () => {
    if (finalized) return;
    finalized = true;
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const responseBytes = Number(res.getHeader?.('X-Valorae-Response-Bytes') || res.getHeader?.('Content-Length') || 0) || 0;
    record({
      at: new Date().toISOString(),
      requestId: String(context.requestId || '').slice(0, 96),
      route: String(context.route || '/').slice(0, 160),
      method: String(req?.method || 'GET').toUpperCase(),
      statusCode: Number(res.statusCode || 200),
      durationMs: Number(durationMs.toFixed(2)),
      responseBytes,
      cache: String(res.getHeader?.('X-Valorae-Cache') || '').slice(0, 32) || undefined,
      compatibility: String(res.getHeader?.('X-Valorae-Apk-Compatibility') || '').slice(0, 40) || undefined,
      appVersion: String(context.appVersion || '').slice(0, 32) || undefined,
    });
  };
  if (typeof res.once === 'function') res.once('finish', finalize);
  else if (typeof res.end === 'function') {
    const original = res.end.bind(res);
    res.end = (...args) => {
      const result = original(...args);
      finalize();
      return result;
    };
  }
  return finalize;
}

export function requestMetricsSnapshot() {
  const routes = {};
  for (const [key, value] of routeMetrics) {
    routes[key] = {
      count: value.count,
      errors: value.errors,
      errorRate: value.count ? Number((value.errors / value.count).toFixed(4)) : 0,
      responseBytes: value.bytes,
      p50Ms: percentile(value.durations, 0.5),
      p95Ms: percentile(value.durations, 0.95),
      p99Ms: percentile(value.durations, 0.99),
      statusCodes: value.statusCodes,
    };
  }
  return { version: 'valorae-request-metrics-v1', routeCount: routeMetrics.size, recentCount: recent.length, routes };
}

export function clearRequestMetrics() {
  routeMetrics.clear();
  recent.length = 0;
}
