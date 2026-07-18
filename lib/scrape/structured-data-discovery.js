import { performance } from 'node:perf_hooks';
import { createLazyHtmlDocumentContext, VALORAE_HYBRID_DOCUMENT_VERSION } from './document-context.js';

import { VALORAE_STRUCTURED_DATA_VERSION } from '../core/feature-versions.js';
export { VALORAE_STRUCTURED_DATA_VERSION } from '../core/feature-versions.js';
export const VALORAE_STRUCTURED_DATA_POLICY = 'structured-data-first-shadow-v1';
export const VALORAE_STRUCTURED_DATA_IMPLEMENTATION = 'cheerio-script-discovery-safe-json-v1';

const metrics = globalThis.__VALORAE_STRUCTURED_DATA_METRICS__ || {
  runs: 0,
  successes: 0,
  failures: 0,
  skipped: 0,
  jsonLdDocuments: 0,
  nextDataDocuments: 0,
  applicationJsonDocuments: 0,
  inlineAssignments: 0,
  chartConfigurations: 0,
  discoveredEndpoints: 0,
  safePromotionRuns: 0,
  totalElapsedMs: 0,
  maxElapsedMs: 0,
  lastElapsedMs: 0,
  lastStatus: 'NEVER',
  lastReason: '',
  lastRunAt: '',
};
globalThis.__VALORAE_STRUCTURED_DATA_METRICS__ = metrics;

function envDisabled(name) {
  return ['0', 'false', 'no', 'off', 'disabled'].includes(String(process.env[name] || '').trim().toLowerCase());
}

export function structuredDataMode() {
  if (envDisabled('VALORAE_STRUCTURED_DATA_DISCOVERY_ENABLED')) return 'disabled';
  const value = String(process.env.VALORAE_STRUCTURED_DATA_MODE || 'shadow').trim().toLowerCase();
  if (['disabled', 'off', 'legacy-only'].includes(value)) return 'disabled';
  if (['prefer-structured', 'structured', 'promote-safe'].includes(value)) return 'prefer-structured';
  return 'shadow';
}

function maxHtmlChars() {
  const configured = Number(process.env.VALORAE_STRUCTURED_DATA_MAX_HTML_CHARS || 3_000_000);
  return Math.max(100_000, Math.min(Number.isFinite(configured) ? configured : 3_000_000, 8_000_000));
}

function maxDocuments() {
  const configured = Number(process.env.VALORAE_STRUCTURED_DATA_MAX_DOCUMENTS || 80);
  return Math.max(8, Math.min(Number.isFinite(configured) ? configured : 80, 240));
}

function maxEndpoints() {
  const configured = Number(process.env.VALORAE_STRUCTURED_DATA_MAX_ENDPOINTS || 80);
  return Math.max(8, Math.min(Number.isFinite(configured) ? configured : 80, 240));
}

function maxDocumentBytes() {
  const configured = Number(process.env.VALORAE_STRUCTURED_DATA_MAX_DOCUMENT_BYTES || 350_000);
  return Math.max(10_000, Math.min(Number.isFinite(configured) ? configured : 350_000, 1_500_000));
}

function compact(value = '') {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHtml(value = '') {
  return String(value || '')
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&#x22;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\\\//g, '/');
}

function normalizeJsLikeJson(raw = '') {
  let source = decodeHtml(String(raw || '').trim());
  if (!source) return '';
  if (source.endsWith(';')) source = source.slice(0, -1).trim();
  source = source
    .replace(/\bundefined\b/g, 'null')
    .replace(/\bNaN\b/g, 'null')
    .replace(/\bInfinity\b/g, 'null')
    .replace(/,\s*([}\]])/g, '$1');
  source = source.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3');
  source = source.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, inner) => JSON.stringify(String(inner).replace(/\\'/g, "'")));
  return source;
}

function safeParseJson(raw = '') {
  const source = String(raw || '').trim();
  if (!source || source.length > maxDocumentBytes()) return null;
  const candidates = [source, decodeHtml(source), normalizeJsLikeJson(source)];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  return null;
}

function extractBalancedLiteral(source = '', startIndex = 0) {
  const open = source[startIndex];
  const close = open === '{' ? '}' : open === '[' ? ']' : '';
  if (!close) return '';
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return source.slice(startIndex, index + 1);
    }
  }
  return '';
}

