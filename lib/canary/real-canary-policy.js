import { createHash } from 'node:crypto';

/**
 * Checkpoint 116: política pura dos canários reais.
 * Não executa rede nem escreve estado; concentra seleção, limites e validação aditiva.
 */
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function boolEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 'on', 'enabled'].includes(String(value).trim().toLowerCase());
}

export function intEnv(name, fallback, min, max) {
  const value = Number(process.env[name]);
  return Math.max(min, Math.min(max, Number.isFinite(value) ? Math.floor(value) : fallback));
}

export function normalizeToken(value = '', fallback = 'unknown') {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

export function endpointAllowlist() {
  const raw = String(process.env.VALORAE_REAL_CANARY_ENDPOINTS || 'scrape,batch-scrape');
  return new Set(raw.split(',').map(value => normalizeToken(value)).filter(Boolean));
}

export function pipelineAllowlist() {
  const raw = String(process.env.VALORAE_REAL_CANARY_PIPELINES || 'standards-html,structured-data,dynamic-render');
  return new Set(raw.split(',').map(value => normalizeToken(value)).filter(Boolean));
}

export function realCanaryMode() {
  if (!boolEnv('VALORAE_REAL_CANARY_ENABLED', true)) return 'disabled';
  const raw = String(process.env.VALORAE_REAL_CANARY_MODE || 'shadow').trim().toLowerCase();
  if (['disabled', 'off', 'none'].includes(raw)) return 'disabled';
  if (['shadow', 'observe', 'observation'].includes(raw)) return 'shadow';
  return 'safe-promote';
}

export function sampleBasisPoints() {
  return intEnv('VALORAE_REAL_CANARY_SAMPLE_BPS', 100, 0, 2500);
}

export function maxConcurrent() {
  return intEnv('VALORAE_REAL_CANARY_MAX_CONCURRENT', 1, 1, 4);
}

export function maxRunsPerMinute() {
  return intEnv('VALORAE_REAL_CANARY_MAX_RUNS_PER_MINUTE', 8, 1, 120);
}

export function leaseTtlMs() {
  return intEnv('VALORAE_REAL_CANARY_LEASE_TTL_MS', 20_000, 2_000, 180_000);
}

export function circuitFailureThreshold() {
  return intEnv('VALORAE_REAL_CANARY_CIRCUIT_FAILURES', 3, 1, 20);
}

export function circuitCooldownMs() {
  return intEnv('VALORAE_REAL_CANARY_CIRCUIT_COOLDOWN_MS', 5 * 60_000, 10_000, 60 * 60_000);
}

export function maxValueBytes() {
  return intEnv('VALORAE_REAL_CANARY_MAX_VALUE_BYTES', 256_000, 8_000, 1_000_000);
}

function stableHash(value = '') {
  const salt = String(process.env.VALORAE_REAL_CANARY_SALT || 'valorae-checkpoint115-v1');
  return createHash('sha256').update(`${salt}\u0000${String(value || '')}`).digest('hex');
}

export function bucketFor(value = '') {
  return Number.parseInt(stableHash(value).slice(0, 8), 16) % 10_000;
}

export function identityHash(endpoint, identity) {
  return stableHash(`${normalizeToken(endpoint)}\u0000${String(identity || '')}`);
}

function present(value) {
  if (Array.isArray(value)) return value.some(present);
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function safeClone(value) {
  try { return structuredClone(value); }
  catch { return JSON.parse(JSON.stringify(value)); }
}

export function validateValue(value, depth = 0, counters = { nodes: 0 }) {
  if (depth > 14) return { ok: false, reason: 'max-depth' };
  counters.nodes += 1;
  if (counters.nodes > 20_000) return { ok: false, reason: 'max-nodes' };
  if (typeof value === 'number' && !Number.isFinite(value)) return { ok: false, reason: 'non-finite-number' };
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return { ok: false, reason: 'unsupported-value' };
  if (typeof value === 'string' && value.length > 200_000) return { ok: false, reason: 'oversize-string' };
  if (Array.isArray(value)) {
    if (value.length > 5000) return { ok: false, reason: 'oversize-array' };
    for (const item of value) {
      const checked = validateValue(item, depth + 1, counters);
      if (!checked.ok) return checked;
    }
    return { ok: true };
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length > 2000) return { ok: false, reason: 'oversize-object' };
    for (const key of keys) {
      if (DANGEROUS_KEYS.has(key)) return { ok: false, reason: 'dangerous-key' };
      const checked = validateValue(value[key], depth + 1, counters);
      if (!checked.ok) return checked;
    }
  }
  return { ok: true };
}

function byteLength(value) {
  try { return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8'); }
  catch { return Number.MAX_SAFE_INTEGER; }
}

export function additiveCandidate(baselineResults = {}, candidates = [], allowedKeys = []) {
  const baseline = baselineResults && typeof baselineResults === 'object' && !Array.isArray(baselineResults) ? baselineResults : {};
  const out = safeClone(baseline);
  const allowed = new Set((allowedKeys || []).map(String));
  const restrictKeys = allowed.size > 0;
  const gainedKeys = [];
  const provenance = {};
  const rejected = [];
  const pipelines = pipelineAllowlist();

  for (const candidate of candidates || []) {
    const pipeline = normalizeToken(candidate?.pipeline);
    if (!pipelines.has(pipeline)) continue;
    if (candidate?.error) {
      rejected.push({ pipeline, reason: String(candidate.error).slice(0, 120) });
      continue;
    }
    const results = candidate?.results;
    if (!results || typeof results !== 'object' || Array.isArray(results)) continue;
    for (const [key, value] of Object.entries(results)) {
      if (DANGEROUS_KEYS.has(key) || (restrictKeys && !allowed.has(key))) continue;
      if (present(out[key])) continue;
      const checked = validateValue(value);
      if (!checked.ok) {
        rejected.push({ pipeline, key: String(key).slice(0, 100), reason: checked.reason });
        continue;
      }
      if (!present(value)) continue;
      out[key] = safeClone(value);
      gainedKeys.push(key);
      provenance[key] = pipeline;
    }
  }

  const bytes = byteLength(out);
  if (bytes > maxValueBytes()) {
    return { ok: false, results: baseline, gainedKeys: [], provenance: {}, rejected: [...rejected, { reason: 'payload-oversize', bytes }], reason: 'payload-oversize' };
  }
  const checked = validateValue(out);
  if (!checked.ok) return { ok: false, results: baseline, gainedKeys: [], provenance: {}, rejected: [...rejected, { reason: checked.reason }], reason: checked.reason };
  return { ok: true, results: out, gainedKeys: [...new Set(gainedKeys)], provenance, rejected, bytes };
}
