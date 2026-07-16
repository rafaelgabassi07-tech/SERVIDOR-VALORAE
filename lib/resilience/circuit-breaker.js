import { getSharedState, setSharedState, sharedStateDriverInfo } from '../state/shared-runtime-state.js';

const DEFAULT_FAILURE_THRESHOLD = Number(process.env.VALORAE_CIRCUIT_FAILURE_THRESHOLD || 4);
const DEFAULT_COOLDOWN_MS = Number(process.env.VALORAE_CIRCUIT_COOLDOWN_MS || 5 * 60 * 1000);
const DEFAULT_SUCCESS_RESET = Number(process.env.VALORAE_CIRCUIT_SUCCESS_RESET || 2);
const WINDOW_LIMIT = Number(process.env.VALORAE_CIRCUIT_WINDOW_LIMIT || 40);
const state = globalThis.__VALORAE_PROVIDER_HEALTH_STATE__ || new Map();
globalThis.__VALORAE_PROVIDER_HEALTH_STATE__ = state;
const DEFAULT_PROVIDERS = Object.freeze(['Investidor10','StatusInvest','YahooChart','GoogleNews','BancoCentral','YahooHistory']);
const sharedRuntime = globalThis.__VALORAE_PROVIDER_HEALTH_SHARED_RUNTIME__ || { hydratedAt: 0, hydration: null, timers: new Map(), persisted: 0, hydrationHits: 0, hydrationMisses: 0, errors: 0 };
globalThis.__VALORAE_PROVIDER_HEALTH_SHARED_RUNTIME__ = sharedRuntime;

function nowIso() { return new Date().toISOString(); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, Number(n || 0))); }


function sharedKey(name) {
  return String(name || 'unknown').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(0, 80) || 'unknown';
}

function serializableEntry(value = {}) {
  return {
    provider: String(value.provider || 'unknown'),
    status: String(value.status || 'healthy'),
    failures: Number(value.failures || 0),
    successes: Number(value.successes || 0),
    openedAt: value.openedAt || null,
    cooldownUntil: value.cooldownUntil || null,
    lastError: value.lastError || null,
    lastErrorType: value.lastErrorType || null,
    lastStatus: value.lastStatus ?? null,
    updatedAt: value.updatedAt || nowIso(),
    rolling: Array.isArray(value.rolling) ? value.rolling.slice(-WINDOW_LIMIT) : [],
    score: Number(value.score ?? 100),
    avgLatencyMs: Number(value.avgLatencyMs || 0),
    errorRatePercent: Number(value.errorRatePercent || 0),
    retryAfterMs: Number(value.retryAfterMs || 0),
  };
}

function scheduleSharedPersist(name, value) {
  if (sharedStateDriverInfo().enabled !== true) return;
  const key = sharedKey(name);
  const previous = sharedRuntime.timers.get(key);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(() => {
    sharedRuntime.timers.delete(key);
    void setSharedState('provider-health', key, serializableEntry(value), {
      ttlMs: Math.max(60_000, Number(process.env.VALORAE_PROVIDER_HEALTH_SHARED_TTL_MS || 30 * 60 * 1000)),
    }).then(result => {
      if (result?.stored) sharedRuntime.persisted += 1;
    }).catch(() => { sharedRuntime.errors += 1; });
  }, 25);
  timer.unref?.();
  sharedRuntime.timers.set(key, timer);
}

function mergeSharedProviderState(name, remoteValue) {
  if (!remoteValue || typeof remoteValue !== 'object') return false;
  const local = entry(name);
  const remoteUpdated = Date.parse(remoteValue.updatedAt || '') || 0;
  const localUpdated = Date.parse(local.updatedAt || '') || 0;
  if (localUpdated > remoteUpdated) return false;
  Object.assign(local, serializableEntry({ ...remoteValue, provider: name }));
  computeScore(local);
  return true;
}