function sanitizeName(value = '', fallback = 'document') {
  const normalized = String(value || fallback).trim().replace(/[^A-Za-z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized.slice(0, 100) || fallback;
}

function valuePresent(value) {
  if (Array.isArray(value)) return value.some(valuePresent);
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function addDocument(documents, candidate) {
  if (!candidate?.data || typeof candidate.data !== 'object') return;
  const fingerprint = JSON.stringify(candidate.data).slice(0, 4000);
  if (documents.some(item => item.fingerprint === fingerprint)) return;
  if (documents.length >= maxDocuments()) return;
  documents.push({
    id: sanitizeName(candidate.id || `${candidate.kind}-${documents.length + 1}`),
    kind: String(candidate.kind || 'embedded-json'),
    source: String(candidate.source || 'html-script'),
    data: candidate.data,
    bytes: Number(candidate.bytes || Buffer.byteLength(JSON.stringify(candidate.data), 'utf8')),
    fingerprint,
  });
}

function walkValues(value, visitor, path = '$', depth = 0, state = { nodes: 0 }) {
  if (depth > 14 || state.nodes > 20_000) return;
  state.nodes += 1;
  visitor(value, path);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) walkValues(value[index], visitor, `${path}[${index}]`, depth + 1, state);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    const safeKey = /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
    walkValues(nested, visitor, `${path}${safeKey}`, depth + 1, state);
  }
}

function safeUrl(raw = '', baseUrl = '') {
  const source = decodeHtml(String(raw || '').trim()).replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
  if (!source || source.length > 2000 || /^(?:data|javascript|file|blob):/i.test(source)) return '';
  let parsed;
  try { parsed = new URL(source, baseUrl || 'https://valorae.local'); } catch { return ''; }
  if (!['https:', 'http:'].includes(parsed.protocol)) return '';
  if (parsed.username || parsed.password) return '';
  if (!parsed.hostname || parsed.hostname === 'valorae.local') {
    if (!baseUrl) return '';
    try { parsed = new URL(source, baseUrl); } catch { return ''; }
  }
  if (parsed.protocol === 'http:' && parsed.hostname !== 'localhost') parsed.protocol = 'https:';
  parsed.hash = '';
  return parsed.toString();
}

function endpointKind(url = '') {
  const value = String(url || '').toLowerCase();
  if (/\.json(?:\?|$)/.test(value)) return 'json-file';
  if (/graphql/.test(value)) return 'graphql';
  if (/\/api\//.test(value)) return 'api';
  if (/ajax|xhr/.test(value)) return 'ajax';
  if (/chart|series|histor|indicador|balanco|dividend|provento|cotacao|compare/.test(value)) return 'data-endpoint';
  return 'linked-endpoint';
}

function discoverEndpointsFromText(text = '', baseUrl = '') {
  const endpoints = [];
  const seen = new Set();
  const add = (raw, evidence = '') => {
    const url = safeUrl(raw, baseUrl);
    if (!url || seen.has(url) || endpoints.length >= maxEndpoints()) return;
    seen.add(url);
    endpoints.push({ url, kind: endpointKind(url), evidence: compact(evidence).slice(0, 120) });
  };

  const patterns = [
    /(?:fetch|axios\.(?:get|post)|\$\.getJSON|\$\.ajax)\s*\(\s*["'`]([^"'`]+)["'`]/gi,
    /XMLHttpRequest\s*\([^)]*\)|\.open\s*\(\s*["'](?:GET|POST)["']\s*,\s*["'`]([^"'`]+)["'`]/gi,
    /["'`]((?:https?:)?\/\/[^"'`\s]+|\/(?:api|ajax|graphql|chart|dados|data|historico|indicadores|balancos)[^"'`\s]*)["'`]/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) && endpoints.length < maxEndpoints()) add(match[1], match[0]);
  }
  return endpoints;
}

function extractInlineAssignments(scriptText = '') {
  const source = String(scriptText || '');
  const documents = [];
  const assignment = /(?:^|[;\n\r])\s*(?:var|let|const)?\s*(?:window\.)?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*){0,3})\s*=\s*([\[{])/g;
  let match;
  while ((match = assignment.exec(source)) && documents.length < maxDocuments()) {
    const start = match.index + match[0].lastIndexOf(match[2]);
    const raw = extractBalancedLiteral(source, start);
    if (!raw || raw.length > maxDocumentBytes()) continue;
    const parsed = safeParseJson(raw);
    if (parsed) documents.push({ id: match[1], kind: 'inline-assignment', source: 'script-assignment', data: parsed, bytes: raw.length });
    assignment.lastIndex = Math.max(assignment.lastIndex, start + Math.max(raw.length, 1));
  }
  return documents;
}

function extractJsonParseLiterals(scriptText = '') {
  const source = String(scriptText || '');
  const documents = [];
  const pattern = /JSON\.parse\(\s*(["'`])([\s\S]*?)\1\s*\)/g;
  let match;
  while ((match = pattern.exec(source)) && documents.length < maxDocuments()) {
    const parsed = safeParseJson(match[2]);
    if (parsed) documents.push({ id: `json-parse-${documents.length + 1}`, kind: 'json-parse-literal', source: 'script-json-parse', data: parsed, bytes: match[2].length });
  }
  return documents;
}

function extractChartConfigurations(scriptText = '') {
  const source = String(scriptText || '');
  const documents = [];
  const callPattern = /(Highcharts\.(?:chart|stockChart)|new\s+ApexCharts|new\s+Chart|echarts\.init\([^)]*\)\.setOption)\s*\(/gi;
  let match;
  while ((match = callPattern.exec(source)) && documents.length < maxDocuments()) {
    const searchStart = match.index + match[0].length;
    const brace = source.slice(searchStart, searchStart + 4000).search(/[\[{]/);
    if (brace < 0) continue;
    const start = searchStart + brace;
    const raw = extractBalancedLiteral(source, start);
    if (!raw || raw.length > maxDocumentBytes()) continue;
    const parsed = safeParseJson(raw);
    if (parsed) documents.push({ id: `chart-${documents.length + 1}`, kind: 'chart-config', source: compact(match[1]), data: parsed, bytes: raw.length });
    callPattern.lastIndex = Math.max(callPattern.lastIndex, start + Math.max(raw.length, 1));
  }
  return documents;
}

function documentSummary(document) {
  const root = document?.data;
  return {
    id: document.id,
    kind: document.kind,
    source: document.source,
    bytes: document.bytes,
    rootType: Array.isArray(root) ? 'array' : typeof root,
    rootKeys: root && typeof root === 'object' && !Array.isArray(root) ? Object.keys(root).slice(0, 12) : [],
    itemCount: Array.isArray(root) ? root.length : undefined,
  };
}

export function discoverStructuredPageData(html = '', options = {}) {
  const started = performance.now();
  const source = String(html || '');
  const mode = structuredDataMode();
  if (mode === 'disabled') {
    recordMetric('SKIPPED', 0, null, 'disabled');
    return emptyDiscovery('disabled', false);
  }
  if (!source || source.length > maxHtmlChars()) {
    const reason = !source ? 'empty-html' : 'html-too-large';
    recordMetric('SKIPPED', 0, null, reason);
    return emptyDiscovery(reason, false);
  }
  if (!/(?:application\/ld\+json|application\/json|__NEXT_DATA__|__NUXT__|Highcharts|ApexCharts|new\s+Chart|fetch\s*\(|axios\.|\/api\/)/i.test(source)) {
    recordMetric('SKIPPED', 0, null, 'no-structured-markers');
    return emptyDiscovery('no-structured-markers', false);
  }

  const documents = [];
  const endpoints = [];
  const endpointSeen = new Set();
  const baseUrl = String(options.url || options.baseUrl || '').trim();
  try {
    const context = options.documentContext || createLazyHtmlDocumentContext(source, { parserMode: options.parserMode });
    const document = context.resolve('structured-data-discovery');
    const $ = document.$;
    $('script').each((index, element) => {
      if (documents.length >= maxDocuments()) return false;
      const type = String($(element).attr('type') || '').toLowerCase();
      const id = String($(element).attr('id') || '').trim();
      const text = String($(element).html() || '').trim();
      const src = String($(element).attr('src') || '').trim();
      if (src) {
        const url = safeUrl(src, baseUrl);
        if (url && !endpointSeen.has(url)) {
          endpointSeen.add(url);
          endpoints.push({ url, kind: 'script', evidence: 'script[src]' });
        }
      }
      if (!text) return;
      if (type === 'application/ld+json') {
        const parsed = safeParseJson(text);
        if (parsed) addDocument(documents, { id: id || `json-ld-${index + 1}`, kind: 'json-ld', source: 'script[type=application/ld+json]', data: parsed, bytes: text.length });
      } else if (id === '__NEXT_DATA__') {
        const parsed = safeParseJson(text);
        if (parsed) addDocument(documents, { id, kind: 'next-data', source: 'script#__NEXT_DATA__', data: parsed, bytes: text.length });
      } else if (type === 'application/json' || /json/i.test(type)) {
        const parsed = safeParseJson(text);
        if (parsed) addDocument(documents, { id: id || `application-json-${index + 1}`, kind: 'application-json', source: `script[type=${type || 'json'}]`, data: parsed, bytes: text.length });
      }
      for (const candidate of extractInlineAssignments(text)) addDocument(documents, candidate);
      for (const candidate of extractJsonParseLiterals(text)) addDocument(documents, candidate);
      for (const candidate of extractChartConfigurations(text)) addDocument(documents, candidate);
      for (const endpoint of discoverEndpointsFromText(text, baseUrl)) {
        if (!endpointSeen.has(endpoint.url) && endpoints.length < maxEndpoints()) {
          endpointSeen.add(endpoint.url);
          endpoints.push(endpoint);
        }
      }
    });

    $('[data-api],[data-url],[data-endpoint],[data-source],[href*="/api/"],[action*="/api/"]').each((_index, element) => {
      if (endpoints.length >= maxEndpoints()) return false;
      for (const attr of ['data-api', 'data-url', 'data-endpoint', 'data-source', 'href', 'action']) {
        const raw = String($(element).attr(attr) || '').trim();
        if (!raw) continue;
        const url = safeUrl(raw, baseUrl);
        if (url && !endpointSeen.has(url)) {
          endpointSeen.add(url);
          endpoints.push({ url, kind: endpointKind(url), evidence: attr });
        }
      }
    });

    for (const document of documents) {
      walkValues(document.data, (value, path) => {
        if (typeof value !== 'string' || endpoints.length >= maxEndpoints()) return;
        if (!/(?:\/api\/|https?:\/\/|\.json(?:\?|$)|graphql|chart|historico|indicadores|balancos)/i.test(value)) return;
        const url = safeUrl(value, baseUrl);
        if (url && !endpointSeen.has(url)) {
          endpointSeen.add(url);
          endpoints.push({ url, kind: endpointKind(url), evidence: `${document.id}:${path}`.slice(0, 120) });
        }
      });
    }

    const elapsedMs = performance.now() - started;
    const counts = {
      documents: documents.length,
      jsonLd: documents.filter(item => item.kind === 'json-ld').length,
      nextData: documents.filter(item => item.kind === 'next-data').length,
      applicationJson: documents.filter(item => item.kind === 'application-json').length,
      inlineAssignments: documents.filter(item => item.kind === 'inline-assignment' || item.kind === 'json-parse-literal').length,
      chartConfigurations: documents.filter(item => item.kind === 'chart-config').length,
      endpoints: endpoints.length,
    };
    recordMetric('OK', elapsedMs, counts);
    return {
      ok: true,
      version: VALORAE_STRUCTURED_DATA_VERSION,
      policyVersion: VALORAE_STRUCTURED_DATA_POLICY,
      implementation: VALORAE_STRUCTURED_DATA_IMPLEMENTATION,
      mode,
      url: baseUrl,
      documents,
      endpoints,
      summary: {
        ...counts,
        documentKinds: Object.fromEntries([...new Set(documents.map(item => item.kind))].map(kind => [kind, documents.filter(item => item.kind === kind).length])),
        endpointKinds: Object.fromEntries([...new Set(endpoints.map(item => item.kind))].map(kind => [kind, endpoints.filter(item => item.kind === kind).length])),
      },
      diagnostics: {
        ran: true,
        reason: 'structured-markers-found',
        elapsedMs: Math.round(elapsedMs * 100) / 100,
        parserEngine: document.parser,
        parserDecision: document.decisionReason,
        documentReused: document.reused,
        documentParseTimeMs: Math.round(document.parseTimeMs * 100) / 100,
        documents: documents.slice(0, 20).map(documentSummary),
        endpoints: endpoints.slice(0, 20),
      },
    };
  } catch (error) {
    const elapsedMs = performance.now() - started;
    const reason = String(error?.message || error).slice(0, 180);
    recordMetric('ERROR', elapsedMs, null, reason);
    return {
      ...emptyDiscovery(reason, true),
      diagnostics: { ran: true, reason, elapsedMs: Math.round(elapsedMs * 100) / 100, documents: [], endpoints: [] },
    };
  }
}

function emptyDiscovery(reason = '', error = false) {
  return {
    ok: !error,
    version: VALORAE_STRUCTURED_DATA_VERSION,
    policyVersion: VALORAE_STRUCTURED_DATA_POLICY,
    implementation: VALORAE_STRUCTURED_DATA_IMPLEMENTATION,
    mode: structuredDataMode(),
    documents: [],
    endpoints: [],
    summary: { documents: 0, jsonLd: 0, nextData: 0, applicationJson: 0, inlineAssignments: 0, chartConfigurations: 0, endpoints: 0, documentKinds: {}, endpointKinds: {} },
    diagnostics: { ran: false, reason, elapsedMs: 0, documents: [], endpoints: [] },
  };
}

function recordMetric(status, elapsedMs = 0, counts = null, reason = '') {
  metrics.lastRunAt = new Date().toISOString();
  metrics.lastStatus = status;
  metrics.lastReason = String(reason || '').slice(0, 180);
  if (status === 'SKIPPED') metrics.skipped += 1;
  else {
    metrics.runs += 1;
    metrics.totalElapsedMs += elapsedMs;
    metrics.lastElapsedMs = Math.round(elapsedMs * 100) / 100;
    metrics.maxElapsedMs = Math.max(metrics.maxElapsedMs, metrics.lastElapsedMs);
    if (status === 'OK') metrics.successes += 1;
    else metrics.failures += 1;
  }
  if (counts) {
    metrics.jsonLdDocuments += counts.jsonLd || 0;
    metrics.nextDataDocuments += counts.nextData || 0;
    metrics.applicationJsonDocuments += counts.applicationJson || 0;
    metrics.inlineAssignments += counts.inlineAssignments || 0;
    metrics.chartConfigurations += counts.chartConfigurations || 0;
    metrics.discoveredEndpoints += counts.endpoints || 0;
  }
}

function pathTokens(path = '') {
  const source = String(path || '').trim().replace(/^\$\.?/, '');
  if (!source) return [];
  const tokens = [];
  source.replace(/(?:^|\.)([A-Za-z_$][\w$]*)|\[(\d+)\]|\["([^"]+)"\]|\['([^']+)'\]/g, (_match, dotKey, arrayIndex, doubleKey, singleKey) => {
    tokens.push(dotKey ?? doubleKey ?? singleKey ?? Number(arrayIndex));
    return '';
  });
  return tokens;
}

function getPath(root, path = '') {
  let current = root;
  for (const token of pathTokens(path)) {
    if (current === undefined || current === null) return undefined;
    current = current[token];
  }
  return current;
}

function normalizeStructuredSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null;
  const paths = [spec.structuredPath, ...(Array.isArray(spec.structuredPaths) ? spec.structuredPaths : [])].filter(Boolean).map(String);
  if (!paths.length) return null;
  return { paths, documentKinds: Array.isArray(spec.structuredKinds) ? spec.structuredKinds.map(String) : [], limit: Math.max(1, Math.min(Number(spec.limit || 200), 1000)) };
}

export function extractStructuredSelectors(discovery, selectors = {}) {
  const results = {};
  const evidence = {};
  for (const [key, rawSpec] of Object.entries(selectors || {})) {
    const spec = normalizeStructuredSpec(rawSpec);
    if (!spec) continue;
    const values = [];
    const refs = [];
    for (const document of discovery?.documents || []) {
      if (spec.documentKinds.length && !spec.documentKinds.includes(document.kind)) continue;
      for (const path of spec.paths) {
        const value = getPath(document.data, path);
        if (!valuePresent(value)) continue;
        const rows = Array.isArray(value) ? value : [value];
        for (const row of rows) {
          if (!valuePresent(row)) continue;
          values.push(row);
          refs.push({ documentId: document.id, kind: document.kind, path });
          if (values.length >= spec.limit) break;
        }
        if (values.length >= spec.limit) break;
      }
      if (values.length >= spec.limit) break;
    }
    results[key] = values;
    evidence[key] = refs.slice(0, 12);
  }
  return { results, evidence };
}

function canonical(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? `number:${Number(value.toPrecision(12))}` : 'number:invalid';
  if (value && typeof value === 'object') {
    try { return `json:${JSON.stringify(value)}`; } catch { return 'json:[unserializable]'; }
  }
  return `text:${compact(value).toLowerCase()}`;
}

function canonicalArray(value) {
  const rows = Array.isArray(value) ? value : valuePresent(value) ? [value] : [];
  return rows.filter(valuePresent).map(canonical);
}

export function runStructuredDataShadow(html = '', selectors = {}, legacyResults = {}, options = {}) {
  const discovery = discoverStructuredPageData(html, options);
  const extracted = extractStructuredSelectors(discovery, selectors);
  const structuredKeys = Object.keys(extracted.results);
  const lostKeys = [];
  const gainedKeys = [];
  const divergentKeys = [];
  for (const key of structuredKeys) {
    const legacy = canonicalArray(legacyResults?.[key]);
    const structured = canonicalArray(extracted.results?.[key]);
    if (legacy.length && !structured.length) lostKeys.push(key);
    else if (!legacy.length && structured.length) gainedKeys.push(key);
    if ((legacy.length || structured.length) && (legacy.length !== structured.length || legacy.some((value, index) => value !== structured[index]))) divergentKeys.push(key);
  }
  const promotionSafe = lostKeys.length === 0 && structuredKeys.length > 0;
  const promoted = structuredDataMode() === 'prefer-structured' && promotionSafe;
  if (promoted) metrics.safePromotionRuns += 1;
  const merged = { ...(legacyResults || {}) };
  if (promoted) {
    for (const key of structuredKeys) {
      if (valuePresent(extracted.results[key])) merged[key] = extracted.results[key];
    }
  }
  return {
    results: merged,
    candidateResults: extracted.results,
    diagnostics: {
      version: VALORAE_STRUCTURED_DATA_VERSION,
      policyVersion: VALORAE_STRUCTURED_DATA_POLICY,
      implementation: VALORAE_STRUCTURED_DATA_IMPLEMENTATION,
      mode: structuredDataMode(),
      ran: discovery.diagnostics?.ran || false,
      promoted,
      outputSource: promoted ? 'structured-data' : 'legacy-preserved',
      comparison: {
        structuredSelectorCount: structuredKeys.length,
        lostKeyCount: lostKeys.length,
        gainedKeyCount: gainedKeys.length,
        divergentKeyCount: divergentKeys.length,
        lostKeys: lostKeys.slice(0, 12),
        gainedKeys: gainedKeys.slice(0, 12),
        divergentKeys: divergentKeys.slice(0, 12),
        promotionSafe,
      },
      summary: discovery.summary,
      documents: discovery.diagnostics?.documents || [],
      endpoints: discovery.diagnostics?.endpoints || [],
      evidence: extracted.evidence,
      elapsedMs: discovery.diagnostics?.elapsedMs || 0,
      parserEngine: discovery.diagnostics?.parserEngine,
      documentReused: Boolean(discovery.diagnostics?.documentReused),
      reason: discovery.diagnostics?.reason || '',
    },
  };
}

export function findStructuredValues(discovery, keyPatterns = [], { limit = 20, documentKinds = [] } = {}) {
  const patterns = keyPatterns.map(pattern => pattern instanceof RegExp ? pattern : new RegExp(String(pattern), 'i'));
  const out = [];
  for (const document of discovery?.documents || []) {
    if (documentKinds.length && !documentKinds.includes(document.kind)) continue;
    walkValues(document.data, (value, path) => {
      if (out.length >= limit || !valuePresent(value)) return;
      const key = String(path).split(/[.\[]/).filter(Boolean).at(-1)?.replace(/[\]"']/g, '') || '';
      if (!patterns.some(pattern => pattern.test(key) || pattern.test(path))) return;
      out.push({ value, path, documentId: document.id, kind: document.kind });
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function structuredDataMetrics() {
  return {
    ...metrics,
    averageElapsedMs: metrics.runs ? Math.round((metrics.totalElapsedMs / metrics.runs) * 100) / 100 : 0,
  };
}

export function resetStructuredDataMetricsForTests() {
  for (const key of Object.keys(metrics)) delete metrics[key];
  Object.assign(metrics, {
    runs: 0, successes: 0, failures: 0, skipped: 0, jsonLdDocuments: 0, nextDataDocuments: 0,
    applicationJsonDocuments: 0, inlineAssignments: 0, chartConfigurations: 0, discoveredEndpoints: 0,
    safePromotionRuns: 0, totalElapsedMs: 0, maxElapsedMs: 0, lastElapsedMs: 0,
    lastStatus: 'NEVER', lastReason: '', lastRunAt: '',
  });
}

export function buildStructuredDataManifest() {
  const mode = structuredDataMode();
  return {
    status: 'OK',
    endpoint: 'contract/structured-data',
    version: VALORAE_STRUCTURED_DATA_VERSION,
    policyVersion: VALORAE_STRUCTURED_DATA_POLICY,
    implementation: VALORAE_STRUCTURED_DATA_IMPLEMENTATION,
    hybridDocumentVersion: VALORAE_HYBRID_DOCUMENT_VERSION,
    compatibility: 'additive-hidden-from-ui',
    contractImpact: 'none',
    mode,
    enabled: mode !== 'disabled',
    outputPolicy: mode === 'prefer-structured'
      ? 'promote-explicit-structured-paths-only-when-no-legacy-key-is-lost'
      : 'legacy-output-always-preserved',
    discoveryOrder: ['json-ld', '__NEXT_DATA__', 'application-json', 'inline-assignments', 'chart-configurations', 'internal-endpoints', 'html-parser-fallback'],
    documentPolicy: 'reuse-the-lazy-hybrid-dom-when-standard-selector-shadow-already-parsed-the-page',
    safety: {
      executesPageJavaScript: false,
      usesEval: false,
      followsDiscoveredEndpointsAutomatically: false,
      credentialsEmbeddedInUrlsRejected: true,
      payloadSizeLimited: true,
    },
    limits: {
      maxHtmlChars: maxHtmlChars(),
      maxDocuments: maxDocuments(),
      maxDocumentBytes: maxDocumentBytes(),
      maxEndpoints: maxEndpoints(),
    },
    featureFlags: [
      'VALORAE_STRUCTURED_DATA_DISCOVERY_ENABLED',
      'VALORAE_STRUCTURED_DATA_MODE',
      'VALORAE_STRUCTURED_DATA_MAX_HTML_CHARS',
      'VALORAE_STRUCTURED_DATA_MAX_DOCUMENTS',
      'VALORAE_STRUCTURED_DATA_MAX_DOCUMENT_BYTES',
      'VALORAE_STRUCTURED_DATA_MAX_ENDPOINTS',
    ],
    rollback: 'Set VALORAE_STRUCTURED_DATA_DISCOVERY_ENABLED=0 or VALORAE_STRUCTURED_DATA_MODE=disabled.',
    metrics: structuredDataMetrics(),
  };
}

export function classifyKnownInternalEndpoint(url = '') {
  let parsed;
  try { parsed = new URL(String(url || '')); } catch { return ''; }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  if (!['investidor10.com.br', 'www.investidor10.com.br', 'statusinvest.com.br', 'www.statusinvest.com.br'].includes(host)) return '';
  if (/\/api\/balancos\/receitaliquida\/chart\//.test(path)) return 'receitasLucros';
  if (/\/api\/balancos\/ativospassivos\/chart\//.test(path)) return 'evolucaoPatrimonio';
  if (/\/api\/balancos\/resultado\/chart\//.test(path)) return 'resultadoDre';
  if (/\/api\/balancos\/fluxocaixa\/chart\//.test(path)) return 'fluxoCaixa';
  if (/\/api\/balancos\/indicadores\/chart\//.test(path)) return 'historicoIndicadores';
  if (/\/api\/cotacao-lucro\//.test(path)) return 'lucroCotacao';
  if (/\/api\/acoes\/payout-chart\//.test(path)) return 'payoutHistorico';
  if (/\/api\/fii\/historico-indicadores\//.test(path)) return 'historicoIndicadoresFii';
  if (/\/api\/fii\/comparador\//.test(path)) return 'comparadorFii';
  if (/\/api\/(?:acoes|fii)\/.*(?:dividend|provento|rendimento)/.test(path)) return 'proventos';
  return '';
}

export function discoveredKnownInternalEndpoints(discovery) {
  const out = [];
  const seen = new Set();
  for (const item of discovery?.endpoints || []) {
    const key = classifyKnownInternalEndpoint(item.url);
    if (!key) continue;
    const signature = `${key}:${item.url}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    out.push({ key, url: item.url, kind: item.kind, evidence: item.evidence });
  }
  return out;
}
