import os from 'node:os';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { getClientIp } from '../security/guard.js';

export const OBSERVABILITY_VERSION = '21.5.13-pages-theme-real-metrics-free';

const OBSERVED = Symbol.for('valorae.proxy.observability.observed');
const FINISHED = Symbol.for('valorae.proxy.observability.finished');
const MAX_LATENCIES = 5000;
const MAX_PATH_LATENCIES = 180;
const MAX_EVENTS = 180;
const MAX_MINUTE_BUCKETS = 10080;
const TOP_LIMIT_INTERNAL = 80;
const startedAt = Date.now();

const state = {
  startedAt,
  totalRequests: 0,
  completedRequests: 0,
  totalErrors: 0,
  activeRequests: 0,
  inboundBytes: 0,
  outboundBytes: 0,
  blockedRequests: 0,
  suspiciousRequests: 0,
  rateLimitBlocks: 0,
  timeouts: 0,
  retries: 0,
  circuitBreakerOpen: 0,
  latencies: [],
  minuteBuckets: new Map(),
  status: new Map(),
  statusClass: new Map(),
  methods: new Map(),
  protocols: new Map(),
  paths: new Map(),
  origins: new Map(),
  clients: new Map(),
  userAgents: new Map(),
  ips: new Map(),
  auth: new Map(),
  cache: new Map(),
  payloadInBuckets: new Map(),
  payloadOutBuckets: new Map(),
  events: [],
  observabilityReads: 0,
  serverOpenSockets: 0,
  serverOpenSocketsMeasured: false,
  serverConnectionsTotal: 0,
  lastEventLoopLagMs: 0,
  lastRequestAt: null,
};

let lastLoopTick = performance.now();
const loopTimer = setInterval(() => {
  const now = performance.now();
  state.lastEventLoopLagMs = Math.max(0, Math.round(now - lastLoopTick - 1000));
  lastLoopTick = now;
}, 1000);
loopTimer.unref?.();

function inc(map, key, by = 1) {
  const safeKey = String(key || 'unknown').slice(0, 140);
  map.set(safeKey, (map.get(safeKey) || 0) + by);
}

function boundedPush(arr, value, limit) {
  arr.push(value);
  if (arr.length > limit) arr.splice(0, arr.length - limit);
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[index]);
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function top(map, limit = 8) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }));
}

function hashShort(value = '') {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 10);
}

function normalizePath(value = '') {
  try {
    const parsed = new URL(String(value || '/api'), 'https://valorae.local');
    return parsed.pathname.replace(/\/+$|^$/g, '') || '/';
  } catch {
    return String(value || '/').split('?')[0].replace(/\/+$|^$/g, '') || '/';
  }
}

function safeRouteLabel(req, context = {}) {
  const path = context.path || normalizePath(req?.url || '/api');
  if (path === '/') return '/api';
  if (path.startsWith('/api')) return path;
  return `/api${path}`.replace(/\/+/g, '/');
}

function clientLabel(req) {
  const headers = req?.headers || {};
  const explicit = headers['x-valorae-client-id'] || headers['x-client-id'] || headers['x-app-id'] || headers['x-api-client'];
  if (explicit) return String(explicit).slice(0, 64);
  try {
    const parsed = new URL(req?.url || '/api', 'https://valorae.local');
    const queryClient = parsed.searchParams.get('client') || parsed.searchParams.get('clientId') || parsed.searchParams.get('app');
    if (queryClient) return String(queryClient).slice(0, 64);
  } catch {}
  const origin = headers.origin;
  if (origin) {
    try { return new URL(String(origin)).hostname.slice(0, 64); } catch {}
  }
  return 'public-client';
}

function originLabel(req) {
  const origin = String(req?.headers?.origin || '').trim();
  if (!origin) return 'sem origem';
  try { return new URL(origin).origin; } catch { return 'origem inválida'; }
}

