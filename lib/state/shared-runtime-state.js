import { createHash } from 'node:crypto';

import {
  DEFAULT_SHARED_STATE_MAX_VALUE_BYTES,
  DEFAULT_SHARED_STATE_MISS_TTL_MS,
  clone,
  intValue,
  isExpired,
  isoTime,
  keyValue,
  mapRemoteRow,
  memoryKey,
  namespaceValue,
  normalizeRecord,
  remoteAllowed,
  scopeValue,
  setMemoryRecord,
  sharedStateDriver,
  sharedStateMode,
  sharedStateRuntime,
  supabaseConfig,
  tableValue,
  trimMemory,
  valueBytes,
} from './shared-state-foundation.js';
import { sharedStateRemoteRequest, sharedStateRemoteSelectPath } from './shared-state-supabase.js';

import { VALORAE_SHARED_STATE_VERSION } from '../core/feature-versions.js';
export { VALORAE_SHARED_STATE_VERSION } from '../core/feature-versions.js';
export const VALORAE_SHARED_STATE_POLICY = 'supabase-shared-runtime-state-memory-fallback-v1';
export const VALORAE_SHARED_STATE_IMPLEMENTATION = 'supabase-rest-memory-mirror-leases-v1';

const runtime = sharedStateRuntime;
const driver = sharedStateDriver;
const mode = sharedStateMode;
const remoteRequest = sharedStateRemoteRequest;
const remoteSelectPath = sharedStateRemoteSelectPath;

export function sharedStateDriverInfo() {
  const requestedMode = mode();
  const cfg = supabaseConfig();
  const activeDriver = driver();
  return {
    enabled: activeDriver !== 'off',
    requestedMode,
    driver: activeDriver,
    scope: scopeValue(),
    table: tableValue(),
    remoteConfigured: cfg.configured,
    remoteHealthy: activeDriver !== 'supabase' || Date.now() >= Number(runtime.remoteUnavailableUntil || 0),
    memoryFallback: true,
    instanceId: runtime.instanceId,
  };
}

export async function getSharedState(namespace, key, options = {}) {
  runtime.metrics.gets += 1;
  trimMemory();
  const ns = namespaceValue(namespace);
  const sk = keyValue(key);
  const mk = memoryKey(ns, sk);
  const local = runtime.memory.get(mk);
  if (local && !isExpired(local)) {
    runtime.memory.delete(mk);
    runtime.memory.set(mk, local);
    runtime.metrics.localHits += 1;
    return { ...clone(local), source: local.source || 'memory' };
  }
  if (local && options.allowStale === true) {
    runtime.metrics.staleHits += 1;
    return { ...clone(local), source: local.source || 'memory', stale: true };
  }
  runtime.metrics.localMisses += 1;
  if (options.remote === false || !remoteAllowed()) {
    if (driver() === 'supabase' && Date.now() < Number(runtime.remoteUnavailableUntil || 0)) runtime.metrics.remoteSkippedCooldown += 1;
    return null;
  }
  const missUntil = runtime.misses.get(mk) || 0;
  if (missUntil > Date.now()) return null;
  if (runtime.inflight.has(`get:${mk}`)) return runtime.inflight.get(`get:${mk}`);

  const promise = (async () => {
    runtime.metrics.remoteReads += 1;
    try {
      const rows = await remoteRequest(remoteSelectPath(ns, sk), { method: 'GET' });
      const record = mapRemoteRow(Array.isArray(rows) ? rows[0] : rows);
      if (!record || isExpired(record)) {
        runtime.metrics.remoteMisses += 1;
        const missTtlMs = intValue(process.env.VALORAE_SHARED_STATE_MISS_TTL_MS, DEFAULT_SHARED_STATE_MISS_TTL_MS, 1000, 120000);
        runtime.misses.set(mk, Date.now() + missTtlMs);
        return null;
      }
      runtime.metrics.remoteHits += 1;
      setMemoryRecord(record);
      return clone(record);
    } catch {
      return options.allowStale === true && local ? { ...clone(local), stale: true } : null;
    }
  })().finally(() => runtime.inflight.delete(`get:${mk}`));
  runtime.inflight.set(`get:${mk}`, promise);
  return promise;
}

