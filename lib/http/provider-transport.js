import { Pool } from 'undici';

export const VALORAE_HTTP_TRANSPORT_VERSION = '2026.07.15-checkpoint113-v1';
export const VALORAE_HTTP_TRANSPORT_POLICY = 'provider-pools-backpressure-fallback-v1';
export const VALORAE_HTTP_TRANSPORT_IMPLEMENTATION = 'undici-pool-per-origin-v1';

import {
  DEFAULT_PROVIDER_TRANSPORT_PROFILES,
  boolValue,
  providerNameForUrl,
  resolveProviderTransportProfile,
  transportMode,
} from './provider-transport-profile.js';

export { providerNameForUrl, resolveProviderTransportProfile } from './provider-transport-profile.js';


const runtime = globalThis.__VALORAE_HTTP_PROVIDER_TRANSPORT__ || {
  pools: new Map(),
  limiters: new Map(),
  providers: new Map(),
  totals: {
    requests: 0,
    managedRequests: 0,
    legacyRequests: 0,
    queued: 0,
    queueRejected: 0,
    queueTimeouts: 0,
    cancelled: 0,
    legacyFallbacks: 0,
    errors: 0,
    completed: 0,
    totalLatencyMs: 0,
  },
  startedAt: Date.now(),
};
globalThis.__VALORAE_HTTP_PROVIDER_TRANSPORT__ = runtime;

function providerStats(provider) {
  if (!runtime.providers.has(provider)) {
    runtime.providers.set(provider, {
      requests: 0,
      managedRequests: 0,
      legacyRequests: 0,
      queued: 0,
      queueRejected: 0,
      queueTimeouts: 0,
      cancelled: 0,
      legacyFallbacks: 0,
      errors: 0,
      completed: 0,
      totalLatencyMs: 0,
      maxObservedActive: 0,
      maxObservedQueued: 0,
    });
  }
  return runtime.providers.get(provider);
}

function increment(provider, key, amount = 1) {
  runtime.totals[key] = Number(runtime.totals[key] || 0) + amount;
  const stats = providerStats(provider);
  stats[key] = Number(stats[key] || 0) + amount;
}

function limiterFor(profile) {
  let limiter = runtime.limiters.get(profile.provider);
  if (!limiter) {
    limiter = { active: 0, queue: [], maxConcurrency: profile.maxConcurrency, maxQueue: profile.maxQueue };
    runtime.limiters.set(profile.provider, limiter);
  }
  limiter.maxConcurrency = profile.maxConcurrency;
  limiter.maxQueue = profile.maxQueue;
  return limiter;
}

function abortError(message = 'A operação HTTP foi cancelada.') {
  const error = new Error(message);
  error.name = 'AbortError';
  error.code = 'ABORT_ERR';
  return error;
}

function backpressureError(code, message, retryAfterMs) {
  const error = new Error(message);
  error.name = 'ValoraeHttpBackpressureError';
  error.code = code;
  error.retryable = true;
  error.retryAfterMs = retryAfterMs;
  return error;
}

function drainLimiter(provider, limiter) {
  while (limiter.active < limiter.maxConcurrency && limiter.queue.length) {
    const entry = limiter.queue.shift();
    if (!entry || entry.settled) continue;
    if (entry.signal?.aborted) {
      entry.settled = true;
      clearTimeout(entry.timer);
      entry.signal?.removeEventListener?.('abort', entry.onAbort);
      increment(provider, 'cancelled');
      entry.reject(abortError());
      continue;
    }
    entry.settled = true;
    clearTimeout(entry.timer);
    entry.signal?.removeEventListener?.('abort', entry.onAbort);
    limiter.active += 1;
    const stats = providerStats(provider);
    stats.maxObservedActive = Math.max(stats.maxObservedActive, limiter.active);
    entry.resolve({ queuedMs: Date.now() - entry.enqueuedAt, release: releaseLimiter(provider, limiter) });
  }
}

