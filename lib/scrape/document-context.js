import { performance } from 'node:perf_hooks';
import { load as loadParse5 } from 'cheerio';
import { load as loadHtmlparser2 } from 'cheerio/slim';

export const VALORAE_HYBRID_DOCUMENT_VERSION = '2026.07.16-checkpoint117-v1';
export const VALORAE_HYBRID_DOCUMENT_POLICY = 'adaptive-htmlparser2-parse5-shared-dom-v1';
export const VALORAE_HYBRID_DOCUMENT_HARDENING_VERSION = '2026.07.17-checkpoint118-v1';
export const VALORAE_HYBRID_DOCUMENT_IMPLEMENTATION = 'cheerio-1.2.0-htmlparser2-fast-parse5-selector-aware-compat';

const metrics = globalThis.__VALORAE_HYBRID_DOCUMENT_METRICS__ || {
  documents: 0,
  htmlparser2Documents: 0,
  parse5Documents: 0,
  parseFallbacks: 0,
  domReuses: 0,
  consumers: 0,
  totalParseMs: 0,
  lastParseMs: 0,
  lastParser: 'NEVER',
  lastReason: '',
  selectorAwareDocuments: 0,
};
globalThis.__VALORAE_HYBRID_DOCUMENT_METRICS__ = metrics;
metrics.selectorAwareDocuments = Number(metrics.selectorAwareDocuments || 0);

function parserMode(raw = process.env.VALORAE_HTML_DOCUMENT_PARSER || process.env.VALORAE_HYBRID_PARSER_MODE || 'adaptive') {
  const mode = String(raw || 'adaptive').trim().toLowerCase();
  if (['parse5', 'standards', 'browser-compatible'].includes(mode)) return 'parse5';
  if (['htmlparser2', 'fast', 'performance'].includes(mode)) return 'htmlparser2';
  return 'adaptive';
}

function selectorText(selectors = {}) {
  if (!selectors || typeof selectors !== 'object' || Array.isArray(selectors)) return '';
  return Object.values(selectors)
    .slice(0, 100)
    .map(spec => String(typeof spec === 'string' ? spec : spec?.selector || '').slice(0, 1000))
    .filter(Boolean)
    .join('\n');
}

