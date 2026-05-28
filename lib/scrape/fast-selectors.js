// Fast-path conservador de seletores simples. Nunca substitui o extrator robusto em seletores complexos.
import { stripTags } from './custom-selectors.js';
import { parseFinancialNumber } from '../normalizers/numbers.js';

export const VALORAE_FAST_SELECTORS_VERSION = '21.11.6-fast-selectors-planned-single-pass';

function decodeHtml(value = '') {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function compactText(value = '') { return stripTags(value).replace(/\s+/g, ' ').trim(); }
function parseNumericText(value = '') {
  return parseFinancialNumber(compactText(value));
}
function pushUnique(values, value, seen) {
  const key = typeof value === 'number' ? `n:${value}` : String(value || '').trim().toLowerCase();
  if (!key || seen.has(key)) return;
  seen.add(key);
  values.push(value);
}
function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function attr(fragment, name) {
  const re = new RegExp(`${escapeRe(name)}\\s*=\\s*(?:["']([^"']*)["']|([^\\s>]+))`, 'i');
  const m = String(fragment || '').match(re);
  return decodeHtml(m?.[1] || m?.[2] || '');
}
function normalizeSpec(spec) {
  if (typeof spec === 'string') return { selector: spec, extract: 'text' };
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) return { extract: 'text', ...spec };
  return null;
}

function buildFastSelectorPlan(selectors = {}, options = {}) {
  const maxPerSelector = Math.max(1, Math.min(Number(options.maxPerSelector || 200), 1000));
  const plan = [];
  const unsupported = [];
  for (const [key, rawSpec] of Object.entries(selectors || {})) {
    const spec = normalizeSpec(rawSpec);
    const parsed = spec?.selector ? parseFastSelector(spec.selector) : null;
    const extract = String(spec?.extract || 'text');
    const supportedExtract = ['text', 'html', 'outerHtml', 'href', 'src', 'content', 'number', 'numeric', 'percent'].includes(extract) || extract.startsWith('attr:');
    if (!parsed || !supportedExtract) { unsupported.push(key); continue; }
    plan.push({
      key,
      spec,
      parsed,
      regex: elementRegexFor(parsed),
      limit: Math.max(1, Math.min(Number(spec.limit || maxPerSelector), maxPerSelector)),
    });
  }
  return { ok: plan.length > 0 && unsupported.length === 0, plan, unsupported, maxPerSelector };
}

