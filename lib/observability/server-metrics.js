import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

export const VALORAE_SERVER_METRICS_VERSION = '21.12.0-consolidated-api-routes';

const MAX_EVENTS = Number(process.env.VALORAE_METRICS_MAX_EVENTS || 500);
const MAX_ROUTE_STATS = Number(process.env.VALORAE_METRICS_MAX_ROUTES || 180);
const MAX_CLIENTS = Number(process.env.VALORAE_METRICS_MAX_CLIENTS || 520);
const MAX_ROUTE_SAMPLES = Number(process.env.VALORAE_METRICS_ROUTE_SAMPLES || 160);
const SLO_AVAILABILITY_TARGET = Number(process.env.VALORAE_SLO_AVAILABILITY_TARGET || 99);
const SLO_P95_TARGET_MS = Number(process.env.VALORAE_SLO_P95_TARGET_MS || 2500);
const SLO_ERROR_BUDGET_PERCENT = Math.max(0.1, 100 - SLO_AVAILABILITY_TARGET);
const BUCKET_MS = 60_000;
const MAX_BUCKETS = Number(process.env.VALORAE_METRICS_MAX_BUCKETS || 240);
const bootedAt = Date.now();

const emptyTotals = () => ({
  requests: 0,
  responses: 0,
  inFlight: 0,
  errors: 0,
  clientErrors: 0,
  serverErrors: 0,
  success: 0,
  redirects: 0,
  rateLimited: 0,
  bytesOut: 0,
  bytesIn: 0,
  cacheHits: 0,
  cacheMisses: 0,
  cacheStale: 0,
  blockedSources: 0,
  driftSources: 0,
  partialResponses: 0,
  interceptedBySendJson: 0,
  interceptedByResEnd: 0,
  optionsPreflight: 0,
  headResponses: 0,
  slowResponses: 0,
  abortedResponses: 0,
  clientClosed: 0,
  bodylessResponses: 0,
  staleActiveCleanups: 0,
});

const state = globalThis.__VALORAE_SERVER_METRICS__ || {
  version: VALORAE_SERVER_METRICS_VERSION,
  instanceId: randomUUID(),
  bootedAt,
  seq: 0,
  totals: emptyTotals(),
  status: new Map(),
  statusFamily: new Map(),
  methods: new Map(),
  routes: new Map(),
  routeDetails: new Map(),
  cache: new Map(),
  source: new Map(),
  devices: new Map(),
  tickers: new Map(),
  views: new Map(),
  clients: new Map(),
  interceptors: new Map(),
  buckets: new Map(),
  latencies: [],
  bytesOutSamples: [],
  bytesInSamples: [],
  events: [],
  activeRequests: new Map(),
  internalTelemetry: { requests: 0, lastAt: null, routes: new Map() },
};

state.version = VALORAE_SERVER_METRICS_VERSION;
if (!state.bytesOutSamples) state.bytesOutSamples = [];
if (!state.bytesInSamples) state.bytesInSamples = [];
if (typeof state.totals.bytesIn !== 'number') state.totals.bytesIn = 0;
if (typeof state.totals.abortedResponses !== 'number') state.totals.abortedResponses = 0;
if (typeof state.totals.clientClosed !== 'number') state.totals.clientClosed = 0;
if (typeof state.totals.bodylessResponses !== 'number') state.totals.bodylessResponses = 0;
if (typeof state.totals.staleActiveCleanups !== 'number') state.totals.staleActiveCleanups = 0;
if (!state.activeRequests) state.activeRequests = new Map();
if (!state.internalTelemetry) state.internalTelemetry = { requests: 0, lastAt: null, routes: new Map() };
if (!state.internalTelemetry.routes) state.internalTelemetry.routes = new Map();
globalThis.__VALORAE_SERVER_METRICS__ = state;

function nowIso(ts = Date.now()) { return new Date(ts).toISOString(); }
function hash(value = '') { return createHash('sha256').update(String(value || 'unknown')).digest('hex').slice(0, 16); }
function inc(map, key, amount = 1) { const safe = String(key || 'unknown'); map.set(safe, (map.get(safe) || 0) + amount); }
function topMap(map, limit = 12) { return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, value]) => ({ name, value })); }
function statusFamily(status) { const n = Number(status || 0); if (!n) return 'unknown'; return `${Math.floor(n / 100)}xx`; }
function safeNumber(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function percentile(values, p) { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)); return Math.round(sorted[idx]); }
function avg(values) { if (!values.length) return null; return Math.round(values.reduce((a, b) => a + b, 0) / values.length); }
function sum(values) { return values.reduce((a, b) => a + Number(b || 0), 0); }
function clamp(n, min = 0, max = 100) { return Math.max(min, Math.min(max, Number(n) || 0)); }
function histogram(values, ranges) {
  return ranges.map(([name, min, max]) => ({ name, value: values.filter(v => Number(v) >= min && (max === null || Number(v) < max)).length }));
}
function secondsBetween(a, b = Date.now()) { return Math.max(0, Math.round((b - a) / 1000)); }
function ratePerMinute(count, seconds) { return seconds > 0 ? Math.round((count / seconds) * 60 * 100) / 100 : 0; }
function round2(value) { return Math.round(Number(value || 0) * 100) / 100; }
function deltaPercent(current, baseline) {
  const c = Number(current || 0);
  const b = Number(baseline || 0);
  if (b <= 0) return c > 0 ? 100 : 0;
  return round2(((c - b) / b) * 100);
}

function scoreClamp(value) { return clamp(Math.round(Number(value) || 0), 0, 100); }
function qualityPenalty(summary = {}) {
  return Math.min(100,
    (summary.errorRatePercent || 0) * 1.8 +
    (summary.slowRatePercent || 0) * 0.7 +
    (summary.partialResponses || 0) * 4 +
    (summary.blockedSources || 0) * 6 +
    (summary.driftSources || 0) * 5 +
    Math.max(0, 25 - (summary.cacheHitRatePercent || 0)) * 0.18
  );
}
function stateLabel(score = 100) {
  if (score >= 85) return 'saudável';
  if (score >= 70) return 'atenção';
  return 'crítico';
}

function trafficStateLabel({ requests = 0, recentRequests = 0, errorRatePercent = 0, p95LatencyMs = 0, inFlight = 0 } = {}) {
  if (!requests) return 'sem_trafego_real';
  if (!recentRequests) return 'ocioso_sem_trafego_recente';
  if (errorRatePercent >= 10 || Number(p95LatencyMs || 0) > SLO_P95_TARGET_MS * 1.6) return 'degradado';
  if (inFlight >= 12 || recentRequests >= 60) return 'alto_volume';
  return 'ativo';
}

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

