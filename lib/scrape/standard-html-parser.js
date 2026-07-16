import { performance } from 'node:perf_hooks';
import { load } from 'cheerio';
import { parseFinancialNumber } from '../normalizers/numbers.js';

export const VALORAE_HTML_PARSER_SHADOW_VERSION = '2026.07.15-checkpoint109-v1';
export const VALORAE_HTML_PARSER_SHADOW_POLICY = 'standards-html-shadow-v1';
export const VALORAE_HTML_PARSER_IMPLEMENTATION = 'cheerio-1.2.0-parse5';

const metrics = globalThis.__VALORAE_HTML_PARSER_SHADOW_METRICS__ || {
  runs: 0,
  successes: 0,
  failures: 0,
  skipped: 0,
  parityRuns: 0,
  safePromotionRuns: 0,
  standardCoverageWins: 0,
  legacyCoverageWins: 0,
  totalElapsedMs: 0,
  maxElapsedMs: 0,
  lastElapsedMs: 0,
  lastStatus: 'NEVER',
  lastReason: '',
  lastRunAt: '',
};
globalThis.__VALORAE_HTML_PARSER_SHADOW_METRICS__ = metrics;

function envDisabled(name) {
  return ['0', 'false', 'no', 'off', 'disabled'].includes(String(process.env[name] || '').trim().toLowerCase());
}

export function htmlParserShadowMode() {
  if (envDisabled('VALORAE_STANDARD_HTML_PARSER_ENABLED')) return 'disabled';
  const value = String(process.env.VALORAE_STANDARD_HTML_PARSER_MODE || 'shadow').trim().toLowerCase();
  if (['disabled', 'legacy', 'legacy-only', 'off'].includes(value)) return 'disabled';
  if (['prefer-standard', 'standard', 'promote-safe'].includes(value)) return 'prefer-standard';
  return 'shadow';
}

export function isHtmlParserShadowEnabled() {
  return htmlParserShadowMode() !== 'disabled';
}

function maxHtmlChars() {
  const configured = Number(process.env.VALORAE_STANDARD_HTML_PARSER_MAX_CHARS || 2_500_000);
  return Math.max(100_000, Math.min(Number.isFinite(configured) ? configured : 2_500_000, 8_000_000));
}

function maxSelectors(options = {}) {
  return Math.max(1, Math.min(Number(options.maxSelectors || 40), 100));
}

function maxPerSelector(options = {}) {
  return Math.max(1, Math.min(Number(options.maxPerSelector || 200), 1000));
}

function normalizeSpec(spec) {
  if (typeof spec === 'string') return { selector: spec, extract: 'text' };
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) return { extract: 'text', ...spec };
  return null;
}

