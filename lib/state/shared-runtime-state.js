import { createHash } from 'node:crypto';

import {
  DEFAULT_SHARED_STATE_MAX_VALUE_BYTES,
  clone,
  intValue,
  isExpired,
  isoTime,
  keyValue,
  memoryKey,
  namespaceValue,
  normalizeRecord,
  scopeValue,
  setMemoryRecord,
  sharedStateRuntime,
  trimMemory,
  valueBytes,
} from './shared-state-foundation.js';

import { sharedStateRemoteDriverStatus } from './shared-state-supabase.js';

import { VALORAE_SHARED_STATE_VERSION } from '../core/feature-versions.js';
export { VALORAE_SHARED_STATE_VERSION } from '../core/feature-versions.js';

// Identificadores preservados para compatibilidade de protocolo com APKs anteriores.
export const VALORAE_SHARED_STATE_POLICY = 'memory-only-instance-state-v2';
export const VALORAE_SHARED_STATE_IMPLEMENTATION = 'memory-only-instance-state-v2';

const runtime = sharedStateRuntime;
const driver = () => 'memory';

export function sharedStateDriverInfo() {
  const remote = sharedStateRemoteDriverStatus();
  return {
    enabled: true,
    requestedMode: 'memory',
    driver: 'memory',
    scope: scopeValue(),
    table: null,
    remoteConfigured: remote.configured,
    remoteHealthy: true,
    memoryFallback: false,
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
    return { ...clone(local), source: 'memory' };
  }

  if (local && options.allowStale === true) {
    runtime.metrics.staleHits += 1;
    return { ...clone(local), source: 'memory', stale: true };
  }

  runtime.metrics.localMisses += 1;
  return null;
}

export async function setSharedState(namespace, key, value, options = {}) {
  runtime.metrics.sets += 1;
  const maxValueBytes = intValue(
    process.env.VALORAE_SHARED_STATE_MAX_VALUE_BYTES,
    DEFAULT_SHARED_STATE_MAX_VALUE_BYTES,
    4096,
    4 * 1024 * 1024,
  );
  const bytes = valueBytes(value);
  if (bytes > maxValueBytes) {
    runtime.metrics.oversizeRejected += 1;
    return { ok: false, stored: false, reason: 'oversize', bytes, maxValueBytes, driver: driver() };
  }

  const record = normalizeRecord(namespace, key, value, { ...options, source: 'memory' });
  setMemoryRecord(record);
  return {
    ok: true,
    stored: true,
    remoteStored: false,
    record: clone(record),
    driver: driver(),
  };
}

export async function deleteSharedState(namespace, key) {
  runtime.metrics.deletes += 1;
  const ns = namespaceValue(namespace);
  const sk = keyValue(key);
  const mk = memoryKey(ns, sk);
  runtime.memory.delete(mk);
  runtime.misses.delete(mk);
  return { ok: true, remoteDeleted: false, driver: driver() };
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

  const lease = { owner, expiresAt: isoTime(Date.now() + ttlMs) };
  runtime.leases.set(leaseKey, lease);
  runtime.metrics.leaseAcquired += 1;
  return { acquired: true, ...lease, driver: driver(), shared: false };
}

export async function releaseSharedLease(namespace, key, options = {}) {
  const ns = namespaceValue(namespace);
  const sk = keyValue(key);
  const owner = String(options.owner || runtime.instanceId).slice(0, 128);
  const leaseKey = memoryKey(`lease.${ns}`, sk);
  const current = runtime.leases.get(leaseKey);
  const released = !current || current.owner === owner;
  if (released) runtime.leases.delete(leaseKey);
  runtime.metrics.leaseReleased += released ? 1 : 0;
  return { released, driver: driver(), shared: false };
}

export function sharedStateStats() {
  trimMemory();
  const info = sharedStateDriverInfo();
  const namespaces = {};
  for (const record of runtime.memory.values()) {
    namespaces[record.namespace] = Number(namespaces[record.namespace] || 0) + 1;
  }
  return {
    version: VALORAE_SHARED_STATE_VERSION,
    startedAt: isoTime(runtime.startedAt),
    ...info,
    entries: runtime.memory.size,
    missEntries: runtime.misses.size,
    inflight: 0,
    leases: runtime.leases.size,
    namespaces,
    metrics: { ...runtime.metrics },
    remoteLastSuccessAt: null,
    remoteUnavailableUntil: null,
    remoteLastError: null,
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
    enabled: true,
    mode: 'memory',
    driver: 'memory',
    hiddenFromUi: true,
    contractImpact: 'none-financial-contract-preserved',
    storage: {
      remote: 'desativado',
      localMirror: 'memória efêmera e limitada por instância',
      scope: info.scope,
      table: null,
      remoteConfigured: info.remoteConfigured,
      migration: null,
    },
    sharedNamespaces: {
      contractContinuity: 'último payload válido na instância atual',
      providerHealth: 'circuit breaker e cooldown na instância atual',
      negativeFailureCache: 'backoff curto na instância atual',
      leases: 'coordenação local na instância atual',
    },
    guarantees: {
      crossInstanceContractContinuity: false,
      crossInstanceProviderHealth: false,
      sharedNegativeFailureBackoff: false,
      expiringStateWithTtl: true,
      atomicLeaseSupport: false,
      boundedMemoryMirror: true,
      remoteFailureNeverBlocksFinancialResponse: true,
      memoryFallbackAvailable: true,
      serviceRoleNeverExposedToApk: true,
      financialPayloadShapeUnchanged: true,
      supabaseUserSyncTablesUntouched: true,
    },
    rollback: {
      disable: 'não necessário; estado operacional não usa rede nem SQL',
      memoryOnly: 'VALORAE_SHARED_STATE_MODE=memory',
      remoteOptIn: 'indisponível',
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