const INTERNAL_TELEMETRY_ROUTES = new Set([
  '/api/server/metrics',
  '/api/v1/server/metrics',
  '/api/v2/server/metrics',
  '/api/ready',
  '/api/manifest',
  '/api/env',
  '/api/schema',
  '/api/source/status',
  '/api/cache/stats',
  '/api/v1/source/status',
  '/api/v2/source/status',
  '/api/v1/cache/stats',
  '/api/v2/cache/stats',
  '/api/server/tests',
  '/api/v1/server/tests',
  '/api/v2/server/tests',
  '/api/deploy/status',
  '/api/admin/status',
  '/api/admin/cache',
  '/api/openapi',
  '/api/fields',
  '/api/errors',
  '/api/v1/deploy/status',
  '/api/v2/deploy/status',
  '/api/v1/admin/status',
  '/api/v2/admin/status',
  '/api/v1/admin/cache',
  '/api/v2/admin/cache',
  '/api/v1/ready',
  '/api/v2/ready',
  '/api/v1/openapi',
  '/api/v2/openapi',
  '/api/v1/fields',
  '/api/v2/fields',
  '/api/v1/errors',
  '/api/v2/errors',
]);

function isInternalTelemetryRoute(route = '') {
  const normalized = normalizeRoutePath(route || '/');
  return INTERNAL_TELEMETRY_ROUTES.has(normalized);
}

function shouldIgnoreMetrics(req, meta = {}) {
  if (req?.__valoraeInternalTelemetry === true || meta?.internalTelemetry === true) return true;
  const telemetryHeader = String(req?.headers?.['x-valorae-telemetry'] || req?.headers?.['X-Valorae-Telemetry'] || '').toLowerCase();
  if (/dashboard|internal|test|probe|telemetry/.test(telemetryHeader)) return true;
  const route = normalizeRoutePath(meta.route || routeFromReq(req));
  return isInternalTelemetryRoute(route);
}

function recordInternalTelemetry(req, meta = {}) {
  if (!req || req.__valoraeInternalTelemetryRecorded) return;
  const route = normalizeRoutePath(meta.route || routeFromReq(req));
  req.__valoraeInternalTelemetryRecorded = true;
  state.internalTelemetry.requests += 1;
  state.internalTelemetry.lastAt = Date.now();
  inc(state.internalTelemetry.routes, route);
}

function querySignal(req) {
  try {
    const url = new URL(req?.url || '/', 'https://valorae.local');
    const ticker = url.searchParams.get('ticker') || url.searchParams.get('tickers') || url.searchParams.get('symbol') || url.searchParams.get('asset') || url.searchParams.get('ativo');
    const view = url.searchParams.get('view') || url.searchParams.get('profile') || url.searchParams.get('mode') || url.searchParams.get('type') || url.searchParams.get('tipo');
    const fields = url.searchParams.get('fields');
    return {
      ticker: ticker ? String(ticker).slice(0, 120).toUpperCase() : undefined,
      view: view ? String(view).slice(0, 80) : undefined,
      fieldsCount: fields ? String(fields).split(',').filter(Boolean).length : 0,
      hasEnvelope: url.searchParams.get('envelope') !== null,
    };
  } catch { return {}; }
}

function clientHash(req) {
  const realIp = String(req?.headers?.['x-real-ip'] || req?.headers?.['x-vercel-forwarded-for'] || '').split(',')[0].trim();
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const ua = String(req?.headers?.['user-agent'] || '').slice(0, 120);
  return hash(`${realIp || forwarded || req?.socket?.remoteAddress || 'unknown'}|${ua}`);
}