function parseFastSelector(selector = '') {
  const s = String(selector || '').trim();
  if (!s || /\s|>|\+|~|:|,/.test(s)) return null;
  if (s === 'title') return { kind: 'tag', tag: 'title' };
  if (/^h[1-3]$/i.test(s)) return { kind: 'tag', tag: s.toLowerCase() };
  if (/^#[a-zA-Z0-9_-]+$/.test(s)) return { kind: 'id', id: s.slice(1) };
  if (/^\.[a-zA-Z0-9_-]+$/.test(s)) return { kind: 'class', className: s.slice(1), tag: '[a-z0-9]+' };
  const tagClass = s.match(/^([a-z0-9]+)\.([a-zA-Z0-9_-]+)$/i);
  if (tagClass) return { kind: 'class', tag: tagClass[1].toLowerCase(), className: tagClass[2] };
  const tagAttr = s.match(/^([a-z0-9]+)\[([a-zA-Z0-9_:-]+)\]$/i);
  if (tagAttr && ['a[href]', 'img[src]'].includes(s.toLowerCase())) return { kind: 'attrTag', tag: tagAttr[1].toLowerCase(), attr: tagAttr[2] };
  const dataAttr = s.match(/^\[(data-[a-zA-Z0-9_-]+|aria-label)\]$/i);
  if (dataAttr) return { kind: 'attrAny', attr: dataAttr[1] };
  const meta = s.match(/^meta\[(name|property)=['"]?([a-zA-Z0-9_:-]+)['"]?\]$/i);
  if (meta) return { kind: 'meta', attr: meta[1].toLowerCase(), value: meta[2] };
  return null;
}

function elementRegexFor(parsed) {
  if (parsed.kind === 'tag') return new RegExp(`<${escapeRe(parsed.tag)}\\b[^>]*>[\\s\\S]*?<\\/${escapeRe(parsed.tag)}>`, 'gi');
  if (parsed.kind === 'id') return new RegExp(`<([a-z0-9]+)\\b(?=[^>]*\\bid\\s*=\\s*(?:["']${escapeRe(parsed.id)}["']|${escapeRe(parsed.id)})(?=[\\s>/]))[^>]*>[\\s\\S]*?<\\/\\1>`, 'gi');
  if (parsed.kind === 'class') return new RegExp(`<(${parsed.tag || '[a-z0-9]+'})\\b(?=[^>]*\\bclass\\s*=\\s*(?:["'][^"']*\\b${escapeRe(parsed.className)}\\b[^"']*["']|[^\\s>]*\\b${escapeRe(parsed.className)}\\b[^\\s>]*))[^>]*>[\\s\\S]*?<\\/\\1>`, 'gi');
  if (parsed.kind === 'attrTag') return new RegExp(`<${escapeRe(parsed.tag)}\\b(?=[^>]*\\b${escapeRe(parsed.attr)}\\s*=)[^>]*>`, 'gi');
  if (parsed.kind === 'attrAny') return new RegExp(`<[a-z0-9]+\\b(?=[^>]*\\b${escapeRe(parsed.attr)}(?:\\s*=|[\\s>/]))[^>]*>`, 'gi');
  if (parsed.kind === 'meta') return new RegExp(`<meta\\b(?=[^>]*\\b${escapeRe(parsed.attr)}\\s*=\\s*(?:["']${escapeRe(parsed.value)}["']|${escapeRe(parsed.value)})(?=[\\s>/]))[^>]*>`, 'gi');
  return null;
}

function extractValue(fragment, spec, parsed) {
  const mode = String(spec.extract || '').trim() || 'text';
  if (mode === 'href') return attr(fragment, 'href');
  if (mode === 'src') return attr(fragment, 'src');
  if (mode === 'content') return attr(fragment, 'content');
  if (mode === 'number' || mode === 'numeric' || mode === 'percent') return parseNumericText(fragment);
  if (mode === 'html' || mode === 'outerHtml') return fragment;
  if (mode.startsWith('attr:')) return attr(fragment, mode.slice(5));
  if (parsed.kind === 'meta') return attr(fragment, 'content');
  if (parsed.kind === 'attrTag') return attr(fragment, parsed.attr);
  if (parsed.kind === 'attrAny') return attr(fragment, parsed.attr);
  return compactText(fragment);
}

export function canUseFastSelectors(selectors, options = {}) {
  if (!selectors || typeof selectors !== 'object' || Array.isArray(selectors)) return false;
  if (String(process.env.VALORAE_FAST_SELECTORS_ENABLED ?? 'true').toLowerCase() === 'false') return false;
  const entries = Object.entries(selectors).slice(0, Number(options.maxSelectors || 100));
  if (!entries.length) return false;
  return buildFastSelectorPlan(Object.fromEntries(entries), options).ok;
}

export function extractFastSelectors(html = '', selectors = {}, options = {}) {
  const started = performance.now();
  const source = String(html || '');
  const entries = Object.entries(selectors || {}).slice(0, Number(options.maxSelectors || 100));
  const limitedSelectors = Object.fromEntries(entries);
  const { ok, plan, unsupported } = buildFastSelectorPlan(limitedSelectors, options);
  if (!ok) return { ok: false, safe: false, strategy: 'fallback-required', results: {}, warnings: [`Seletores complexos exigem fallback css-lite: ${unsupported.join(', ') || 'desconhecido'}`], metrics: { selectorTimeMs: 0, nodesFound: 0, parseStrategy: 'fallback' } };

  const results = {};
  const warnings = [];
  let nodesFound = 0;
  let emptyKeys = 0;
  let regexRuns = 0;
  const duplicateSelectorMap = new Map();

  // Deduplica seletores idênticos dentro da mesma chamada; isso melhora batchs com aliases.
  for (const item of plan) {
    const signature = `${item.spec.selector}::${item.spec.extract || 'text'}::${item.limit}`;
    if (!duplicateSelectorMap.has(signature)) duplicateSelectorMap.set(signature, []);
    duplicateSelectorMap.get(signature).push(item);
  }

  for (const group of duplicateSelectorMap.values()) {
    const first = group[0];
    const values = [];
    const seen = new Set();
    let m;
    regexRuns += 1;
    while (first.regex && (m = first.regex.exec(source)) && values.length < first.limit) {
      const value = extractValue(m[0], first.spec, first.parsed);
      if (value !== undefined && value !== null && String(value).trim() !== '') pushUnique(values, value, seen);
    }
    for (const item of group) {
      results[item.key] = values;
      if (!values.length) emptyKeys += 1;
    }
    nodesFound += values.length;
  }

  const selectorCount = Object.keys(limitedSelectors || {}).length;
  const coveragePercent = selectorCount ? Math.round(((selectorCount - emptyKeys) / selectorCount) * 10000) / 100 : 100;
  return {
    ok: true,
    safe: true,
    strategy: 'single-pass',
    results,
    warnings,
    version: VALORAE_FAST_SELECTORS_VERSION,
    plan: { selectorCount, groups: duplicateSelectorMap.size, regexRuns },
    metrics: { selectorTimeMs: Math.round(performance.now() - started), nodesFound, emptyKeys, coveragePercent, parseStrategy: 'single-pass', regexRuns, selectorGroups: duplicateSelectorMap.size }
  };
}

export function extractBatchFastSelectors(html = '', requests = [], options = {}) {
  return requests.map(req => extractFastSelectors(html, req.selectors || {}, { ...options, ...req }));
}
