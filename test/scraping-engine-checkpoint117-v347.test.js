import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VALORAE_HYBRID_DOCUMENT_IMPLEMENTATION,
  VALORAE_HYBRID_DOCUMENT_POLICY,
  VALORAE_HYBRID_DOCUMENT_VERSION,
  buildHybridDocumentManifest,
  createLazyHtmlDocumentContext,
  resetHybridDocumentMetricsForTests,
} from '../lib/scrape/document-context.js';
import { extractStandardHtmlSelectors } from '../lib/scrape/standard-html-parser.js';
import { discoverStructuredPageData } from '../lib/scrape/structured-data-discovery.js';
import { chooseDynamicWaitSelector, buildDynamicRenderManifest } from '../lib/scrape/dynamic-render-fallback.js';
import { detectResponseEncoding, readTextLimited, responseRetryAfterMs } from '../lib/http/native-adaptive-fetch.js';
import { dispatchRoute, routeManifest } from '../routes/_router.js';
import { sendJson } from '../lib/core/http.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
resetHybridDocumentMetricsForTests();

const html = '<!doctype html><html><head><script type="application/ld+json">{"name":"VALORAE"}</script></head><body><article><h2>PETR4</h2><span class="price">R$ 38,42</span></article></body></html>';
const context = createLazyHtmlDocumentContext(html, { parserMode: 'adaptive' });
const selected = extractStandardHtmlSelectors(html, {
  ticker: { selector: 'article h2', extract: 'text' },
  tickerAlias: { selector: 'article h2', extract: 'text' },
  price: { selector: '.price', extract: 'number' },
}, { documentContext: context });
assert.equal(selected.ok, true);
assert.equal(selected.metrics.parserEngine, 'htmlparser2');
assert.equal(selected.metrics.selectorGroups, 2);
assert.equal(selected.metrics.queriesSaved, 1);
assert.deepEqual(selected.results.ticker, ['PETR4']);
assert.deepEqual(selected.results.tickerAlias, ['PETR4']);
assert.deepEqual(selected.results.price, [38.42]);

const structured = discoverStructuredPageData(html, { documentContext: context, url: 'https://investidor10.com.br/acoes/petr4/' });
assert.equal(structured.ok, true);
assert.equal(structured.summary.jsonLd, 1);
assert.equal(structured.diagnostics.documentReused, true);
assert.equal(context.diagnostics().resolveCount, 2);

const standardsSensitive = createLazyHtmlDocumentContext('<html><body><svg><title>gráfico</title></svg></body></html>');
assert.equal(standardsSensitive.resolve('test').parser, 'parse5');

assert.equal(chooseDynamicWaitSelector({ price: '#price', sector: '.sector' }, { price: ['10'], sector: [] }), '.sector');
assert.equal(buildDynamicRenderManifest().runtime.isolatedContextPerRun, true);
assert.equal(buildDynamicRenderManifest().runtime.reuseLocalBrowser, true);

const encoded = Buffer.concat([
  Buffer.from('<html><head><meta charset="windows-1252"></head><body>caf', 'ascii'),
  Buffer.from([0xe9]),
  Buffer.from('</body></html>', 'ascii'),
]);
assert.deepEqual(detectResponseEncoding(encoded, 'text/html'), { encoding: 'windows-1252', source: 'html-meta' });
const decoded = await readTextLimited(new Response(encoded, { headers: { 'content-type': 'text/html' } }));
assert.ok(decoded.text.includes('café'));
assert.equal(decoded.encoding, 'windows-1252');
assert.equal(decoded.encodingSource, 'html-meta');
assert.equal(responseRetryAfterMs(new Headers({ 'retry-after': '2' })), 2000);
assert.equal(responseRetryAfterMs(new Headers({ 'retry-after': '120' }), { maxMs: 5000 }), 5000);

const manifest = buildHybridDocumentManifest();
assert.equal(manifest.version, VALORAE_HYBRID_DOCUMENT_VERSION);
assert.equal(manifest.policyVersion, VALORAE_HYBRID_DOCUMENT_POLICY);
assert.equal(manifest.implementation, VALORAE_HYBRID_DOCUMENT_IMPLEMENTATION);
assert.equal(manifest.contractImpact, 'none-existing-fields-and-endpoints-preserved');
assert.ok(routeManifest().routes.includes('/contract/scraping-engine'));
assert.ok(fs.existsSync(path.join(root, 'contracts/checkpoint117/scraping-engine.json')));

function responseHarness() {
  const headers = new Map();
  let body = '';
  return {
    response: {
      statusCode: 200,
      writableEnded: false,
      setHeader(key, value) { headers.set(String(key).toLowerCase(), String(value)); },
      getHeader(key) { return headers.get(String(key).toLowerCase()); },
      removeHeader(key) { headers.delete(String(key).toLowerCase()); },
      end(value = '') { body += String(value); this.writableEnded = true; return this; },
      status(code) { this.statusCode = code; return this; },
      send(value) { return this.end(value); },
    },
    headers,
    json() { return JSON.parse(body || '{}'); },
  };
}

const direct = responseHarness();
sendJson({ method: 'GET', url: '/api/v1/ready', headers: {} }, direct.response, { status: 'OK' });
assert.equal(direct.headers.get('x-valorae-scraping-engine'), VALORAE_HYBRID_DOCUMENT_VERSION);
const routed = responseHarness();
await dispatchRoute({ method: 'GET', url: '/api/v1/contract/scraping-engine', headers: { 'x-request-id': 'cp117-engine' } }, routed.response);
assert.equal(routed.response.statusCode, 200);
assert.equal(routed.json().version, VALORAE_HYBRID_DOCUMENT_VERSION);
assert.equal(routed.headers.get('x-valorae-scraping-engine'), VALORAE_HYBRID_DOCUMENT_VERSION);

const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const clientContract = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeScrapingEngine.kt');
const clientHttp = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const endpointCatalog = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeProxyEndpointCatalog.kt');
if (protocol !== null || clientContract !== null || clientHttp !== null || endpointCatalog !== null) {
  assert.ok(protocol?.includes('HeaderScrapingEngineAccept'));
  assert.ok(clientContract?.includes(VALORAE_HYBRID_DOCUMENT_VERSION));
  assert.ok(clientContract?.includes('serverVersion.isNullOrBlank()'));
  assert.ok(clientHttp?.includes('scrapingEngineVersion'));
  assert.ok(clientHttp?.includes('ValoraeScrapingEngineContract.PolicyVersion'));
  assert.ok(endpointCatalog?.includes('/api/v1/contract/scraping-engine'));
}

console.log('scraping-engine-checkpoint117-v347 ok');