function releaseLimiter(provider, limiter) {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    limiter.active = Math.max(0, limiter.active - 1);
    drainLimiter(provider, limiter);
  };
}

async function acquireLimiter(profile, signal) {
  const limiter = limiterFor(profile);
  if (signal?.aborted) throw abortError();
  if (limiter.active < limiter.maxConcurrency) {
    limiter.active += 1;
    const stats = providerStats(profile.provider);
    stats.maxObservedActive = Math.max(stats.maxObservedActive, limiter.active);
    return { queuedMs: 0, release: releaseLimiter(profile.provider, limiter) };
  }
  if (limiter.queue.length >= limiter.maxQueue) {
    increment(profile.provider, 'queueRejected');
    throw backpressureError('VALORAE_HTTP_BACKPRESSURE', `Fila HTTP de ${profile.provider} atingiu o limite seguro.`, profile.queueTimeoutMs);
  }
  increment(profile.provider, 'queued');
  const stats = providerStats(profile.provider);
  stats.maxObservedQueued = Math.max(stats.maxObservedQueued, limiter.queue.length + 1);
  return new Promise((resolve, reject) => {
    const entry = {
      resolve,
      reject,
      signal,
      enqueuedAt: Date.now(),
      settled: false,
      timer: null,
      onAbort: null,
    };
    entry.onAbort = () => {
      if (entry.settled) return;
      entry.settled = true;
      const index = limiter.queue.indexOf(entry);
      if (index >= 0) limiter.queue.splice(index, 1);
      clearTimeout(entry.timer);
      increment(profile.provider, 'cancelled');
      reject(abortError());
    };
    entry.timer = setTimeout(() => {
      if (entry.settled) return;
      entry.settled = true;
      const index = limiter.queue.indexOf(entry);
      if (index >= 0) limiter.queue.splice(index, 1);
      signal?.removeEventListener?.('abort', entry.onAbort);
      increment(profile.provider, 'queueTimeouts');
      reject(backpressureError('VALORAE_HTTP_QUEUE_TIMEOUT', `Fila HTTP de ${profile.provider} excedeu ${profile.queueTimeoutMs}ms.`, profile.queueTimeoutMs));
    }, profile.queueTimeoutMs);
    signal?.addEventListener?.('abort', entry.onAbort, { once: true });
    limiter.queue.push(entry);
  });
}

function poolKey(origin, profile) {
  return [
    profile.provider,
    origin,
    profile.connections,
    profile.pipelining,
    profile.connectTimeoutMs,
    profile.headersTimeoutMs,
    profile.bodyTimeoutMs,
    profile.keepAliveTimeoutMs,
    profile.keepAliveMaxTimeoutMs,
  ].join('|');
}

function dispatcherFor(url, profile) {
  const parsed = new URL(String(url));
  const key = poolKey(parsed.origin, profile);
  let entry = runtime.pools.get(key);
  if (!entry) {
    const dispatcher = new Pool(parsed.origin, {
      connections: profile.connections,
      pipelining: profile.pipelining,
      connectTimeout: profile.connectTimeoutMs,
      headersTimeout: profile.headersTimeoutMs,
      bodyTimeout: profile.bodyTimeoutMs,
      keepAliveTimeout: profile.keepAliveTimeoutMs,
      keepAliveMaxTimeout: profile.keepAliveMaxTimeoutMs,
    });
    entry = { key, provider: profile.provider, origin: parsed.origin, dispatcher, createdAt: Date.now(), requests: 0 };
    runtime.pools.set(key, entry);
  }
  entry.requests += 1;
  return entry.dispatcher;
}

function combinedSignal(parentSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) controller.abort(parentSignal.reason);
  else parentSignal?.addEventListener?.('abort', abortFromParent, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(1, timeoutMs));
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup() {
      clearTimeout(timer);
      parentSignal?.removeEventListener?.('abort', abortFromParent);
    },
  };
}

function errorCode(error) {
  return String(error?.code || error?.cause?.code || '').toUpperCase();
}

