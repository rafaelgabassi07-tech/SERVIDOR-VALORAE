/**
 * Checkpoint 116: configuração pura do transporte HTTP por provedor.
 * Este módulo não cria pools, não executa rede e não mantém estado mutável.
 */
export const DEFAULT_PROVIDER_TRANSPORT_PROFILES = Object.freeze({
  generic: Object.freeze({ connections: 3, maxConcurrency: 4, maxQueue: 24, queueTimeoutMs: 1400, connectTimeoutMs: 3500, headersTimeoutMs: 6500, bodyTimeoutMs: 9000, totalTimeoutMs: 12000, keepAliveTimeoutMs: 10000, keepAliveMaxTimeoutMs: 30000, pipelining: 1 }),
  investidor10: Object.freeze({ connections: 4, maxConcurrency: 6, maxQueue: 36, queueTimeoutMs: 1800, connectTimeoutMs: 4000, headersTimeoutMs: 7500, bodyTimeoutMs: 10000, totalTimeoutMs: 14000, keepAliveTimeoutMs: 12000, keepAliveMaxTimeoutMs: 35000, pipelining: 1 }),
  statusinvest: Object.freeze({ connections: 3, maxConcurrency: 5, maxQueue: 30, queueTimeoutMs: 1700, connectTimeoutMs: 4000, headersTimeoutMs: 7000, bodyTimeoutMs: 9500, totalTimeoutMs: 13000, keepAliveTimeoutMs: 12000, keepAliveMaxTimeoutMs: 35000, pipelining: 1 }),
  yahoo: Object.freeze({ connections: 4, maxConcurrency: 6, maxQueue: 36, queueTimeoutMs: 1200, connectTimeoutMs: 3000, headersTimeoutMs: 6000, bodyTimeoutMs: 8500, totalTimeoutMs: 11000, keepAliveTimeoutMs: 12000, keepAliveMaxTimeoutMs: 35000, pipelining: 1 }),
  b3: Object.freeze({ connections: 3, maxConcurrency: 4, maxQueue: 24, queueTimeoutMs: 1500, connectTimeoutMs: 3500, headersTimeoutMs: 6500, bodyTimeoutMs: 9000, totalTimeoutMs: 12000, keepAliveTimeoutMs: 10000, keepAliveMaxTimeoutMs: 30000, pipelining: 1 }),
  bcb: Object.freeze({ connections: 2, maxConcurrency: 3, maxQueue: 18, queueTimeoutMs: 1200, connectTimeoutMs: 3000, headersTimeoutMs: 5500, bodyTimeoutMs: 7500, totalTimeoutMs: 10000, keepAliveTimeoutMs: 10000, keepAliveMaxTimeoutMs: 30000, pipelining: 1 }),
  cvm: Object.freeze({ connections: 2, maxConcurrency: 3, maxQueue: 18, queueTimeoutMs: 1700, connectTimeoutMs: 4000, headersTimeoutMs: 8000, bodyTimeoutMs: 12000, totalTimeoutMs: 16000, keepAliveTimeoutMs: 10000, keepAliveMaxTimeoutMs: 30000, pipelining: 1 }),
  fundamentus: Object.freeze({ connections: 2, maxConcurrency: 3, maxQueue: 18, queueTimeoutMs: 1700, connectTimeoutMs: 4000, headersTimeoutMs: 7500, bodyTimeoutMs: 10000, totalTimeoutMs: 14000, keepAliveTimeoutMs: 10000, keepAliveMaxTimeoutMs: 30000, pipelining: 1 }),
});

export function boolValue(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value).trim().toLowerCase());
}