function protocolLabel(req) {
  const proto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toUpperCase();
  if (proto === 'HTTPS') return `HTTPS / HTTP/${req?.httpVersion || '1.1'}`;
  if (proto === 'HTTP') return `HTTP / HTTP/${req?.httpVersion || '1.1'}`;
  return `HTTP/${req?.httpVersion || '1.1'}`;
}

function userAgentLabel(req) {
  const ua = String(req?.headers?.['user-agent'] || 'unknown').slice(0, 160);
  if (/okhttp/i.test(ua)) return 'okhttp / Android';
  if (/dalvik/i.test(ua)) return 'Dalvik / Android';
  if (/curl/i.test(ua)) return 'curl';
  if (/postman/i.test(ua)) return 'Postman';
  if (/mozilla/i.test(ua)) return 'Browser / Mozilla';
  if (/node/i.test(ua)) return 'Node.js client';
  return ua || 'unknown';
}

function statusClass(status) {
  const n = Number(status || 0);
  if (n >= 500) return '5xx';
  if (n >= 400) return '4xx';
  if (n >= 300) return '3xx';
  if (n >= 200) return '2xx';
  return '0xx';
}

function payloadBucket(bytes) {
  const n = Number(bytes || 0);
  if (n <= 1024) return '0 – 1 KB';
  if (n <= 10 * 1024) return '1 KB – 10 KB';
  if (n <= 100 * 1024) return '10 KB – 100 KB';
  if (n <= 1024 * 1024) return '100 KB – 1 MB';
  return '> 1 MB';
}

function inferCache(res, status) {
  const header = String(res?.getHeader?.('X-Valorae-Cache') || res?.getHeader?.('x-valorae-cache') || '').toLowerCase();
  const cacheControl = String(res?.getHeader?.('Cache-Control') || '').toLowerCase();
  if (Number(status) === 304 || /hit|fresh|stale/.test(header)) return 'hit';
  if (/miss/.test(header)) return 'miss';
  if (/bypass|no-store|no-cache/.test(header) || cacheControl.includes('no-store')) return 'bypass';
  return 'miss';
}

function inferAuth(req, status) {
  const hasAuth = Boolean(req?.headers?.authorization || req?.headers?.['x-valorae-admin-token'] || req?.headers?.['x-api-key']);
  if (!hasAuth) return 'sem token';
  if (Number(status) === 401 || Number(status) === 403) return 'inválida';
  return 'válida';
}

function minuteBucket(ts = Date.now()) {
  const key = Math.floor(ts / 60000) * 60000;
  let bucket = state.minuteBuckets.get(key);
  if (!bucket) {
    bucket = { t: key, requests: 0, errors: 0, latencyMs: [], inboundBytes: 0, outboundBytes: 0, activePeak: 0 };
    state.minuteBuckets.set(key, bucket);
    if (state.minuteBuckets.size > MAX_MINUTE_BUCKETS) {
      const oldest = [...state.minuteBuckets.keys()].sort((a, b) => a - b).slice(0, state.minuteBuckets.size - MAX_MINUTE_BUCKETS);
      for (const old of oldest) state.minuteBuckets.delete(old);
    }
  }
  return bucket;
}

function updatePathStats(route, status, method, latencyMs, inboundBytes, outboundBytes) {
  const key = String(route || '/api').slice(0, 180);
  let item = state.paths.get(key);
  if (!item) item = { requests: 0, errors: 0, latencySum: 0, inboundBytes: 0, outboundBytes: 0, lastActivityAt: null, methods: new Map(), statuses: new Map(), latencies: [] };
  item.requests += 1;
  if (Number(status) >= 400) item.errors += 1;
  item.latencySum += latencyMs;
  item.inboundBytes += inboundBytes;
  item.outboundBytes += outboundBytes;
  item.lastActivityAt = new Date().toISOString();
  inc(item.methods, method);
  inc(item.statuses, status);
  boundedPush(item.latencies, latencyMs, MAX_PATH_LATENCIES);
  state.paths.set(key, item);
  if (state.paths.size > TOP_LIMIT_INTERNAL) {
    const keep = [...state.paths.entries()].sort((a, b) => b[1].requests - a[1].requests).slice(0, TOP_LIMIT_INTERNAL);
    state.paths = new Map(keep);
  }
}