export async function hydrateProviderHealthFromSharedState(names = DEFAULT_PROVIDERS, options = {}) {
  if (sharedStateDriverInfo().enabled !== true) return { hydrated: false, reason: 'disabled', hits: 0 };
  const maxAgeMs = Math.max(250, Number(options.maxAgeMs || process.env.VALORAE_PROVIDER_HEALTH_HYDRATE_INTERVAL_MS || 15_000));
  if (!options.force && sharedRuntime.hydratedAt && Date.now() - sharedRuntime.hydratedAt < maxAgeMs) {
    return { hydrated: true, reason: 'recent', hits: 0 };
  }
  if (sharedRuntime.hydration) return sharedRuntime.hydration;
  const unique = [...new Set((Array.isArray(names) ? names : [names]).filter(Boolean).map(String))];
  sharedRuntime.hydration = (async () => {
    const results = await Promise.all(unique.map(async name => {
      try {
        const record = await getSharedState('provider-health', sharedKey(name));
        if (record?.value && mergeSharedProviderState(name, record.value)) {
          sharedRuntime.hydrationHits += 1;
          return 1;
        }
        sharedRuntime.hydrationMisses += 1;
        return 0;
      } catch {
        sharedRuntime.errors += 1;
        return 0;
      }
    }));
    const hits = results.reduce((sum, value) => sum + value, 0);
    sharedRuntime.hydratedAt = Date.now();
    return { hydrated: true, reason: 'completed', hits };
  })().finally(() => { sharedRuntime.hydration = null; });
  return sharedRuntime.hydration;
}

export function providerHealthSharedStateStats() {
  return {
    hydratedAt: sharedRuntime.hydratedAt ? new Date(sharedRuntime.hydratedAt).toISOString() : null,
    hydrationInFlight: Boolean(sharedRuntime.hydration),
    pendingPersists: sharedRuntime.timers.size,
    persisted: sharedRuntime.persisted,
    hydrationHits: sharedRuntime.hydrationHits,
    hydrationMisses: sharedRuntime.hydrationMisses,
    errors: sharedRuntime.errors,
  };
}

function entry(name) {
  const key = String(name || 'unknown');
  if (!state.has(key)) {
    state.set(key, {
      provider: key,
      status: 'healthy',
      failures: 0,
      successes: 0,
      openedAt: null,
      cooldownUntil: null,
      lastError: null,
      lastErrorType: null,
      lastStatus: null,
      updatedAt: null,
      rolling: [],
      score: 100,
      avgLatencyMs: 0,
      errorRatePercent: 0,
      retryAfterMs: 0,
    });
  }
  return state.get(key);
}

function computeScore(e) {
  const rolling = e.rolling || [];
  const total = rolling.length;
  const failures = rolling.filter(x => !x.ok).length;
  const blocked = rolling.filter(x => x.blocked || x.status === 429 || x.status === 403 || x.errorType === 'WAF_DETECTED').length;
  const retryable = rolling.filter(x => x.retryable).length;
  const avgLatencyMs = total ? Math.round(rolling.reduce((sum, x) => sum + Number(x.latencyMs || 0), 0) / total) : 0;
  const errorRatePercent = total ? Math.round((failures / total) * 10000) / 100 : 0;
  const latencyPenalty = avgLatencyMs > 0 ? Math.min(18, avgLatencyMs / 600) : 0;
  const score = Math.round(clamp(100 - errorRatePercent * 0.72 - blocked * 7 - retryable * 2 - latencyPenalty - Math.max(0, e.failures - 1) * 5, 0, 100));
  e.score = score;
  e.avgLatencyMs = avgLatencyMs;
  e.errorRatePercent = errorRatePercent;
  return score;
}

export function providerNameForHost(hostname = '') {
  const h = String(hostname || '').toLowerCase();
  if (h.includes('investidor10.com.br')) return 'Investidor10';
  if (h.includes('statusinvest.com.br')) return 'StatusInvest';
  if (h.includes('finance.yahoo.com')) return 'YahooChart';
  if (h.includes('news.google.com')) return 'GoogleNews';
  if (h.includes('bcb.gov.br') || h.includes('bancocentral')) return 'BancoCentral';
  return h || 'UnknownSource';
}