export function intValue(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function envProviderName(provider) {
  return String(provider || 'generic').replace(/[^a-z0-9]+/gi, '_').toUpperCase();
}

function envInt(provider, suffix, fallback, min, max) {
  const specific = process.env[`VALORAE_HTTP_${envProviderName(provider)}_${suffix}`];
  const globalValue = process.env[`VALORAE_HTTP_${suffix}`];
  return intValue(specific ?? globalValue, fallback, min, max);
}

export function transportMode() {
  if (!boolValue(process.env.VALORAE_HTTP_TRANSPORT_ENABLED, true)) return 'legacy';
  const mode = String(process.env.VALORAE_HTTP_TRANSPORT_MODE || 'managed').trim().toLowerCase();
  return mode === 'legacy' || mode === 'off' || mode === 'disabled' ? 'legacy' : 'managed';
}

export function providerNameForUrl(url) {
  let host = '';
  try { host = new URL(String(url)).hostname.toLowerCase(); } catch { return 'generic'; }
  if (host === 'investidor10.com.br' || host.endsWith('.investidor10.com.br')) return 'investidor10';
  if (host === 'statusinvest.com.br' || host.endsWith('.statusinvest.com.br')) return 'statusinvest';
  if (host === 'finance.yahoo.com' || host.endsWith('.finance.yahoo.com') || host.endsWith('.yahooapis.com')) return 'yahoo';
  if (host === 'b3.com.br' || host.endsWith('.b3.com.br') || host.endsWith('.b3.com')) return 'b3';
  if (host === 'bcb.gov.br' || host.endsWith('.bcb.gov.br')) return 'bcb';
  if (host === 'cvm.gov.br' || host.endsWith('.cvm.gov.br')) return 'cvm';
  if (host === 'fundamentus.com.br' || host.endsWith('.fundamentus.com.br')) return 'fundamentus';
  return 'generic';
}

export function resolveProviderTransportProfile(url, overrides = {}) {
  const provider = String(overrides.provider || providerNameForUrl(url) || 'generic');
  const base = DEFAULT_PROVIDER_TRANSPORT_PROFILES[provider] || DEFAULT_PROVIDER_TRANSPORT_PROFILES.generic;
  const totalTimeoutMs = intValue(overrides.totalTimeoutMs, envInt(provider, 'TOTAL_TIMEOUT_MS', base.totalTimeoutMs, 500, 60000), 500, 60000);
  return Object.freeze({
    provider,
    connections: intValue(overrides.connections, envInt(provider, 'CONNECTIONS', base.connections, 1, 12), 1, 12),
    maxConcurrency: intValue(overrides.maxConcurrency, envInt(provider, 'MAX_CONCURRENCY', base.maxConcurrency, 1, 24), 1, 24),
    maxQueue: intValue(overrides.maxQueue, envInt(provider, 'MAX_QUEUE', base.maxQueue, 0, 240), 0, 240),
    queueTimeoutMs: intValue(overrides.queueTimeoutMs, envInt(provider, 'QUEUE_TIMEOUT_MS', base.queueTimeoutMs, 50, 30000), 50, 30000),
    connectTimeoutMs: intValue(overrides.connectTimeoutMs, envInt(provider, 'CONNECT_TIMEOUT_MS', base.connectTimeoutMs, 250, 30000), 250, 30000),
    headersTimeoutMs: intValue(overrides.headersTimeoutMs, envInt(provider, 'HEADERS_TIMEOUT_MS', base.headersTimeoutMs, 500, 60000), 500, 60000),
    bodyTimeoutMs: intValue(overrides.bodyTimeoutMs, envInt(provider, 'BODY_TIMEOUT_MS', base.bodyTimeoutMs, 500, 120000), 500, 120000),
    totalTimeoutMs,
    keepAliveTimeoutMs: intValue(overrides.keepAliveTimeoutMs, envInt(provider, 'KEEP_ALIVE_TIMEOUT_MS', base.keepAliveTimeoutMs, 1000, 60000), 1000, 60000),
    keepAliveMaxTimeoutMs: intValue(overrides.keepAliveMaxTimeoutMs, envInt(provider, 'KEEP_ALIVE_MAX_TIMEOUT_MS', base.keepAliveMaxTimeoutMs, 1000, 120000), 1000, 120000),
    pipelining: intValue(overrides.pipelining, envInt(provider, 'PIPELINING', base.pipelining, 1, 4), 1, 4),
  });
}
