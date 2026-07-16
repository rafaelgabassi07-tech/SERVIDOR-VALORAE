import { createHash, randomUUID } from 'node:crypto';

/**
 * Checkpoint 116: núcleo determinístico do estado compartilhado.
 * Não executa rede; concentra configuração, validação, serialização e espelho local.
 */
export const DEFAULT_SHARED_STATE_TABLE = 'valorae_runtime_shared_state';
export const DEFAULT_SHARED_STATE_TTL_MS = 15 * 60 * 1000;
export const DEFAULT_SHARED_STATE_REMOTE_TIMEOUT_MS = 1200;
export const DEFAULT_SHARED_STATE_REMOTE_COOLDOWN_MS = 60 * 1000;
export const DEFAULT_SHARED_STATE_MAX_ENTRIES = 320;
export const DEFAULT_SHARED_STATE_MAX_VALUE_BYTES = 768 * 1024;
export const DEFAULT_SHARED_STATE_MISS_TTL_MS = 15 * 1000;

const NAMESPACE_RE = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
const KEY_RE = /^[a-z0-9][a-z0-9._:@/-]{0,239}$/i;

export const sharedStateRuntime = globalThis.__VALORAE_SHARED_RUNTIME_STATE__ || {
  instanceId: randomUUID(),
  startedAt: Date.now(),
  memory: new Map(),
  misses: new Map(),
  inflight: new Map(),
  leases: new Map(),
  remoteUnavailableUntil: 0,
  remoteLastError: null,
  remoteLastSuccessAt: null,
  versionSequence: 0,
  metrics: {
    gets: 0,
    sets: 0,
    deletes: 0,
    localHits: 0,
    localMisses: 0,
    remoteReads: 0,
    remoteHits: 0,
    remoteMisses: 0,
    remoteWrites: 0,
    remoteDeletes: 0,
    remoteErrors: 0,
    remoteSkippedCooldown: 0,
    staleHits: 0,
    oversizeRejected: 0,
    evictions: 0,
    leaseAttempts: 0,
    leaseAcquired: 0,
    leaseRejected: 0,
    leaseReleased: 0,
  },
};
globalThis.__VALORAE_SHARED_RUNTIME_STATE__ = sharedStateRuntime;

export function boolValue(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value).trim().toLowerCase());
}

export function intValue(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

export function sharedStateMode() {
  if (!boolValue(process.env.VALORAE_SHARED_STATE_ENABLED, true)) return 'off';
  const raw = String(process.env.VALORAE_SHARED_STATE_MODE || 'auto').trim().toLowerCase();
  if (['off', 'disabled', 'none'].includes(raw)) return 'off';
  if (['memory', 'local'].includes(raw)) return 'memory';
  if (['supabase', 'remote', 'shared'].includes(raw)) return 'supabase';
  return 'auto';
}

function safeIdentifier(value, fallback, regex) {
  const normalized = String(value || fallback).trim();
  if (!regex.test(normalized)) throw new TypeError(`Identificador de estado compartilhado inválido: ${normalized.slice(0, 80)}`);
  return normalized;
}

export function namespaceValue(value) {
  return safeIdentifier(value, 'runtime', NAMESPACE_RE).toLowerCase();
}

export function keyValue(value) {
  return safeIdentifier(value, 'default', KEY_RE);
}

export function scopeValue() {
  const raw = String(process.env.VALORAE_SHARED_STATE_SCOPE || process.env.VERCEL_ENV || process.env.NODE_ENV || 'production')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return raw || 'production';
}

export function tableValue() {
  const raw = String(process.env.VALORAE_SHARED_STATE_TABLE || DEFAULT_SHARED_STATE_TABLE).trim();
  return /^[a-z_][a-z0-9_]{0,62}$/i.test(raw) ? raw : DEFAULT_SHARED_STATE_TABLE;
}

export function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();
  return { url, key, configured: Boolean(url && key) };
}

export function sharedStateDriver() {
  const requested = sharedStateMode();
  const remote = supabaseConfig().configured;
  if (requested === 'off') return 'off';
  if (requested === 'memory') return 'memory';
  if (requested === 'supabase') return remote ? 'supabase' : 'memory-fallback';
  return remote ? 'supabase' : 'memory';
}

