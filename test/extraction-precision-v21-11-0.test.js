import assert from 'node:assert/strict';
import { buildExtractionPrecisionReport, parsePtBrNumber } from '../lib/quality/extraction-precision.js';
import { extractFastSelectors } from '../lib/scrape/fast-selectors.js';
import { shapeResponsePayload } from '../lib/http/response-shape.js';

assert.equal(parsePtBrNumber('R$ 32,45'), 32.45);
assert.equal(parsePtBrNumber('1.234,56%'), 1234.56);

const html = '<html><head><title>PETR4</title><meta name="description" content="Petrobras"></head><body><span class="price">R$ 32,45</span><span class="dy">7,20%</span></body></html>';
const selectors = {
  title: 'title',
  price: { selector: '.price', extract: 'number' },
  dividendYield: { selector: '.dy', extract: 'percent' },
  description: { selector: 'meta[name=description]', extract: 'content' },
};
const fast = extractFastSelectors(html, selectors, { maxPerSelector: 4 });
assert.equal(fast.ok, true);
assert.equal(fast.results.price[0], 32.45);
assert.equal(fast.results.dividendYield[0], 7.2);
assert.equal(fast.results.description[0], 'Petrobras');
assert.equal(fast.metrics.coveragePercent, 100);

const report = buildExtractionPrecisionReport({ results: fast.results, selectors, htmlLength: html.length, strategy: 'single-pass' });
assert.equal(report.level, 'high');
assert.equal(report.coveragePercent, 100);
assert.equal(report.chartReadiness.ready, false);
assert.equal(report.suspicious.length, 0);

const shaped = shapeResponsePayload({ version: 'x', requestId: 'r1', ok: true, status: 200, results: { a: 1 }, metrics: { totalTimeMs: 1 }, htmlPreview: 'abcdef', ignored: true }, { fields: 'results,metrics', compact: true, previewChars: 0 });
assert.deepEqual(shaped, { version: 'x', requestId: 'r1', ok: true, status: 200, results: { a: 1 }, metrics: { totalTimeMs: 1 } });
console.log('extraction precision v21.11.0 tests OK.');