function totalTimeoutError(error, timedOut) {
  if (!timedOut || error?.name !== 'AbortError') return error;
  if (errorCode(error) === 'VALORAE_HTTP_TOTAL_TIMEOUT') return error;
  const timeout = new Error('A requisição HTTP excedeu o tempo total permitido.');
  timeout.name = 'AbortError';
  timeout.code = 'VALORAE_HTTP_TOTAL_TIMEOUT';
  timeout.cause = error;
  return timeout;
}

function shouldFallbackToLegacy(error, method, signal, allowed) {
  if (!allowed || signal?.aborted || !['GET', 'HEAD', 'OPTIONS'].includes(method)) return false;
  if (error?.name === 'AbortError' || ['ABORT_ERR', 'VALORAE_HTTP_BACKPRESSURE', 'VALORAE_HTTP_QUEUE_TIMEOUT'].includes(errorCode(error))) return false;
  const code = errorCode(error);
  const text = `${error?.name || ''} ${error?.message || ''} ${error?.cause?.message || ''}`.toLowerCase();
  return error instanceof TypeError || code.startsWith('UND_ERR_') || /dispatcher|dispatch|pool|fetch failed|socket|connect/.test(text);
}

/**
 * Fetch compatível com a API WHATWG, com dispatcher/pool por origem, limite por provedor e rollback imediato.
 * A opção privada `valoraeTransport` nunca é encaminhada ao servidor remoto.
 */
export async function providerFetch(url, requestInit = {}) {
  const started = Date.now();
  const privateOptions = requestInit?.valoraeTransport && typeof requestInit.valoraeTransport === 'object'
    ? requestInit.valoraeTransport
    : {};
  const init = { ...requestInit };
  delete init.valoraeTransport;
  const profile = resolveProviderTransportProfile(url, privateOptions);
  const method = String(init.method || 'GET').toUpperCase();
  const mode = privateOptions.mode || transportMode();
  const legacyFallbackAllowed = privateOptions.legacyFallback !== false && boolValue(process.env.VALORAE_HTTP_LEGACY_FALLBACK, true);
  const signalScope = combinedSignal(init.signal, profile.totalTimeoutMs);
  init.signal = signalScope.signal;
  increment(profile.provider, 'requests');

  if (mode === 'legacy' || init.dispatcher) {
    increment(profile.provider, 'legacyRequests');
    try {
      const response = await globalThis.fetch(url, init);
      increment(profile.provider, 'completed');
      return response;
    } catch (error) {
      increment(profile.provider, 'errors');
      throw totalTimeoutError(error, signalScope.timedOut());
    } finally {
      const elapsed = Date.now() - started;
      runtime.totals.totalLatencyMs += elapsed;
      providerStats(profile.provider).totalLatencyMs += elapsed;
      signalScope.cleanup();
    }
  }

  increment(profile.provider, 'managedRequests');
  let lease;
  try {
    lease = await acquireLimiter(profile, signalScope.signal);
    const dispatcher = dispatcherFor(url, profile);
    try {
      const response = await globalThis.fetch(url, { ...init, dispatcher });
      increment(profile.provider, 'completed');
      return response;
    } catch (error) {
      if (shouldFallbackToLegacy(error, method, signalScope.signal, legacyFallbackAllowed)) {
        increment(profile.provider, 'legacyFallbacks');
        const response = await globalThis.fetch(url, init);
        increment(profile.provider, 'completed');
        return response;
      }
      throw totalTimeoutError(error, signalScope.timedOut());
    }
  } catch (error) {
    increment(profile.provider, 'errors');
    throw error;
  } finally {
    lease?.release?.();
    const elapsed = Date.now() - started;
    runtime.totals.totalLatencyMs += elapsed;
    providerStats(profile.provider).totalLatencyMs += elapsed;
    signalScope.cleanup();
  }
}

