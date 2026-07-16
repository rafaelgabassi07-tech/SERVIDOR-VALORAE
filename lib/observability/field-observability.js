import { randomUUID } from 'node:crypto';

export const VALORAE_FIELD_OBSERVABILITY_VERSION = '2026.07.14-checkpoint107-v1';
export const VALORAE_FIELD_OBSERVABILITY_POLICY_VERSION = 'field-source-evidence-v1';

const MAX_FIELDS = 120;
const MAX_SOURCE_TIMINGS = 80;
const MAX_RESPONSE_FIELDS = 10;
const MAX_RESPONSE_TIMINGS = 6;
const MAX_TRACE_ENTRIES = 64;
const MAX_TRACE_AGE_MS = 15 * 60 * 1000;
const traceStore = globalThis.__VALORAE_FIELD_OBSERVABILITY_TRACES__ || new Map();
globalThis.__VALORAE_FIELD_OBSERVABILITY_TRACES__ = traceStore;
const MAX_DEPTH = 10;
const MAX_VISITED_NODES = 12_000;
const SKIP_KEYS = new Set([
  'fieldObservability', 'contractBaseline', 'raw', 'html', 'body', 'requestBody',
  'selectorResults', 'pageHtml', 'sourceHtml', 'document', 'stack',
]);

function cleanText(value, max = 160) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min = 0, max = 1) {
  const number = finiteNumber(value);
  return number === null ? null : Math.max(min, Math.min(max, number));
}

function present(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function normalizedPath(path = '') {
  return cleanText(String(path).replace(/\.\d+(?=\.|$)/g, '[]'), 240);
}

function sourceName(node = {}) {
  return cleanText(
    node.source || node.provider || node.origin || node.sourceLabel || node.dataSource || node.vendor || '',
    120
  );
}

function confidenceValue(value) {
  const direct = clamp(value);
  if (direct !== null) return Number(direct.toFixed(2));
  const label = cleanText(value, 24).toLowerCase();
  if (['high', 'alta', 'verified', 'validado'].includes(label)) return 0.92;
  if (['medium', 'partial', 'média', 'media'].includes(label)) return 0.72;
  if (['low', 'baixa', 'suspect', 'suspeito'].includes(label)) return 0.45;
  return null;
}

function inferMethod(node = {}, source = '') {
  const explicit = cleanText(
    node.extractionMethod || node.method || node.sourceType || node.transport || node.parser || node.strategy || '',
    80
  );
  if (explicit) return explicit.toLowerCase().replace(/\s+/g, '-');
  const text = `${source} ${cleanText(node.url || node.endpoint || '', 180)}`.toLowerCase();
  if (/json-ld|__next_data__|embedded.?json|highcharts/.test(text)) return 'embedded-structured-data';
  if (/api|yahoo|banco central|sgs|b3 oficial|cvm|endpoint/.test(text)) return 'structured-api';
  if (/html|página|pagina|dom|selector|statusinvest|investidor10/.test(text)) return 'html-extraction';
  if (/cache|stale/.test(text)) return 'cache-reuse';
  return source ? 'source-declared' : 'derived';
}

function inferFallback(node = {}, source = '') {
  if (node.fallback === true || node.isFallback === true || node.stale === true || node.recovered === true) return true;
  const status = cleanText(node.status || node.cacheStatus || node.code || '', 80).toLowerCase();
  return /fallback|stale|recovered|degraded|partial/.test(`${status} ${source}`.toLowerCase());
}

function inferConfidence(node = {}, source = '', method = '', fallback = false) {
  const explicit = confidenceValue(node.confidence ?? node.score ?? node.reliability?.score);
  if (explicit !== null) return explicit;
  let value = 0.62;
  if (method === 'structured-api') value = 0.94;
  else if (method === 'embedded-structured-data') value = 0.9;
  else if (method === 'html-extraction') value = 0.8;
  else if (method === 'cache-reuse') value = 0.7;
  if (/oficial|official|cvm|b3|banco central|sgs/.test(source.toLowerCase())) value += 0.03;
  if (fallback) value -= 0.16;
  if (node.validated === true || node.ok === true) value += 0.03;
  if (node.validated === false || node.suspicious === true) value -= 0.25;
  return Number(Math.max(0.05, Math.min(0.99, value)).toFixed(2));
}

function observedAt(node = {}, root = {}) {
  return cleanText(
    node.observedAt || node.fetchedAt || node.retrievedAt || node.updatedAt ||
      root.generatedAt || root.updatedAt || root.timestamp || '',
    64
  ) || null;
}

function cacheStatus(node = {}) {
  return cleanText(node.cacheStatus || node.cache || node.cacheState || node.reliability?.state || '', 64) || null;
}

function fieldIdentifier(node = {}, path = '') {
  const id = cleanText(node.id || node.key || node.code || node.field || node.name || node.label || '', 100);
  return id || normalizedPath(path).split('.').at(-1) || 'field';
}

function hasScalarValue(node = {}) {
  return ['value', 'numericValue', 'display', 'amount', 'price', 'returnPercent', 'close', 'status']
    .some(key => present(node[key]) && (typeof node[key] !== 'object' || node[key] === null));
}

function shouldRecordNode(node = {}) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  const source = sourceName(node);
  if (!source) return false;
  return hasScalarValue(node) || present(node.confidence) || present(node.unit) || present(node.extractionMethod) || present(node.method);
}

