import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyFetchOutcome, shouldRetryFetch } from '../lib/resilience/error-classifier.js';
import { buildExtractionPrecisionReport } from '../lib/quality/extraction-precision.js';
import { extractFastSelectors } from '../lib/scrape/fast-selectors.js';
import { getValoraeRuntimeStats } from '../lib/Valorae-engine.js';

const required = [
  'lib/resilience/error-classifier.js',
  'lib/quality/extraction-precision.js',
  'lib/http/response-shape.js',
  'routes/scrape.js',
  'routes/batch-scrape.js',
  'public/server.html',
];
for (const file of required) assert.equal(fs.existsSync(file), true, `${file} ausente`);

const waf = classifyFetchOutcome({ status: 403, ok: false, html: 'cloudflare captcha', blocked: true });
assert.equal(waf.type, 'WAF_DETECTED');
assert.equal(waf.retryable, false);
assert.equal(shouldRetryFetch(classifyFetchOutcome({ status: 429, ok: false })), true);
assert.equal(shouldRetryFetch(classifyFetchOutcome({ status: 404, ok: false })), false);

const html = '<h1>Ativo</h1><span class="price">R$ 10,50</span><span class="dy">8,5%</span>';
const selectors = { name: 'h1', price: { selector: '.price', extract: 'number' }, dy: { selector: '.dy', extract: 'percent' } };
const fast = extractFastSelectors(html, selectors);
assert.equal(fast.ok, true);
assert.equal(fast.results.price[0], 10.5);
const precision = buildExtractionPrecisionReport({ results: fast.results, selectors, htmlLength: html.length, strategy: fast.strategy });
assert.ok(precision.score >= 80, 'precision score baixo');

const runtime = getValoraeRuntimeStats();
assert.ok(String(runtime.engineCore.version || '').startsWith('21.12.'), 'engineCore version deve ser 21.11.x');
assert.ok(typeof runtime.engineCore.score === 'number');

const serverHtml = fs.readFileSync('public/server.html', 'utf8');
assert.ok(serverHtml.includes('engineCoreChart'));
assert.ok(serverHtml.includes('engineCoreList'));
console.log('audit engine core v21.11.0 OK');