export async function setSharedState(namespace, key, value, options = {}) {
  runtime.metrics.sets += 1;
  const maxValueBytes = intValue(process.env.VALORAE_SHARED_STATE_MAX_VALUE_BYTES, DEFAULT_SHARED_STATE_MAX_VALUE_BYTES, 4096, 4 * 1024 * 1024);
  const bytes = valueBytes(value);
  if (bytes > maxValueBytes) {
    runtime.metrics.oversizeRejected += 1;
    return { ok: false, stored: false, reason: 'oversize', bytes, maxValueBytes, driver: driver() };
  }
  const record = normalizeRecord(namespace, key, value, options);
  setMemoryRecord(record);
  if (options.remote === false || !remoteAllowed()) {
    if (driver() === 'supabase' && Date.now() < Number(runtime.remoteUnavailableUntil || 0)) runtime.metrics.remoteSkippedCooldown += 1;
    return { ok: true, stored: true, remoteStored: false, record: clone(record), driver: driver() };
  }
  runtime.metrics.remoteWrites += 1;
  try {
    const result = await remoteRequest('/rest/v1/rpc/valorae_shared_state_put', {
      method: 'POST',
      body: JSON.stringify({
        p_scope: record.scope,
        p_namespace: record.namespace,
        p_state_key: record.key,
        p_value: record.value,
        p_version: record.version,
        p_checksum: record.checksum,
        p_owner: record.owner,
        p_created_at: record.createdAt,
        p_updated_at: record.updatedAt,
        p_expires_at: record.expiresAt,
      }),
    });
    const row = Array.isArray(result) ? result[0] : result;
    const current = mapRemoteRow(row) || { ...record, source: 'supabase' };
    setMemoryRecord(current);
    const remoteStored = row?.stored !== false;
    return {
      ok: true,
      stored: true,
      remoteStored,
      record: clone(current),
      driver: 'supabase',
      ...(remoteStored ? {} : { warning: 'SHARED_STATE_STALE_WRITE_REJECTED' }),
    };
  } catch (error) {
    return { ok: true, stored: true, remoteStored: false, record: clone(record), driver: 'memory-fallback', warning: error?.code || 'SHARED_STATE_REMOTE_ERROR' };
  }
}

