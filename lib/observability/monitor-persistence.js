import { VALORAE_RELEASE_PATCH } from '../release/current.js';

const DEFAULT_TABLE = 'valorae_monitor_events';
const DEFAULT_READ_LIMIT = 500;
const DEFAULT_TIMEOUT_MS = 1800;
const DEFAULT_READ_CACHE_MS = 4000;
const DEFAULT_COOLDOWN_MS = 60000;
const DEFAULT_BATCH_SIZE = 40;
const DEFAULT_DEBOUNCE_MS = 12;
const MAX_QUEUE_SIZE = 1200;

const runtime = globalThis.__VALORAE_MONITOR_PERSISTENCE__ || {
  queue: new Map(),
  flushPromise: null,
  cache: { events: [], total: 0, fetchedAt: 0 },
  remoteUnavailableUntil: 0,
  lastError: null,
  lastWriteAt: null,
  lastReadAt: null,
  metrics: {
    queued: 0,
    written: 0,
    writeBatches: 0,
    writeErrors: 0,
    reads: 0,
    readErrors: 0,
    cacheHits: 0,
    dropped: 0,
  },
};
globalThis.__VALORAE_MONITOR_PERSISTENCE__ = runtime;

function boolValue(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value).trim().toLowerCase());
}

function intValue(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function cleanUrl(raw = '') {
  return String(raw || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(?:rest|auth|storage|functions)\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

function safeIdentifier(value, fallback) {
  const normalized = String(value || fallback).trim();
  return /^[a-z_][a-z0-9_]{0,62}$/i.test(normalized) ? normalized : fallback;
}

function safeScope(value) {
  const normalized = String(value || 'production')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return normalized || 'production';
}

export function monitorPersistenceConfig() {
  const url = cleanUrl(process.env.SUPABASE_URL || process.env.VALORAE_SUPABASE_URL || '');
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.VALORAE_SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();
  const configured = url.startsWith('https://') && Boolean(key);
  const enabled = boolValue(process.env.VALORAE_MONITOR_PERSISTENCE_ENABLED, configured);
  return {
    url,
    key,
    configured,
    enabled,
    active: enabled && configured,
    table: safeIdentifier(process.env.VALORAE_MONITOR_PERSISTENCE_TABLE, DEFAULT_TABLE),
    scope: safeScope(
      process.env.VALORAE_MONITOR_PERSISTENCE_SCOPE ||
      process.env.VALORAE_SHARED_STATE_SCOPE ||
      process.env.VERCEL_ENV ||
      process.env.NODE_ENV ||
      'production'
    ),
    readLimit: intValue(process.env.VALORAE_MONITOR_PERSISTENCE_READ_LIMIT, DEFAULT_READ_LIMIT, 80, 2000),
    timeoutMs: intValue(process.env.VALORAE_MONITOR_PERSISTENCE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 300, 10000),
    readCacheMs: intValue(process.env.VALORAE_MONITOR_PERSISTENCE_READ_CACHE_MS, DEFAULT_READ_CACHE_MS, 500, 60000),
    cooldownMs: intValue(process.env.VALORAE_MONITOR_PERSISTENCE_COOLDOWN_MS, DEFAULT_COOLDOWN_MS, 1000, 10 * 60 * 1000),
    batchSize: intValue(process.env.VALORAE_MONITOR_PERSISTENCE_BATCH_SIZE, DEFAULT_BATCH_SIZE, 1, 100),
    debounceMs: intValue(process.env.VALORAE_MONITOR_PERSISTENCE_DEBOUNCE_MS, DEFAULT_DEBOUNCE_MS, 0, 250),
    persistPayloadPreview: boolValue(process.env.VALORAE_MONITOR_PERSIST_PAYLOAD_PREVIEW, true),
  };
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  try { return structuredClone(value); } catch {
    try { return JSON.parse(JSON.stringify(value)); } catch { return undefined; }
  }
}

function compactEvent(event = {}, { instanceId = 'unknown', releasePatch = VALORAE_RELEASE_PATCH } = {}) {
  const eventKey = String(event.eventKey || `${instanceId}:${event.id ?? event.at ?? Date.now()}`).slice(0, 220);
  const config = monitorPersistenceConfig();
  const safe = {
    ...cloneJson(event),
    eventKey,
    instanceId: String(instanceId || 'unknown').slice(0, 96),
    releasePatch: String(releasePatch || VALORAE_RELEASE_PATCH).slice(0, 160),
    persisted: true,
  };
  delete safe.client;
  if (!config.persistPayloadPreview) delete safe.payloadPreview;
  return safe;
}

function rowFromEvent(event, context = {}) {
  const cfg = monitorPersistenceConfig();
  const safe = compactEvent(event, context);
  return {
    event_key: safe.eventKey,
    scope: cfg.scope,
    instance_id: safe.instanceId,
    event_seq: Number.isFinite(Number(event?.id)) ? Number(event.id) : null,
    release_patch: safe.releasePatch,
    occurred_at: safe.at || new Date().toISOString(),
    route: String(safe.route || '/api').slice(0, 320),
    method: String(safe.method || 'GET').slice(0, 12),
    status: Number.isFinite(Number(safe.status)) ? Number(safe.status) : null,
    latency_ms: Number.isFinite(Number(safe.latencyMs)) ? Number(safe.latencyMs) : null,
    bytes_out: Number.isFinite(Number(safe.bytesOut)) ? Number(safe.bytesOut) : 0,
    event: safe,
  };
}

function markSuccess(kind) {
  runtime.remoteUnavailableUntil = 0;
  runtime.lastError = null;
  if (kind === 'write') runtime.lastWriteAt = new Date().toISOString();
  if (kind === 'read') runtime.lastReadAt = new Date().toISOString();
}

function markFailure(kind, error, cfg = monitorPersistenceConfig()) {
  runtime.remoteUnavailableUntil = Date.now() + cfg.cooldownMs;
  runtime.lastError = {
    kind,
    at: new Date().toISOString(),
    code: String(error?.code || error?.status || 'MONITOR_PERSISTENCE_ERROR').slice(0, 96),
    message: String(error?.message || 'Falha na persistência do monitor.').slice(0, 280),
  };
  if (kind === 'write') runtime.metrics.writeErrors += 1;
  if (kind === 'read') runtime.metrics.readErrors += 1;
}

async function supabaseRequest(path, init = {}, cfg = monitorPersistenceConfig()) {
  if (!cfg.active) {
    const error = new Error('Supabase não configurado para persistência do monitor.');
    error.code = 'MONITOR_PERSISTENCE_NOT_CONFIGURED';
    throw error;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const response = await globalThis.fetch(`${cfg.url}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        apikey: cfg.key,
        authorization: `Bearer ${cfg.key}`,
        accept: 'application/json',
        'content-type': 'application/json',
        ...(init.headers || {}),
      },
    });
    const text = await response.text();
    let body = null;
    if (text) {
      try { body = JSON.parse(text); } catch { body = text; }
    }
    if (!response.ok) {
      const error = new Error(String(body?.message || body?.hint || body?.details || body || `Supabase HTTP ${response.status}`).slice(0, 320));
      error.status = response.status;
      error.code = body?.code || `SUPABASE_HTTP_${response.status}`;
      throw error;
    }
    return { body, headers: response.headers, status: response.status };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Persistência do monitor excedeu ${cfg.timeoutMs}ms.`);
      timeoutError.code = 'MONITOR_PERSISTENCE_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function registerBackgroundTask(task, req, res) {
  let registered = false;
  try {
    const context = globalThis[Symbol.for('@vercel/request-context')]?.get?.();
    if (typeof context?.waitUntil === 'function') {
      context.waitUntil(task);
      registered = true;
    }
  } catch {}
  for (const target of [req, res]) {
    if (registered) break;
    try {
      if (typeof target?.waitUntil === 'function') {
        target.waitUntil(task);
        registered = true;
      }
    } catch {}
  }
  return registered;
}

function trimQueue() {
  while (runtime.queue.size > MAX_QUEUE_SIZE) {
    const oldest = runtime.queue.keys().next().value;
    runtime.queue.delete(oldest);
    runtime.metrics.dropped += 1;
  }
}

async function flushQueue() {
  const cfg = monitorPersistenceConfig();
  if (!cfg.active || Date.now() < runtime.remoteUnavailableUntil || runtime.queue.size === 0) return { ok: false, skipped: true };
  let written = 0;
  while (runtime.queue.size > 0) {
    const batch = [...runtime.queue.values()].slice(0, cfg.batchSize);
    for (const row of batch) runtime.queue.delete(row.event_key);
    try {
      await supabaseRequest(`/rest/v1/${cfg.table}?on_conflict=event_key`, {
        method: 'POST',
        headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(batch),
      }, cfg);
      written += batch.length;
      runtime.metrics.written += batch.length;
      runtime.metrics.writeBatches += 1;
      markSuccess('write');
    } catch (error) {
      for (const row of batch) runtime.queue.set(row.event_key, row);
      trimQueue();
      markFailure('write', error, cfg);
      return { ok: false, error: runtime.lastError, written };
    }
  }
  return { ok: true, written };
}

function ensureFlush() {
  if (runtime.flushPromise) return runtime.flushPromise;
  const cfg = monitorPersistenceConfig();
  runtime.flushPromise = (async () => {
    if (cfg.debounceMs > 0) await new Promise(resolve => setTimeout(resolve, cfg.debounceMs));
    return flushQueue();
  })().catch(error => {
    markFailure('write', error, cfg);
    return { ok: false, error: runtime.lastError };
  }).finally(() => {
    runtime.flushPromise = null;
  });
  return runtime.flushPromise;
}

export function scheduleMonitorEventPersistence(event, context = {}) {
  const cfg = monitorPersistenceConfig();
  if (!cfg.active || !event) return null;
  const row = rowFromEvent(event, context);
  runtime.queue.set(row.event_key, row);
  runtime.metrics.queued += 1;
  trimQueue();
  const task = ensureFlush();
  registerBackgroundTask(task, context.req, context.res);
  return task;
}

function parseTotal(headers, fallback) {
  const contentRange = String(headers?.get?.('content-range') || '');
  const match = contentRange.match(/\/(\d+|\*)$/);
  return match && match[1] !== '*' ? Number(match[1]) : fallback;
}

function normalizeRemoteRows(rows = []) {
  return rows.map(row => {
    const event = cloneJson(row?.event) || {};
    return {
      ...event,
      eventKey: event.eventKey || row?.event_key,
      persisted: true,
      at: event.at || row?.occurred_at,
      instanceId: event.instanceId || row?.instance_id,
      releasePatch: event.releasePatch || row?.release_patch,
    };
  }).filter(event => event.at && event.route);
}

export async function loadPersistedMonitorEvents({ force = false } = {}) {
  const cfg = monitorPersistenceConfig();
  const status = monitorPersistenceStatus();
  if (!cfg.active) return { events: [], total: 0, status };
  const age = Date.now() - Number(runtime.cache.fetchedAt || 0);
  if (!force && runtime.cache.fetchedAt && age < cfg.readCacheMs) {
    runtime.metrics.cacheHits += 1;
    return { events: cloneJson(runtime.cache.events) || [], total: runtime.cache.total || 0, status: monitorPersistenceStatus() };
  }
  if (Date.now() < runtime.remoteUnavailableUntil && runtime.cache.fetchedAt) {
    return { events: cloneJson(runtime.cache.events) || [], total: runtime.cache.total || 0, status: monitorPersistenceStatus() };
  }
  const params = new URLSearchParams({
    select: 'event_key,instance_id,release_patch,occurred_at,event',
    scope: `eq.${cfg.scope}`,
    order: 'occurred_at.desc',
    limit: String(cfg.readLimit),
  });
  try {
    runtime.metrics.reads += 1;
    const result = await supabaseRequest(`/rest/v1/${cfg.table}?${params.toString()}`, {
      method: 'GET',
      headers: {
        prefer: 'count=exact',
        'range-unit': 'items',
        range: `0-${cfg.readLimit - 1}`,
      },
    }, cfg);
    const events = normalizeRemoteRows(Array.isArray(result.body) ? result.body : []).reverse();
    const total = parseTotal(result.headers, events.length);
    runtime.cache = { events, total, fetchedAt: Date.now() };
    markSuccess('read');
    return { events: cloneJson(events) || [], total, status: monitorPersistenceStatus() };
  } catch (error) {
    markFailure('read', error, cfg);
    return {
      events: cloneJson(runtime.cache.events) || [],
      total: runtime.cache.total || 0,
      status: monitorPersistenceStatus(),
    };
  }
}

export function mergeMonitorEvents(memoryEvents = [], persistedEvents = [], limit = DEFAULT_READ_LIMIT) {
  const merged = new Map();
  for (const event of [...persistedEvents, ...memoryEvents]) {
    if (!event) continue;
    const key = String(event.eventKey || `${event.instanceId || 'memory'}:${event.id ?? ''}:${event.at || ''}:${event.route || ''}`);
    merged.set(key, { ...cloneJson(event), eventKey: key });
  }
  return [...merged.values()]
    .sort((a, b) => Date.parse(a.at || 0) - Date.parse(b.at || 0))
    .slice(-Math.max(80, Number(limit) || DEFAULT_READ_LIMIT));
}

export function monitorPersistenceStatus() {
  const cfg = monitorPersistenceConfig();
  const operational = cfg.active && !runtime.lastError;
  return {
    enabled: cfg.enabled,
    configured: cfg.configured,
    active: cfg.active,
    operational,
    mode: operational ? 'supabase' : (cfg.enabled ? 'memory-fallback' : 'memory'),
    table: cfg.table,
    scope: cfg.scope,
    readLimit: cfg.readLimit,
    queueDepth: runtime.queue.size,
    lastWriteAt: runtime.lastWriteAt,
    lastReadAt: runtime.lastReadAt,
    remoteUnavailableUntil: runtime.remoteUnavailableUntil ? new Date(runtime.remoteUnavailableUntil).toISOString() : null,
    lastError: runtime.lastError,
    cachedEvents: runtime.cache.events.length,
    cachedTotal: runtime.cache.total,
    metrics: { ...runtime.metrics },
  };
}

export async function flushMonitorPersistenceForTests() {
  return ensureFlush();
}

export function resetMonitorPersistenceForTests() {
  runtime.queue.clear();
  runtime.flushPromise = null;
  runtime.cache = { events: [], total: 0, fetchedAt: 0 };
  runtime.remoteUnavailableUntil = 0;
  runtime.lastError = null;
  runtime.lastWriteAt = null;
  runtime.lastReadAt = null;
  runtime.metrics = { queued: 0, written: 0, writeBatches: 0, writeErrors: 0, reads: 0, readErrors: 0, cacheHits: 0, dropped: 0 };
}

export const _test = { cleanUrl, safeScope, compactEvent, rowFromEvent, parseTotal, registerBackgroundTask };