function selectorAwareStandardsReason(html = '', selectors = {}) {
  const requested = selectorText(selectors);
  if (!requested) return '';

  // cheerio/slim + htmlparser2 intentionally avoids the browser's implied
  // html/head/body tree. Selectors that name those nodes therefore need parse5.
  if (/(^|[\s>+~,(])(?:html|head|body)(?=$|[\s>+~.#:[,(])/i.test(requested)) {
    return 'selector-requires-implied-document-tree';
  }

  if (/<table(?:\s|>)/i.test(html)) {
    const browserTableTree = /(?:^|[\s>+~,(])(?:tbody|thead|tfoot|colgroup)(?=$|[\s>+~.#:[,(])/i.test(requested) ||
      /table\s*>\s*(?:tr|td|th)(?=$|[\s>+~.#:[,(])/i.test(requested);
    if (browserTableTree) return 'selector-requires-browser-table-tree';
  }

  const formCount = (String(html).match(/<form(?:\s|>)/gi) || []).length;
  if (formCount > 1 && /(?:^|[\s>+~,(])form(?=$|[\s>+~.#:[,(])/i.test(requested)) {
    return 'selector-requires-browser-form-tree';
  }
  return '';
}

function parserDecision(html = '', requestedMode = 'adaptive', selectors = {}) {
  const mode = parserMode(requestedMode);
  if (mode === 'parse5') return { parser: 'parse5', reason: 'forced-standards-mode' };
  if (mode === 'htmlparser2') return { parser: 'htmlparser2', reason: 'forced-performance-mode' };

  const sample = String(html || '').slice(0, 1_000_000);
  const selectorReason = selectorAwareStandardsReason(sample, selectors);
  if (selectorReason) return { parser: 'parse5', reason: selectorReason };
  if (/<(?:template|svg|math)(?:\s|>)/i.test(sample)) {
    return { parser: 'parse5', reason: 'standards-sensitive-foreign-or-template-content' };
  }
  if (/<table(?:\s|>)/i.test(sample) && /<(?:td|th)\b[^>]*>[^<]*(?=<(?:td|th)\b)/i.test(sample)) {
    return { parser: 'parse5', reason: 'standards-sensitive-malformed-table-content' };
  }
  if (/<noscript(?:\s|>)/i.test(sample) && /<table(?:\s|>)/i.test(sample)) {
    return { parser: 'parse5', reason: 'standards-sensitive-noscript-table-content' };
  }
  if (/<table\b[^>]*>\s*<(?!caption\b|colgroup\b|col\b|thead\b|tbody\b|tfoot\b|tr\b|style\b|script\b|template\b)/i.test(sample)) {
    return { parser: 'parse5', reason: 'standards-sensitive-foster-parenting-content' };
  }
  return { parser: 'htmlparser2', reason: 'performance-safe-html' };
}

function parseDocument(html, parser) {
  if (parser === 'parse5') {
    return loadParse5(html, { xmlMode: false, scriptingEnabled: false }, true);
  }
  return loadHtmlparser2(html, {
    xml: {
      xmlMode: false,
      decodeEntities: true,
      lowerCaseTags: true,
      lowerCaseAttributeNames: true,
      recognizeSelfClosing: true,
    },
  }, true);
}

export function createLazyHtmlDocumentContext(html = '', options = {}) {
  const source = String(html || '');
  const decision = parserDecision(source, options.parserMode, options.selectors);
  let resolved = null;
  let failure = null;
  let resolveCount = 0;

  return {
    version: VALORAE_HYBRID_DOCUMENT_VERSION,
    sourceLength: source.length,
    preferredParser: decision.parser,
    decisionReason: decision.reason,
    resolve(consumer = 'unknown') {
      metrics.consumers += 1;
      resolveCount += 1;
      if (resolved) {
        metrics.domReuses += 1;
        return { ...resolved, reused: true, reuseCount: resolveCount - 1, consumer };
      }
      if (failure) throw failure;

      const started = performance.now();
      let parser = decision.parser;
      let fallbackFrom = '';
      try {
        let $;
        try {
          $ = parseDocument(source, parser);
        } catch (error) {
          if (parser !== 'htmlparser2') throw error;
          fallbackFrom = parser;
          parser = 'parse5';
          metrics.parseFallbacks += 1;
          $ = parseDocument(source, parser);
        }
        const parseTimeMs = performance.now() - started;
        metrics.documents += 1;
        metrics.totalParseMs += parseTimeMs;
        metrics.lastParseMs = Math.round(parseTimeMs * 100) / 100;
        metrics.lastParser = parser;
        metrics.lastReason = fallbackFrom ? `${decision.reason};fallback-from-${fallbackFrom}` : decision.reason;
        if (decision.reason.startsWith('selector-requires-')) metrics.selectorAwareDocuments += 1;
        if (parser === 'parse5') metrics.parse5Documents += 1;
        else metrics.htmlparser2Documents += 1;
        resolved = {
          $,
          parser,
          parseTimeMs,
          decisionReason: metrics.lastReason,
          fallbackFrom: fallbackFrom || undefined,
        };
        return { ...resolved, reused: false, reuseCount: 0, consumer };
      } catch (error) {
        failure = error;
        throw error;
      }
    },
    diagnostics() {
      return {
        resolved: Boolean(resolved),
        parser: resolved?.parser || decision.parser,
        decisionReason: resolved?.decisionReason || decision.reason,
        parseTimeMs: Math.round(Number(resolved?.parseTimeMs || 0) * 100) / 100,
        resolveCount,
        reuseCount: Math.max(0, resolveCount - 1),
      };
    },
  };
}

export function hybridDocumentMetrics() {
  return {
    ...metrics,
    averageParseMs: metrics.documents ? Math.round((metrics.totalParseMs / metrics.documents) * 100) / 100 : 0,
  };
}

export function buildHybridDocumentManifest() {
  return {
    status: 'OK',
    endpoint: 'contract/scraping-engine',
    version: VALORAE_HYBRID_DOCUMENT_VERSION,
    hardeningVersion: VALORAE_HYBRID_DOCUMENT_HARDENING_VERSION,
    policyVersion: VALORAE_HYBRID_DOCUMENT_POLICY,
    implementation: VALORAE_HYBRID_DOCUMENT_IMPLEMENTATION,
    compatibility: 'additive-backward-compatible',
    contractImpact: 'none-existing-fields-and-endpoints-preserved',
    parserMode: parserMode(),
    parserPolicy: {
      default: 'htmlparser2-fast-path',
      standardsFallback: 'parse5-for-template-svg-math-and-parser-errors',
      selectorAwareStandardsFallback: 'parse5-for-browser-document-table-and-form-tree-selectors',
      sharedDom: 'one-lazy-document-shared-by-standard-selectors-and-structured-discovery',
      selectorDeduplication: 'identical-selector-extraction-limit-tuples-execute-once',
    },
    safety: {
      executesPageJavaScript: false,
      evalEnabled: false,
      boundedByExistingHtmlAndSelectorLimits: true,
      legacyOutputPreservedUnlessExistingSafePromotionFlagsAreEnabled: true,
      non2xxResponsesAreNeverStoredAsFreshFetchCache: true,
      outboundHeadersAreSanitizedAfterFinalMerge: true,
      invalidUndeclaredUtf8FallsBackToWindows1252ForText: true,
    },
    featureFlags: ['VALORAE_HTML_DOCUMENT_PARSER', 'VALORAE_HYBRID_PARSER_MODE'],
    rollback: 'Set VALORAE_HTML_DOCUMENT_PARSER=parse5 to restore the previous standards parser for every document.',
    metrics: hybridDocumentMetrics(),
  };
}

export function resetHybridDocumentMetricsForTests() {
  for (const key of Object.keys(metrics)) delete metrics[key];
  Object.assign(metrics, {
    documents: 0, htmlparser2Documents: 0, parse5Documents: 0, parseFallbacks: 0,
    domReuses: 0, consumers: 0, totalParseMs: 0, lastParseMs: 0,
    lastParser: 'NEVER', lastReason: '', selectorAwareDocuments: 0,
  });
}