export async function deleteSharedState(namespace, key, options = {}) {
  runtime.metrics.deletes += 1;
  const ns = namespaceValue(namespace);
  const sk = keyValue(key);
  runtime.memory.delete(memoryKey(ns, sk));
  runtime.misses.delete(memoryKey(ns, sk));
  if (options.remote === false || !remoteAllowed()) return { ok: true, remoteDeleted: false };
  runtime.metrics.remoteDeletes += 1;
  const params = new URLSearchParams({
    scope: `eq.${scopeValue()}`,
    namespace: `eq.${ns}`,
    state_key: `eq.${sk}`,
  });
  try {
    await remoteRequest(`/rest/v1/${tableValue()}?${params.toString()}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
    return { ok: true, remoteDeleted: true };
  } catch (error) {
    return { ok: true, remoteDeleted: false, warning: error?.code || 'SHARED_STATE_REMOTE_ERROR' };
  }
}

export async function acquireSharedLease(namespace, key, options = {}) {
  runtime.metrics.leaseAttempts += 1;
  trimMemory();
  const ns = namespaceValue(namespace);
  const sk = keyValue(key);
  const owner = String(options.owner || runtime.instanceId).slice(0, 128);
  const ttlMs = intValue(options.ttlMs, 30_000, 1000, 15 * 60 * 1000);
  const leaseKey = memoryKey(`lease.${ns}`, sk);
  const current = runtime.leases.get(leaseKey);
  if (current && new Date(current.expiresAt).getTime() > Date.now() && current.owner !== owner) {
    runtime.metrics.leaseRejected += 1;
    return { acquired: false, owner: current.owner, expiresAt: current.expiresAt, driver: driver(), shared: false };
  }
  const localLease = { owner, expiresAt: isoTime(Date.now() + ttlMs) };
  runtime.leases.set(leaseKey, localLease);

  if (!remoteAllowed()) {
    runtime.metrics.leaseAcquired += 1;
    return { acquired: true, ...localLease, driver: driver(), shared: false };
  }
  try {
    const result = await remoteRequest('/rest/v1/rpc/valorae_shared_state_acquire_lease', {
      method: 'POST',
      body: JSON.stringify({
        p_scope: scopeValue(),
        p_namespace: ns,
        p_state_key: sk,
        p_owner: owner,
        p_ttl_seconds: Math.max(1, Math.ceil(ttlMs / 1000)),
      }),
    });
    const row = Array.isArray(result) ? result[0] : result;
    const acquired = row?.acquired === true;
    if (acquired) runtime.metrics.leaseAcquired += 1;
    else {
      runtime.metrics.leaseRejected += 1;
      runtime.leases.delete(leaseKey);
    }
    return {
      acquired,
      owner: row?.owner || owner,
      expiresAt: row?.expires_at || localLease.expiresAt,
      driver: 'supabase',
      shared: true,
    };
  } catch (error) {
    if (options.requireShared === true) {
      runtime.leases.delete(leaseKey);
      runtime.metrics.leaseRejected += 1;
      return { acquired: false, owner: null, expiresAt: null, driver: 'memory-fallback', shared: false, warning: error?.code || 'SHARED_STATE_REMOTE_ERROR' };
    }
    runtime.metrics.leaseAcquired += 1;
    return { acquired: true, ...localLease, driver: 'memory-fallback', shared: false, warning: error?.code || 'SHARED_STATE_REMOTE_ERROR' };
  }
}

export async function releaseSharedLease(namespace, key, options = {}) {
  const ns = namespaceValue(namespace);
  const sk = keyValue(key);
  const owner = String(options.owner || runtime.instanceId).slice(0, 128);
  runtime.leases.delete(memoryKey(`lease.${ns}`, sk));
  if (!remoteAllowed()) {
    runtime.metrics.leaseReleased += 1;
    return { released: true, driver: driver(), shared: false };
  }
  try {
    const result = await remoteRequest('/rest/v1/rpc/valorae_shared_state_release_lease', {
      method: 'POST',
      body: JSON.stringify({ p_scope: scopeValue(), p_namespace: ns, p_state_key: sk, p_owner: owner }),
    });
    const row = Array.isArray(result) ? result[0] : result;
    const released = row === true || row?.released === true;
    if (released) runtime.metrics.leaseReleased += 1;
    return { released, driver: 'supabase', shared: true };
  } catch (error) {
    runtime.metrics.leaseReleased += 1;
    return { released: true, driver: 'memory-fallback', shared: false, warning: error?.code || 'SHARED_STATE_REMOTE_ERROR' };
  }
}

export function sharedStateStats() {
  trimMemory();
  const info = sharedStateDriverInfo();
  const namespaces = {};
  for (const record of runtime.memory.values()) namespaces[record.namespace] = Number(namespaces[record.namespace] || 0) + 1;
  return {
    version: VALORAE_SHARED_STATE_VERSION,
    startedAt: isoTime(runtime.startedAt),
    ...info,
    entries: runtime.memory.size,
    missEntries: runtime.misses.size,
    inflight: runtime.inflight.size,
    leases: runtime.leases.size,
    namespaces,
    metrics: { ...runtime.metrics },
    remoteLastSuccessAt: runtime.remoteLastSuccessAt,
    remoteUnavailableUntil: runtime.remoteUnavailableUntil ? isoTime(runtime.remoteUnavailableUntil) : null,
    remoteLastError: runtime.remoteLastError,
  };
}

export function buildSharedStateManifest() {
  const info = sharedStateDriverInfo();
  return {
    status: 'OK',
    endpoint: 'contract/shared-state',
    version: VALORAE_SHARED_STATE_VERSION,
    policyVersion: VALORAE_SHARED_STATE_POLICY,
    implementation: VALORAE_SHARED_STATE_IMPLEMENTATION,
    enabled: info.enabled,
    mode: info.requestedMode,
    driver: info.driver,
    hiddenFromUi: true,
    contractImpact: 'none-financial-contract-preserved',
    storage: {
      remote: 'Supabase REST/Postgres quando configurado',
      localMirror: 'memória limitada por instância',
      scope: info.scope,
      table: info.table,
      remoteConfigured: info.remoteConfigured,
      migration: 'supabase/004_valorae_runtime_shared_state_checkpoint114.sql',
    },
    sharedNamespaces: {
      contractContinuity: 'último payload formalmente válido por identidade anonimizada',
      providerHealth: 'circuit breaker e cooldown por fonte',
      negativeFailureCache: 'backoff curto para falhas repetidas de scraping',
      leases: 'coordenação atômica ativa para canários reais do checkpoint 115',
    },
    guarantees: {
      crossInstanceContractContinuity: true,
      crossInstanceProviderHealth: true,
      sharedNegativeFailureBackoff: true,
      expiringStateWithTtl: true,
      atomicLeaseSupport: true,
      boundedMemoryMirror: true,
      remoteFailureNeverBlocksFinancialResponse: true,
      memoryFallbackAvailable: true,
      serviceRoleNeverExposedToApk: true,
      financialPayloadShapeUnchanged: true,
      supabaseUserSyncTablesUntouched: true,
    },
    rollback: {
      disable: 'VALORAE_SHARED_STATE_ENABLED=0',
      memoryOnly: 'VALORAE_SHARED_STATE_MODE=memory',
      automatic: 'VALORAE_SHARED_STATE_MODE=auto',
    },
    metrics: sharedStateStats(),
  };
}

export function sharedStateKeyHash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

export async function resetSharedStateForTests() {
  runtime.memory.clear();
  runtime.misses.clear();
  runtime.inflight.clear();
  runtime.leases.clear();
  runtime.remoteUnavailableUntil = 0;
  runtime.remoteLastError = null;
  runtime.remoteLastSuccessAt = null;
  runtime.versionSequence = 0;
  for (const key of Object.keys(runtime.metrics)) runtime.metrics[key] = 0;
  runtime.startedAt = Date.now();
}