export function remoteAllowed() {
  return sharedStateDriver() === 'supabase' && Date.now() >= Number(sharedStateRuntime.remoteUnavailableUntil || 0);
}

export function memoryKey(namespace, key) {
  return `${scopeValue()}::${namespaceValue(namespace)}::${keyValue(key)}`;
}

export function clone(value) {
  if (value === undefined || value === null) return value;
  try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); }
}

export function checksum(value) {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

export function valueBytes(value) {
  return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
}

export function isoTime(ms) {
  return new Date(ms).toISOString();
}

export function nextStateVersion(now = Date.now()) {
  sharedStateRuntime.versionSequence = (Number(sharedStateRuntime.versionSequence || 0) + 1) % 1000;
  return now * 1000 + sharedStateRuntime.versionSequence;
}

export function normalizeRecord(namespace, key, value, options = {}) {
  const now = Date.now();
  const ttlMs = intValue(options.ttlMs, DEFAULT_SHARED_STATE_TTL_MS, 1000, 24 * 60 * 60 * 1000);
  const version = intValue(options.version, nextStateVersion(now), 1, Number.MAX_SAFE_INTEGER);
  return {
    scope: scopeValue(),
    namespace: namespaceValue(namespace),
    key: keyValue(key),
    value: clone(value),
    checksum: checksum(value),
    version,
    owner: options.owner ? String(options.owner).slice(0, 128) : null,
    createdAt: options.createdAt || isoTime(now),
    updatedAt: options.updatedAt || isoTime(now),
    expiresAt: options.expiresAt || isoTime(now + ttlMs),
    source: options.source || 'memory',
  };
}

export function isExpired(record, now = Date.now()) {
  return !record?.expiresAt || new Date(record.expiresAt).getTime() <= now;
}

export function setMemoryRecord(record) {
  const key = memoryKey(record.namespace, record.key);
  sharedStateRuntime.memory.delete(key);
  sharedStateRuntime.memory.set(key, { ...clone(record), source: record.source || 'memory' });
  sharedStateRuntime.misses.delete(key);
  trimMemory();
  return sharedStateRuntime.memory.get(key);
}

export function trimMemory() {
  const now = Date.now();
  for (const [key, record] of sharedStateRuntime.memory.entries()) {
    if (isExpired(record, now) && now - new Date(record.expiresAt).getTime() > DEFAULT_SHARED_STATE_TTL_MS) sharedStateRuntime.memory.delete(key);
  }
  const maxEntries = intValue(process.env.VALORAE_SHARED_STATE_MAX_ENTRIES, DEFAULT_SHARED_STATE_MAX_ENTRIES, 32, 5000);
  while (sharedStateRuntime.memory.size > maxEntries) {
    const oldest = sharedStateRuntime.memory.keys().next().value;
    sharedStateRuntime.memory.delete(oldest);
    sharedStateRuntime.metrics.evictions += 1;
  }
  for (const [key, expiresAt] of sharedStateRuntime.misses.entries()) if (expiresAt <= now) sharedStateRuntime.misses.delete(key);
  for (const [key, lease] of sharedStateRuntime.leases.entries()) if (new Date(lease.expiresAt).getTime() <= now) sharedStateRuntime.leases.delete(key);
}

export function mapRemoteRow(row) {
  if (!row || typeof row !== 'object') return null;
  const value = typeof row.value === 'string' ? (() => { try { return JSON.parse(row.value); } catch { return row.value; } })() : row.value;
  return {
    scope: row.scope || scopeValue(),
    namespace: row.namespace,
    key: row.state_key,
    value,
    checksum: row.checksum || checksum(value),
    version: Number(row.version || 1),
    owner: row.owner || null,
    createdAt: row.created_at || row.updated_at || isoTime(Date.now()),
    updatedAt: row.updated_at || isoTime(Date.now()),
    expiresAt: row.expires_at,
    source: 'supabase',
  };
}

export function remoteRow(record) {
  return {
    scope: record.scope,
    namespace: record.namespace,
    state_key: record.key,
    value: record.value,
    version: record.version,
    checksum: record.checksum,
    owner: record.owner,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    expires_at: record.expiresAt,
  };
}
