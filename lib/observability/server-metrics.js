import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

export const VALORAE_SERVER_METRICS_VERSION = '21.8.0-proxy-server-md3-green';

const MAX_EVENTS = Number(process.env.VALORAE_METRICS_MAX_EVENTS || 320);
const MAX_ROUTE_STATS = Number(process.env.VALORAE_METRICS_MAX_ROUTES || 120);
const MAX_CLIENTS = Number(process.env.VALORAE_METRICS_MAX_CLIENTS || 420);
const BUCKET_MS = 60_000;
const MAX_BUCKETS = Number(process.env.VALORAE_METRICS_MAX_BUCKETS || 180);
const bootedAt = Date.now();

const emptyTotals = () => ({
  requests: 0,
  responses: 0,
  inFlight: 0,
  errors: 0,
  rateLimited: 0,
  bytesOut: 0,
  cacheHits: 0,
  cacheMisses: 0,
  blockedSources: 0,
  partialResponses: 0,
  interceptedBySendJson: 0,
  interceptedByResEnd: 0,
});

const state = globalThis.__VALORAE_SERVER_METRICS__ || {
  version: VALORAE_SERVER_METRICS_VERSION,
  instanceId: randomUUID(),
  bootedAt,
  seq: 0,
  totals: emptyTotals(),
  status: new Map(),
  methods: new Map(),
  routes: new Map(),
  cache: new Map(),
  source: new Map(),
  devices: new Map(),
  tickers: new Map(),
  views: new Map(),
  clients: new Map(),
  buckets: new Map(),
  latencies: [],
  events: [],
};

globalThis.__VALORAE_SERVER_METRICS__ = state;

function nowIso(ts = Date.now()) { return new Date(ts).toISOString(); }
function hash(value = '') { return createHash('sha256').update(String(value || 'unknown')).digest('hex').slice(0, 16); }
function inc(map, key, amount = 1) { const safe = String(key || 'unknown'); map.set(safe, (map.get(safe) || 0) + amount); }
function topMap(map, limit = 12) { return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, value]) => ({ name, value })); }
function statusFamily(status) { const n = Number(status || 0); if (!n) return 'unknown'; return `${Math.floor(n / 100)}xx`; }
function safeNumber(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function percentile(values, p) { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)); return Math.round(sorted[idx]); }
function avg(values) { if (!values.length) return null; return Math.round(values.reduce((a, b) => a + b, 0) / values.length); }

function normalizeRoutePath(path) {
  let out = String(path || '/').split('?')[0] || '/';
  if (!out.startsWith('/')) out = `/${out}`;
  if (!out.startsWith('/api')) out = `/api${out}`;
  return out.replace(/\/+/g, '/').replace(/\/$/, '') || '/api';
}

function routeFromReq(req) {
  try {
    const url = new URL(req?.url || '/', 'https://valorae.local');
    return normalizeRoutePath(url.pathname || '/');
  } catch { return normalizeRoutePath(String(req?.url || '/').split('?')[0] || '/'); }
}

function querySignal(req) {
  try {
    const url = new URL(req?.url || '/', 'https://valorae.local');
    const ticker = url.searchParams.get('ticker') || url.searchParams.get('tickers') || url.searchParams.get('symbol') || url.searchParams.get('asset');
    const view = url.searchParams.get('view') || url.searchParams.get('profile') || url.searchParams.get('mode') || url.searchParams.get('type');
    return {
      ticker: ticker ? String(ticker).slice(0, 120).toUpperCase() : undefined,
      view: view ? String(view).slice(0, 80) : undefined,
    };
  } catch { return {}; }
}

function clientHash(req) {
  const realIp = String(req?.headers?.['x-real-ip'] || req?.headers?.['x-vercel-forwarded-for'] || '').split(',')[0].trim();
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const ua = String(req?.headers?.['user-agent'] || '').slice(0, 80);
  return hash(`${realIp || forwarded || req?.socket?.remoteAddress || 'unknown'}|${ua}`);
}

