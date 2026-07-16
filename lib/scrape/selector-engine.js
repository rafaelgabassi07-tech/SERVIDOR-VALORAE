import { extractCustomSelectors } from './custom-selectors.js';
import { canUseFastSelectors, extractFastSelectors } from './fast-selectors.js';
import { htmlParserShadowMode, runHtmlParserShadow, VALORAE_HTML_PARSER_SHADOW_VERSION } from './standard-html-parser.js';
import { runStructuredDataShadow, VALORAE_STRUCTURED_DATA_VERSION } from './structured-data-discovery.js';
import { runDynamicRenderFallback, VALORAE_DYNAMIC_RENDER_VERSION } from './dynamic-render-fallback.js';
import { runRealCanary, VALORAE_REAL_CANARY_VERSION } from '../canary/real-canary.js';

function shadowFastPathEnabled() {
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(process.env.VALORAE_STANDARD_HTML_PARSER_SHADOW_FAST_PATH || '').trim().toLowerCase());
}

function attachCanaryInternals(result, internals = {}) {
  Object.defineProperty(result, '__realCanary', {
    value: internals,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return result;
}

function selectorIdentity(result = {}, options = {}, selectors = {}) {
  const url = String(result.url || options.url || '').trim();
  const provider = String(result.provider || options.provider || 'direct').trim();
  const selectorKeys = Object.keys(selectors || {}).sort().join(',');
  return `${provider}|${url}|${selectorKeys}`;
}

export function extractSelectors(html = '', selectors = null, options = {}, result = {}) {
  if (!selectors) {
    return attachCanaryInternals({
      results: result.selectorResults || {},
      warnings: [],
      sourceDrift: undefined,
      metrics: { selectorTimeMs: 0, nodesFound: 0, parseStrategy: 'none' },
      strategy: 'none',
      htmlParserShadow: undefined,
      structuredDataDiscovery: undefined,
    }, { baselineResults: result.selectorResults || {}, candidates: [] });
  }

  if (canUseFastSelectors(selectors, options)) {
    const fast = extractFastSelectors(html || '', selectors, options);
    if (fast.ok && fast.safe) {
      let shadow;
      if (shadowFastPathEnabled()) shadow = runHtmlParserShadow(html || '', selectors, fast.results, options);
      const standardCandidate = shadow?.diagnostics?.ran ? shadow.results : null;
      const structured = runStructuredDataShadow(html || '', selectors, shadow?.diagnostics?.promoted && shadow.results ? shadow.results : fast.results, options);
      const htmlResults = shadow?.diagnostics?.promoted && shadow.results ? shadow.results : fast.results;
      const finalResults = structured?.diagnostics?.promoted ? structured.results : htmlResults;
      const response = {
        results: finalResults,
        warnings: fast.warnings || [],
        sourceDrift: undefined,
        metrics: {
          ...(fast.metrics || {}),
          structuredDataTimeMs: structured?.diagnostics?.elapsedMs || 0,
          structuredDocuments: structured?.diagnostics?.summary?.documents || 0,
          structuredEndpoints: structured?.diagnostics?.summary?.endpoints || 0,
        },
        strategy: structured?.diagnostics?.promoted
          ? 'structured-data-promoted'
          : shadow?.diagnostics?.promoted ? 'standards-dom-promoted' : 'single-pass',
        htmlParserShadow: shadow?.diagnostics || {
          version: VALORAE_HTML_PARSER_SHADOW_VERSION,
          mode: htmlParserShadowMode(),
          ran: false,
          reason: 'fast-path-preserved',
          promoted: false,
        },
        structuredDataDiscovery: structured?.diagnostics || {
          version: VALORAE_STRUCTURED_DATA_VERSION,
          ran: false,
          reason: 'no-structured-selectors',
          promoted: false,
        },
      };
      return attachCanaryInternals(response, {
        baselineResults: fast.results || {},
        candidates: [
          standardCandidate ? { pipeline: 'standards-html', results: standardCandidate } : null,
          structured?.candidateResults ? { pipeline: 'structured-data', results: structured.candidateResults } : null,
        ].filter(Boolean),
      });
    }
  }

  const legacy = extractCustomSelectors(html || '', selectors, {
    maxSelectors: options.maxSelectors,
    maxPerSelector: options.maxPerSelector,
    provider: options.provider || 'direct',
    url: result.url || options.url,
    minCoverage: options.minCoverage,
  });
  const shadow = runHtmlParserShadow(html || '', selectors, legacy.results || {}, options);
  const promoted = Boolean(shadow.diagnostics?.promoted && shadow.results);
  const htmlResults = promoted ? shadow.results : (legacy.results || {});
  const structured = runStructuredDataShadow(html || '', selectors, htmlResults, options);
  const structuredPromoted = Boolean(structured.diagnostics?.promoted && structured.results);
  const response = {
    results: structuredPromoted ? structured.results : htmlResults,
    warnings: legacy.warnings || [],
    sourceDrift: legacy.sourceDrift,
    metrics: {
      ...(legacy.metrics || {}),
      standardParserTimeMs: shadow.diagnostics?.metrics?.parserTimeMs || 0,
      standardSelectorTimeMs: shadow.diagnostics?.metrics?.selectorTimeMs || 0,
      standardNodesFound: shadow.diagnostics?.metrics?.nodesFound || 0,
      structuredDataTimeMs: structured.diagnostics?.elapsedMs || 0,
      structuredDocuments: structured.diagnostics?.summary?.documents || 0,
      structuredEndpoints: structured.diagnostics?.summary?.endpoints || 0,
    },
    strategy: structuredPromoted ? 'structured-data-promoted' : promoted ? 'standards-dom-promoted' : (legacy.metrics?.parseStrategy || 'css-lite'),
    htmlParserShadow: shadow.diagnostics,
    structuredDataDiscovery: structured.diagnostics,
  };
  return attachCanaryInternals(response, {
    baselineResults: legacy.results || {},
    candidates: [
      shadow?.diagnostics?.ran && shadow.results ? { pipeline: 'standards-html', results: shadow.results } : null,
      structured?.candidateResults ? { pipeline: 'structured-data', results: structured.candidateResults } : null,
    ].filter(Boolean),
  });
}

export async function extractSelectorsWithDynamicFallback(html = '', selectors = null, options = {}, result = {}) {
  const staticExtraction = extractSelectors(html, selectors, options, result);
  const dynamic = await runDynamicRenderFallback({
    url: result.url || options.url || '',
    selectors,
    staticHtml: html,
    staticResults: staticExtraction.results || {},
    options: { ...options, blocked: result.blocked },
    extractRendered: async renderedHtml => extractSelectors(renderedHtml, selectors, { ...options, dynamicRenderDisabled: true }, { ...result, html: renderedHtml }),
  });
  const globallyPromoted = Boolean(dynamic?.diagnostics?.promoted);
  const internals = staticExtraction.__realCanary || { baselineResults: staticExtraction.results || {}, candidates: [] };
  const candidates = [
    ...(internals.candidates || []),
    dynamic?.candidateResults ? { pipeline: 'dynamic-render', results: dynamic.candidateResults } : null,
  ].filter(Boolean);
  const canaryEndpoint = String(options.realCanaryEndpoint || options.canaryEndpoint || 'scrape');
  const canary = await runRealCanary({
    endpoint: canaryEndpoint,
    identity: selectorIdentity(result, options, selectors || {}),
    baselineResults: internals.baselineResults || staticExtraction.results || {},
    candidates,
    allowedKeys: Object.keys(selectors || {}),
    forceSelected: options.forceRealCanary === true,
  });
  const canaryPromoted = Boolean(canary?.diagnostics?.promoted);
  const selectedResults = canaryPromoted
    ? canary.results
    : (dynamic?.results || staticExtraction.results);
  return {
    ...staticExtraction,
    results: selectedResults,
    strategy: canaryPromoted ? 'real-canary-gap-fill' : globallyPromoted ? 'dynamic-render-gap-fill' : staticExtraction.strategy,
    metrics: {
      ...(staticExtraction.metrics || {}),
      dynamicRenderTimeMs: dynamic?.diagnostics?.elapsedMs || 0,
      dynamicRenderRan: Boolean(dynamic?.diagnostics?.ran),
      dynamicRenderPromoted: globallyPromoted,
      realCanarySelected: Boolean(canary?.diagnostics?.selected),
      realCanaryPromoted: canaryPromoted,
      realCanaryGainedKeys: Number(canary?.diagnostics?.gainedKeyCount || 0),
    },
    dynamicRenderFallback: dynamic?.diagnostics || {
      version: VALORAE_DYNAMIC_RENDER_VERSION,
      ran: false,
      promoted: false,
      reason: 'not-evaluated',
    },
    realCanary: canary?.diagnostics || {
      version: VALORAE_REAL_CANARY_VERSION,
      selected: false,
      promoted: false,
      reason: 'not-evaluated',
      hiddenFromUi: true,
    },
  };
}
