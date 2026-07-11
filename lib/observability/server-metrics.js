import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { buildPersonalReleaseReadiness } from '../release/personal-maturity.js';
import { VALORAE_RELEASE_PATCH } from '../release/current.js';

export const VALORAE_SERVER_METRICS_VERSION = `${VALORAE_RELEASE_PATCH}-monitor`;

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
  writeChunks: 0,
  writeBytes: 0,
  directResponses: 0,
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
  apps: new Map(),
  channels: new Map(),
  vercelRegions: new Map(),
  vercelHosts: new Map(),
  vercelCountries: new Map(),
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
  internalTelemetry: { requests: 0, lastAt: null, routes: new Map(), vercelHeadersRequests: 0, platform: null, vercelRegions: new Map(), vercelHosts: new Map(), vercelCountries: new Map() },
};

state.version = VALORAE_SERVER_METRICS_VERSION;
if (!state.bytesOutSamples) state.bytesOutSamples = [];
if (!state.bytesInSamples) state.bytesInSamples = [];
if (typeof state.totals.bytesIn !== 'number') state.totals.bytesIn = 0;
if (typeof state.totals.abortedResponses !== 'number') state.totals.abortedResponses = 0;
if (typeof state.totals.clientClosed !== 'number') state.totals.clientClosed = 0;
if (typeof state.totals.bodylessResponses !== 'number') state.totals.bodylessResponses = 0;
if (typeof state.totals.staleActiveCleanups !== 'number') state.totals.staleActiveCleanups = 0;
if (typeof state.totals.writeChunks !== 'number') state.totals.writeChunks = 0;
if (typeof state.totals.writeBytes !== 'number') state.totals.writeBytes = 0;
if (typeof state.totals.directResponses !== 'number') state.totals.directResponses = 0;
if (!state.activeRequests) state.activeRequests = new Map();
if (!state.apps) state.apps = new Map();
if (!state.channels) state.channels = new Map();
if (!state.vercelRegions) state.vercelRegions = new Map();
if (!state.vercelHosts) state.vercelHosts = new Map();
if (!state.vercelCountries) state.vercelCountries = new Map();
if (!state.internalTelemetry) state.internalTelemetry = { requests: 0, lastAt: null, routes: new Map(), vercelHeadersRequests: 0, platform: null, vercelRegions: new Map(), vercelHosts: new Map(), vercelCountries: new Map() };
if (!state.internalTelemetry.routes) state.internalTelemetry.routes = new Map();
if (!state.internalTelemetry.vercelRegions) state.internalTelemetry.vercelRegions = new Map();
if (!state.internalTelemetry.vercelHosts) state.internalTelemetry.vercelHosts = new Map();
if (!state.internalTelemetry.vercelCountries) state.internalTelemetry.vercelCountries = new Map();
if (typeof state.internalTelemetry.vercelHeadersRequests !== 'number') state.internalTelemetry.vercelHeadersRequests = 0;
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
  '/api/release/readiness',
  '/api/release-readiness',
  '/api/personal/readiness',
  '/api/personal-readiness',
  '/api/cache/stats',
  '/api/v1/source/status',
  '/api/v2/source/status',
  '/api/v1/release/readiness',
  '/api/v2/release/readiness',
  '/api/v1/release-readiness',
  '/api/v2/release-readiness',
  '/api/v1/personal/readiness',
  '/api/v2/personal/readiness',

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
  '/api/integration/manifest',
  '/api/integration/sdk',
  '/api/integration/prompts',
  '/api/v1/integration/manifest',
  '/api/v1/integration/sdk',
  '/api/v1/integration/prompts',
  '/api/v2/integration/manifest',
  '/api/v2/integration/sdk',
  '/api/v2/integration/prompts',
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
  const route = normalizeRoutePath(meta.route || routeFromReq(req));
  if (req?.__valoraeInternalTelemetry === true || meta?.internalTelemetry === true) return true;
  if (isInternalTelemetryRoute(route)) return true;
  // IMPORTANTE: cabeçalhos de dashboard/test/probe não podem esconder rotas de dados.
  // O monitor precisa espelhar tudo que SAI do proxy para apps/usuários em /api/asset,
  // /api/assets, /api/portfolio/*, /api/scrape etc. Antes, qualquer cliente que enviasse
  // x-valorae-telemetry: dashboard/test/probe fazia a resposta sumir do feed. Agora esses
  // cabeçalhos só servem como contexto do consumidor; rotas de dados continuam capturadas.
  return false;
}