function deviceFromUA(ua = '') {
  const v = String(ua).toLowerCase();
  if (/android|okhttp|dart|flutter|dalvik/.test(v)) return 'APK/Android';
  if (/iphone|ipad|ios|cfnetwork/.test(v)) return 'iOS/WebView';
  if (/chrome|firefox|safari|edge|edg\//.test(v)) return 'Web';
  if (/curl|postman|insomnia|httpie|python|node|axios|fetch|java|go-http/.test(v)) return 'API/Dev';
  return 'Outro';
}

function compactMaps() {
  if (state.routes.size > MAX_ROUTE_STATS) {
    const keep = new Set(topMap(state.routes, MAX_ROUTE_STATS).map(x => x.name));
    for (const key of state.routes.keys()) if (!keep.has(key)) state.routes.delete(key);
    for (const key of state.routeDetails.keys()) if (!keep.has(key)) state.routeDetails.delete(key);
  }
}

function touchBucket(ts) {
  const key = Math.floor(ts / BUCKET_MS) * BUCKET_MS;
  const bucket = state.buckets.get(key) || {
    t: key, requests: 0, responses: 0, success: 0, errors: 0, clientErrors: 0, serverErrors: 0,
    bytesOut: 0, bytesIn: 0, latencyTotal: 0, latencyCount: 0, slowResponses: 0, cacheHits: 0, cacheMisses: 0,
  };
  state.buckets.set(key, bucket);
  const keys = [...state.buckets.keys()].sort((a, b) => a - b);
  while (keys.length > MAX_BUCKETS) state.buckets.delete(keys.shift());
  return bucket;
}

function updateRouteDetail(route, patch = {}) {
  const current = state.routeDetails.get(route) || {
    route, requests: 0, responses: 0, errors: 0, clientErrors: 0, serverErrors: 0, bytesOut: 0, bytesIn: 0,
    latencyTotal: 0, latencyCount: 0, latencySamples: [], statusCounts: {}, maxLatencyMs: 0, lastStatus: null, lastSeenAt: null, lastRequestAt: null, lastCacheStatus: 'unknown', lastSourceStatus: 'unknown', methods: {}, devices: {}, cacheStatuses: {}, sourceStatuses: {},
  };
  Object.assign(current, patch.base || {});
  if (patch.request) {
    current.requests += 1;
    current.bytesIn += patch.bytesIn || 0;
    current.lastRequestAt = patch.at || current.lastRequestAt;
  }
  if (patch.method) current.methods[patch.method] = (current.methods[patch.method] || 0) + 1;
  if (patch.device) current.devices[patch.device] = (current.devices[patch.device] || 0) + 1;
  if (patch.response) {
    current.responses += 1;
    current.bytesOut += patch.bytesOut || 0;
    current.lastStatus = patch.status;
    current.lastSeenAt = patch.at;
    current.lastCacheStatus = patch.cacheStatus || 'unknown';
    current.lastSourceStatus = patch.sourceStatus || 'unknown';
    current.statusCounts[String(patch.status || 'unknown')] = (current.statusCounts[String(patch.status || 'unknown')] || 0) + 1;
    if (patch.cacheStatus && patch.cacheStatus !== 'unknown') current.cacheStatuses[patch.cacheStatus] = (current.cacheStatuses[patch.cacheStatus] || 0) + 1;
    if (patch.sourceStatus && patch.sourceStatus !== 'unknown') current.sourceStatuses[patch.sourceStatus] = (current.sourceStatuses[patch.sourceStatus] || 0) + 1;
    if (patch.status >= 400) current.errors += 1;
    if (patch.status >= 400 && patch.status < 500) current.clientErrors += 1;
    if (patch.status >= 500) current.serverErrors += 1;
    if (patch.latencyMs !== null && patch.latencyMs !== undefined) {
      current.latencyTotal += patch.latencyMs;
      current.latencyCount += 1;
      current.maxLatencyMs = Math.max(current.maxLatencyMs || 0, patch.latencyMs);
      current.latencySamples.push(patch.latencyMs);
      if (current.latencySamples.length > MAX_ROUTE_SAMPLES) current.latencySamples.splice(0, current.latencySamples.length - MAX_ROUTE_SAMPLES);
    }
  }
  state.routeDetails.set(route, current);
}

function inferCache(cacheStatus = '') {
  const v = String(cacheStatus || '').toLowerCase();
  return { hit: /hit/.test(v), miss: /miss/.test(v), stale: /stale/.test(v) };
}

function inferSource(sourceStatus = '', payload = {}) {
  const v = String(sourceStatus || '').toLowerCase();
  return {
    blocked: /blocked/.test(v),
    partial: /partial/.test(v) || payload?.partial || payload?.data?.partial,
    drift: /drift/.test(v) || payload?.sourceDrift?.sourceDrift || payload?.data?.sourceDrift?.sourceDrift,
  };
}

export function recordRequestStart(req, meta = {}) {
  if (!req) return undefined;
  if (req.__valoraeMetricsIgnored || shouldIgnoreMetrics(req, meta)) {
    recordInternalTelemetry(req, meta);
    req.__valoraeMetricsIgnored = true;
    req.__valoraeMetricsStarted = false;
    return undefined;
  }
  if (req.__valoraeMetricsStarted) {
    if (meta.route && req.__valoraeMetrics) req.__valoraeMetrics.route = normalizeRoutePath(meta.route);
    return req.__valoraeMetrics;
  }
  const startedAt = performance.now();
  const wallStartedAt = Date.now();
  const ua = String(req?.headers?.['user-agent'] || '').slice(0, 220);
  const route = normalizeRoutePath(meta.route || routeFromReq(req));
  const method = String(req?.method || 'GET').toUpperCase();
  const client = clientHash(req);
  const device = deviceFromUA(ua);
  const signal = querySignal(req);
  const metricsId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  req.__valoraeMetricsStarted = true;
  req.__valoraeMetricsId = metricsId;
  req.__valoraeMetrics = { id: metricsId, startedAt, wallStartedAt, route, method, client, device, ua, signal };
  state.activeRequests.set(metricsId, { id: metricsId, route, method, client, device, startedAt: wallStartedAt });
  const bytesIn = safeNumber(req?.headers?.['content-length'], 0);
  state.totals.requests += 1;
  state.totals.inFlight += 1;
  state.totals.bytesIn += bytesIn;
  if (bytesIn > 0) { state.bytesInSamples.push(bytesIn); if (state.bytesInSamples.length > 2000) state.bytesInSamples.splice(0, state.bytesInSamples.length - 2000); }
  if (method === 'OPTIONS') state.totals.optionsPreflight += 1;
  inc(state.methods, method);
  inc(state.routes, route);
  inc(state.devices, device);
  if (signal.ticker) inc(state.tickers, signal.ticker);
  if (signal.view) inc(state.views, signal.view);
  updateRouteDetail(route, { request: true, method, device, bytesIn, at: wallStartedAt });
  const b = touchBucket(wallStartedAt);
  b.requests += 1;
  b.bytesIn = (b.bytesIn || 0) + bytesIn;
  const c = state.clients.get(client) || { id: client, firstSeenAt: wallStartedAt, lastSeenAt: wallStartedAt, requests: 0, responses: 0, errors: 0, bytesOut: 0, device, lastRoute: route };
  c.requests += 1;
  c.lastSeenAt = wallStartedAt;
  c.device = device;
  c.lastRoute = route;
  state.clients.set(client, c);
  if (state.clients.size > MAX_CLIENTS) {
    const oldest = [...state.clients.entries()].sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)[0];
    if (oldest) state.clients.delete(oldest[0]);
  }
  compactMaps();
  return req.__valoraeMetrics;
}