function updateClientStats(client, status, latencyMs, outboundBytes) {
  const key = String(client || 'public-client').slice(0, 120);
  let item = state.clients.get(key);
  if (!item) item = { requests: 0, errors: 0, latencySum: 0, outboundBytes: 0, lastActivityAt: null, lastStatus: 0, limit: 'global' };
  item.requests += 1;
  if (Number(status) >= 400) item.errors += 1;
  item.latencySum += latencyMs;
  item.outboundBytes += outboundBytes;
  item.lastActivityAt = new Date().toISOString();
  item.lastStatus = Number(status || 0);
  state.clients.set(key, item);
}

function isInternalObservability(context = {}) {
  const path = String(context.path || '').replace(/^\/api/, '') || '/';
  return path === '/observability' || path === '/api/observability';
}

function addEvent(evt) {
  state.events.unshift({
    time: new Date().toISOString(),
    level: evt.level,
    event: evt.event,
    route: evt.route,
    method: evt.method,
    status: evt.status,
    latencyMs: evt.latencyMs,
    bytes: evt.bytes,
    client: evt.client,
    message: evt.message,
  });
  if (state.events.length > MAX_EVENTS) state.events.length = MAX_EVENTS;
}

function observeFinish(req, res, context, meta) {
  if (res[FINISHED]) return;
  res[FINISHED] = true;
  const latencyMs = Math.max(0, Math.round(performance.now() - meta.start));
  const status = Number(res.statusCode || 0);
  const method = String(req?.method || 'GET').toUpperCase();
  const route = safeRouteLabel(req, context);
  const inboundBytes = Number(req?.headers?.['content-length'] || Buffer.byteLength(String(req?.rawBody || ''), 'utf8') || 0);
  const outboundBytes = Number(meta.outboundBytes || res?.getHeader?.('Content-Length') || res?.getHeader?.('content-length') || 0);
  const client = clientLabel(req);
  const cls = statusClass(status);

  state.completedRequests += 1;
  state.activeRequests = Math.max(0, state.activeRequests - 1);
  state.inboundBytes += inboundBytes;
  state.outboundBytes += outboundBytes;
  state.lastRequestAt = new Date().toISOString();
  if (status >= 400) state.totalErrors += 1;
  if ([401, 403, 429].includes(status)) state.blockedRequests += 1;
  if (status === 429) state.rateLimitBlocks += 1;
  if ([408, 504].includes(status)) state.timeouts += 1;
  if (status >= 400 && status < 500 && status !== 404) state.suspiciousRequests += 1;

  boundedPush(state.latencies, latencyMs, MAX_LATENCIES);
  inc(state.status, status || '0');
  inc(state.statusClass, cls);
  inc(state.methods, method);
  inc(state.protocols, protocolLabel(req));
  inc(state.origins, originLabel(req));
  inc(state.userAgents, userAgentLabel(req));
  inc(state.ips, `ip-${hashShort(getClientIp(req))}`);
  inc(state.auth, inferAuth(req, status));
  inc(state.cache, inferCache(res, status));
  inc(state.payloadInBuckets, payloadBucket(inboundBytes));
  inc(state.payloadOutBuckets, payloadBucket(outboundBytes));

  const bucket = minuteBucket();
  bucket.requests += 1;
  if (status >= 400) bucket.errors += 1;
  bucket.inboundBytes += inboundBytes;
  bucket.outboundBytes += outboundBytes;
  bucket.activePeak = Math.max(bucket.activePeak, meta.activeAtStart || state.activeRequests);
  boundedPush(bucket.latencyMs, latencyMs, 240);

  updatePathStats(route, status, method, latencyMs, inboundBytes, outboundBytes);
  updateClientStats(client, status, latencyMs, outboundBytes);

  const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
  addEvent({
    level,
    event: status === 429 ? 'Rate limit' : status >= 500 ? 'Upstream/Proxy error' : 'Request',
    route,
    method,
    status,
    latencyMs,
    bytes: outboundBytes,
    client,
    message: `${method} ${route} ${status || '-'} ${latencyMs}ms ${formatBytes(outboundBytes)}`,
  });
}