function recordInternalTelemetry(req, meta = {}) {
  if (!req || req.__valoraeInternalTelemetryRecorded) return;
  const route = normalizeRoutePath(meta.route || routeFromReq(req));
  const platform = platformContext(req);
  req.__valoraeInternalTelemetryRecorded = true;
  state.internalTelemetry.requests += 1;
  state.internalTelemetry.lastAt = Date.now();
  state.internalTelemetry.platform = platform;
  inc(state.internalTelemetry.routes, route);
  // O painel precisa enxergar runtime/host/região da Vercel sem inflar tráfego de usuários.
  // Por isso estes mapas ficam separados dos contadores externos principais.
  if (platform?.region) inc(state.internalTelemetry.vercelRegions, platform.region);
  if (platform?.host) inc(state.internalTelemetry.vercelHosts, platform.host);
  if (platform?.country) inc(state.internalTelemetry.vercelCountries, platform.country);
  if (platform?.isVercel || platform?.vercelId) state.internalTelemetry.vercelHeadersRequests += 1;
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

function headerValue(req, names = []) {
  const h = req?.headers || {};
  for (const name of names) {
    const direct = h[name] ?? h[String(name).toLowerCase()] ?? h[String(name).toUpperCase()];
    if (direct !== undefined && direct !== null && String(direct).trim()) return String(direct).trim();
  }
  return '';
}

function appContext(req, ua = '', signal = {}) {
  let query = {};
  try {
    const url = new URL(req?.url || '/', 'https://valorae.local');
    query = Object.fromEntries(url.searchParams.entries());
  } catch {}
  const rawName = headerValue(req, ['x-valorae-app', 'x-app-name', 'x-client-name', 'x-consumer-app']) || query.app || query.client || query.consumer;
  const rawVersion = headerValue(req, ['x-valorae-app-version', 'x-app-version', 'x-client-version']) || query.appVersion || query.clientVersion;
  const rawChannel = headerValue(req, ['x-valorae-channel', 'x-app-channel', 'x-client-channel']) || query.channel || signal.view;
  const rawBuild = headerValue(req, ['x-valorae-build', 'x-app-build']) || query.build;
  const v = String(ua || '').toLowerCase();
  const inferredName = rawName || (/android|okhttp|dart|flutter|dalvik/.test(v) ? 'VALORAE APK' : /chrome|firefox|safari|edge|edg\//.test(v) ? 'VALORAE Web' : 'Consumidor API');
  const channel = rawChannel || (/watchlist|list|compact|mobile/.test(String(signal.view || '').toLowerCase()) ? 'mobile-list' : /portfolio|wallet/.test(String(signal.view || '').toLowerCase()) ? 'portfolio' : 'standard');
  return {
    name: String(inferredName).slice(0, 80),
    version: rawVersion ? String(rawVersion).slice(0, 40) : undefined,
    channel: String(channel || 'standard').slice(0, 60),
    build: rawBuild ? String(rawBuild).slice(0, 40) : undefined,
  };
}


function platformContext(req) {
  const headers = req?.headers || {};
  const host = headerValue(req, ['x-forwarded-host', 'host']) || 'unknown';
  const proto = headerValue(req, ['x-forwarded-proto']) || 'https';
  const vercelId = headerValue(req, ['x-vercel-id']);
  const regionFromId = vercelId ? String(vercelId).split(':')[0] : '';
  const region = headerValue(req, ['x-vercel-region', 'x-vercel-ip-country-region']) || process.env.VERCEL_REGION || regionFromId || 'local';
  const country = headerValue(req, ['x-vercel-ip-country', 'cf-ipcountry']) || 'unknown';
  const city = headerValue(req, ['x-vercel-ip-city']) || undefined;
  const deploymentHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
  return {
    isVercel: Boolean(process.env.VERCEL || vercelId || headers['x-vercel-deployment-url']),
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local',
    region: String(region).slice(0, 40),
    host: String(host).slice(0, 120),
    proto: String(proto).slice(0, 12),
    country: String(country).slice(0, 40),
    city: city ? String(city).slice(0, 80) : undefined,
    vercelId: vercelId ? String(vercelId).slice(0, 120) : undefined,
    deploymentHost: deploymentHost ? String(deploymentHost).replace(/^https?:\/\//, '').slice(0, 120) : undefined,
  };
}

function mergeTopMaps(primary = new Map(), secondary = new Map(), limit = 12) {
  const merged = new Map();
  for (const [k, v] of primary.entries()) merged.set(k, (merged.get(k) || 0) + v);
  for (const [k, v] of secondary.entries()) merged.set(k, (merged.get(k) || 0) + v);
  return topMap(merged, limit);
}

function getVercelRuntimeSnapshot() {
  const deploymentHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
  const gitSha = process.env.VERCEL_GIT_COMMIT_SHA || '';
  const internal = state.internalTelemetry || {};
  const internalPlatform = internal.platform || null;
  const regions = mergeTopMaps(state.vercelRegions, internal.vercelRegions || new Map(), 12);
  const hosts = mergeTopMaps(state.vercelHosts, internal.vercelHosts || new Map(), 12);
  const countries = mergeTopMaps(state.vercelCountries, internal.vercelCountries || new Map(), 12);
  const externalRegions = topMap(state.vercelRegions, 12);
  const externalHosts = topMap(state.vercelHosts, 12);
  const externalCountries = topMap(state.vercelCountries, 12);
  const recentVercel = state.events.filter(e => e.platform?.isVercel || e.platform?.vercelId).slice(-80);
  const detectedByInternal = Boolean(internalPlatform?.isVercel || internalPlatform?.vercelId || process.env.VERCEL || deploymentHost);
  const lastPlatform = recentVercel.at(-1)?.platform || internalPlatform || null;
  return {
    detected: Boolean(process.env.VERCEL || deploymentHost || recentVercel.length || detectedByInternal),
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local',
    region: process.env.VERCEL_REGION || lastPlatform?.region || regions[0]?.name || 'local',
    url: deploymentHost ? `https://${String(deploymentHost).replace(/^https?:\/\//, '')}` : null,
    productionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${String(process.env.VERCEL_PROJECT_PRODUCTION_URL).replace(/^https?:\/\//, '')}` : null,
    git: {
      provider: process.env.VERCEL_GIT_PROVIDER || null,
      repo: process.env.VERCEL_GIT_REPO_SLUG || null,
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      commit: gitSha ? gitSha.slice(0, 12) : null,
    },
    observed: {
      requestsWithVercelHeaders: recentVercel.length + safeNumber(internal.vercelHeadersRequests, 0),
      externalRequestsWithVercelHeaders: recentVercel.length,
      internalTelemetryRequestsWithVercelHeaders: safeNumber(internal.vercelHeadersRequests, 0),
      regions,
      hosts,
      countries,
      externalRegions,
      externalHosts,
      externalCountries,
      lastVercelId: recentVercel.at(-1)?.platform?.vercelId || internalPlatform?.vercelId || null,
      lastHost: lastPlatform?.host || hosts[0]?.name || null,
      lastRegion: lastPlatform?.region || regions[0]?.name || null,
      lastCountry: lastPlatform?.country || countries[0]?.name || null,
      source: recentVercel.length ? 'external_traffic' : internalPlatform ? 'dashboard_internal_telemetry' : 'environment',
    },
    dashboardHint: 'Se estes campos aparecem como local/0 em produção, o painel está lendo outra instância/origem ou o deploy publicado ainda não contém esta versão.',
  };
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
    latencyTotal: 0, latencyCount: 0, latencySamples: [], statusCounts: {}, maxLatencyMs: 0, lastStatus: null, lastSeenAt: null, lastRequestAt: null, lastCacheStatus: 'unknown', lastSourceStatus: 'unknown', lastPayloadKind: null, lastPayloadSignals: null, deliveredPayloads: 0, renderSafePayloads: 0, cacheSafePayloads: 0, chartSeriesDelivered: 0, metricsDelivered: 0, dividendRowsDelivered: 0, methods: {}, devices: {}, apps: {}, channels: {}, vercelRegions: {}, vercelHosts: {}, cacheStatuses: {}, sourceStatuses: {},
  };
  Object.assign(current, patch.base || {});
  if (patch.request) {
    current.requests += 1;
    current.bytesIn += patch.bytesIn || 0;
    current.lastRequestAt = patch.at || current.lastRequestAt;
  }
  if (patch.method) current.methods[patch.method] = (current.methods[patch.method] || 0) + 1;
  if (patch.device) current.devices[patch.device] = (current.devices[patch.device] || 0) + 1;
  if (patch.appName) current.apps[patch.appName] = (current.apps[patch.appName] || 0) + 1;
  if (patch.channel) current.channels[patch.channel] = (current.channels[patch.channel] || 0) + 1;
  if (patch.platform?.region) current.vercelRegions[patch.platform.region] = (current.vercelRegions[patch.platform.region] || 0) + 1;
  if (patch.platform?.host) current.vercelHosts[patch.platform.host] = (current.vercelHosts[patch.platform.host] || 0) + 1;
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
    if (patch.payloadSignals) {
      current.deliveredPayloads += 1;
      current.lastPayloadKind = patch.payloadKind || current.lastPayloadKind;
      current.lastPayloadSignals = patch.payloadSignals;
      current.metricsDelivered += safeNumber(patch.payloadSignals.metrics, 0);
      current.chartSeriesDelivered += safeNumber(patch.payloadSignals.charts, 0);
      current.dividendRowsDelivered += safeNumber(patch.payloadSignals.dividends, 0);
      if (patch.payloadSignals.renderSafe === true) current.renderSafePayloads += 1;
      if (patch.payloadSignals.cacheSafe === true) current.cacheSafePayloads += 1;
    }
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


function objectKeys(value, limit = 32) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value).slice(0, limit);
}

function countPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).length : 0;
}

function arrayLength(value) { return Array.isArray(value) ? value.length : 0; }

function safePreview(value, limit = Number(process.env.VALORAE_METRICS_PREVIEW_BYTES || 1800)) {
  if (process.env.VALORAE_METRICS_CAPTURE_PREVIEW === '0') return undefined;
  try {
    const json = typeof value === 'string' ? value : JSON.stringify(value ?? null);
    return String(json).slice(0, Math.max(0, limit));
  } catch { return undefined; }
}

function parseBodyPreview(raw) {
  const text = String(raw || '').trim();
  if (!text || !/^\s*[\[{]/.test(text)) return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

function collectSnippet(current = '', chunk, encoding = 'utf8') {
  const limit = Number(process.env.VALORAE_METRICS_BODY_CAPTURE_BYTES || 8192);
  if (limit <= 0 || current.length >= limit) return current;
  try {
    const txt = Buffer.isBuffer(chunk) ? chunk.toString(encoding || 'utf8') : String(chunk || '');
    return (current + txt).slice(0, limit);
  } catch { return current; }
}

function countMetricsLike(value) {
  if (!value) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    const financial = keys.filter(k => {
      const v = value[k];
      return v !== undefined && v !== null && (typeof v !== 'object' || Array.isArray(v) || ('value' in v) || ('display' in v));
    });
    return financial.length || keys.length;
  }
  return 1;
}

function chartSeriesCount(charts) {
  if (!charts) return 0;
  if (Array.isArray(charts)) return charts.length;
  return Number(charts?.count || charts?.series?.length || charts?.seriesPreview?.length || charts?.templates?.length || 0);
}

function chartPointCount(charts) {
  if (!charts) return 0;
  if (Number.isFinite(Number(charts?.bestPointCount || charts?.totalPoints))) return Number(charts.bestPointCount || charts.totalPoints);
  const series = Array.isArray(charts) ? charts : (charts.series || charts.seriesPreview || charts.templates || []);
  if (!Array.isArray(series)) return 0;
  return series.reduce((n, s) => n + arrayLength(s?.points || s?.data || s?.values), 0);
}

function detectPayloadKind(payload, appPayload, mobile) {
  if (!payload || typeof payload !== 'object') return 'unknown';
  if (payload?.appMobileSnapshot || payload?.appPayload || payload?.appDataContract || payload?.appSyncEnvelope || payload?.chartSeries) return 'app_delivery';
  if (payload?.ticker || appPayload?.ticker || mobile?.ticker) return 'asset';
  if (payload?.portfolio || payload?.allocation || payload?.summary?.portfolio || payload?.holdings) return 'portfolio';
  if (payload?.openapi || payload?.paths) return 'contract';
  if (payload?.tests || payload?.readiness || payload?.name === 'Valorae Proxy Server Metrics') return 'diagnostic';
  if (payload?.ok === true || payload?.status) return 'json_status';
  return 'json';
}

function payloadDiagnostics(payload) {
  const rootKeys = objectKeys(payload, 60);
  const appPayload = payload?.appPayload || payload?.data?.appPayload;
  const mobile = payload?.appMobileSnapshot || payload?.data?.appMobileSnapshot;
  const chartSeries = payload?.chartSeries || payload?.data?.chartSeries;
  const normalized = payload?.normalized || payload?.data?.normalized;
  const results = payload?.results || payload?.data?.results;
  const assetClassContract = payload?.assetClassContract || payload?.data?.assetClassContract;
  const assetIndicatorCoverage = payload?.assetIndicatorCoverage || payload?.data?.assetIndicatorCoverage;
  const engineMaturityBooster = payload?.engineMaturityBooster || payload?.data?.engineMaturityBooster;
  const fieldConsistencyGuard = payload?.fieldConsistencyGuard || payload?.data?.fieldConsistencyGuard;
  const payloadBudget = payload?.payloadBudget || payload?.data?.payloadBudget;
  const assetActionPlan = payload?.assetActionPlan || payload?.data?.assetActionPlan;
  const engineRuntimeProfiler = payload?.engineRuntimeProfiler || payload?.data?.engineRuntimeProfiler;
  const engineLaunchGate = payload?.engineLaunchGate || payload?.data?.engineLaunchGate;
  const extractionCompleteness = payload?.metrics?.extractionCompleteness || payload?.data?.metrics?.extractionCompleteness || payload?.extractionCompleteness || payload?.data?.extractionCompleteness;
  const dataReliability = payload?.dataReliability || payload?.data?.dataReliability || payload?.metrics?.dataReliability || payload?.data?.metrics?.dataReliability;
  const performanceProfile = payload?.metrics?.performanceProfile || payload?.data?.metrics?.performanceProfile || payload?.performance?.profile || payload?.data?.performance?.profile;
  const panels = appPayload?.panels || mobile?.panels || payload?.panelReadiness?.panels || payload?.data?.panelReadiness?.panels;
  const charts = appPayload?.charts || mobile?.charts || chartSeries;
  const dividends = appPayload?.dividends || mobile?.dividends || results?.dividendos || results?.dividends;
  const kind = detectPayloadKind(payload, appPayload, mobile);
  const syncAction = payload?.appSyncEnvelope?.action || payload?.appSyncEnvelope?.decision || mobile?.sync?.action || mobile?.sync?.decision;
  const assetClassFieldCount = countMetricsLike(assetClassContract?.fieldConfidence);
  const indicatorPresent = Number(assetIndicatorCoverage?.summary?.present || 0);
  const metricsCount = countMetricsLike(appPayload?.metrics?.canonical) + countMetricsLike(appPayload?.metrics?.aliases) + countMetricsLike(mobile?.metrics) + countMetricsLike(normalized) + assetClassFieldCount + indicatorPresent;
  const signals = {
    status: payload?.status || payload?.data?.status,
    ticker: payload?.ticker || appPayload?.ticker || mobile?.ticker,
    type: payload?.type || appPayload?.type || mobile?.type,
    roots: rootKeys.length,
    metrics: metricsCount,
    charts: chartSeriesCount(charts),
    chartPoints: chartPointCount(charts),
    panels: countPlainObject(panels),
    assetClassScore: assetClassContract?.score,
    assetClassState: assetClassContract?.state,
    assetClassGroups: countPlainObject(assetClassContract?.groups),
    assetClassFields: assetClassFieldCount,
    indicatorCoveragePercent: assetIndicatorCoverage?.completenessPercent,
    indicatorCriticalCoveragePercent: assetIndicatorCoverage?.criticalCompletenessPercent,
    indicatorFields: indicatorPresent,
    engineMaturityScore: engineMaturityBooster?.scores?.overall,
    engineMaturityGrade: engineMaturityBooster?.grade,
    fieldConsistencyScore: fieldConsistencyGuard?.score,
    fieldConsistencyState: fieldConsistencyGuard?.state,
    fieldConsistencyIssues: fieldConsistencyGuard?.issueCounts?.total,
    extractionCompletenessScore: extractionCompleteness?.score,
    extractionCompletenessThreshold: extractionCompleteness?.threshold,
    extractionComplete: extractionCompleteness?.complete,
    extractionFoundKeys: extractionCompleteness?.afterSnapshotKeys ?? extractionCompleteness?.foundKeys,
    extractionTargetKeys: extractionCompleteness?.targetKeys,
    extractionMissingCriticalFields: Array.isArray(extractionCompleteness?.criticalFields?.missingCriticalFields) ? extractionCompleteness.criticalFields.missingCriticalFields.slice(0, 8) : undefined,
    adaptiveCompletionAttempted: extractionCompleteness?.adaptiveCompletion?.attempted,
    adaptiveCompletionOk: extractionCompleteness?.adaptiveCompletion?.ok,
    statusInvestComplementAttempted: extractionCompleteness?.statusInvestComplement?.attempted,
    statusInvestComplementOk: extractionCompleteness?.statusInvestComplement?.ok,
    statusInvestHedged: extractionCompleteness?.statusInvestHedge?.enabled,
    statusInvestHedgeOk: extractionCompleteness?.statusInvestHedge?.ok,
    bestSnapshotHydrated: extractionCompleteness?.bestSnapshotHydration?.used,
    yahooPrefetch: extractionCompleteness?.yahooPrefetch,
    canonicalReliabilityUsed: extractionCompleteness?.canonicalReliability?.used ?? dataReliability?.canonicalSnapshotAvailable,
    canonicalRenderableCore: extractionCompleteness?.canonicalReliability?.renderableCore ?? dataReliability?.renderableCore,
    dataReliabilityState: dataReliability?.globalState,
    dataReliabilityIdentity: dataReliability?.blocks?.identity?.status,
    dataReliabilityQuote: dataReliability?.blocks?.quote?.status,
    dataReliabilityFundamentals: dataReliability?.blocks?.fundamentals?.status,
    dataReliabilityDividends: dataReliability?.blocks?.dividends?.status,
    dataReliabilityCharts: dataReliability?.blocks?.charts?.status,
    dataReliabilityRankings: dataReliability?.blocks?.rankings?.status,
    performanceProfile,
    payloadBudgetBytes: payloadBudget?.totalBytesApprox,
    payloadBudgetState: payloadBudget?.state,
    assetActionScore: assetActionPlan?.score,
    assetActionDecision: assetActionPlan?.releaseDecision,
    engineRuntimeScore: engineRuntimeProfiler?.score,
    engineRuntimeGrade: engineRuntimeProfiler?.grade,
    engineRuntimeTotalMs: engineRuntimeProfiler?.totalMs,
    engineRuntimeSlowStages: Array.isArray(engineRuntimeProfiler?.slowStages) ? engineRuntimeProfiler.slowStages.length : undefined,
    engineLaunchGateScore: engineLaunchGate?.score,
    engineLaunchGateGrade: engineLaunchGate?.grade,
    engineLaunchGateDecision: engineLaunchGate?.decision,
    engineLaunchReady: engineLaunchGate?.readyForPersonalUse,
    dividends: arrayLength(dividends?.items) || arrayLength(dividends?.historico) || arrayLength(dividends),
    renderSafe: payload?.appResponseIntegrity?.renderSafe ?? payload?.appDataContract?.renderSafe ?? mobile?.sync?.renderSafe,
    cacheSafe: payload?.appResponseIntegrity?.cacheSafe ?? payload?.appDataContract?.canReplacePreviousSnapshot,
    replaceSafe: payload?.appDataContract?.canReplacePreviousSnapshot ?? payload?.appSyncEnvelope?.canReplacePreviousSnapshot,
    syncAction,
    payloadHash: payload?.appSyncEnvelope?.identity?.payloadHash || mobile?.snapshotHash,
    hasAppMobileSnapshot: Boolean(mobile),
    hasAppPayload: Boolean(appPayload),
    hasChartSeries: Boolean(chartSeries),
    hasNormalized: Boolean(normalized),
    hasResults: Boolean(results),
    hasAssetClassContract: Boolean(assetClassContract),
    hasAssetIndicatorCoverage: Boolean(assetIndicatorCoverage),
    hasEngineMaturityBooster: Boolean(engineMaturityBooster),
    hasFieldConsistencyGuard: Boolean(fieldConsistencyGuard),
    hasPayloadBudget: Boolean(payloadBudget),
    hasAssetActionPlan: Boolean(assetActionPlan),
    hasEngineRuntimeProfiler: Boolean(engineRuntimeProfiler),
    hasEngineLaunchGate: Boolean(engineLaunchGate),
    hasDataReliability: Boolean(dataReliability),
    rootsCsv: rootKeys.slice(0, 16).join(','),
  };
  return { kind, rootKeys, signals, preview: safePreview(payload) };
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
    // Preserve a rota HTTP real capturada na entrada. Handlers internos podem informar
    // um profile curto (ex.: "asset"), mas isso não deve apagar /api/v1/asset do feed.
    if (meta.route && req.__valoraeMetrics && (!req.__valoraeMetrics.route || req.__valoraeMetrics.route === '/api/router')) {
      req.__valoraeMetrics.route = normalizeRoutePath(meta.route);
    }
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
  const app = appContext(req, ua, signal);
  const platform = platformContext(req);
  const metricsId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  req.__valoraeMetricsStarted = true;
  req.__valoraeMetricsId = metricsId;
  req.__valoraeMetrics = { id: metricsId, startedAt, wallStartedAt, route, method, client, device, app, platform, ua, signal };
  state.activeRequests.set(metricsId, { id: metricsId, route, method, client, device, appName: app.name, channel: app.channel, platform, startedAt: wallStartedAt });
  const bytesIn = safeNumber(req?.headers?.['content-length'], 0);
  state.totals.requests += 1;
  state.totals.inFlight += 1;
  state.totals.bytesIn += bytesIn;
  if (bytesIn > 0) { state.bytesInSamples.push(bytesIn); if (state.bytesInSamples.length > 2000) state.bytesInSamples.splice(0, state.bytesInSamples.length - 2000); }
  if (method === 'OPTIONS') state.totals.optionsPreflight += 1;
  inc(state.methods, method);
  inc(state.routes, route);
  inc(state.devices, device);
  inc(state.apps, app.name);
  inc(state.channels, app.channel);
  inc(state.vercelRegions, platform.region);
  inc(state.vercelHosts, platform.host);
  inc(state.vercelCountries, platform.country);
  if (signal.ticker) inc(state.tickers, signal.ticker);
  if (signal.view) inc(state.views, signal.view);
  updateRouteDetail(route, { request: true, method, device, appName: app.name, channel: app.channel, platform, bytesIn, at: wallStartedAt });
  const b = touchBucket(wallStartedAt);
  b.requests += 1;
  b.bytesIn = (b.bytesIn || 0) + bytesIn;
  const c = state.clients.get(client) || { id: client, firstSeenAt: wallStartedAt, lastSeenAt: wallStartedAt, requests: 0, responses: 0, errors: 0, bytesOut: 0, device, lastRoute: route, appName: app.name, appVersion: app.version, channel: app.channel, platform };
  c.requests += 1;
  c.lastSeenAt = wallStartedAt;
  c.device = device;
  c.appName = app.name;
  c.appVersion = app.version;
  c.channel = app.channel;
  c.platform = platform;
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
    const diagnostics = payloadDiagnostics(payload);
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
      appName: started?.app?.name,
      appVersion: started?.app?.version,
      appChannel: started?.app?.channel,
      appBuild: started?.app?.build,
      platform: started?.platform,
      ticker: started?.signal?.ticker,
      view: started?.signal?.view,
      fieldsCount: started?.signal?.fieldsCount || 0,
      envelope: Boolean(started?.signal?.hasEnvelope),
      contentType: String(res?.getHeader?.('Content-Type') || res?.getHeader?.('content-type') || '').slice(0, 120) || undefined,
      payloadKind: diagnostics.kind,
      payloadRoots: diagnostics.rootKeys,
      payloadSignals: diagnostics.signals,
      payloadPreview: diagnostics.preview,
      deliveryDecision: diagnostics.signals.syncAction || (diagnostics.signals.renderSafe ? 'render_safe' : 'inspect_payload'),
    };
    state.totals.responses += 1;
    state.totals.inFlight = Math.max(0, state.totals.inFlight - 1);
    if (req.__valoraeMetricsId) state.activeRequests.delete(req.__valoraeMetricsId);
    if (status === 499 || options.aborted === true) state.totals.abortedResponses += 1;
    if (options.clientClosed === true) state.totals.clientClosed += 1;
    state.totals.bytesOut += bytesOut;
    if (bytesOut > 0) { state.bytesOutSamples.push(bytesOut); if (state.bytesOutSamples.length > 2000) state.bytesOutSamples.splice(0, state.bytesOutSamples.length - 2000); }
    if (event.interceptor === 'res.end' || event.interceptor === 'res.write+end' || event.interceptor === 'close') state.totals.interceptedByResEnd += 1;
    else state.totals.interceptedBySendJson += 1;
    if (event.interceptor !== 'sendJson') state.totals.directResponses += 1;
    state.totals.writeChunks += safeNumber(options.writeChunks, 0);
    state.totals.writeBytes += safeNumber(options.writeBytes, 0);
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
    updateRouteDetail(route, { response: true, status, at: ts, bytesOut, latencyMs, cacheStatus, sourceStatus, appName: event.appName, channel: event.appChannel, platform: event.platform, payloadKind: event.payloadKind, payloadSignals: event.payloadSignals });
    const c = event.client ? state.clients.get(event.client) : null;
    if (c) {
      c.responses += 1;
      c.bytesOut += bytesOut;
      c.lastStatus = status;
      c.lastSeenAt = ts;
      c.lastRoute = route;
      c.appName = event.appName || c.appName;
      c.appVersion = event.appVersion || c.appVersion;
      c.channel = event.appChannel || c.channel;
      c.platform = event.platform || c.platform;
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
  const originalWrite = res.write;
  const originalEnd = res.end;
  res.__valoraeMetricsEndWrapped = true;
  res.__valoraeMetricsWrittenBytes = 0;
  res.__valoraeMetricsWriteChunks = 0;
  res.__valoraeMetricsBodyPreview = "";

  if (typeof originalWrite === 'function') {
    res.write = function patchedWrite(chunk, encoding, cb) {
      try {
        const enc = encoding && typeof encoding === 'string' ? encoding : 'utf8';
        const n = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk || ''), enc);
        res.__valoraeMetricsWrittenBytes += n;
        res.__valoraeMetricsWriteChunks += 1;
        res.__valoraeMetricsBodyPreview = collectSnippet(res.__valoraeMetricsBodyPreview, chunk, enc);
      } catch {}
      return originalWrite.call(this, chunk, encoding, cb);
    };
  }

  res.end = function patchedEnd(chunk, encoding, cb) {
    if (!req.__valoraeMetricsRecorded) {
      const enc = encoding && typeof encoding === 'string' ? encoding : 'utf8';
      const endBytes = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk || ''), enc);
      const responseBytes = safeNumber(res.__valoraeMetricsWrittenBytes, 0) + endBytes;
      const rawPreview = collectSnippet(res.__valoraeMetricsBodyPreview, chunk, enc);
      const parsedPreview = parseBodyPreview(rawPreview);
      recordResponse(req, res, parsedPreview, {
        interceptor: res.__valoraeMetricsWriteChunks > 0 ? 'res.write+end' : 'res.end',
        responseBytes,
        route: meta.route,
        writeChunks: safeNumber(res.__valoraeMetricsWriteChunks, 0),
        writeBytes: safeNumber(res.__valoraeMetricsWrittenBytes, 0),
      });
    }
    return originalEnd.call(this, chunk, encoding, cb);
  };
  if (typeof res.once === 'function') {
    res.once('close', () => {
      if (req.__valoraeMetricsRecorded || req.__valoraeMetricsIgnored) return;
      const status = res.writableEnded ? safeNumber(res.statusCode, 200) : 499;
      recordResponse(req, res, { status: status === 499 ? 'CLIENT_CLOSED' : 'CLOSED' }, {
        interceptor: 'close',
        responseBytes: safeNumber(res.__valoraeMetricsWrittenBytes, 0),
        route: meta.route,
        status,
        aborted: status === 499,
        clientClosed: status === 499,
        writeChunks: safeNumber(res.__valoraeMetricsWriteChunks, 0),
        writeBytes: safeNumber(res.__valoraeMetricsWrittenBytes, 0),
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
      topApp: Object.entries(r.apps || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      topChannel: Object.entries(r.channels || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      topVercelRegion: Object.entries(r.vercelRegions || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      topHost: Object.entries(r.vercelHosts || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      statusCounts: Object.fromEntries(Object.entries(r.statusCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 8)),
      topCache: Object.entries(r.cacheStatuses || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      topSource: Object.entries(r.sourceStatuses || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      deliveredPayloads: r.deliveredPayloads || 0,
      renderSafeRatePercent: r.deliveredPayloads ? Math.round(((r.renderSafePayloads || 0) / r.deliveredPayloads) * 10000) / 100 : null,
      cacheSafeRatePercent: r.deliveredPayloads ? Math.round(((r.cacheSafePayloads || 0) / r.deliveredPayloads) * 10000) / 100 : null,
      lastPayloadKind: r.lastPayloadKind || null,
      lastPayloadSignals: r.lastPayloadSignals || null,
      metricsDelivered: r.metricsDelivered || 0,
      chartSeriesDelivered: r.chartSeriesDelivered || 0,
      dividendRowsDelivered: r.dividendRowsDelivered || 0,
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
    { name: 'Medição res.end/write', ok: summary.interceptedByResEnd >= 0, detail: `${summary.interceptedByResEnd} respostas diretas/streaming medidas; ${summary.streamedWriteChunks || 0} chunks.` },
    { name: 'Completude de captura', ok: (summary.captureCompletenessPercent || 100) >= 99 || summary.requests === 0, detail: `${summary.captureCompletenessPercent ?? 100}% das solicitações finalizadas foram transformadas em eventos.` },
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
    { name: 'Contexto Vercel visível', ok: true, detail: 'O snapshot expõe vercelRuntime com ambiente, região, host, headers x-vercel-id e origem observada.' },
  ];
}



function buildProxyOutputMonitor(summary = {}, routeDetails = [], vercelRuntime = {}) {
  const events = state.events.slice(-180);
  const responses = events.filter(e => e.status);
  const payloadEvents = responses.filter(e => e.payloadKind && e.payloadKind !== 'unknown');
  const rootCounts = new Map();
  const appContractCounts = new Map();
  for (const e of payloadEvents) {
    for (const root of e.payloadRoots || []) inc(rootCounts, root);
    for (const key of ['hasAppMobileSnapshot','hasAppPayload','hasChartSeries','hasNormalized','hasResults']) {
      if (e.payloadSignals?.[key]) inc(appContractCounts, key.replace(/^has/, ''));
    }
  }
  const outputFeed = responses.slice(-80).reverse().map(e => ({
    id: e.id,
    at: e.at,
    route: e.route,
    method: e.method,
    status: e.status,
    statusFamily: e.family,
    latencyMs: e.latencyMs,
    bytesOut: e.bytesOut,
    contentType: e.contentType,
    appName: e.appName || e.device || 'Consumidor API',
    appVersion: e.appVersion,
    appChannel: e.appChannel,
    appBuild: e.appBuild,
    device: e.device,
    platform: e.platform,
    ticker: e.ticker || e.payloadSignals?.ticker,
    view: e.view,
    cacheStatus: e.cacheStatus,
    sourceStatus: e.sourceStatus,
    interceptor: e.interceptor,
    deliveryDecision: e.deliveryDecision,
    payloadKind: e.payloadKind,
    payloadRoots: e.payloadRoots || [],
    payloadSignals: e.payloadSignals || {},
    payloadPreview: e.payloadPreview,
    requestId: e.requestId,
  }));
  const routeOutputs = routeDetails
    .filter(r => r.responses > 0)
    .sort((a, b) => (b.deliveredPayloads || 0) - (a.deliveredPayloads || 0) || b.responses - a.responses)
    .slice(0, 24)
    .map(r => ({
      route: r.route,
      requests: r.requests,
      responses: r.responses,
      bytesOut: r.bytesOut,
      avgBytesOut: r.avgBytesOut,
      p95LatencyMs: r.p95LatencyMs,
      errorRatePercent: r.errorRatePercent,
      deliveredPayloads: r.deliveredPayloads || 0,
      renderSafeRatePercent: r.renderSafeRatePercent,
      cacheSafeRatePercent: r.cacheSafeRatePercent,
      metricsDelivered: r.metricsDelivered || 0,
      chartSeriesDelivered: r.chartSeriesDelivered || 0,
      dividendRowsDelivered: r.dividendRowsDelivered || 0,
      topApp: r.topApp,
      topChannel: r.topChannel,
      topVercelRegion: r.topVercelRegion,
      topHost: r.topHost,
      lastPayloadKind: r.lastPayloadKind,
      lastPayloadSignals: r.lastPayloadSignals,
    }));
  const payloadCoveragePercent = responses.length ? Math.round((payloadEvents.length / responses.length) * 10000) / 100 : 100;
  const transformedForApps = payloadEvents.filter(e => e.payloadSignals?.hasAppMobileSnapshot || e.payloadSignals?.hasAppPayload || e.payloadSignals?.hasChartSeries || e.payloadSignals?.hasNormalized).length;
  const appCoveragePercent = payloadEvents.length ? Math.round((transformedForApps / payloadEvents.length) * 10000) / 100 : 100;
  const bytesOutRecent = responses.reduce((n, e) => n + safeNumber(e.bytesOut, 0), 0);
  return {
    title: 'Proxy Output Monitor',
    purpose: 'Espelha as respostas que saem do proxy para apps/usuários: rota, consumidor, payload transformado, métricas, gráficos, cache, fonte e prévia limitada do JSON entregue.',
    scope: {
      captures: 'Toda resposta de rota de dados /api/* que sai do proxy para app/usuário, mesmo quando o cliente envia headers de dashboard/test/probe.',
      excludes: 'Somente polling interno e rotas administrativas/diagnóstico como /api/server/metrics, /api/ready, /api/cache/stats, /api/openapi, /api/fields etc.',
      persistence: 'memória da instância serverless atual; sem banco/Redis/KV para manter compatibilidade com Vercel Free.',
      important: 'Para ver 100% do ecossistema em produção, todos os apps precisam consumir esta mesma URL/deploy do proxy. x-valorae-app/x-valorae-channel ajudam a identificar consumidor, mas não são obrigatórios para capturar a saída.',
      capturePolicy: 'O interceptador central é instalado antes de CORS, body parsing e despacho. Rotas de dados nunca são ignoradas por x-valorae-telemetry; apenas rotas internas são isoladas para não inflar o tráfego real.',
      instanceScope: `Snapshot da instância ${state.instanceId}. Em Vercel serverless, outra instância pode manter contadores independentes até haver persistência externa.`,
    },
    totals: {
      externalRequests: summary.requests || 0,
      completedRequests: summary.completedRequests || 0,
      captureGap: summary.captureGap || 0,
      captureHealth: summary.captureHealth || 'complete',
      captureCompletenessPercent: summary.captureCompletenessPercent ?? 100,
      centralInterceptorInstalled: summary.centralInterceptorInstalled === true,
      sendJsonResponses: summary.interceptedBySendJson || 0,
      directResponses: summary.interceptedByResEnd || 0,
      internalTelemetryRequests: summary.internalTelemetryRequests || 0,
      instanceId: state.instanceId,
      instanceUptimeSeconds: Math.max(1, secondsBetween(state.bootedAt)),
      outboundResponses: summary.responses || 0,
      outboundBytes: summary.bytesOut || 0,
      recentWindowResponses: responses.length,
      recentWindowBytes: bytesOutRecent,
      payloadResponses: payloadEvents.length,
      transformedForApps,
      payloadCoveragePercent,
      appCoveragePercent,
      renderSafePayloads: payloadEvents.filter(e => e.payloadSignals?.renderSafe === true).length,
      cacheSafePayloads: payloadEvents.filter(e => e.payloadSignals?.cacheSafe === true).length,
      mobileSnapshots: payloadEvents.filter(e => e.payloadSignals?.hasAppMobileSnapshot === true).length,
      chartSeries: payloadEvents.reduce((n, e) => n + safeNumber(e.payloadSignals?.charts, 0), 0),
      chartPoints: payloadEvents.reduce((n, e) => n + safeNumber(e.payloadSignals?.chartPoints, 0), 0),
      metrics: payloadEvents.reduce((n, e) => n + safeNumber(e.payloadSignals?.metrics, 0), 0),
      indicatorFields: payloadEvents.reduce((n, e) => n + safeNumber(e.payloadSignals?.indicatorFields, 0), 0),
      avgIndicatorCoveragePercent: payloadEvents.length ? round2(payloadEvents.reduce((n, e) => n + safeNumber(e.payloadSignals?.indicatorCoveragePercent, 0), 0) / payloadEvents.length) : null,
      avgEngineMaturityScore: payloadEvents.length ? round2(payloadEvents.reduce((n, e) => n + safeNumber(e.payloadSignals?.engineMaturityScore, 0), 0) / payloadEvents.length) : null,
    avgFieldConsistencyScore: payloadEvents.length ? round2(payloadEvents.reduce((n, e) => n + safeNumber(e.payloadSignals?.fieldConsistencyScore, 0), 0) / payloadEvents.length) : null,
    avgAssetActionScore: payloadEvents.length ? round2(payloadEvents.reduce((n, e) => n + safeNumber(e.payloadSignals?.assetActionScore, 0), 0) / payloadEvents.length) : null,
      dividends: payloadEvents.reduce((n, e) => n + safeNumber(e.payloadSignals?.dividends, 0), 0),
    },
    liveStatus: {
      trafficState: summary.trafficState,
      captureCompletenessPercent: summary.captureCompletenessPercent,
      lastExternalEventAt: summary.lastExternalEventAt,
      quietForSeconds: summary.quietForSeconds,
      vercelSource: vercelRuntime?.observed?.source,
      vercelHost: vercelRuntime?.observed?.lastHost || vercelRuntime?.url,
      vercelRegion: vercelRuntime?.observed?.lastRegion || vercelRuntime?.region,
    },
    rootCoverage: topMap(rootCounts, 32),
    appContractCoverage: topMap(appContractCounts, 12),
    routeOutputs,
    outputFeed,
    selectedOutput: outputFeed[0] || null,
  };
}

function buildDeliveryHarmony(summary = {}, routeDetails = [], payloadEvents = [], vercelRuntime = {}) {
  const appReady = payloadEvents.filter(e => e.payloadSignals?.renderSafe === true).length;
  const cacheSafe = payloadEvents.filter(e => e.payloadSignals?.cacheSafe === true).length;
  const mobileReady = payloadEvents.filter(e => e.payloadSignals?.hasAppMobileSnapshot === true).length;
  const richReady = payloadEvents.filter(e => e.payloadSignals?.hasAppPayload === true || e.payloadSignals?.hasChartSeries === true).length;
  const metricsPerPayload = payloadEvents.length ? payloadEvents.reduce((n, e) => n + safeNumber(e.payloadSignals?.metrics, 0), 0) / payloadEvents.length : 0;
  const chartsPerPayload = payloadEvents.length ? payloadEvents.reduce((n, e) => n + safeNumber(e.payloadSignals?.charts, 0), 0) / payloadEvents.length : 0;
  const transformScore = payloadEvents.length ? scoreClamp(25 + Math.min(35, metricsPerPayload * 4) + Math.min(20, chartsPerPayload * 8) + Math.min(20, (mobileReady / payloadEvents.length) * 20)) : 100;
  const appDeliveryScore = payloadEvents.length ? scoreClamp((appReady / payloadEvents.length) * 55 + (cacheSafe / payloadEvents.length) * 25 + (mobileReady / payloadEvents.length) * 20) : 100;
  const pipeline = [
    { stage: 'vercel_runtime', label: 'Vercel Runtime', ok: Boolean(vercelRuntime.detected) || summary.requests === 0, detail: `${vercelRuntime.env || 'local'} · região ${vercelRuntime.region || 'local'} · host ${(vercelRuntime.observed?.lastHost || vercelRuntime.url || 'não observado')}` },
    { stage: 'vercel_router', label: 'Vercel Router', ok: true, detail: 'api/router.js direciona todo /api/* para o router único compatível com Vercel Free.' },
    { stage: 'proxy_capture', label: 'Captura proxy', ok: (summary.captureCompletenessPercent || 100) >= 99 || summary.requests === 0, detail: `${summary.captureCompletenessPercent ?? 100}% das requisições reais viraram eventos.` },
    { stage: 'engine_transform', label: 'Engine transforma', ok: transformScore >= 70 || payloadEvents.length === 0, detail: `${payloadEvents.length} payload(s) com ${summary.payloadTotalMetricsObserved || 0} métricas e ${summary.payloadTotalChartSeriesObserved || 0} séries.` },
    { stage: 'app_contract', label: 'Contrato para apps', ok: appDeliveryScore >= 70 || payloadEvents.length === 0, detail: `${appReady}/${payloadEvents.length} renderSafe, ${mobileReady}/${payloadEvents.length} com snapshot mobile.` },
    { stage: 'dashboard_visibility', label: 'Painel mostra saída', ok: true, detail: 'Eventos recentes e proxyOutputMonitor expõem cada saída do proxy: rota, app, sinais, raízes, decisão de sync e prévia limitada do JSON entregue.' },
  ];
  const byApp = new Map();
  for (const e of payloadEvents) {
    const key = e.appName || e.device || 'Consumidor desconhecido';
    const row = byApp.get(key) || { name: key, responses: 0, renderSafe: 0, cacheSafe: 0, metrics: 0, charts: 0, chartPoints: 0, lastAt: null, lastRoute: null, channel: e.appChannel || null };
    row.responses += 1;
    if (e.payloadSignals?.renderSafe === true) row.renderSafe += 1;
    if (e.payloadSignals?.cacheSafe === true) row.cacheSafe += 1;
    row.metrics += safeNumber(e.payloadSignals?.metrics, 0);
    row.charts += safeNumber(e.payloadSignals?.charts, 0);
    row.chartPoints += safeNumber(e.payloadSignals?.chartPoints, 0);
    row.lastAt = e.at;
    row.lastRoute = e.route;
    row.channel = e.appChannel || row.channel;
    byApp.set(key, row);
  }
  return {
    score: scoreClamp((summary.healthScore || 100) * 0.25 + (summary.sourceReliabilityScore || 100) * 0.2 + transformScore * 0.25 + appDeliveryScore * 0.3),
    transformScore,
    appDeliveryScore,
    payloadsDelivered: payloadEvents.length,
    renderSafePayloads: appReady,
    cacheSafePayloads: cacheSafe,
    mobileSnapshotsDelivered: mobileReady,
    richPayloadsDelivered: richReady,
    pipeline,
    apps: [...byApp.values()].sort((a, b) => b.responses - a.responses).slice(0, 12),
    topRoutes: routeDetails.filter(r => r.deliveredPayloads > 0).sort((a, b) => b.deliveredPayloads - a.deliveredPayloads).slice(0, 12).map(r => ({ route: r.route, payloads: r.deliveredPayloads, renderSafeRatePercent: r.renderSafeRatePercent, metrics: r.metricsDelivered, charts: r.chartSeriesDelivered, dividends: r.dividendRowsDelivered, app: r.topApp, channel: r.topChannel, region: r.topVercelRegion, host: r.topHost })),
  };
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


function buildMonitorBlueprint(summary = {}, routeDetails = [], payloadIntelligence = {}, vercelRuntime = {}) {
  const observedRoutes = (routeDetails || []).slice(0, 28).map(r => ({
    route: r.route,
    method: r.topMethod || 'GET/POST',
    input: r.route?.includes('portfolio') ? 'carteira, posições, transações ou tickers' : r.route?.includes('asset') || r.route?.includes('scraper') ? 'ticker, URL, view, fields e modo' : r.route?.includes('market') ? 'índice, período ou tipo de ranking' : 'query, headers e parâmetros HTTP',
    output: r.lastPayloadKind || 'json_status',
    responses: r.responses || 0,
    p95LatencyMs: r.p95LatencyMs,
    avgBytesOut: r.avgBytesOut || 0,
    renderSafeRatePercent: r.renderSafeRatePercent,
    cacheSafeRatePercent: r.cacheSafeRatePercent,
    topApp: r.topApp,
    topChannel: r.topChannel,
    lastPayloadSignals: r.lastPayloadSignals || null,
  }));
  const staticRoutes = [
    { group: 'Ativos', route: '/api/asset, /api/assets, /api/scraper', input: 'ticker, URL do ativo, view, mode, fields, headers do app', output: 'appMobileSnapshot, appPayload, graficos_i10, chart_manifest e JSON compatível com APK' },
    { group: 'Carteira', route: '/api/portfolio/*', input: 'posições, quantidades, preços médios, eventos e parâmetros de análise', output: 'resumo, alocação, renda, risco, rebalanceamento, histórico e próximos dividendos' },
    { group: 'Mercado', route: '/api/market/*, /api/compare', input: 'índices, tickers, range, ranking e filtros', output: 'séries, comparação, rankings, IPCA e dados auxiliares' },
    { group: 'Integração', route: '/api/integration/*, /api/openapi, /api/fields', input: 'requisição de manifesto/SDK/contrato', output: 'contratos, exemplos, prompts técnicos e mapa de campos' },
    { group: 'Operação', route: '/api/server/metrics, /api/ready, /api/source/status', input: 'polling interno e diagnóstico', output: 'métricas, saúde, readiness, fontes e monitorBlueprint' },
    { group: 'Supabase Sync', route: '/api/sync', input: 'snapshot, transações, proventos, Bearer JWT ou credenciais locais do APK', output: 'health, diagnostics, upsert/get e delete_user_data em Supabase opcional' },
  ];
  return {
    title: 'Monitor Proxy Profissional',
    version: `${VALORAE_RELEASE_PATCH}-professional-monitor`,
    purpose: 'Explicar e monitorar, em uma única superfície, tecnologias, entradas, processamento, saídas, contratos e riscos operacionais do proxy.',
    runtimeSummary: {
      environment: vercelRuntime?.environment || vercelRuntime?.env || 'local/serverless',
      region: vercelRuntime?.observed?.lastRegion || vercelRuntime?.region || 'não observada',
      host: vercelRuntime?.observed?.lastHost || vercelRuntime?.host || vercelRuntime?.url || 'não observado',
      uptimeSeconds: summary.uptimeSeconds,
      trafficState: summary.trafficState,
      operationalState: summary.operationalState,
    },
    technologies: [
      { name: 'Node.js 24', layer: 'Runtime', role: 'Executa rotas serverless e normalização JSON sem servidor dedicado.' },
      { name: 'Vercel Serverless', layer: 'Deploy', role: 'Hospeda /api/* sem banco externo, filas pagas, WebSocket obrigatório ou filesystem persistente.' },
      { name: 'Router único /api', layer: 'Entrada', role: 'Centraliza compatibilidade de rotas, versões /api/v1 e handlers legados.' },
      { name: 'Fetch HTTP nativo', layer: 'Coleta', role: 'Cliente adaptativo com timeout, limite de corpo, retry controlado, ETag/Last-Modified e cache de resultado.' },
      { name: 'Normalizadores financeiros', layer: 'Transformação', role: 'Convertem números, datas, indicadores, gráficos e contratos mobile para formatos renderizáveis.' },
      { name: 'Observabilidade em memória', layer: 'Monitor', role: 'Mede rotas, latência, payloads, entradas/saídas, cache, fontes, consumidores e qualidade por instância.' },
      { name: 'Supabase REST opcional', layer: 'Persistência', role: 'Quando configurado no Vercel, sincroniza snapshots, transações e proventos sem dependência @supabase/supabase-js.' },
      { name: 'PWA HTML/CSS/JS puro', layer: 'Interface', role: 'Monitor leve, instalável e sem dependências externas para facilitar manutenção no AI Studio.' },
      { name: 'Contrato APK JSON', layer: 'Saída', role: 'Entrega appMobileSnapshot, appPayload, appSyncEnvelope e catálogo de gráficos para Android/Web.' },
    ],
    inputChannels: [
      { name: 'APK Android', method: 'GET/POST', examples: ['/api/scraper mode=fundamentos', '/api/asset?ticker=BBAS3&view=app'], headers: ['x-valorae-app', 'x-valorae-channel', 'x-valorae-app-version'], risk: 'campos ausentes ou payload pesado', control: 'view=app, contratos renderSafe e manifest de gráficos' },
      { name: 'Web/PWA', method: 'GET', examples: ['/api/assets?tickers=PETR4,MXRF11', '/api/portfolio/summary'], headers: ['accept', 'origin'], risk: 'CORS ou cache incorreto', control: 'headers seguros, ETag e CORS controlado' },
      { name: 'AI Studio / testes', method: 'GET/POST', examples: ['/api/openapi', '/api/server/tests', '/api/fields'], headers: ['x-valorae-telemetry'], risk: 'telemetria poluir tráfego real', control: 'rotas internas isoladas do contador principal' },
      { name: 'Supabase Sync', method: 'GET/POST/DELETE', examples: ['/api/sync?action=health', '/api/sync?action=diagnostics', '/api/sync?action=upsert_snapshot'], headers: ['authorization', 'x-valorae-user-id', 'x-valorae-client-secret', 'x-valorae-sync-token'], risk: 'variáveis/tabelas ausentes ou CORS sem headers de sync', control: 'diagnostics real, headers permitidos e service role apenas no Vercel' },
      { name: 'Fonte pública', method: 'HTTPS', examples: ['páginas de ativos, FIIs, ETFs, BDRs e dados auxiliares'], headers: ['user-agent estável', 'if-none-match', 'if-modified-since'], risk: 'drift, bloqueio, HTML parcial', control: 'cache stale-if-error, circuit breaker, fallback e renderable=false' },
    ],
    outputChannels: [
      { name: 'Snapshot mobile', payload: 'appMobileSnapshot', consumer: 'primeira pintura do APK', guarantee: 'pequeno, cacheável e seguro para renderização' },
      { name: 'Payload completo de app', payload: 'appPayload', consumer: 'telas detalhadas do APK/Web', guarantee: 'métricas canônicas, aliases e grupos de dados' },
      { name: 'Catálogo gráfico', payload: 'graficos_i10 + chart_manifest', consumer: 'cards e gráficos do ativo', guarantee: 'id, título, tipo visual, fonte, renderable e pontos reais' },
      { name: 'Envelope de sincronização', payload: 'appSyncEnvelope', consumer: 'cache local do app', guarantee: 'decisão replace/keep, hash e segurança de atualização' },
      { name: 'Persistência Supabase', payload: 'snapshots, transactions, dividend_events', consumer: 'APK autenticado ou cliente local registrado', guarantee: 'salva/busca dados quando /api/sync?action=diagnostics está OK' },
      { name: 'Diagnóstico operacional', payload: 'proxyOutputMonitor + monitorBlueprint', consumer: 'monitor profissional', guarantee: 'rotas, tecnologias, entradas, saídas, riscos e preview limitado' },
    ],
    dataFlow: [
      { step: 1, title: 'Entrada normalizada', input: 'URL, body, headers, ticker, view, fields e modo', output: 'rota, consumidor, canal, ticker e orçamento de payload', controls: ['CORS', 'rate limit', 'request-id', 'validação de método'] },
      { step: 2, title: 'Coleta resiliente', input: 'fonte HTTPS e cache existente', output: 'HTML/JSON bruto com metadados de fonte', controls: ['timeout', 'retry com backoff', 'limite de corpo', 'allowlist/SSRF guard'] },
      { step: 3, title: 'Extração e normalização', input: 'blocos brutos de página/API', output: 'métricas, indicadores, gráficos, dividendos e contratos canônicos', controls: ['parse tolerante', 'fallback', 'remoção de NaN/Infinity', 'unidades financeiras'] },
      { step: 4, title: 'Contrato mobile', input: 'dados canônicos normalizados', output: 'appMobileSnapshot, appPayload, appSyncEnvelope, chart_manifest', controls: ['renderSafe', 'cacheSafe', 'payloadBudget', 'fieldConsistencyGuard'] },
      { step: 5, title: 'Saída observada', input: 'JSON final enviado ao cliente', output: 'evento no monitor com latência, bytes, roots, charts e preview limitado', controls: ['preview limitado', 'telemetria interna isolada', 'sem persistência sensível'] },
    ],
    securityControls: [
      'Bloqueio de URL insegura e defesa contra SSRF nas rotas de scraping.',
      'Headers de segurança aplicados nas rotas administrativas e JSON.',
      'Rate limit separado para health, métricas, admin e rotas de dados.',
      'Rotas internas não contaminam os gráficos de tráfego real.',
      'Prévia de payload limitada e desativável por variável de ambiente.',
      'Sem dependência obrigatória de banco externo; Supabase é opcional e fica isolado em /api/sync.',
      'Service role key do Supabase nunca é enviada ao APK e deve existir somente no Vercel.',
    ],
    resilienceControls: [
      'Cache em memória com stale-if-error para reduzir quebras por instabilidade de fonte.',
      'Circuit breaker, failure cache e coalescing de requisições repetidas.',
      'Contratos com campos opcionais e renderable=false quando o dado real não está disponível.',
      'Normalização de datas, números abreviados, aliases snake_case/camelCase e classes de ativo.',
      'Score de qualidade, completude, payload budget e plano de ação por resposta.',
    ],
    contracts: [
      { name: 'Android simples', route: 'POST /api/scraper', input: '{ mode: fundamentos, ticker }', output: '{ json: ... }' },
      { name: 'Android recomendado', route: 'GET /api/asset?ticker=BBAS3&view=app', input: 'ticker + view=app', output: 'appMobileSnapshot + appPayload + appSyncEnvelope' },
      { name: 'Gráficos fiéis', route: 'campos dentro de fundamentos/asset', input: 'graficos_i10 / chart_manifest', output: 'séries reais, status de fonte e renderable por bloco' },
      { name: 'Diagnóstico', route: 'GET /api/server/metrics', input: 'polling do monitor', output: 'summary, routeDetails, proxyOutputMonitor e monitorBlueprint' },
      { name: 'Supabase Sync', route: 'GET/POST /api/sync', input: 'action=health/diagnostics/upsert/get + credenciais', output: 'status real de configuração, tabelas e sincronização' },
    ],
    supabaseSync: {
      route: '/api/sync',
      configured: Boolean(process.env.SUPABASE_URL || process.env.VALORAE_SUPABASE_URL),
      serviceKeyConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VALORAE_SUPABASE_SERVICE_ROLE_KEY),
      diagnosticsRoute: '/api/sync?action=diagnostics',
      tables: {
        snapshots: process.env.VALORAE_SUPABASE_SNAPSHOT_TABLE || 'valorae_user_snapshots',
        clients: process.env.VALORAE_SUPABASE_CLIENTS_TABLE || 'valorae_sync_clients',
        transactions: process.env.VALORAE_SUPABASE_TRANSACTIONS_TABLE || 'valorae_transactions',
        dividends: process.env.VALORAE_SUPABASE_DIVIDENDS_TABLE || 'valorae_dividend_events',
      },
    },
    endpointGroups: staticRoutes,
    observedRoutes,
    payloadRoots: payloadIntelligence.recentRoots || [],
    counters: {
      requests: summary.requests || 0,
      responses: summary.responses || 0,
      inFlight: summary.inFlight || 0,
      bytesOut: summary.bytesOut || 0,
      routesTracked: summary.routesTracked || routeDetails.length,
      observedPayloads: payloadIntelligence.observedPayloads || 0,
      totalChartSeriesObserved: payloadIntelligence.totalChartSeriesObserved || 0,
      totalChartPointsObserved: payloadIntelligence.totalChartPointsObserved || 0,
    },
  };
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
  const completedRequests = Math.max(0, state.totals.requests - state.totals.inFlight);
  const captureGap = Math.max(0, completedRequests - state.totals.responses);
  const dashboardIntegrityScore = scoreClamp(100 - captureGap * 5);
  const captureCompletenessPercent = completedRequests ? clamp(Math.round((state.totals.responses / completedRequests) * 10000) / 100, 0, 100) : 100;
  const captureHealth = captureGap === 0 ? 'complete' : (captureCompletenessPercent >= 95 ? 'attention' : 'degraded');
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
  const payloadEvents = state.events.filter(e => e.payloadKind && e.payloadKind !== 'unknown');
  const payloadIntelligence = {
    observedPayloads: payloadEvents.length,
    kinds: topMap(payloadEvents.reduce((m, e) => { inc(m, e.payloadKind); return m; }, new Map()), 12),
    tickers: topMap(state.tickers, 24),
    lastPayloadAt: payloadEvents.length ? payloadEvents[payloadEvents.length - 1].at : null,
    totalMetricsObserved: payloadEvents.reduce((n, e) => n + safeNumber(e.payloadSignals?.metrics, 0), 0),
    totalChartSeriesObserved: payloadEvents.reduce((n, e) => n + safeNumber(e.payloadSignals?.charts, 0), 0),
    totalChartPointsObserved: payloadEvents.reduce((n, e) => n + safeNumber(e.payloadSignals?.chartPoints, 0), 0),
    totalDividendRowsObserved: payloadEvents.reduce((n, e) => n + safeNumber(e.payloadSignals?.dividends, 0), 0),
    recentRoots: [...new Set(payloadEvents.slice(-24).flatMap(e => e.payloadRoots || []))].slice(0, 40),
    capturePreviewEnabled: process.env.VALORAE_METRICS_CAPTURE_PREVIEW !== '0',
    note: 'Mostra estrutura, sinais e prévia limitada dos payloads que atravessaram o proxy. Não usa banco externo para manter compatibilidade Vercel Free.',
  };

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
    captureCompletenessPercent,
    completedRequests,
    captureGap,
    captureHealth,
    centralInterceptorInstalled: true,
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
    directResponsesCaptured: state.totals.directResponses,
    streamedWriteChunks: state.totals.writeChunks,
    streamedWriteBytes: state.totals.writeBytes,
    payloadTotalMetricsObserved: payloadIntelligence.totalMetricsObserved,
    payloadTotalChartSeriesObserved: payloadIntelligence.totalChartSeriesObserved,
    payloadTotalChartPointsObserved: payloadIntelligence.totalChartPointsObserved,
    payloadTotalDividendRowsObserved: payloadIntelligence.totalDividendRowsObserved,
  };
  const vercelRuntime = getVercelRuntimeSnapshot();
  const deliveryHarmony = buildDeliveryHarmony(summary, routeDetails, payloadEvents, vercelRuntime);
  const proxyOutputMonitor = buildProxyOutputMonitor(summary, routeDetails, vercelRuntime);
  const monitorBlueprint = buildMonitorBlueprint(summary, routeDetails, payloadIntelligence, vercelRuntime);
  const personalReleaseReadiness = buildPersonalReleaseReadiness({ metrics: { summary, eventsStored: state.events.length, routesTracked: state.routes.size, deliveryHarmony, monitorBlueprint }, proxyOutputMonitor, deliveryHarmony });
  return {
    ok: true,
    name: 'Valorae Proxy Server Metrics',
    version: VALORAE_SERVER_METRICS_VERSION,
    releasePatch: VALORAE_RELEASE_PATCH,
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
    payloadIntelligence,
    vercelRuntime,
    deliveryHarmony,
    proxyOutputMonitor,
    monitorBlueprint,
    personalReleaseReadiness,
    distributions: {
      status: topMap(state.status, 16),
      statusFamily: topMap(state.statusFamily, 8),
      methods: topMap(state.methods, 10),
      routes: topMap(state.routes, 32),
      cache: topMap(state.cache, 12),
      source: topMap(state.source, 12),
      devices: topMap(state.devices, 10),
      apps: topMap(state.apps, 12),
      channels: topMap(state.channels, 12),
      vercelRegions: topMap(state.vercelRegions, 12),
      vercelHosts: topMap(state.vercelHosts, 12),
      vercelCountries: topMap(state.vercelCountries, 12),
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
      appName: c.appName,
      appVersion: c.appVersion,
      channel: c.channel,
      requests: c.requests,
      responses: c.responses,
      errors: c.errors,
      bytesOut: c.bytesOut,
      lastRoute: c.lastRoute,
      lastStatus: c.lastStatus,
      platform: c.platform,
      firstSeenAt: nowIso(c.firstSeenAt),
      lastSeenAt: nowIso(c.lastSeenAt),
    })),
  };
}

export function resetServerMetricsForTests() {
  state.seq = 0;
  state.totals = emptyTotals();
  state.status.clear(); state.statusFamily.clear(); state.methods.clear(); state.routes.clear(); state.routeDetails.clear(); state.cache.clear(); state.source.clear(); state.devices.clear(); state.apps.clear(); state.channels.clear(); state.vercelRegions.clear(); state.vercelHosts.clear(); state.vercelCountries.clear(); state.tickers.clear(); state.views.clear(); state.clients.clear(); state.interceptors.clear(); state.buckets.clear();
  state.latencies = []; state.bytesOutSamples = []; state.bytesInSamples = []; state.events = []; state.activeRequests.clear(); state.internalTelemetry = { requests: 0, lastAt: null, routes: new Map(), vercelHeadersRequests: 0, platform: null, vercelRegions: new Map(), vercelHosts: new Map(), vercelCountries: new Map() };
}

export const _test = { normalizeRoutePath, isInternalTelemetryRoute, shouldIgnoreMetrics, appContext, payloadDiagnostics };
