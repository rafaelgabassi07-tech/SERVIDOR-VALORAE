import { VALORAE_RELEASE_PATCH } from '../release/current.js';

// Compatibility shim only. Remote monitor persistence was permanently removed from runtime.
// This module intentionally contains no fetch, timer, queue, waitUntil, SQL table access or
// background task. Metrics exist only in the memory owned by server-metrics.js and disappear
// when the serverless instance is recycled.
const DEFAULT_READ_LIMIT = 160;
const enabled = false;

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

function safeScope(value) {
  const normalized = String(value || 'production')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return normalized || 'production';
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  try { return structuredClone(value); } catch {
    try { return JSON.parse(JSON.stringify(value)); } catch { return undefined; }
  }
}

function compactEvent(event = {}, { instanceId = 'memory', releasePatch = VALORAE_RELEASE_PATCH } = {}) {
  const safe = {
    ...cloneJson(event),
    eventKey: String(event.eventKey || `${instanceId}:${event.id ?? event.at ?? Date.now()}`).slice(0, 220),
    instanceId: String(instanceId || 'memory').slice(0, 96),
    releasePatch: String(releasePatch || VALORAE_RELEASE_PATCH).slice(0, 160),
    persisted: false,
  };
  delete safe.client;
  delete safe.payloadPreview;
  return safe;
}

function rowFromEvent(event, context = {}) {
  return compactEvent(event, context);
}

function parseTotal(headers, fallback) {
  const contentRange = String(headers?.get?.('content-range') || '');
  const match = contentRange.match(/\/(\d+|\*)$/);
  return match && match[1] !== '*' ? Number(match[1]) : fallback;
}

function registerBackgroundTask() {
  return false;
}

export function monitorPersistenceConfig() {
  const url = cleanUrl(process.env.SUPABASE_URL || process.env.VALORAE_SUPABASE_URL || '');
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.VALORAE_SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();
  return {
    url,
    key,
    configured: url.startsWith('https://') && Boolean(key),
    requested: boolValue(process.env.VALORAE_MONITOR_PERSISTENCE_ENABLED, false),
    enabled,
    active: false,
    mode: 'memory',
    table: null,
    scope: safeScope(process.env.VERCEL_ENV || process.env.NODE_ENV || 'production'),
    readLimit: intValue(process.env.VALORAE_MONITOR_PERSISTENCE_READ_LIMIT, DEFAULT_READ_LIMIT, 80, 500),
    persistPayloadPreview: false,
  };
}

export function scheduleMonitorEventPersistence() {
  return null;
}

export async function loadPersistedMonitorEvents() {
  return { events: [], total: 0, status: monitorPersistenceStatus() };
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
  return {
    requested: cfg.requested,
    enabled: false,
    configured: cfg.configured,
    active: false,
    operational: false,
    mode: 'memory',
    table: null,
    scope: cfg.scope,
    readLimit: cfg.readLimit,
    queueDepth: 0,
    lastWriteAt: null,
    lastReadAt: null,
    remoteUnavailableUntil: null,
    lastError: null,
    cachedEvents: 0,
    cachedTotal: 0,
    metrics: { queued: 0, written: 0, writeBatches: 0, writeErrors: 0, reads: 0, readErrors: 0, cacheHits: 0, dropped: 0 },
  };
}

export async function flushMonitorPersistenceForTests() {
  return { ok: true, skipped: true, written: 0 };
}

export function resetMonitorPersistenceForTests() {}

export const _test = { cleanUrl, safeScope, compactEvent, rowFromEvent, parseTotal, registerBackgroundTask };