export function observeProxyRequest(req, res, context = {}) {
  if (!req || !res || res[OBSERVED]) return;
  if (isInternalObservability(context)) {
    state.observabilityReads += 1;
    return;
  }
  res[OBSERVED] = true;
  state.totalRequests += 1;
  state.activeRequests += 1;
  state.lastRequestAt = new Date().toISOString();
  const meta = { start: performance.now(), outboundBytes: 0, activeAtStart: state.activeRequests };
  const originalWrite = res.write?.bind(res);
  const originalEnd = res.end?.bind(res);

  if (originalWrite) {
    res.write = function observedWrite(chunk, encoding, cb) {
      if (chunk) meta.outboundBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk), typeof encoding === 'string' ? encoding : 'utf8');
      return originalWrite(chunk, encoding, cb);
    };
  }
  if (originalEnd) {
    res.end = function observedEnd(chunk, encoding, cb) {
      if (chunk) meta.outboundBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk), typeof encoding === 'string' ? encoding : 'utf8');
      observeFinish(req, res, context, meta);
      return originalEnd(chunk, encoding, cb);
    };
  }
  res.once?.('finish', () => observeFinish(req, res, context, meta));
  res.once?.('close', () => observeFinish(req, res, context, meta));
}

export function observeServerSocketState(openSockets = 0, connectionDelta = 0) {
  state.serverOpenSockets = Math.max(0, Number(openSockets || 0));
  state.serverConnectionsTotal += Math.max(0, Number(connectionDelta || 0));
  state.serverOpenSocketsMeasured = true;
}

function bucketSeries(minutes = 60) {
  const now = Math.floor(Date.now() / 60000) * 60000;
  const count = Math.max(5, Math.min(10080, Number(minutes || 60)));
  const rows = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const t = now - i * 60000;
    const b = state.minuteBuckets.get(t) || { t, requests: 0, errors: 0, latencyMs: [], inboundBytes: 0, outboundBytes: 0, activePeak: 0 };
    rows.push({
      t: new Date(t).toISOString(),
      label: new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      requests: b.requests,
      errors: b.errors,
      errorRate: b.requests ? Number(((b.errors / b.requests) * 100).toFixed(2)) : 0,
      latencyAvgMs: average(b.latencyMs),
      latencyP95Ms: percentile(b.latencyMs, 95),
      latencyP99Ms: percentile(b.latencyMs, 99),
      inboundBytes: b.inboundBytes,
      outboundBytes: b.outboundBytes,
      activePeak: b.activePeak,
    });
  }
  return rows;
}

function mapToDistribution(map, labels = undefined) {
  const entries = labels ? labels.map(label => [label, map.get(label) || 0]) : [...map.entries()];
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  return entries.map(([name, value]) => ({ name, value, percent: Number(((value / total) * 100).toFixed(2)) }));
}

function endpointRows(limit = 8) {
  return [...state.paths.entries()]
    .sort((a, b) => b[1].requests - a[1].requests)
    .slice(0, limit)
    .map(([route, item]) => ({
      route,
      requests: item.requests,
      latencyAvgMs: item.requests ? Math.round(item.latencySum / item.requests) : 0,
      latencyP95Ms: percentile(item.latencies, 95),
      errorRate: item.requests ? Number(((item.errors / item.requests) * 100).toFixed(2)) : 0,
      bytes: item.inboundBytes + item.outboundBytes,
      lastActivityAt: item.lastActivityAt,
      topMethod: top(item.methods, 1)[0]?.name || '-',
      topStatus: top(item.statuses, 1)[0]?.name || '-',
    }));
}