export function isProviderAvailable(name) {
  const e = entry(name);
  if (e.status !== 'degraded') return true;
  if (!e.cooldownUntil) return true;
  const remaining = new Date(e.cooldownUntil).getTime() - Date.now();
  e.retryAfterMs = Math.max(0, remaining);
  if (remaining <= 0) {
    e.status = 'half-open';
    e.updatedAt = nowIso();
    e.retryAfterMs = 0;
    return true;
  }
  return false;
}

export function getProviderCooldown(name) {
  const e = entry(name);
  const until = e.cooldownUntil ? new Date(e.cooldownUntil).getTime() : 0;
  return { available: isProviderAvailable(name), status: e.status, retryAfterMs: Math.max(0, until - Date.now()), cooldownUntil: e.cooldownUntil, score: e.score };
}

export function recordProviderResult(name, ok, detail = {}) {
  const e = entry(name);
  const status = Number(detail.status || 0);
  const retryable = detail.retryable === true || [408, 425, 429, 500, 502, 503, 504].includes(status) || (!status && ok !== true);
  const blocked = Boolean(detail.blocked || status === 401 || status === 403 || status === 429 || detail.errorType === 'WAF_DETECTED');
  e.updatedAt = nowIso();
  e.lastStatus = detail.status ?? e.lastStatus;
  e.rolling.push({ at: Date.now(), ok: Boolean(ok), status, blocked, retryable, errorType: detail.errorType || null, latencyMs: Number(detail.latencyMs || detail.elapsedMs || 0) });
  if (e.rolling.length > WINDOW_LIMIT) e.rolling.splice(0, e.rolling.length - WINDOW_LIMIT);

  if (ok) {
    e.successes += 1;
    e.failures = 0;
    e.lastError = null;
    e.lastErrorType = null;
    if (e.status === 'half-open' || e.status === 'degraded') {
      if (e.successes >= DEFAULT_SUCCESS_RESET || e.status === 'half-open') {
        e.status = 'healthy';
        e.openedAt = null;
        e.cooldownUntil = null;
        e.retryAfterMs = 0;
      }
    } else {
      e.status = 'healthy';
    }
    computeScore(e);
    scheduleSharedPersist(name, e);
    return e;
  }

  const severe = blocked || retryable;
  if (severe) e.failures += 1;
  e.successes = 0;
  e.lastError = detail.error || detail.errorType || `HTTP ${status || 0}`;
  e.lastErrorType = detail.errorType || null;
  const score = computeScore(e);
  if (e.failures >= DEFAULT_FAILURE_THRESHOLD || (score < 42 && e.failures >= 2)) {
    e.status = 'degraded';
    e.openedAt = nowIso();
    const dynamicCooldown = Math.round(DEFAULT_COOLDOWN_MS * (blocked ? 1.5 : 1) * Math.min(2.5, 1 + e.failures / 8));
    e.cooldownUntil = new Date(Date.now() + dynamicCooldown).toISOString();
    e.retryAfterMs = dynamicCooldown;
  }
  scheduleSharedPersist(name, e);
  return e;
}

export const noteProviderResult = recordProviderResult;

export function getProviderHealthSnapshot() {
  const out = {};
  for (const [key, value] of state.entries()) {
    computeScore(value);
    out[key] = { ...value, rolling: undefined, sampleSize: value.rolling?.length || 0 };
  }
  for (const key of DEFAULT_PROVIDERS) {
    if (!out[key]) {
      const e = entry(key);
      computeScore(e);
      out[key] = { ...e, rolling: undefined, sampleSize: e.rolling?.length || 0 };
    }
  }
  return out;
}

export function resetProviderHealth(name) {
  if (name) {
    state.delete(name);
    const timer = sharedRuntime.timers.get(sharedKey(name));
    if (timer) clearTimeout(timer);
    sharedRuntime.timers.delete(sharedKey(name));
  } else {
    state.clear();
    for (const timer of sharedRuntime.timers.values()) clearTimeout(timer);
    sharedRuntime.timers.clear();
    sharedRuntime.hydratedAt = 0;
  }
}