function profileManifest(provider) {
  const profile = resolveProviderTransportProfile(`https://${provider === 'yahoo' ? 'query1.finance.yahoo.com' : provider === 'bcb' ? 'api.bcb.gov.br' : provider === 'b3' ? 'www.b3.com.br' : provider === 'cvm' ? 'dados.cvm.gov.br' : provider === 'generic' ? 'example.com' : `www.${provider}.com.br`}/`, { provider });
  return {
    connections: profile.connections,
    maxConcurrency: profile.maxConcurrency,
    maxQueue: profile.maxQueue,
    queueTimeoutMs: profile.queueTimeoutMs,
    connectTimeoutMs: profile.connectTimeoutMs,
    headersTimeoutMs: profile.headersTimeoutMs,
    bodyTimeoutMs: profile.bodyTimeoutMs,
    totalTimeoutMs: profile.totalTimeoutMs,
    keepAliveTimeoutMs: profile.keepAliveTimeoutMs,
    keepAliveMaxTimeoutMs: profile.keepAliveMaxTimeoutMs,
    pipelining: profile.pipelining,
  };
}

export function providerTransportStats() {
  const providers = {};
  for (const [provider, counters] of runtime.providers.entries()) {
    const limiter = runtime.limiters.get(provider);
    providers[provider] = {
      ...counters,
      active: limiter?.active || 0,
      queuedNow: limiter?.queue?.length || 0,
      averageLatencyMs: counters.completed ? Math.round(counters.totalLatencyMs / counters.completed) : 0,
    };
  }
  return {
    startedAt: new Date(runtime.startedAt).toISOString(),
    mode: transportMode(),
    pools: runtime.pools.size,
    totals: {
      ...runtime.totals,
      averageLatencyMs: runtime.totals.completed ? Math.round(runtime.totals.totalLatencyMs / runtime.totals.completed) : 0,
    },
    providers,
  };
}

export function buildProviderTransportManifest() {
  const providers = {};
  for (const provider of Object.keys(DEFAULT_PROVIDER_TRANSPORT_PROFILES)) providers[provider] = profileManifest(provider);
  return {
    status: 'OK',
    endpoint: 'contract/http-transport',
    version: VALORAE_HTTP_TRANSPORT_VERSION,
    policyVersion: VALORAE_HTTP_TRANSPORT_POLICY,
    implementation: VALORAE_HTTP_TRANSPORT_IMPLEMENTATION,
    enabled: transportMode() === 'managed',
    mode: transportMode(),
    hiddenFromUi: true,
    contractImpact: 'none-financial-contract-preserved',
    guarantees: {
      poolsPerOriginAndProvider: true,
      connectionReuse: true,
      boundedConcurrency: true,
      boundedQueue: true,
      separateConnectHeadersBodyAndTotalTimeouts: true,
      parentCancellationPropagated: true,
      staleCacheRemainsUpstreamFallback: true,
      legacyTransportRollbackAvailable: true,
      financialPayloadShapeUnchanged: true,
    },
    rollback: {
      disable: 'VALORAE_HTTP_TRANSPORT_ENABLED=0',
      mode: 'VALORAE_HTTP_TRANSPORT_MODE=legacy',
      legacyFallback: 'VALORAE_HTTP_LEGACY_FALLBACK=1',
    },
    providers,
    metrics: providerTransportStats(),
  };
}

export async function resetProviderTransportForTests() {
  const closes = [];
  for (const entry of runtime.pools.values()) {
    try { closes.push(entry.dispatcher.close()); } catch {}
  }
  await Promise.allSettled(closes);
  runtime.pools.clear();
  runtime.limiters.clear();
  runtime.providers.clear();
  runtime.totals = {
    requests: 0,
    managedRequests: 0,
    legacyRequests: 0,
    queued: 0,
    queueRejected: 0,
    queueTimeouts: 0,
    cancelled: 0,
    legacyFallbacks: 0,
    errors: 0,
    completed: 0,
    totalLatencyMs: 0,
  };
  runtime.startedAt = Date.now();
}
