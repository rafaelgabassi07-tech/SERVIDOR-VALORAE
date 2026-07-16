import { performance } from 'node:perf_hooks';

export const VALORAE_SOURCE_ADAPTER_VERSION = '2026.07.14-checkpoint108-v1';
export const VALORAE_SOURCE_ADAPTER_POLICY_VERSION = 'isolated-provider-adapters-v1';

const registry = globalThis.__VALORAE_SOURCE_ADAPTER_REGISTRY__ || new Map();
const metrics = globalThis.__VALORAE_SOURCE_ADAPTER_METRICS__ || new Map();
globalThis.__VALORAE_SOURCE_ADAPTER_REGISTRY__ = registry;
globalThis.__VALORAE_SOURCE_ADAPTER_METRICS__ = metrics;

function normalizeId(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeOperation(value = '') {
  return String(value || '').trim().replace(/[^a-zA-Z0-9]+(.)?/g, (_match, next = '') => next.toUpperCase());
}

function envToken(value = '') {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function envDisabled(name) {
  return ['0', 'false', 'no', 'off', 'disabled'].includes(String(process.env[name] || '').trim().toLowerCase());
}

function operationMetricKey(adapterId, operation) {
  return `${adapterId}:${operation}`;
}

function metricFor(adapterId, operation) {
  const key = operationMetricKey(adapterId, operation);
  if (!metrics.has(key)) {
    metrics.set(key, {
      adapterId,
      operation,
      calls: 0,
      successes: 0,
      degraded: 0,
      failures: 0,
      disabled: 0,
      fallbackWins: 0,
      totalElapsedMs: 0,
      maxElapsedMs: 0,
      lastElapsedMs: 0,
      lastStatus: 'NEVER',
      lastError: '',
      lastCalledAt: '',
    });
  }
  return metrics.get(key);
}

function resultLooksSuccessful(result) {
  if (result == null) return false;
  if (typeof result !== 'object') return true;
  if (result.ok === false) return false;
  const status = String(result.status || result.sourceStatus || '').trim().toUpperCase();
  if (['ERROR', 'FAILED', 'UNAVAILABLE', 'DISABLED', 'EMPTY'].includes(status)) return false;
  return true;
}

export class SourceAdapterDisabledError extends Error {
  constructor(adapterId, operation, reason = 'disabled') {
    super(`Source adapter ${adapterId}.${operation} is disabled (${reason}).`);
    this.name = 'SourceAdapterDisabledError';
    this.code = 'SOURCE_ADAPTER_DISABLED';
    this.adapterId = adapterId;
    this.operation = operation;
    this.reason = reason;
  }
}

export function registerSourceAdapter(adapter = {}) {
  const id = normalizeId(adapter.id);
  if (!id) throw new TypeError('Source adapter id is required.');
  const operations = Object.fromEntries(
    Object.entries(adapter.operations || {})
      .map(([name, fn]) => [normalizeOperation(name), fn])
      .filter(([name, fn]) => name && typeof fn === 'function')
  );
  if (!Object.keys(operations).length) throw new TypeError(`Source adapter ${id} must expose at least one operation.`);
  const normalized = Object.freeze({
    id,
    label: String(adapter.label || id),
    kind: String(adapter.kind || 'external-source'),
    official: adapter.official === true,
    freeOnly: adapter.freeOnly !== false,
    domains: Object.freeze([...(adapter.domains || [])].map(String)),
    operations: Object.freeze(operations),
    description: String(adapter.description || ''),
  });
  registry.set(id, normalized);
  return normalized;
}


export function unregisterSourceAdapterForTests(adapterId) {
  return registry.delete(normalizeId(adapterId));
}

export function isSourceAdapterEnabled(adapterId, operation = '') {
  const id = normalizeId(adapterId);
  const op = normalizeOperation(operation);
  if (envDisabled('VALORAE_SOURCE_ADAPTERS_ENABLED')) return false;
  if (envDisabled(`VALORAE_ADAPTER_${envToken(id)}_ENABLED`)) return false;
  if (op && envDisabled(`VALORAE_ADAPTER_${envToken(id)}_${envToken(op)}_ENABLED`)) return false;
  return registry.has(id);
}

export function sourceAdapter(adapterId) {
  return registry.get(normalizeId(adapterId)) || null;
}

export async function executeSourceAdapter(adapterId, operation, args = [], options = {}) {
  const id = normalizeId(adapterId);
  const op = normalizeOperation(operation);
  const adapter = registry.get(id);
  if (!adapter) throw new Error(`Unknown source adapter: ${id || adapterId}`);
  const fn = adapter.operations[op];
  if (typeof fn !== 'function') throw new Error(`Unsupported source adapter operation: ${id}.${op}`);
  const metric = metricFor(id, op);
  metric.calls += 1;
  metric.lastCalledAt = new Date().toISOString();
  if (!isSourceAdapterEnabled(id, op)) {
    metric.disabled += 1;
    metric.lastStatus = 'DISABLED';
    metric.lastError = 'feature-flag-disabled';
    if (typeof options.onDisabled === 'function') return options.onDisabled({ adapter, operation: op });
    throw new SourceAdapterDisabledError(id, op, 'feature-flag-disabled');
  }
  const started = performance.now();
  try {
    const result = await fn(...(Array.isArray(args) ? args : [args]));
    const elapsedMs = Math.max(0, performance.now() - started);
    metric.totalElapsedMs += elapsedMs;
    metric.lastElapsedMs = Math.round(elapsedMs * 100) / 100;
    metric.maxElapsedMs = Math.max(metric.maxElapsedMs, metric.lastElapsedMs);
    const predicate = typeof options.successPredicate === 'function' ? options.successPredicate : resultLooksSuccessful;
    if (predicate(result)) {
      metric.successes += 1;
      metric.lastStatus = 'OK';
      metric.lastError = '';
    } else {
      metric.degraded += 1;
      metric.lastStatus = 'DEGRADED';
      metric.lastError = String(result?.error || result?.reason || result?.status || 'result-not-usable').slice(0, 240);
    }
    return result;
  } catch (error) {
    const elapsedMs = Math.max(0, performance.now() - started);
    metric.totalElapsedMs += elapsedMs;
    metric.lastElapsedMs = Math.round(elapsedMs * 100) / 100;
    metric.maxElapsedMs = Math.max(metric.maxElapsedMs, metric.lastElapsedMs);
    metric.failures += 1;
    metric.lastStatus = error?.code === 'SOURCE_ADAPTER_DISABLED' ? 'DISABLED' : 'ERROR';
    metric.lastError = String(error?.message || error || 'adapter-error').slice(0, 240);
    throw error;
  }
}

export async function executeSourceFallback(candidates = [], options = {}) {
  const attempts = [];
  const successPredicate = typeof options.successPredicate === 'function' ? options.successPredicate : resultLooksSuccessful;
  let lastError = null;
  for (const candidate of candidates) {
    const adapterId = normalizeId(candidate?.adapterId || candidate?.id);
    const operation = normalizeOperation(candidate?.operation);
    try {
      const result = await executeSourceAdapter(adapterId, operation, candidate?.args || [], { successPredicate });
      const usable = successPredicate(result);
      attempts.push({ adapterId, operation, usable, error: usable ? '' : String(result?.error || result?.status || 'result-not-usable') });
      if (usable) {
        const metric = metricFor(adapterId, operation);
        if (attempts.length > 1) metric.fallbackWins += 1;
        return options.returnDiagnostics === true ? { result, winner: { adapterId, operation }, attempts } : result;
      }
    } catch (error) {
      lastError = error;
      attempts.push({ adapterId, operation, usable: false, error: String(error?.message || error) });
    }
  }
  if (typeof options.onExhausted === 'function') return options.onExhausted({ attempts, error: lastError });
  if (lastError) throw lastError;
  throw new Error('No source adapter candidate produced a usable result.');
}

export function buildSourceAdapterManifest({ includeMetrics = true } = {}) {
  const adapters = [...registry.values()].map(adapter => ({
    id: adapter.id,
    label: adapter.label,
    kind: adapter.kind,
    official: adapter.official,
    freeOnly: adapter.freeOnly,
    domains: [...adapter.domains],
    enabled: isSourceAdapterEnabled(adapter.id),
    operations: Object.keys(adapter.operations).map(operation => ({
      name: operation,
      enabled: isSourceAdapterEnabled(adapter.id, operation),
      metric: includeMetrics ? sourceAdapterMetrics(adapter.id, operation) : undefined,
    })),
  }));
  return {
    status: 'OK',
    endpoint: 'contract/source-adapters',
    version: VALORAE_SOURCE_ADAPTER_VERSION,
    policyVersion: VALORAE_SOURCE_ADAPTER_POLICY_VERSION,
    compatibility: 'additive-hidden-from-ui',
    contractImpact: 'none',
    adapters,
    summary: {
      adapterCount: adapters.length,
      operationCount: adapters.reduce((sum, item) => sum + item.operations.length, 0),
      enabledAdapterCount: adapters.filter(item => item.enabled).length,
    },
  };
}

export function sourceAdapterMetrics(adapterId = '', operation = '') {
  const id = normalizeId(adapterId);
  const op = normalizeOperation(operation);
  if (id && op) {
    const metric = metricFor(id, op);
    return {
      ...metric,
      averageElapsedMs: metric.calls ? Math.round((metric.totalElapsedMs / metric.calls) * 100) / 100 : 0,
    };
  }
  return [...metrics.values()].map(metric => ({
    ...metric,
    averageElapsedMs: metric.calls ? Math.round((metric.totalElapsedMs / metric.calls) * 100) / 100 : 0,
  }));
}

export function resetSourceAdapterMetricsForTests() {
  metrics.clear();
}

export const _test = Object.freeze({ normalizeId, normalizeOperation, resultLooksSuccessful });