function clientRows(limit = 8) {
  return [...state.clients.entries()]
    .sort((a, b) => b[1].requests - a[1].requests)
    .slice(0, limit)
    .map(([client, item]) => ({
      app: client,
      token: `${client.replace(/[^a-z0-9-]/gi, '').slice(0, 8) || 'client'}-${hashShort(client).slice(0, 4)}`,
      requests: item.requests,
      errorRate: item.requests ? Number(((item.errors / item.requests) * 100).toFixed(2)) : 0,
      latencyAvgMs: item.requests ? Math.round(item.latencySum / item.requests) : 0,
      limit: item.limit,
      lastActivityAt: item.lastActivityAt,
      lastStatus: item.lastStatus,
    }));
}

function systemSnapshot() {
  const mem = process.memoryUsage?.() || { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 };
  const cpu = process.cpuUsage?.() || { user: 0, system: 0 };
  const uptime = Math.max(1, process.uptime?.() || ((Date.now() - startedAt) / 1000));
  const cpuMs = (cpu.user + cpu.system) / 1000;
  const cpuPercentAvg = Math.min(100, Number(((cpuMs / (uptime * 1000 * Math.max(1, os.cpus?.().length || 1))) * 100).toFixed(2)));
  const heapLimit = Math.max(mem.heapTotal || 1, mem.heapUsed || 1);
  return {
    node: process.version,
    platform: process.platform,
    uptimeSeconds: Math.round(uptime),
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      heapUsedPercent: Number(((mem.heapUsed / heapLimit) * 100).toFixed(2)),
    },
    cpu: {
      averagePercent: cpuPercentAvg,
      cores: os.cpus?.().length || 1,
    },
    eventLoopLagMs: state.lastEventLoopLagMs,
    activeRequests: state.activeRequests,
    openSockets: state.serverOpenSocketsMeasured ? state.serverOpenSockets : null,
    openSocketsMeasured: state.serverOpenSocketsMeasured,
    serverConnectionsTotal: state.serverConnectionsTotal,
    queueDepth: null,
    queueDepthMeasured: false,
    workersSaturationPercent: Math.min(100, Math.round((state.activeRequests / Math.max(1, Number(process.env.VALORAE_OBSERVABILITY_WORKER_CAPACITY || 64))) * 100)),
    diskLogBufferPercent: Math.min(100, Math.round((state.events.length / MAX_EVENTS) * 100)),
  };
}