export function recordResponse(req, res, payload, options = {}) {
  try {
    if (!req || req.__valoraeMetricsIgnored || shouldIgnoreMetrics(req, options) || req.__valoraeMetricsRecorded) return null;
    const started = req.__valoraeMetrics || recordRequestStart(req, { route: options.route || options.profile });
    req.__valoraeMetricsRecorded = true;
    const ts = Date.now();
    const latencyMs = started?.startedAt ? Math.max(0, Math.round(performance.now() - started.startedAt)) : null;
    const status = Number(options.status || res?.statusCode || 200);
    const route = normalizeRoutePath(options.route || started?.route || options.profile || routeFromReq(req));
    const method = started?.method || String(req?.method || 'GET').toUpperCase();
    const isProtocolBodyless = method === 'HEAD' || status === 204 || status === 304;
    const bodyBytes = options.responseBytes ?? res?.getHeader?.('X-Valorae-Response-Bytes') ?? res?.getHeader?.('Content-Length') ?? 0;
    const bytesOut = isProtocolBodyless ? 0 : safeNumber(bodyBytes, 0);
    const cacheStatus = String(options.cacheStatus || payload?.cacheStatus || payload?.cache?.status || res?.getHeader?.('X-Valorae-Cache') || 'unknown');
    const sourceStatus = String(options.sourceStatus || res?.getHeader?.('X-Valorae-Source-Status') || 'unknown');
    const family = statusFamily(status);
    const slowThreshold = Number(process.env.VALORAE_METRICS_SLOW_MS || 2500);
    const isSlow = latencyMs !== null && latencyMs >= slowThreshold;
    const event = {
      id: ++state.seq,
      at: nowIso(ts),
      route,
      method,
      status,
      family,
      latencyMs,
      slow: isSlow,
      aborted: Boolean(options.aborted),
      clientClosed: Boolean(options.clientClosed),
      bytesOut,
      cacheStatus,
      sourceStatus,
      interceptor: options.interceptor || 'sendJson',
      requestId: String(res?.getHeader?.('X-Request-Id') || payload?.requestId || '').slice(0, 96) || undefined,
      client: started?.client,
      device: started?.device || 'Outro',
      ticker: started?.signal?.ticker,
      view: started?.signal?.view,
      fieldsCount: started?.signal?.fieldsCount || 0,
      envelope: Boolean(started?.signal?.hasEnvelope),
    };
    state.totals.responses += 1;
    state.totals.inFlight = Math.max(0, state.totals.inFlight - 1);
    if (req.__valoraeMetricsId) state.activeRequests.delete(req.__valoraeMetricsId);
    if (status === 499 || options.aborted === true) state.totals.abortedResponses += 1;
    if (options.clientClosed === true) state.totals.clientClosed += 1;
    state.totals.bytesOut += bytesOut;
    if (bytesOut > 0) { state.bytesOutSamples.push(bytesOut); if (state.bytesOutSamples.length > 2000) state.bytesOutSamples.splice(0, state.bytesOutSamples.length - 2000); }
    if (event.interceptor === 'res.end') state.totals.interceptedByResEnd += 1;
    else state.totals.interceptedBySendJson += 1;
    if (method === 'HEAD') state.totals.headResponses += 1;
    if (isProtocolBodyless) state.totals.bodylessResponses += 1;
    if (status >= 200 && status < 400) state.totals.success += 1;
    if (status >= 300 && status < 400) state.totals.redirects += 1;
    if (status >= 400) state.totals.errors += 1;
    if (status >= 400 && status < 500) state.totals.clientErrors += 1;
    if (status >= 500) state.totals.serverErrors += 1;
    if (status === 429 || payload?.status === 'RATE_LIMITED') state.totals.rateLimited += 1;
    if (isSlow) state.totals.slowResponses += 1;
    const cache = inferCache(cacheStatus);
    if (cache.hit) state.totals.cacheHits += 1;
    if (cache.miss) state.totals.cacheMisses += 1;
    if (cache.stale) state.totals.cacheStale += 1;
    const src = inferSource(sourceStatus, payload);
    if (src.blocked) state.totals.blockedSources += 1;
    if (src.partial) state.totals.partialResponses += 1;
    if (src.drift) state.totals.driftSources += 1;
    inc(state.status, status);
    inc(state.statusFamily, family);
    if (cacheStatus && cacheStatus !== 'unknown') inc(state.cache, cacheStatus);
    if (sourceStatus && sourceStatus !== 'unknown') inc(state.source, sourceStatus);
    inc(state.interceptors, event.interceptor);
    if (latencyMs !== null) {
      state.latencies.push(latencyMs);
      if (state.latencies.length > 2000) state.latencies.splice(0, state.latencies.length - 2000);
    }
    const b = touchBucket(ts);
    b.responses += 1;
    if (status >= 200 && status < 400) b.success += 1;
    if (status >= 400) b.errors += 1;
    if (status >= 400 && status < 500) b.clientErrors += 1;
    if (status >= 500) b.serverErrors += 1;
    if (isSlow) b.slowResponses += 1;
    if (cache.hit) b.cacheHits += 1;
    if (cache.miss) b.cacheMisses += 1;
    b.bytesOut += bytesOut;
    if (latencyMs !== null) { b.latencyTotal += latencyMs; b.latencyCount += 1; }
    updateRouteDetail(route, { response: true, status, at: ts, bytesOut, latencyMs, cacheStatus, sourceStatus });
    const c = event.client ? state.clients.get(event.client) : null;
    if (c) {
      c.responses += 1;
      c.bytesOut += bytesOut;
      c.lastStatus = status;
      c.lastSeenAt = ts;
      c.lastRoute = route;
      if (status >= 400) c.errors += 1;
      state.clients.set(event.client, c);
    }
    state.events.push(event);
    if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
    return event;
  } catch {
    return null;
  }
}

export function attachProxyMetricsInterceptor(req, res, meta = {}) {
  const started = recordRequestStart(req, meta);
  if (!started || req.__valoraeMetricsIgnored || !res || res.__valoraeMetricsEndWrapped) return;
  const originalEnd = res.end;
  res.__valoraeMetricsEndWrapped = true;
  res.end = function patchedEnd(chunk, encoding, cb) {
    if (!req.__valoraeMetricsRecorded) {
      const enc = encoding && typeof encoding === 'string' ? encoding : 'utf8';
      const responseBytes = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk || ''), enc);
      recordResponse(req, res, undefined, { interceptor: 'res.end', responseBytes, route: meta.route });
    }
    return originalEnd.call(this, chunk, encoding, cb);
  };
  if (typeof res.once === 'function') {
    res.once('close', () => {
      if (req.__valoraeMetricsRecorded || req.__valoraeMetricsIgnored) return;
      const status = res.writableEnded ? safeNumber(res.statusCode, 200) : 499;
      recordResponse(req, res, { status: status === 499 ? 'CLIENT_CLOSED' : 'CLOSED' }, {
        interceptor: 'close',
        responseBytes: 0,
        route: meta.route,
        status,
        aborted: status === 499,
        clientClosed: status === 499,
        sourceStatus: status === 499 ? 'client_closed' : undefined,
      });
    });
  }
}

function summarizeWindow(minutes, now = Date.now()) {
  const from = now - minutes * 60_000;
  const buckets = [...state.buckets.values()].filter(b => b.t >= from);
  const responses = sum(buckets.map(b => b.responses));
  const errors = sum(buckets.map(b => b.errors));
  const requests = sum(buckets.map(b => b.requests));
  const latencyCount = sum(buckets.map(b => b.latencyCount));
  const latencyTotal = sum(buckets.map(b => b.latencyTotal));
  const bytesOut = sum(buckets.map(b => b.bytesOut));
  const bytesIn = sum(buckets.map(b => b.bytesIn));
  return {
    minutes, requests, responses, errors,
    requestsPerMinute: Math.round((requests / Math.max(1, minutes)) * 100) / 100,
    responsesPerMinute: Math.round((responses / Math.max(1, minutes)) * 100) / 100,
    errorRatePercent: responses ? Math.round((errors / responses) * 10000) / 100 : 0,
    avgLatencyMs: latencyCount ? Math.round(latencyTotal / latencyCount) : null,
    bytesIn, bytesOut,
  };
}