function compactEvidence(node = {}) {
  const keys = [
    'source', 'provider', 'origin', 'sourceType', 'extractionMethod', 'method', 'parser',
    'confidence', 'validated', 'cacheStatus', 'status', 'url', 'endpoint', 'observedAt', 'fetchedAt', 'updatedAt',
  ].filter(key => present(node[key]));
  let host = null;
  const url = cleanText(node.url || node.endpoint || '', 300);
  if (/^https?:\/\//i.test(url)) {
    try { host = new URL(url).hostname; } catch {}
  }
  return { keys: keys.slice(0, 14), host };
}

function buildFieldEntry(node, path, root) {
  const source = sourceName(node);
  const method = inferMethod(node, source);
  const fallback = inferFallback(node, source);
  const elapsedMs = finiteNumber(node.elapsedMs ?? node.durationMs ?? node.latencyMs);
  return {
    path: normalizedPath(path),
    field: fieldIdentifier(node, path),
    source,
    method,
    confidence: inferConfidence(node, source, method, fallback),
    observedAt: observedAt(node, root),
    fallback,
    cacheStatus: cacheStatus(node),
    elapsedMs: elapsedMs === null ? null : Math.max(0, Math.round(elapsedMs)),
    evidence: compactEvidence(node),
  };
}

function collectFields(root = {}) {
  const fields = [];
  const seen = new Set();
  let visited = 0;
  let candidateCount = 0;
  let truncated = false;

  function walk(value, path = '', depth = 0) {
    if (visited >= MAX_VISITED_NODES || depth > MAX_DEPTH) {
      truncated = true;
      return;
    }
    visited += 1;
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (visited >= MAX_VISITED_NODES) { truncated = true; break; }
        walk(value[index], path ? `${path}.${index}` : String(index), depth + 1);
      }
      return;
    }
    if (shouldRecordNode(value)) {
      candidateCount += 1;
      const entry = buildFieldEntry(value, path || 'root', root);
      const key = `${entry.path}|${entry.field}|${entry.source}`;
      if (!seen.has(key)) {
        seen.add(key);
        if (fields.length < MAX_FIELDS) fields.push(entry);
        else truncated = true;
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (SKIP_KEYS.has(key)) continue;
      walk(child, path ? `${path}.${key}` : key, depth + 1);
    }
  }

  walk(root);
  return { fields, candidateCount, visitedNodes: visited, truncated };
}

function normalizeTiming(node = {}, path = '') {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
  const provider = sourceName(node);
  const elapsed = finiteNumber(node.elapsedMs ?? node.durationMs ?? node.latencyMs ?? node.timingMs);
  const status = cleanText(node.status || node.state || node.code || '', 64);
  const cache = cacheStatus(node);
  if (!provider || (elapsed === null && !status && !cache)) return null;
  return {
    provider,
    path: normalizedPath(path),
    status: status || null,
    elapsedMs: elapsed === null ? null : Math.max(0, Math.round(elapsed)),
    cacheStatus: cache,
    fallback: inferFallback(node, provider),
  };
}