function deviceFromUA(ua = '') {
  const v = String(ua).toLowerCase();
  if (/android|okhttp|dart|flutter|dalvik/.test(v)) return 'APK/Android';
  if (/iphone|ipad|ios/.test(v)) return 'iOS/WebView';
  if (/chrome|firefox|safari|edge|edg\//.test(v)) return 'Web';
  if (/curl|postman|insomnia|httpie|python|node|axios|fetch/.test(v)) return 'API/Dev';
  return 'Outro';
}

function compactRouteStats() {
  if (state.routes.size <= MAX_ROUTE_STATS) return;
  const keep = new Set(topMap(state.routes, MAX_ROUTE_STATS).map(x => x.name));
  for (const key of state.routes.keys()) if (!keep.has(key)) state.routes.delete(key);
}

function touchBucket(ts, event) {
  const key = Math.floor(ts / BUCKET_MS) * BUCKET_MS;
  const bucket = state.buckets.get(key) || { t: key, requests: 0, responses: 0, errors: 0, bytesOut: 0, latencyTotal: 0, latencyCount: 0 };
  bucket.responses += 1;
  bucket.requests = Math.max(bucket.requests, bucket.responses);
  if (event.status >= 400) bucket.errors += 1;
  bucket.bytesOut += event.bytesOut || 0;
  if (event.latencyMs !== null && event.latencyMs !== undefined) { bucket.latencyTotal += event.latencyMs; bucket.latencyCount += 1; }
  state.buckets.set(key, bucket);
  const keys = [...state.buckets.keys()].sort((a, b) => a - b);
  while (keys.length > MAX_BUCKETS) state.buckets.delete(keys.shift());
}

export function recordRequestStart(req, meta = {}) {
  if (!req) return undefined;
  if (req.__valoraeMetricsStarted) {
    if (meta.route) req.__valoraeMetrics.route = normalizeRoutePath(meta.route);
    return req.__valoraeMetrics;
  }
  const startedAt = performance.now();
  const wallStartedAt = Date.now();
  const ua = String(req?.headers?.['user-agent'] || '').slice(0, 180);
  const route = normalizeRoutePath(meta.route || routeFromReq(req));
  const method = String(req?.method || 'GET').toUpperCase();
  const client = clientHash(req);
  const device = deviceFromUA(ua);
  const signal = querySignal(req);
  req.__valoraeMetricsStarted = true;
  req.__valoraeMetrics = { startedAt, wallStartedAt, route, method, client, device, ua, signal };
  state.totals.requests += 1;
  state.totals.inFlight += 1;
  inc(state.methods, method);
  inc(state.routes, route);
  inc(state.devices, device);
  if (signal.ticker) inc(state.tickers, signal.ticker);
  if (signal.view) inc(state.views, signal.view);
  const c = state.clients.get(client) || { id: client, firstSeenAt: wallStartedAt, lastSeenAt: wallStartedAt, requests: 0, device };
  c.requests += 1;
  c.lastSeenAt = wallStartedAt;
  c.device = device;
  state.clients.set(client, c);
  if (state.clients.size > MAX_CLIENTS) {
    const oldest = [...state.clients.entries()].sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)[0];
    if (oldest) state.clients.delete(oldest[0]);
  }
  compactRouteStats();
  return req.__valoraeMetrics;
}

export function recordResponse(req, res, payload, options = {}) {
  try {
    if (!req || req.__valoraeMetricsRecorded) return null;
    const started = req.__valoraeMetrics || recordRequestStart(req, { route: options.route || options.profile });
    req.__valoraeMetricsRecorded = true;
    const ts = Date.now();
    const latencyMs = started?.startedAt ? Math.max(0, Math.round(performance.now() - started.startedAt)) : null;
    const status = Number(options.status || res?.statusCode || 200);
    const bodyBytes = options.responseBytes ?? res?.getHeader?.('X-Valorae-Response-Bytes') ?? res?.getHeader?.('Content-Length') ?? 0;
    const bytesOut = safeNumber(bodyBytes, 0);
    const cacheStatus = String(options.cacheStatus || payload?.cacheStatus || payload?.cache?.status || res?.getHeader?.('X-Valorae-Cache') || 'unknown');
    const sourceStatus = String(options.sourceStatus || res?.getHeader?.('X-Valorae-Source-Status') || 'unknown');
    const route = normalizeRoutePath(options.route || started?.route || options.profile || routeFromReq(req));
    const event = {
      id: ++state.seq,
      at: nowIso(ts),
      route,
      method: started?.method || String(req?.method || 'GET').toUpperCase(),
      status,
      family: statusFamily(status),
      latencyMs,
      bytesOut,
      cacheStatus,
      sourceStatus,
      interceptor: options.interceptor || 'sendJson',
      requestId: String(res?.getHeader?.('X-Request-Id') || payload?.requestId || '').slice(0, 96) || undefined,
      client: started?.client,
      device: started?.device || 'Outro',
      ticker: started?.signal?.ticker,
      view: started?.signal?.view,
    };
    state.totals.responses += 1;
    state.totals.inFlight = Math.max(0, state.totals.inFlight - 1);
    state.totals.bytesOut += bytesOut;
    if (event.interceptor === 'res.end') state.totals.interceptedByResEnd += 1;
    else state.totals.interceptedBySendJson += 1;
    if (status >= 400) state.totals.errors += 1;
    if (status === 429 || payload?.status === 'RATE_LIMITED') state.totals.rateLimited += 1;
    if (/hit/i.test(cacheStatus)) state.totals.cacheHits += 1;
    if (/miss/i.test(cacheStatus)) state.totals.cacheMisses += 1;
    if (/blocked/i.test(sourceStatus)) state.totals.blockedSources += 1;
    if (/partial/i.test(sourceStatus) || payload?.partial || payload?.data?.partial) state.totals.partialResponses += 1;
    inc(state.status, status);
    inc(state.cache, cacheStatus);
    inc(state.source, sourceStatus);
    if (latencyMs !== null) {
      state.latencies.push(latencyMs);
      if (state.latencies.length > 1200) state.latencies.splice(0, state.latencies.length - 1200);
    }
    state.events.push(event);
    if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
    touchBucket(ts, event);
    return event;
  } catch {
    return null;
  }
}