function summarizeRouteDetails(limit = 32) {
  return [...state.routeDetails.values()]
    .sort((a, b) => b.requests - a.requests)
    .slice(0, limit)
    .map(r => ({
      route: r.route,
      requests: r.requests,
      responses: r.responses,
      errors: r.errors,
      clientErrors: r.clientErrors,
      serverErrors: r.serverErrors,
      errorRatePercent: r.responses ? Math.round((r.errors / r.responses) * 10000) / 100 : 0,
      avgLatencyMs: r.latencyCount ? Math.round(r.latencyTotal / r.latencyCount) : null,
      successRatePercent: r.responses ? Math.round(((r.responses - r.errors) / r.responses) * 10000) / 100 : 100,
      avgBytesOut: r.responses ? Math.round(r.bytesOut / r.responses) : 0,
      avgBytesIn: r.requests ? Math.round((r.bytesIn || 0) / r.requests) : 0,
      completionRatePercent: r.requests ? Math.round((r.responses / r.requests) * 10000) / 100 : 0,
      p50LatencyMs: percentile(r.latencySamples || [], 50),
      p95LatencyMs: percentile(r.latencySamples || [], 95),
      p99LatencyMs: percentile(r.latencySamples || [], 99),
      maxLatencyMs: r.maxLatencyMs || null,
      bytesOut: r.bytesOut,
      bytesIn: r.bytesIn || 0,
      lastStatus: r.lastStatus,
      lastSeenAt: r.lastSeenAt ? nowIso(r.lastSeenAt) : null,
      lastCacheStatus: r.lastCacheStatus,
      lastSourceStatus: r.lastSourceStatus,
      topMethod: Object.entries(r.methods || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || 'GET',
      topDevice: Object.entries(r.devices || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Outro',
      statusCounts: Object.fromEntries(Object.entries(r.statusCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 8)),
      topCache: Object.entries(r.cacheStatuses || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      topSource: Object.entries(r.sourceStatuses || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    }));
}

function sloLabel(summary = {}) {
  const healthyAvailability = Number(summary.availabilityPercent ?? 100) >= SLO_AVAILABILITY_TARGET;
  const healthyLatency = !summary.p95LatencyMs || Number(summary.p95LatencyMs) <= SLO_P95_TARGET_MS;
  if (healthyAvailability && healthyLatency) return 'dentro_do_slo';
  if (!healthyAvailability && !healthyLatency) return 'risco_duplo';
  return healthyAvailability ? 'latência_em_atenção' : 'disponibilidade_em_atenção';
}

function buildOperations(summary, routeDetails, memory = {}) {
  const slowRoutes = [...routeDetails].filter(r => r.responses > 0).sort((a, b) => (b.p95LatencyMs || b.avgLatencyMs || 0) - (a.p95LatencyMs || a.avgLatencyMs || 0)).slice(0, 8);
  const errorRoutes = [...routeDetails].filter(r => r.responses > 0 && r.errors > 0).sort((a, b) => (b.errorRatePercent - a.errorRatePercent) || (b.errors - a.errors)).slice(0, 8);
  const payloadRoutes = [...routeDetails].filter(r => r.bytesOut > 0).sort((a, b) => (b.avgBytesOut || 0) - (a.avgBytesOut || 0)).slice(0, 8);
  const runbook = [];
  if (summary.requests === 0) runbook.push({ level: 'info', action: 'Gerar tráfego externo de teste', detail: 'Chame /api/health ou /api/asset?ticker=PETR4 para validar o fluxo real sem contar o painel.' });
  if (summary.inFlight > 0) runbook.push({ level: 'info', action: 'Acompanhar chamadas em voo', detail: `Há ${summary.inFlight} chamada(s) aberta(s). Se permanecer, verifique rotas lentas e fontes externas.` });
  if (summary.serverErrors > 0) runbook.push({ level: 'error', action: 'Investigar erros 5xx', detail: 'Priorize Eventos, Rotas com erro e fontes bloqueadas antes de alterar o app consumidor.' });
  if ((summary.p95LatencyMs || 0) > SLO_P95_TARGET_MS) runbook.push({ level: 'warn', action: 'Reduzir latência p95', detail: 'Aumente cache em rotas pesadas, reduza payloads e evite múltiplas chamadas sequenciais do APK.' });
  if ((summary.payloadP95BytesOut || 0) > 250000) runbook.push({ level: 'warn', action: 'Controlar payload', detail: 'Use fields, views resumidas ou endpoints específicos para não enviar JSON pesado ao mobile.' });
  if ((summary.sourceReliabilityScore || 100) < 82) runbook.push({ level: 'warn', action: 'Revisar fontes de dados', detail: 'Bloqueios, drift ou respostas parciais reduzem a confiabilidade do Proxy para apps consumidores.' });
  if ((summary.cacheEfficiencyScore || 100) < 70 && (summary.cacheHits + summary.cacheMisses) >= 6) runbook.push({ level: 'info', action: 'Aprimorar cache', detail: 'Padronize queries do APK/Web e use fields para aumentar reaproveitamento sem persistência paga.' });
  if (Number(memory.heapUsagePercent || 0) > 82) runbook.push({ level: 'warn', action: 'Monitorar memória heap', detail: 'A instância está com heap alto. Reduza amostras, payloads e evite chamadas em lote grandes.' });
  if (!runbook.length) runbook.push({ level: 'ok', action: 'Manter operação atual', detail: 'Sem ação crítica detectada nesta instância serverless.' });
  return { slowRoutes, errorRoutes, payloadRoutes, runbook: runbook.slice(0, 8) };
}

function generateReadiness(summary, routeDetails) {
  return [
    { name: 'Interceptação global /api', ok: summary.requests >= 0, detail: 'Rotas de dados em /api são medidas; /api/server/metrics e rotas operacionais são isoladas para não inflar os gráficos.' },
    { name: 'Telemetria interna isolada', ok: summary.telemetrySelfPollingIsolated === true, detail: `${summary.internalTelemetryRequests || 0} leitura(s) internas separadas dos contadores de tráfego real.` },
    { name: 'Medição sendJson', ok: summary.interceptedBySendJson >= 0, detail: `${summary.interceptedBySendJson} respostas JSON medidas.` },
    { name: 'Medição res.end', ok: summary.interceptedByResEnd >= 0, detail: `${summary.interceptedByResEnd} respostas diretas medidas.` },
    { name: 'Latência percentil', ok: summary.measuredLatencySamples > 0 || summary.requests === 0, detail: `${summary.measuredLatencySamples} amostras de latência.` },
    { name: 'Mapa de rotas', ok: routeDetails.length > 0 || summary.requests === 0, detail: `${routeDetails.length} rotas observadas na instância.` },
    { name: 'SLO de disponibilidade', ok: summary.availabilityPercent >= SLO_AVAILABILITY_TARGET || summary.responses === 0, detail: `${summary.availabilityPercent}% medido / alvo ${SLO_AVAILABILITY_TARGET}%.` },
    { name: 'Latência p95 dentro do alvo', ok: !summary.p95LatencyMs || summary.p95LatencyMs <= SLO_P95_TARGET_MS, detail: `p95 ${summary.p95LatencyMs ?? '—'}ms / alvo ${SLO_P95_TARGET_MS}ms.` },
    { name: 'Qualidade dos dados', ok: (summary.dataQualityScore || 100) >= 80, detail: `Score ${summary.dataQualityScore ?? 100}/100 considerando erro, fontes, cache e respostas parciais.` },
    { name: 'Carga da instância', ok: (summary.loadScore || 100) >= 75, detail: `Score ${summary.loadScore ?? 100}/100 com ${summary.inFlight} chamada(s) em voo.` },
    { name: 'Confiabilidade das fontes', ok: (summary.sourceReliabilityScore || 100) >= 80, detail: `Score ${summary.sourceReliabilityScore ?? 100}/100 considerando bloqueios, drift e respostas parciais.` },
    { name: 'Eficiência de cache', ok: (summary.cacheEfficiencyScore || 100) >= 70 || (summary.cacheHits + summary.cacheMisses) === 0, detail: `Score ${summary.cacheEfficiencyScore ?? 100}/100; unknown é filtrado dos gráficos.` },
    { name: 'Integridade do painel', ok: (summary.dashboardIntegrityScore || 100) >= 99, detail: `Score ${summary.dashboardIntegrityScore ?? 100}/100; polling interno separado dos totais reais.` },
    { name: 'Compatível com Vercel gratuito', ok: true, detail: 'Sem banco externo, Redis, KV, WebSocket ou cron obrigatório.' },
  ];
}

function generateInsights(summary, routeDetails, recent) {
  const items = [];
  if (summary.requests === 0) items.push({ level: 'info', title: 'Aguardando tráfego real', description: 'Faça chamadas para /api/asset, /api/portfolio/analyze ou outros endpoints para popular os gráficos.' });
  if (summary.inFlight > 0) items.push({ level: 'info', title: 'Chamadas em andamento', description: `${summary.inFlight} solicitação(ões) ainda não finalizaram nesta instância.` });
  if (summary.errorRatePercent >= 10) items.push({ level: 'error', title: 'Taxa de erro alta', description: `A taxa de erro está em ${summary.errorRatePercent}%. Verifique a página Eventos e as rotas com maior erro.` });
  else if (summary.errorRatePercent >= 3) items.push({ level: 'warn', title: 'Erros acima do ideal', description: `A taxa de erro está em ${summary.errorRatePercent}%. Isso pode ser normal em 404/429, mas merece acompanhamento.` });
  if ((summary.p95LatencyMs || 0) >= 2500) items.push({ level: 'warn', title: 'Latência p95 elevada', description: `p95 atual de ${summary.p95LatencyMs}ms. Fontes externas ou rotas de carteira podem estar mais lentas.` });
  if (summary.cacheHitRatePercent < 20 && (summary.cacheHits + summary.cacheMisses) >= 10) items.push({ level: 'warn', title: 'Cache pouco aproveitado', description: `Hit rate em ${summary.cacheHitRatePercent}%. Rotas muito variáveis podem estar reduzindo reaproveitamento.` });
  if (summary.partialResponses > 0) items.push({ level: 'warn', title: 'Respostas parciais detectadas', description: `${summary.partialResponses} resposta(s) parciais foram registradas.` });
  if (summary.blockedSources > 0) items.push({ level: 'warn', title: 'Fonte bloqueada', description: `${summary.blockedSources} ocorrência(s) com fonte bloqueada foram detectadas.` });
  const noisyRoute = routeDetails.find(r => r.errorRatePercent >= 20 && r.responses >= 3);
  if (noisyRoute) items.push({ level: 'error', title: 'Rota crítica', description: `${noisyRoute.route} tem ${noisyRoute.errorRatePercent}% de erro em ${noisyRoute.responses} respostas.` });
  if (summary.quietForSeconds >= 300 && summary.requests > 0) items.push({ level: 'info', title: 'Servidor sem tráfego externo recente', description: `Último evento real há ${summary.quietForSeconds}s. O painel pode continuar aberto sem inflar os contadores.` });
  if (summary.errorBudgetUsedPercent >= 70 && summary.responses >= 10) items.push({ level: 'warn', title: 'Orçamento de erro consumido', description: `${summary.errorBudgetUsedPercent}% do orçamento SLO foi consumido nesta instância.` });
  if ((summary.dataQualityScore || 100) < 80) items.push({ level: 'warn', title: 'Qualidade dos dados abaixo do ideal', description: `Score de qualidade em ${summary.dataQualityScore}/100. Confira respostas parciais, fontes bloqueadas e drift.` });
  if ((summary.loadScore || 100) < 75) items.push({ level: 'warn', title: 'Carga operacional elevada', description: `Score de carga em ${summary.loadScore}/100. Revise latência p95, chamadas em voo e rotas mais lentas.` });
  if ((summary.sourceReliabilityScore || 100) < 82) items.push({ level: 'warn', title: 'Confiabilidade de fonte abaixo do ideal', description: `Score de fonte em ${summary.sourceReliabilityScore}/100. Revise bloqueios, drift e respostas parciais.` });
  if ((summary.cacheEfficiencyScore || 100) < 70 && (summary.cacheHits + summary.cacheMisses) >= 6) items.push({ level: 'info', title: 'Cache com oportunidade de melhoria', description: `Score de cache em ${summary.cacheEfficiencyScore}/100. Ajuste TTLs, fields e rotas de consulta repetitiva.` });
  if (summary.trafficState === 'sem_trafego_real') items.push({ level: 'info', title: 'Painel pronto, aguardando consumidores', description: 'O servidor está aberto, mas nenhum app externo gerou tráfego real nesta instância.' });
  const slowRoute = routeDetails.find(r => (r.p95LatencyMs || 0) > SLO_P95_TARGET_MS && r.responses >= 3);
  if (slowRoute) items.push({ level: 'warn', title: 'Rota lenta detectada', description: `${slowRoute.route} está com p95 de ${slowRoute.p95LatencyMs}ms.` });
  const resEndCount = recent.filter(e => e.interceptor === 'res.end').length;
  if (resEndCount > 0) items.push({ level: 'info', title: 'Intercepção profunda ativa', description: `${resEndCount} resposta(s) recentes foram capturadas diretamente no res.end.` });
  if (!items.length) items.push({ level: 'ok', title: 'Operação saudável', description: 'Sem anomalias relevantes no intervalo recente da instância atual.' });
  return items.slice(0, 8);
}

export function getServerMetricsSnapshot() {
  const now = Date.now();
  const staleActiveMs = Number(process.env.VALORAE_METRICS_STALE_ACTIVE_MS || 120000);
  for (const [id, active] of [...state.activeRequests.entries()]) {
    if (now - Number(active.startedAt || now) > staleActiveMs) {
      state.activeRequests.delete(id);
      state.totals.inFlight = Math.max(0, state.totals.inFlight - 1);
      state.totals.abortedResponses += 1;
      state.totals.staleActiveCleanups += 1;
    }
  }
  const latencies = state.latencies;
  const recent = state.events.filter(e => Date.parse(e.at) >= now - 5 * 60_000);
  const uniqueRecentClients = new Set(recent.map(e => e.client).filter(Boolean));
  const recent1m = state.events.filter(e => Date.parse(e.at) >= now - 60_000);
  const recent15m = state.events.filter(e => Date.parse(e.at) >= now - 15 * 60_000);
  const uniqueRecentClients1m = new Set(recent1m.map(e => e.client).filter(Boolean));
  const uniqueRecentClients15m = new Set(recent15m.map(e => e.client).filter(Boolean));
  const lastEventTs = state.events.length ? Date.parse(state.events[state.events.length - 1].at) : null;
  const uptimeSeconds = Math.max(1, secondsBetween(state.bootedAt, now));
  const totalResponses = state.totals.responses || 1;
  const errorRate = Math.round((state.totals.errors / totalResponses) * 10000) / 100;
  const successRate = Math.round((state.totals.success / totalResponses) * 10000) / 100;
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const avgLatencyMs = avg(latencies);
  const cacheTotal = state.totals.cacheHits + state.totals.cacheMisses;
  const cacheHitRatePercent = cacheTotal ? Math.round((state.totals.cacheHits / cacheTotal) * 10000) / 100 : 0;
  const avgBytesOut = state.totals.responses ? Math.round(state.totals.bytesOut / state.totals.responses) : 0;
  const avgBytesIn = state.totals.requests ? Math.round(state.totals.bytesIn / state.totals.requests) : 0;
  const slowRatePercent = state.totals.responses ? Math.round((state.totals.slowResponses / state.totals.responses) * 10000) / 100 : 0;
  const payloadP95BytesOut = percentile(state.bytesOutSamples, 95) || 0;
  const payloadP99BytesOut = percentile(state.bytesOutSamples, 99) || 0;
  const payloadMaxBytesOut = state.bytesOutSamples.length ? Math.max(...state.bytesOutSamples) : 0;
  const apdexSatisfied = latencies.filter(x => x <= 1000).length;
  const apdexTolerating = latencies.filter(x => x > 1000 && x <= 4000).length;
  const apdexScore = latencies.length ? Math.round(((apdexSatisfied + apdexTolerating / 2) / latencies.length) * 100) : 100;
  const healthScore = Math.max(0, Math.min(100, Math.round(
    100 - errorRate * 2.2 - Math.max(0, (p95 || 0) - 2000) / 90 - Math.max(0, state.totals.inFlight - 40) - slowRatePercent * 0.6
  )));
  const availabilityPercent = state.totals.responses ? Math.round(((state.totals.responses - state.totals.serverErrors) / state.totals.responses) * 10000) / 100 : 100;
  const errorBudgetUsedPercent = state.totals.responses ? clamp(Math.round((Math.max(0, 100 - availabilityPercent) / SLO_ERROR_BUDGET_PERCENT) * 10000) / 100, 0, 999) : 0;
  const completionRatePercent = state.totals.requests ? Math.round((state.totals.responses / state.totals.requests) * 10000) / 100 : 0;
  const dataQualityScore = state.totals.responses ? scoreClamp(100 - qualityPenalty({
    errorRatePercent: errorRate, slowRatePercent, partialResponses: state.totals.partialResponses,
    blockedSources: state.totals.blockedSources, driftSources: state.totals.driftSources, cacheHitRatePercent,
  })) : 100;
  const loadScore = state.totals.requests ? scoreClamp(100 - Math.max(0, state.totals.inFlight - 6) * 4 - Math.max(0, (p95 || 0) - SLO_P95_TARGET_MS) / 75 - slowRatePercent * 0.6) : 100;
  const contractScore = state.totals.responses ? scoreClamp(100 - state.totals.clientErrors * 1.2 - state.totals.partialResponses * 3 - state.totals.driftSources * 4) : 100;
  const cacheEfficiencyScore = cacheTotal ? scoreClamp(cacheHitRatePercent * 0.75 + Math.max(0, 100 - state.totals.cacheStale * 3) * 0.25) : 100;
  const sourceReliabilityScore = state.totals.responses ? scoreClamp(100 - state.totals.blockedSources * 7 - state.totals.partialResponses * 3.5 - state.totals.driftSources * 5 - errorRate * 1.2) : 100;
  const routeCoverageScore = state.routes.size ? scoreClamp(Math.min(100, 55 + state.routes.size * 6)) : 100;
  const dashboardIntegrityScore = scoreClamp(100 - Math.max(0, (state.status.get('/api/server/metrics') || 0)) * 100);
  const trafficState = trafficStateLabel({ requests: state.totals.requests, recentRequests: recent.length, errorRatePercent: errorRate, p95LatencyMs: p95, inFlight: state.totals.inFlight });
  const latencyHistogram = histogram(latencies, [['0-250ms',0,250],['250-500ms',250,500],['500ms-1s',500,1000],['1-2.5s',1000,2500],['2.5-4s',2500,4000],['>4s',4000,null]]);
  const payloadHistogram = histogram(state.bytesOutSamples, [['0-5KB',0,5_120],['5-25KB',5_120,25_600],['25-100KB',25_600,102_400],['100-500KB',102_400,512_000],['>500KB',512_000,null]]);
  const windows = { oneMinute: summarizeWindow(1, now), fiveMinutes: summarizeWindow(5, now), fifteenMinutes: summarizeWindow(15, now) };
  const mem = process.memoryUsage();
  const memoryRssMb = round2(mem.rss / 1048576);
  const heapUsedMb = round2(mem.heapUsed / 1048576);
  const heapTotalMb = round2(mem.heapTotal / 1048576);
  const heapUsagePercent = mem.heapTotal ? round2((mem.heapUsed / mem.heapTotal) * 100) : 0;
  const activeAges = [...state.activeRequests.values()].map(a => ({ ...a, ageMs: Math.max(0, now - Number(a.startedAt || now)) }));
  const oldestActive = activeAges.sort((a, b) => b.ageMs - a.ageMs)[0] || null;
  const runtimePressureScore = scoreClamp(100 - Math.max(0, heapUsagePercent - 70) * 1.7 - Math.max(0, state.totals.inFlight - 8) * 3 - Math.max(0, (oldestActive?.ageMs || 0) - 30000) / 1000);
  const anomalies = [
    { name: '5xx', value: state.totals.serverErrors, severity: state.totals.serverErrors ? 'error' : 'ok' },
    { name: '4xx', value: state.totals.clientErrors, severity: state.totals.clientErrors ? 'warn' : 'ok' },
    { name: 'lentas', value: state.totals.slowResponses, severity: state.totals.slowResponses ? 'warn' : 'ok' },
    { name: 'parciais', value: state.totals.partialResponses, severity: state.totals.partialResponses ? 'warn' : 'ok' },
    { name: 'bloqueios', value: state.totals.blockedSources, severity: state.totals.blockedSources ? 'error' : 'ok' },
    { name: 'drift', value: state.totals.driftSources, severity: state.totals.driftSources ? 'warn' : 'ok' },
    { name: '499', value: state.totals.clientClosed, severity: state.totals.clientClosed ? 'warn' : 'ok' },
  ];
  const buckets = [...state.buckets.values()].sort((a, b) => a.t - b.t).map(b => ({
    at: nowIso(b.t),
    requests: b.requests,
    responses: b.responses,
    success: b.success,
    errors: b.errors,
    clientErrors: b.clientErrors,
    serverErrors: b.serverErrors,
    slowResponses: b.slowResponses,
    cacheHits: b.cacheHits,
    cacheMisses: b.cacheMisses,
    bytesOut: b.bytesOut,
    avgLatencyMs: b.latencyCount ? Math.round(b.latencyTotal / b.latencyCount) : null,
  }));
  const routeDetails = summarizeRouteDetails();
  const summary = {
    ...state.totals,
    activeClients1m: uniqueRecentClients1m.size,
    activeClients5m: uniqueRecentClients.size,
    activeClients15m: uniqueRecentClients15m.size,
    lastExternalEventAt: lastEventTs ? nowIso(lastEventTs) : null,
    quietForSeconds: lastEventTs ? secondsBetween(lastEventTs, now) : uptimeSeconds,
    requestsPerMinute5m: ratePerMinute(recent.length, 300),
    responsesPerMinuteInstance: ratePerMinute(state.totals.responses, uptimeSeconds),
    avgLatencyMs,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: p95,
    p99LatencyMs: p99,
    maxLatencyMs: latencies.length ? Math.max(...latencies) : null,
    errorRatePercent: errorRate,
    successRatePercent: successRate,
    cacheHitRatePercent,
    avgBytesOut,
    avgBytesIn,
    bytesIn: state.totals.bytesIn,
    availabilityPercent,
    sloAvailabilityTargetPercent: SLO_AVAILABILITY_TARGET,
    sloP95TargetMs: SLO_P95_TARGET_MS,
    errorBudgetPercent: SLO_ERROR_BUDGET_PERCENT,
    errorBudgetUsedPercent,
    errorBudgetRemainingPercent: clamp(100 - errorBudgetUsedPercent, 0, 100),
    sloStatus: sloLabel({ availabilityPercent, p95LatencyMs: p95 }),
    completionRatePercent,
    slowRatePercent,
    apdexScore,
    healthScore,
    dataQualityScore,
    contractScore,
    loadScore,
    operationalState: stateLabel(Math.min(healthScore, dataQualityScore, loadScore, sourceReliabilityScore)),
    trafficState,
    cacheEfficiencyScore,
    sourceReliabilityScore,
    routeCoverageScore,
    dashboardIntegrityScore,
    payloadP95BytesOut,
    payloadP99BytesOut,
    payloadMaxBytesOut,
    requestsPerMinute1m: windows.oneMinute.requestsPerMinute,
    requestsPerMinute15m: windows.fifteenMinutes.requestsPerMinute,
    responsesPerMinute1m: windows.oneMinute.responsesPerMinute,
    responsesPerMinute15m: windows.fifteenMinutes.responsesPerMinute,
    bytesOutPerMinute5m: Math.round((windows.fiveMinutes.bytesOut / 5) * 100) / 100,
    measuredLatencySamples: latencies.length,
    activeRequestsTracked: state.activeRequests.size,
    telemetrySelfPollingIsolated: true,
    internalTelemetryRequests: state.internalTelemetry.requests || 0,
    internalTelemetryLastAt: state.internalTelemetry.lastAt ? nowIso(state.internalTelemetry.lastAt) : null,
    cacheUnknownFiltered: true,
    externalTrafficObserved: state.totals.requests > 0,
    eventsStored: state.events.length,
    bucketsStored: state.buckets.size,
    routesTracked: state.routes.size,
    clientsTracked: state.clients.size,
    requestsTrend1mVs15mPercent: deltaPercent(windows.oneMinute.requestsPerMinute, windows.fifteenMinutes.requestsPerMinute),
    responsesTrend1mVs15mPercent: deltaPercent(windows.oneMinute.responsesPerMinute, windows.fifteenMinutes.responsesPerMinute),
    errorTrend1mVs15mPercent: deltaPercent(windows.oneMinute.errorRatePercent, windows.fifteenMinutes.errorRatePercent),
    memoryRssMb,
    heapUsedMb,
    heapTotalMb,
    heapUsagePercent,
    runtimePressureScore,
    activeRequestMaxAgeMs: oldestActive?.ageMs || 0,
    oldestActiveRoute: oldestActive?.route || null,
  };
  return {
    ok: true,
    name: 'Valorae Proxy Server Metrics',
    version: VALORAE_SERVER_METRICS_VERSION,
    generatedAt: nowIso(now),
    serverless: {
      mode: 'memory-observability',
      persistent: false,
      realtimeTransport: 'http-polling',
      pollingHintMs: 2500,
      internalTelemetryRoutes: [...INTERNAL_TELEMETRY_ROUTES],
      note: 'Métricas reais em memória por instância serverless. O endpoint /api/server/metrics é isolado: o polling do painel não entra em requisições, respostas, status, eventos, cache ou rotas. Campos unknown de cache/fonte são filtrados dos gráficos.',
    },
    instance: {
      id: state.instanceId,
      bootedAt: nowIso(state.bootedAt),
      uptimeSeconds,
      node: process.version,
      platform: process.platform,
      pid: process.pid,
      memory: mem,
    },
    summary,
    distributions: {
      status: topMap(state.status, 16),
      statusFamily: topMap(state.statusFamily, 8),
      methods: topMap(state.methods, 10),
      routes: topMap(state.routes, 32),
      cache: topMap(state.cache, 12),
      source: topMap(state.source, 12),
      devices: topMap(state.devices, 10),
      tickers: topMap(state.tickers, 24),
      views: topMap(state.views, 14),
      interceptors: topMap(state.interceptors, 8),
      internalTelemetry: topMap(state.internalTelemetry.routes, 8),
    },
    operations: buildOperations(summary, routeDetails, { heapUsagePercent }),
    routeDetails,
    insights: generateInsights(summary, routeDetails, recent),
    readiness: generateReadiness(summary, routeDetails),
    windows,
    histograms: { latency: latencyHistogram, payloadBytesOut: payloadHistogram },
    anomalies,
    timeSeries: buckets,
    recentEvents: state.events.slice(-140).reverse().map(({ client, ...safe }) => safe),
    clientSample: [...state.clients.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, 32).map(c => ({
      id: c.id,
      device: c.device,
      requests: c.requests,
      responses: c.responses,
      errors: c.errors,
      bytesOut: c.bytesOut,
      lastRoute: c.lastRoute,
      lastStatus: c.lastStatus,
      firstSeenAt: nowIso(c.firstSeenAt),
      lastSeenAt: nowIso(c.lastSeenAt),
    })),
  };
}

export function resetServerMetricsForTests() {
  state.seq = 0;
  state.totals = emptyTotals();
  state.status.clear(); state.statusFamily.clear(); state.methods.clear(); state.routes.clear(); state.routeDetails.clear(); state.cache.clear(); state.source.clear(); state.devices.clear(); state.tickers.clear(); state.views.clear(); state.clients.clear(); state.interceptors.clear(); state.buckets.clear();
  state.latencies = []; state.bytesOutSamples = []; state.bytesInSamples = []; state.events = []; state.activeRequests.clear(); state.internalTelemetry = { requests: 0, lastAt: null, routes: new Map() };
}

export const _test = { normalizeRoutePath, isInternalTelemetryRoute, shouldIgnoreMetrics };
