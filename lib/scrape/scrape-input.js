// Normalização central de scraping para chaves estáveis, cache seguro e batch coalescido.
// Mantém compatibilidade free-only: sem dependências e sem estado externo obrigatório.

export const VALORAE_SCRAPE_INPUT_VERSION = '21.12.0-scrape-pipeline-engine-policy';

const DEFAULT_MAX_HTML_CHARS = Number(process.env.VALORAE_MAX_HTML_CHARS || 3_200_000);
const DEFAULT_MAX_SELECTORS = 40;
const DEFAULT_MAX_PER_SELECTOR = 200;
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function stableStringify(value) {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).filter(k => !DANGEROUS_KEYS.has(k)).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value).toLowerCase());
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function safeHeaderKey(key = '') {
  return String(key || '').trim().toLowerCase();
}

export function normalizeTargetUrl(url = '') {
  let parsed;
  try {
    parsed = new URL(String(url || '').trim());
  } catch {
    const err = new Error('URL inválida. Envie uma URL completa, por exemplo https://investidor10.com.br/acoes/petr4/.');
    err.status = 400;
    err.code = 'INVALID_TARGET_URL';
    throw err;
  }
  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();
  if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) parsed.port = '';
  return parsed.toString();
}

export function normalizeCacheRelevantHeaders(headers = {}) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return {};
  const allow = new Set(['accept-language', 'user-agent', 'referer', 'x-valorae-source-profile']);
  const out = {};
  for (const [rawKey, rawValue] of Object.entries(headers)) {
    const key = safeHeaderKey(rawKey);
    if (!key || !allow.has(key)) continue;
    if (rawValue === undefined || rawValue === null) continue;
    out[key] = String(rawValue).slice(0, 240);
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

export function normalizeSelectors(selectors = null) {
  if (!selectors || typeof selectors !== 'object' || Array.isArray(selectors)) return null;
  const out = {};
  for (const key of Object.keys(selectors).filter(k => !DANGEROUS_KEYS.has(k)).sort()) {
    const spec = selectors[key];
    if (typeof spec === 'string') out[key] = { selector: spec.trim() };
    else if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
      const clean = {};
      for (const k of Object.keys(spec).filter(k => !DANGEROUS_KEYS.has(k)).sort()) {
        const v = spec[k];
        if (v !== undefined && v !== null && v !== '') clean[k] = typeof v === 'string' ? v.trim() : v;
      }
      out[key] = clean;
    }
  }
  return Object.keys(out).length ? out : null;
}

export function isCacheBypassed(input = {}) {
  return input.cache === false || input.cache === '0' || input.cache === 0 || bool(input.nocache, false) || bool(input.refresh, false) || bool(input.bypassCache, false);
}

export function normalizeScrapeInput(input = {}, defaults = {}) {
  const url = input.url ? normalizeTargetUrl(input.url) : '';
  const selectors = normalizeSelectors(input.selectors || defaults.selectors || null);
  const includeHtml = bool(input.includeHtml ?? input.returnHtml ?? input.html, bool(defaults.includeHtml ?? defaults.returnHtml ?? defaults.html, false));
  const previewChars = clampNumber(input.previewChars ?? defaults.previewChars ?? process.env.VALORAE_DEFAULT_PREVIEW_CHARS, 300, 0, 5000);
  const maxChars = clampNumber(input.maxHtmlChars ?? input.maxChars ?? defaults.maxHtmlChars ?? defaults.maxChars ?? DEFAULT_MAX_HTML_CHARS, DEFAULT_MAX_HTML_CHARS, 10_000, 4_500_000);
  const maxSelectors = clampNumber(input.maxSelectors ?? defaults.maxSelectors, DEFAULT_MAX_SELECTORS, 1, 100);
  const maxPerSelector = clampNumber(input.maxPerSelector ?? defaults.maxPerSelector, DEFAULT_MAX_PER_SELECTOR, 1, 1000);
  const timeoutMs = clampNumber(input.timeoutMs ?? defaults.timeoutMs ?? process.env.VALORAE_FETCH_TIMEOUT_MS, 12_000, 1_000, 20_000);
  const provider = String(input.provider || defaults.provider || 'direct').trim().toLowerCase() || 'direct';
  const headers = normalizeCacheRelevantHeaders({ ...(defaults.headers || {}), ...(input.headers || {}) });
  const compact = bool(input.compact, bool(defaults.compact, false));
  const metrics = !['0', 'false', 'no', 'off'].includes(String(input.metrics ?? defaults.metrics ?? '1').toLowerCase());
  const fields = input.fields || defaults.fields || '';
  const cacheBypassed = isCacheBypassed({ ...defaults, ...input });
  return {
    version: VALORAE_SCRAPE_INPUT_VERSION,
    url,
    provider,
    selectors,
    includeHtml,
    previewChars,
    maxChars,
    maxSelectors,
    maxPerSelector,
    timeoutMs,
    headers,
    compact,
    metrics,
    fields: Array.isArray(fields) ? fields.join(',') : String(fields || ''),
    cache: !cacheBypassed,
    cacheBypassed,
    minCoverage: Number(input.minSelectorCoverage || input.minCoverage || defaults.minCoverage || 0.55),
  };
}


export function buildHtmlCacheFamilyKey(url, options = {}) {
  const normalizedUrl = normalizeTargetUrl(url);
  return `html-family:${stableStringify({
    v: 1,
    url: normalizedUrl,
    provider: String(options.provider || 'auto').toLowerCase(),
    returnHtml: options.returnHtml !== false,
    includeScripts: options.includeScripts !== false,
    headers: normalizeCacheRelevantHeaders(options.headers || {}),
  })}`;
}

export function buildHtmlCacheKey(url, options = {}) {
  const normalizedUrl = normalizeTargetUrl(url);
  return `html:${stableStringify({
    v: 2,
    url: normalizedUrl,
    provider: String(options.provider || 'auto').toLowerCase(),
    maxChars: Number(options.maxChars || DEFAULT_MAX_HTML_CHARS),
    returnHtml: options.returnHtml !== false,
    includeScripts: options.includeScripts !== false,
    headers: normalizeCacheRelevantHeaders(options.headers || {}),
  })}`;
}

export function buildFetchKey(normalized = {}) {
  return `fetch:${stableStringify({
    v: 2,
    url: normalized.url,
    provider: normalized.provider || 'direct',
    maxChars: Number(normalized.maxChars || DEFAULT_MAX_HTML_CHARS),
    returnHtml: true,
    headers: normalized.headers || {},
    cache: normalized.cache !== false,
  })}`;
}

export function buildResultKey(normalized = {}) {
  return `result:${stableStringify({
    v: 3,
    extractor: VALORAE_SCRAPE_INPUT_VERSION,
    url: normalized.url,
    provider: normalized.provider || 'direct',
    selectors: normalizeSelectors(normalized.selectors),
    includeHtml: Boolean(normalized.includeHtml),
    previewChars: Number(normalized.previewChars || 0),
    maxChars: Number(normalized.maxChars || DEFAULT_MAX_HTML_CHARS),
    maxSelectors: Number(normalized.maxSelectors || DEFAULT_MAX_SELECTORS),
    maxPerSelector: Number(normalized.maxPerSelector || DEFAULT_MAX_PER_SELECTOR),
    compact: Boolean(normalized.compact),
    fields: normalized.fields || '',
    metrics: normalized.metrics !== false,
    headers: normalized.headers || {},
  })}`;
}