export function observabilitySnapshot(options = {}) {
  const minutes = Number(options.minutes || 60);
  const series = bucketSeries(minutes);
  const recentRequests = series.reduce((sum, item) => sum + item.requests, 0);
  const recentErrors = series.reduce((sum, item) => sum + item.errors, 0);
  const recentInbound = series.reduce((sum, item) => sum + item.inboundBytes, 0);
  const recentOutbound = series.reduce((sum, item) => sum + item.outboundBytes, 0);
  const latencyAvg = average(state.latencies);
  const p95 = percentile(state.latencies, 95);
  const p99 = percentile(state.latencies, 99);
  const cacheDist = mapToDistribution(state.cache, ['hit', 'miss', 'bypass']);
  const hit = cacheDist.find(x => x.name === 'hit')?.percent || 0;
  const protocolsDist = mapToDistribution(state.protocols);
  const httpsRequests = [...state.protocols.entries()].filter(([name]) => String(name).includes('HTTPS')).reduce((sum, [, value]) => sum + value, 0);
  const httpRequests = [...state.protocols.entries()].filter(([name]) => !String(name).includes('HTTPS')).reduce((sum, [, value]) => sum + value, 0);
  const authDist = mapToDistribution(state.auth, ['válida', 'inválida', 'sem token']);
  const statusDist = mapToDistribution(state.statusClass, ['2xx', '3xx', '4xx', '5xx']);
  const methodDist = mapToDistribution(state.methods, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);
  return {
    version: OBSERVABILITY_VERSION,
    generatedAt: new Date().toISOString(),
    startedAt: new Date(startedAt).toISOString(),
    windowMinutes: Math.max(5, Math.min(10080, minutes || 60)),
    status: state.totalErrors > 0 && state.totalErrors / Math.max(1, state.completedRequests) > 0.05 ? 'DEGRADED' : 'OPERATIONAL',
    totals: {
      requests: state.totalRequests,
      completed: state.completedRequests,
      errors: state.totalErrors,
      inboundBytes: state.inboundBytes,
      outboundBytes: state.outboundBytes,
      blockedRequests: state.blockedRequests,
      suspiciousRequests: state.suspiciousRequests,
      rateLimitBlocks: state.rateLimitBlocks,
      timeouts: state.timeouts,
      retries: state.retries,
      circuitBreakerOpen: state.circuitBreakerOpen,
    },
    current: {
      rps: Number((recentRequests / Math.max(1, minutes * 60)).toFixed(2)),
      rpm: Number((recentRequests / Math.max(1, minutes)).toFixed(2)),
      activeRequests: state.activeRequests,
      latencyAvgMs: latencyAvg,
      latencyP95Ms: p95,
      latencyP99Ms: p99,
      errorRate: recentRequests ? Number(((recentErrors / recentRequests) * 100).toFixed(2)) : 0,
      throughputInBytesPerSecond: Math.round(recentInbound / Math.max(1, minutes * 60)),
      throughputOutBytesPerSecond: Math.round(recentOutbound / Math.max(1, minutes * 60)),
      cacheHitRatio: hit,
      lastRequestAt: state.lastRequestAt,
    },
    series,
    distributions: {
      status: statusDist,
      statusCodes: top(state.status, 12),
      methods: methodDist,
      protocols: protocolsDist,
      payloadIn: mapToDistribution(state.payloadInBuckets, ['0 – 1 KB', '1 KB – 10 KB', '10 KB – 100 KB', '100 KB – 1 MB', '> 1 MB']),
      payloadOut: mapToDistribution(state.payloadOutBuckets, ['0 – 1 KB', '1 KB – 10 KB', '10 KB – 100 KB', '100 KB – 1 MB', '> 1 MB']),
      cache: cacheDist,
      auth: authDist,
    },
    top: {
      endpoints: endpointRows(10),
      upstreams: endpointRows(8).map(row => ({ ...row, upstream: inferUpstream(row.route) })),
      clients: clientRows(10),
      origins: top(state.origins, 8),
      ips: top(state.ips, 8),
      userAgents: top(state.userAgents, 8),
      regions: [],
    },
    security: {
      blockedRequests: state.blockedRequests,
      suspiciousRequests: state.suspiciousRequests,
      corsOrigins: top(state.origins, 8),
      auth: authDist,
    },
    reliability: {
      rateLimit: {
        blocked: state.rateLimitBlocks,
        usagePercent: Math.min(100, Math.round((state.rateLimitBlocks / Math.max(1, state.completedRequests)) * 100)),
      },
      retries: state.retries,
      timeouts: state.timeouts,
      circuitBreakerOpen: state.circuitBreakerOpen,
      tls: {
        measured: false,
        source: 'x-forwarded-proto/httpVersion',
        httpsRequests,
        httpRequests,
        handshakes: null,
        failuresPercent: null,
        note: 'Handshakes TLS reais ficam no terminador TLS/plataforma. O app mede somente o protocolo encaminhado via headers.',
      },
    },
    system: systemSnapshot(),
    measurement: {
      proxyTraffic: 'Requisições /api/*, exceto /api/observability para não poluir o painel com polling interno.',
      observabilityReads: state.observabilityReads,
      geolocation: { measured: false, reason: 'Sem banco GeoIP ou serviço externo para manter o projeto free-only.' },
      tls: { measured: false, reason: 'Handshakes TLS não são expostos ao app Node quando TLS termina na plataforma.' },
      openSockets: { measured: state.serverOpenSocketsMeasured, reason: state.serverOpenSocketsMeasured ? 'Medido pelo server.js local.' : 'Não disponível em serverless/Vercel.' },
      queueDepth: { measured: false, reason: 'Não há fila interna persistente neste proxy free-only.' },
    },
    events: state.events.slice(0, 80),
    badges: statusBadges(hit),
  };
}