function compact(value = '') {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function elementTag(element) {
  return String(element?.tagName || element?.name || '').toLowerCase();
}

function extractTableCells($, element) {
  return $(element).children('th,td').map((_index, cell) => compact($(cell).text())).get().filter(Boolean);
}

function extractValue($, element, spec = {}) {
  const mode = String(spec.extract || 'text').trim() || 'text';
  if (mode === 'html' || mode === 'outerHtml') return $.html(element);
  if (mode === 'row') return extractTableCells($, element).join(' ');
  if (mode === 'cells') return extractTableCells($, element);
  if (mode === 'number' || mode === 'numeric' || mode === 'percent') return parseFinancialNumber(compact($(element).text()));
  const attrName = mode.startsWith('attr:') ? mode.slice(5) : ['href', 'src', 'content', 'data-url'].includes(mode) ? mode : '';
  if (attrName) return compact($(element).attr(attrName) || '');
  if (elementTag(element) === 'tr') return extractTableCells($, element).join(' ');
  return compact($(element).text());
}

function valuePresent(value) {
  if (Array.isArray(value)) return value.some(valuePresent);
  return value !== undefined && value !== null && String(value).trim() !== '';
}

export function extractStandardHtmlSelectors(html = '', selectors = {}, options = {}) {
  const started = performance.now();
  const source = String(html || '');
  if (!selectors || typeof selectors !== 'object' || Array.isArray(selectors)) {
    return {
      ok: false,
      results: {},
      warnings: ['selectors precisa ser objeto.'],
      metrics: { parserTimeMs: 0, selectorTimeMs: 0, nodesFound: 0, parseStrategy: 'standards-dom', selectorCount: 0 },
    };
  }
  if (source.length > maxHtmlChars()) {
    return {
      ok: false,
      skipped: true,
      reason: 'html-too-large',
      results: {},
      warnings: [`HTML excede o limite do parser padrão (${source.length} > ${maxHtmlChars()}).`],
      metrics: { parserTimeMs: 0, selectorTimeMs: 0, nodesFound: 0, parseStrategy: 'standards-dom-skipped', selectorCount: 0 },
    };
  }

  const parseStarted = performance.now();
  let $;
  try {
    $ = load(source, { xmlMode: false, scriptingEnabled: false }, true);
  } catch (error) {
    return {
      ok: false,
      results: {},
      warnings: [`Falha no parser HTML padrão: ${String(error?.message || error).slice(0, 180)}`],
      metrics: { parserTimeMs: Math.round((performance.now() - parseStarted) * 100) / 100, selectorTimeMs: 0, nodesFound: 0, parseStrategy: 'standards-dom-error', selectorCount: 0 },
    };
  }
  const parserTimeMs = performance.now() - parseStarted;
  const selectorStarted = performance.now();
  const results = {};
  const warnings = [];
  let nodesFound = 0;
  let selectorCount = 0;
  const entries = Object.entries(selectors).slice(0, maxSelectors(options));
  const defaultLimit = maxPerSelector(options);

  for (const [key, rawSpec] of entries) {
    const spec = normalizeSpec(rawSpec);
    if (!spec?.selector) {
      warnings.push(`Selector inválido em ${key}`);
      continue;
    }
    selectorCount += 1;
    const limit = Math.max(1, Math.min(Number(spec.limit || defaultLimit), defaultLimit));
    try {
      const selection = $(String(spec.selector)).slice(0, limit);
      const values = [];
      selection.each((_index, element) => {
        const value = extractValue($, element, spec);
        if (valuePresent(value)) values.push(value);
      });
      results[key] = values;
      nodesFound += selection.length;
      if (!selection.length) warnings.push(`Selector sem resultado: ${key} (${spec.selector})`);
    } catch (error) {
      results[key] = [];
      warnings.push(`Selector inválido em ${key}: ${String(error?.message || error).slice(0, 140)}`);
    }
  }

  return {
    ok: true,
    results,
    warnings,
    version: VALORAE_HTML_PARSER_SHADOW_VERSION,
    implementation: VALORAE_HTML_PARSER_IMPLEMENTATION,
    metrics: {
      parserTimeMs: Math.round(parserTimeMs * 100) / 100,
      selectorTimeMs: Math.round((performance.now() - selectorStarted) * 100) / 100,
      totalTimeMs: Math.round((performance.now() - started) * 100) / 100,
      nodesFound,
      selectorCount,
      parseStrategy: 'standards-dom',
    },
  };
}

function canonicalScalar(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? `number:${Number(value.toPrecision(12))}` : 'number:non-finite';
  if (Array.isArray(value)) return `array:[${value.map(canonicalScalar).join('|')}]`;
  return `text:${compact(value).toLowerCase()}`;
}

function canonicalArray(value) {
  const rows = Array.isArray(value) ? value : valuePresent(value) ? [value] : [];
  return rows.filter(valuePresent).map(canonicalScalar);
}

function coverage(results = {}, keys = []) {
  const matched = keys.filter(key => canonicalArray(results?.[key]).length > 0).length;
  return { matched, total: keys.length, percent: keys.length ? Math.round((matched / keys.length) * 10000) / 100 : 100 };
}

export function compareHtmlParserResults(legacyResults = {}, standardResults = {}, selectors = {}) {
  const keys = [...new Set([...Object.keys(selectors || {}), ...Object.keys(legacyResults || {}), ...Object.keys(standardResults || {})])];
  const legacyCoverage = coverage(legacyResults, keys);
  const standardCoverage = coverage(standardResults, keys);
  const lostKeys = [];
  const gainedKeys = [];
  const divergentKeys = [];
  const parityKeys = [];

  for (const key of keys) {
    const legacy = canonicalArray(legacyResults?.[key]);
    const standard = canonicalArray(standardResults?.[key]);
    if (legacy.length && !standard.length) lostKeys.push(key);
    else if (!legacy.length && standard.length) gainedKeys.push(key);
    if (legacy.length === standard.length && legacy.every((value, index) => value === standard[index])) parityKeys.push(key);
    else if (legacy.length || standard.length) divergentKeys.push(key);
  }

  const promotionSafe = lostKeys.length === 0 && standardCoverage.matched >= legacyCoverage.matched;
  return {
    selectorCount: keys.length,
    legacyCoverage,
    standardCoverage,
    parityCount: parityKeys.length,
    parityPercent: keys.length ? Math.round((parityKeys.length / keys.length) * 10000) / 100 : 100,
    lostKeyCount: lostKeys.length,
    gainedKeyCount: gainedKeys.length,
    divergentKeyCount: divergentKeys.length,
    lostKeys: lostKeys.slice(0, 12),
    gainedKeys: gainedKeys.slice(0, 12),
    divergentKeys: divergentKeys.slice(0, 12),
    promotionSafe,
  };
}

function recordShadowMetric(status, elapsedMs = 0, comparison = null, reason = '') {
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
  if (comparison) {
    if (comparison.parityPercent === 100) metrics.parityRuns += 1;
    if (comparison.promotionSafe) metrics.safePromotionRuns += 1;
    if (comparison.standardCoverage.matched > comparison.legacyCoverage.matched) metrics.standardCoverageWins += 1;
    if (comparison.legacyCoverage.matched > comparison.standardCoverage.matched) metrics.legacyCoverageWins += 1;
  }
}

export function runHtmlParserShadow(html = '', selectors = {}, legacyResults = {}, options = {}) {
  const mode = htmlParserShadowMode();
  if (mode === 'disabled') {
    recordShadowMetric('SKIPPED', 0, null, 'disabled');
    return {
      results: null,
      diagnostics: {
        version: VALORAE_HTML_PARSER_SHADOW_VERSION,
        policyVersion: VALORAE_HTML_PARSER_SHADOW_POLICY,
        implementation: VALORAE_HTML_PARSER_IMPLEMENTATION,
        mode,
        ran: false,
        reason: 'disabled',
        promoted: false,
      },
    };
  }
  const started = performance.now();
  const standard = extractStandardHtmlSelectors(html, selectors, options);
  const elapsedMs = performance.now() - started;
  if (!standard.ok) {
    const reason = standard.reason || standard.warnings?.[0] || 'standard-parser-failed';
    recordShadowMetric(standard.skipped ? 'SKIPPED' : 'ERROR', elapsedMs, null, reason);
    return {
      results: null,
      diagnostics: {
        version: VALORAE_HTML_PARSER_SHADOW_VERSION,
        policyVersion: VALORAE_HTML_PARSER_SHADOW_POLICY,
        implementation: VALORAE_HTML_PARSER_IMPLEMENTATION,
        mode,
        ran: false,
        reason,
        promoted: false,
        metrics: standard.metrics,
      },
    };
  }
  const comparison = compareHtmlParserResults(legacyResults, standard.results, selectors);
  const promoted = mode === 'prefer-standard' && comparison.promotionSafe;
  recordShadowMetric('OK', elapsedMs, comparison);
  return {
    results: standard.results,
    diagnostics: {
      version: VALORAE_HTML_PARSER_SHADOW_VERSION,
      policyVersion: VALORAE_HTML_PARSER_SHADOW_POLICY,
      implementation: VALORAE_HTML_PARSER_IMPLEMENTATION,
      mode,
      ran: true,
      promoted,
      outputSource: promoted ? 'standards-dom' : 'legacy-preserved',
      comparison,
      metrics: standard.metrics,
      warnings: standard.warnings.slice(0, 8),
    },
  };
}

export function buildHtmlParserShadowManifest() {
  const mode = htmlParserShadowMode();
  return {
    status: 'OK',
    endpoint: 'contract/html-parser-shadow',
    version: VALORAE_HTML_PARSER_SHADOW_VERSION,
    policyVersion: VALORAE_HTML_PARSER_SHADOW_POLICY,
    implementation: VALORAE_HTML_PARSER_IMPLEMENTATION,
    compatibility: 'additive-hidden-from-ui',
    contractImpact: 'none',
    mode,
    enabled: mode !== 'disabled',
    outputPolicy: mode === 'prefer-standard' ? 'promote-only-when-no-legacy-key-is-lost' : 'legacy-output-always-preserved',
    fastPathPolicy: envDisabled('VALORAE_STANDARD_HTML_PARSER_SHADOW_FAST_PATH') || String(process.env.VALORAE_STANDARD_HTML_PARSER_SHADOW_FAST_PATH || '').trim() === ''
      ? 'single-pass-fast-path-not-shadowed-by-default'
      : 'single-pass-fast-path-shadow-enabled',
    limits: {
      maxHtmlChars: maxHtmlChars(),
      maxSelectors: 100,
      maxPerSelector: 1000,
    },
    featureFlags: [
      'VALORAE_STANDARD_HTML_PARSER_ENABLED',
      'VALORAE_STANDARD_HTML_PARSER_MODE',
      'VALORAE_STANDARD_HTML_PARSER_MAX_CHARS',
      'VALORAE_STANDARD_HTML_PARSER_SHADOW_FAST_PATH',
    ],
    rollback: 'Set VALORAE_STANDARD_HTML_PARSER_ENABLED=0 or VALORAE_STANDARD_HTML_PARSER_MODE=legacy-only.',
    metrics: htmlParserShadowMetrics(),
  };
}

export function htmlParserShadowMetrics() {
  return {
    ...metrics,
    averageElapsedMs: metrics.runs ? Math.round((metrics.totalElapsedMs / metrics.runs) * 100) / 100 : 0,
  };
}

export function resetHtmlParserShadowMetricsForTests() {
  for (const key of Object.keys(metrics)) delete metrics[key];
  Object.assign(metrics, {
    runs: 0, successes: 0, failures: 0, skipped: 0, parityRuns: 0, safePromotionRuns: 0,
    standardCoverageWins: 0, legacyCoverageWins: 0, totalElapsedMs: 0, maxElapsedMs: 0,
    lastElapsedMs: 0, lastStatus: 'NEVER', lastReason: '', lastRunAt: '',
  });
}