function collectSourceTimings(root = {}) {
  const timings = [];
  const seen = new Set();
  let visited = 0;
  let truncated = false;
  function walk(value, path = '', depth = 0, diagnosticContext = false) {
    if (visited >= MAX_VISITED_NODES || depth > MAX_DEPTH) { truncated = true; return; }
    visited += 1;
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        walk(value[index], `${path}.${index}`, depth + 1, diagnosticContext);
      }
      return;
    }
    const hereDiagnostic = diagnosticContext || /(?:diagnostics|attempts|sources|sourceCoverage)$/i.test(path);
    if (hereDiagnostic) {
      const timing = normalizeTiming(value, path);
      if (timing) {
        const key = `${timing.provider}|${timing.path}|${timing.status}|${timing.elapsedMs}|${timing.cacheStatus}`;
        if (!seen.has(key)) {
          seen.add(key);
          if (timings.length < MAX_SOURCE_TIMINGS) timings.push(timing);
          else truncated = true;
        }
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (SKIP_KEYS.has(key)) continue;
      walk(child, path ? `${path}.${key}` : key, depth + 1, hereDiagnostic || /diagnostics|attempts|sources|coverage/i.test(key));
    }
  }
  walk(root);
  return { timings, truncated };
}

function countBy(values = [], selector) {
  const map = new Map();
  for (const value of values) {
    const key = cleanText(selector(value) || 'unknown', 120) || 'unknown';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

export function buildFieldObservability(endpoint, payload = {}, options = {}) {
  const traceId = cleanText(options.traceId || payload.requestId || randomUUID(), 96);
  const fieldResult = collectFields(payload);
  const timingResult = collectSourceTimings(payload);
  const fields = fieldResult.fields;
  const sourceTimings = timingResult.timings;
  const lowConfidence = fields.filter(item => item.confidence < 0.65);
  const fallbackFields = fields.filter(item => item.fallback);
  const observedFields = fields.filter(item => item.observedAt);
  const elapsedSamples = sourceTimings.map(item => item.elapsedMs).filter(Number.isFinite);
  return {
    version: VALORAE_FIELD_OBSERVABILITY_VERSION,
    policyVersion: VALORAE_FIELD_OBSERVABILITY_POLICY_VERSION,
    endpoint: cleanText(endpoint, 80),
    traceId,
    attachedAt: new Date().toISOString(),
    compatibility: 'ADDITIVE_INTERNAL_METADATA',
    hiddenFromUi: true,
    summary: {
      fieldCount: fields.length,
      candidateFieldCount: fieldResult.candidateCount,
      providerCount: new Set(fields.map(item => item.source).filter(Boolean)).size,
      methodCount: new Set(fields.map(item => item.method).filter(Boolean)).size,
      fallbackFieldCount: fallbackFields.length,
      lowConfidenceFieldCount: lowConfidence.length,
      observedAtCoveragePercent: fields.length ? Math.round((observedFields.length / fields.length) * 10000) / 100 : 0,
      sourceTimingCount: sourceTimings.length,
      averageSourceElapsedMs: elapsedSamples.length ? Math.round(elapsedSamples.reduce((sum, value) => sum + value, 0) / elapsedSamples.length) : null,
      maxSourceElapsedMs: elapsedSamples.length ? Math.max(...elapsedSamples) : null,
      truncated: Boolean(fieldResult.truncated || timingResult.truncated),
      visitedNodes: fieldResult.visitedNodes,
    },
    providers: countBy(fields, item => item.source),
    methods: countBy(fields, item => item.method),
    cacheStates: countBy(fields.filter(item => item.cacheStatus), item => item.cacheStatus),
    lowConfidenceFields: lowConfidence.slice(0, 24).map(item => ({ path: item.path, field: item.field, source: item.source, confidence: item.confidence })),
    fallbackFields: fallbackFields.slice(0, 24).map(item => ({ path: item.path, field: item.field, source: item.source, method: item.method })),
    fields,
    sourceTimings,
  };
}


function trimTraceStore(now = Date.now()) {
  for (const [key, entry] of traceStore.entries()) {
    if (now - entry.storedAt > MAX_TRACE_AGE_MS) traceStore.delete(key);
  }
  if (traceStore.size <= MAX_TRACE_ENTRIES) return;
  [...traceStore.entries()]
    .sort((a, b) => a[1].storedAt - b[1].storedAt)
    .slice(0, traceStore.size - MAX_TRACE_ENTRIES)
    .forEach(([key]) => traceStore.delete(key));
}

function storeFullTrace(observability) {
  trimTraceStore();
  traceStore.set(observability.traceId, { storedAt: Date.now(), observability });
  trimTraceStore();
}

function compactForResponse(observability) {
  return {
    version: observability.version,
    policyVersion: observability.policyVersion,
    endpoint: observability.endpoint,
    traceId: observability.traceId,
    attachedAt: observability.attachedAt,
    compatibility: observability.compatibility,
    hiddenFromUi: observability.hiddenFromUi,
    summary: observability.summary,
    providers: observability.providers.slice(0, 12),
    methods: observability.methods.slice(0, 8),
    cacheStates: observability.cacheStates.slice(0, 8),
    lowConfidenceFields: observability.lowConfidenceFields.slice(0, 5),
    fallbackFields: observability.fallbackFields.slice(0, 5),
    fields: observability.fields.slice(0, MAX_RESPONSE_FIELDS),
    sourceTimings: observability.sourceTimings.slice(0, MAX_RESPONSE_TIMINGS),
    fullTraceAvailable: true,
    fullFieldCount: observability.fields.length,
    fullSourceTimingCount: observability.sourceTimings.length,
  };
}

export function attachFieldObservability(endpoint, payload = {}, options = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const out = typeof structuredClone === 'function'
    ? structuredClone(payload)
    : JSON.parse(JSON.stringify(payload));
  const observability = buildFieldObservability(endpoint, out, options);
  storeFullTrace(observability);
  out.fieldObservability = options.full === true ? observability : compactForResponse(observability);
  return out;
}

export function buildFieldObservabilityManifest() {
  return {
    status: 'OK',
    endpoint: 'contract/observability',
    version: VALORAE_FIELD_OBSERVABILITY_VERSION,
    policyVersion: VALORAE_FIELD_OBSERVABILITY_POLICY_VERSION,
    guarantees: {
      additiveMetadataOnly: true,
      noUiContractChange: true,
      noRawHtmlOrSecrets: true,
      requestTraceCorrelation: true,
      perFieldSourceAndMethod: true,
      fallbackAndCacheVisibility: true,
      boundedPayload: true,
    },
    limits: {
      maxFields: MAX_FIELDS,
      maxSourceTimings: MAX_SOURCE_TIMINGS,
      maxResponseFields: MAX_RESPONSE_FIELDS,
      maxResponseTimings: MAX_RESPONSE_TIMINGS,
      maxTraceEntries: MAX_TRACE_ENTRIES,
      maxTraceAgeMs: MAX_TRACE_AGE_MS,
      maxDepth: MAX_DEPTH,
      maxVisitedNodes: MAX_VISITED_NODES,
    },
    fields: ['path', 'field', 'source', 'method', 'confidence', 'observedAt', 'fallback', 'cacheStatus', 'elapsedMs', 'evidence'],
  };
}



export function getFieldObservabilityTrace(traceId = '') {
  trimTraceStore();
  const key = cleanText(traceId, 96);
  const entry = key ? traceStore.get(key) : null;
  if (!entry) return null;
  return { ...entry.observability, storedAt: new Date(entry.storedAt).toISOString() };
}

export function fieldObservabilityStats() {
  trimTraceStore();
  return { entries: traceStore.size, maxEntries: MAX_TRACE_ENTRIES, maxAgeMs: MAX_TRACE_AGE_MS };
}

export function clearFieldObservabilityTraces() {
  traceStore.clear();
}

export const _test = {
  collectFields,
  collectSourceTimings,
  inferMethod,
  inferFallback,
  inferConfidence,
  normalizedPath,
  MAX_FIELDS,
  MAX_SOURCE_TIMINGS,
  MAX_RESPONSE_FIELDS,
  MAX_RESPONSE_TIMINGS,
  MAX_TRACE_ENTRIES,
  MAX_TRACE_AGE_MS,
  traceStore,
  trimTraceStore,
  compactForResponse,
};