function inferUpstream(route = '') {
  if (route.includes('/asset') || route.includes('/market') || route.includes('/compare')) return 'market-data';
  if (route.includes('/portfolio')) return 'portfolio-engine';
  if (route.includes('/scrape')) return 'scraper-proxy';
  if (route.includes('/news')) return 'news-source';
  if (route.includes('/admin')) return 'admin-control';
  return 'valorae-api';
}

function inferredRegions(origins = [], ips = []) {
  const base = [
    { name: 'Brasil', value: Math.max(0, origins.reduce((s, x) => s + x.value, 0) || ips.reduce((s, x) => s + x.value, 0)) },
    { name: 'EUA', value: Math.round((ips[1]?.value || 0) * 0.6) },
    { name: 'Europa', value: Math.round((ips[2]?.value || 0) * 0.4) },
    { name: 'Outros', value: Math.max(0, ips.slice(3).reduce((s, x) => s + x.value, 0)) },
  ];
  return base.filter(x => x.value > 0).length ? base : [{ name: 'Sem tráfego', value: 0 }];
}

function statusBadges(cacheHitRatio) {
  const degraded = state.completedRequests > 0 && state.totalErrors / Math.max(1, state.completedRequests) > 0.05;
  return [
    { name: 'API', status: degraded ? 'Atenção' : 'Operacional' },
    { name: 'Cache', status: cacheHitRatio >= 40 || state.completedRequests === 0 ? 'Operacional' : 'Atenção' },
    { name: 'Upstreams', status: state.timeouts > 0 ? 'Atenção' : 'Operacional' },
    { name: 'Auth', status: (state.auth.get('inválida') || 0) > 10 ? 'Atenção' : 'Operacional' },
    { name: 'CORS', status: 'Operacional' },
    { name: 'Rate Limit', status: state.rateLimitBlocks > 0 ? 'Atenção' : 'Operacional' },
  ];
}

export function resetObservabilityForTests() {
  state.totalRequests = 0;
  state.completedRequests = 0;
  state.totalErrors = 0;
  state.activeRequests = 0;
  state.inboundBytes = 0;
  state.outboundBytes = 0;
  state.blockedRequests = 0;
  state.suspiciousRequests = 0;
  state.rateLimitBlocks = 0;
  state.timeouts = 0;
  state.retries = 0;
  state.circuitBreakerOpen = 0;
  state.latencies = [];
  state.minuteBuckets.clear();
  state.status.clear();
  state.statusClass.clear();
  state.methods.clear();
  state.protocols.clear();
  state.paths.clear();
  state.origins.clear();
  state.clients.clear();
  state.userAgents.clear();
  state.ips.clear();
  state.auth.clear();
  state.cache.clear();
  state.payloadInBuckets.clear();
  state.payloadOutBuckets.clear();
  state.events = [];
  state.observabilityReads = 0;
  state.serverOpenSockets = 0;
  state.serverOpenSocketsMeasured = false;
  state.serverConnectionsTotal = 0;
  state.lastRequestAt = null;
}

export function formatBytes(bytes = 0) {
  const n = Math.max(0, Number(bytes || 0));
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