export function attachProxyMetricsInterceptor(req, res, meta = {}) {
  recordRequestStart(req, meta);
  if (!res || res.__valoraeMetricsEndWrapped) return;
  const originalEnd = res.end;
  res.__valoraeMetricsEndWrapped = true;
  res.end = function patchedEnd(chunk, encoding, cb) {
    if (!req.__valoraeMetricsRecorded) {
      const responseBytes = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk || ''), encoding && typeof encoding === 'string' ? encoding : 'utf8');
      recordResponse(req, res, undefined, { interceptor: 'res.end', responseBytes, route: meta.route });
    }
    return originalEnd.call(this, chunk, encoding, cb);
  };
}

export function getServerMetricsSnapshot() {
  const now = Date.now();
  const latencies = state.latencies;
  const recent = state.events.filter(e => Date.parse(e.at) >= now - 5 * 60_000);
  const uniqueRecentClients = new Set(recent.map(e => e.client).filter(Boolean));
  const buckets = [...state.buckets.values()].sort((a, b) => a.t - b.t).map(b => ({
    at: nowIso(b.t),
    requests: b.requests,
    responses: b.responses,
    errors: b.errors,
    bytesOut: b.bytesOut,
    avgLatencyMs: b.latencyCount ? Math.round(b.latencyTotal / b.latencyCount) : null,
  }));
  const uptimeSeconds = Math.max(1, Math.round((now - state.bootedAt) / 1000));
  const reqPerMinute = Math.round((recent.length / 5) * 100) / 100;
  const totalResponses = state.totals.responses || 1;
  const errorRate = Math.round((state.totals.errors / totalResponses) * 10000) / 100;
  const p95 = percentile(latencies, 95);
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - errorRate * 2 - Math.max(0, (p95 || 0) - 2000) / 100 - Math.max(0, state.totals.inFlight - 40))));
  const cacheTotal = state.totals.cacheHits + state.totals.cacheMisses;
  const cacheHitRatePercent = cacheTotal ? Math.round((state.totals.cacheHits / cacheTotal) * 10000) / 100 : 0;
  return {
    ok: true,
    name: 'Valorae Proxy Server Metrics',
    version: VALORAE_SERVER_METRICS_VERSION,
    generatedAt: nowIso(now),
    serverless: {
      mode: 'memory-observability',
      persistent: false,
      realtimeTransport: 'http-polling',
      note: 'Métricas reais em memória por instância serverless. Podem reiniciar quando a função esfriar, escalar ou receber novo deploy.',
    },
    instance: {
      id: state.instanceId,
      bootedAt: nowIso(state.bootedAt),
      uptimeSeconds,
      node: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
    },
    summary: {
      ...state.totals,
      activeClients5m: uniqueRecentClients.size,
      requestsPerMinute5m: reqPerMinute,
      avgLatencyMs: avg(latencies),
      p50LatencyMs: percentile(latencies, 50),
      p95LatencyMs: p95,
      p99LatencyMs: percentile(latencies, 99),
      errorRatePercent: errorRate,
      cacheHitRatePercent,
      healthScore,
    },
    distributions: {
      status: topMap(state.status, 12),
      methods: topMap(state.methods, 8),
      routes: topMap(state.routes, 24),
      cache: topMap(state.cache, 10),
      source: topMap(state.source, 10),
      devices: topMap(state.devices, 10),
      tickers: topMap(state.tickers, 20),
      views: topMap(state.views, 12),
    },
    timeSeries: buckets,
    recentEvents: state.events.slice(-100).reverse().map(({ client, ...safe }) => safe),
    clientSample: [...state.clients.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, 24).map(c => ({
      id: c.id,
      device: c.device,
      requests: c.requests,
      firstSeenAt: nowIso(c.firstSeenAt),
      lastSeenAt: nowIso(c.lastSeenAt),
    })),
  };
}

export function resetServerMetricsForTests() {
  state.seq = 0;
  state.totals = emptyTotals();
  state.status.clear(); state.methods.clear(); state.routes.clear(); state.cache.clear(); state.source.clear(); state.devices.clear(); state.tickers.clear(); state.views.clear(); state.clients.clear(); state.buckets.clear();
  state.latencies = []; state.events = [];
}
