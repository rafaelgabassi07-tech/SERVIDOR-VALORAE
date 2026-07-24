import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildExtractionIntelligenceManifest,
  VALORAE_EXTRACTION_INTELLIGENCE_IMPLEMENTATION,
  VALORAE_EXTRACTION_INTELLIGENCE_POLICY,
  VALORAE_EXTRACTION_INTELLIGENCE_VERSION,
} from '../lib/scrape/extraction-intelligence.js';
import {
  discoverStructuredPageData,
  extractStructuredSelectors,
} from '../lib/scrape/structured-data-discovery.js';
import {
  captureDynamicPageData,
  resetDynamicRenderStateForTests,
  setDynamicRenderRuntimeForTests,
} from '../lib/scrape/dynamic-render-fallback.js';
import { createNetworkJsonCollector } from '../lib/scrape/network-json-capture.js';
import { dispatchRoute, routeManifest } from '../routes/_router.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const previous = { ...process.env };
process.env.VALORAE_DYNAMIC_RENDER_ENABLED = '1';
process.env.VALORAE_DYNAMIC_NETWORK_CAPTURE_ENABLED = '1';
process.env.VALORAE_DYNAMIC_NETWORK_CAPTURE_MODE = 'known-endpoint-gap-fill';
process.env.VALORAE_DYNAMIC_RENDER_MAX_RUNS_PER_MINUTE = '20';

const hydrationHtml = `<!doctype html><html><body>
<div id="app" data-page="{&quot;component&quot;:&quot;Asset&quot;,&quot;props&quot;:{&quot;ticker&quot;:&quot;PETR4&quot;,&quot;dy&quot;:8.5}}"></div>
<script>window.__APOLLO_STATE__ = {"Asset:PETR4":{"price":38.4}}; self.__next_f.push([1,"1:{\"asset\":{\"ticker\":\"PETR4\",\"dy\":8.5}}"]);</script>
</body></html>`;
const additionalDocuments = [{
  id: 'network-indicators',
  kind: 'network-json',
  source: 'playwright-response',
  url: 'https://investidor10.com.br/api/balancos/indicadores/chart/123/3650/',
  contentType: 'application/json',
  status: 200,
  bytes: 55,
  data: { indicators: [{ year: 2025, dividendYield: 8.5 }] },
}];
const discovery = discoverStructuredPageData(hydrationHtml, {
  url: 'https://investidor10.com.br/acoes/petr4/',
  additionalDocuments,
});
assert.equal(discovery.ok, true);
assert.ok(discovery.summary.hydrationAttributes >= 1);
assert.ok(discovery.summary.networkJsonDocuments >= 1);
assert.ok(discovery.summary.nextFlightFrames >= 1);
assert.ok(discovery.summary.nextFlightJsonDocuments >= 1);
assert.ok(discovery.summary.frameworks.includes('nextjs'));
assert.ok(discovery.summary.frameworks.includes('apollo'));
assert.ok(discovery.endpoints.some(item => item.evidence === 'captured-network-json'));
const selected = extractStructuredSelectors(discovery, {
  ticker: { structuredPath: '$.props.ticker', structuredKinds: ['hydration-attribute'] },
  dy: { structuredPath: '$.indicators[0].dividendYield', structuredKinds: ['network-json'] },
});
assert.deepEqual(selected.results.ticker, ['PETR4']);
assert.deepEqual(selected.results.dy, [8.5]);

function mockResponse({
  url = 'https://investidor10.com.br/api/balancos/resultado/chart/123/3650/',
  status = 200,
  contentType = 'application/json; charset=utf-8',
  body = { rows: [{ year: 2025, value: 10 }] },
  resourceType = 'xhr',
  serverAddress = '8.8.8.8',
} = {}) {
  const buffer = Buffer.from(JSON.stringify(body));
  return {
    status: () => status,
    url: () => url,
    headers: () => ({ 'content-type': contentType, 'content-length': String(buffer.length) }),
    request: () => ({ method: () => 'GET', resourceType: () => resourceType }),
    body: async () => buffer,
    serverAddr: async () => serverAddress ? { ipAddress: serverAddress, port: 443 } : null,
  };
}
const collector = createNetworkJsonCollector({
  targetUrl: 'https://investidor10.com.br/acoes/petr4/',
  maxDocuments: 4,
  maxDocumentBytes: 32_000,
  maxTotalBytes: 64_000,
});
collector.observe(mockResponse());
collector.observe(mockResponse());
collector.observe(mockResponse({ url: 'https://evil.example/api/data' }));
collector.observe(mockResponse({ url: 'https://investidor10.com.br/auth/token' }));
collector.observe(mockResponse({ url: 'https://investidor10.com.br/api/private', serverAddress: '192.168.0.2' }));
const captured = await collector.settle();
assert.equal(captured.length, 1, 'respostas duplicadas, externas ou sensíveis devem ser descartadas');
assert.equal(captured[0].url, 'https://investidor10.com.br/api/balancos/resultado/chart/123/3650/');
assert.equal(collector.diagnostics().duplicateDocuments, 1);
assert.ok(collector.diagnostics().skippedHost >= 1);
assert.ok(collector.diagnostics().skippedSensitive >= 1);
assert.ok(collector.diagnostics().skippedAddress >= 1);

resetDynamicRenderStateForTests();
setDynamicRenderRuntimeForTests(async url => ({
  html: '<html><body><div id="ready">OK</div></body></html>',
  finalUrl: url,
  status: 200,
  runtime: 'fixture-browser',
  waitStrategy: 'networkidle',
  networkDocuments: additionalDocuments,
  networkDiagnostics: { documents: 1, capturedBytes: 55, observed: 1, parseFailures: 0 },
}));
const dynamic = await captureDynamicPageData({
  url: 'https://investidor10.com.br/acoes/petr4/',
  staticHtml: '<html><body>incomplete</body></html>',
});
assert.equal(dynamic.diagnostics.ran, true);
assert.equal(dynamic.diagnostics.outputPolicy, 'known-endpoint-json-gap-fill-only');
assert.equal(dynamic.networkDocuments.length, 1);

const manifest = buildExtractionIntelligenceManifest();
assert.equal(manifest.version, VALORAE_EXTRACTION_INTELLIGENCE_VERSION);
assert.equal(manifest.policyVersion, VALORAE_EXTRACTION_INTELLIGENCE_POLICY);
assert.equal(manifest.implementation, VALORAE_EXTRACTION_INTELLIGENCE_IMPLEMENTATION);
assert.equal(manifest.capabilities.xhrAndFetchJsonCapture, true);
assert.equal(manifest.safety.capturedJsonUsedOnlyForKnownEndpointGapFill, true);
assert.equal(manifest.safety.capturedJsonSensitiveFieldsRemoved, true);
assert.equal(manifest.safety.capturedJsonPrototypeKeysRemoved, true);
assert.equal(manifest.safety.capturedJsonComplexityBounded, true);
assert.equal(manifest.safety.collectorBackpressureAndSettleTimeout, true);
assert.equal(manifest.safety.everyAllowedBrowserRequestDnsPreflight, true);
assert.equal(manifest.safety.localBrowserSandboxEnabledByDefault, true);
assert.equal(manifest.safety.actualBrowserServerAddressRequiredByDefault, true);
assert.equal(manifest.safety.downloadsPopupsAndWebSocketsBlocked, true);
assert.equal(manifest.safety.globallyBoundedHttpPools, true);
assert.equal(manifest.safety.dynamicCacheKeysHashed, true);
assert.equal(manifest.compatibilityContract.mobileProtocolUnchanged, true);
assert.ok(routeManifest().routes.includes('/contract/extraction-intelligence'));
assert.ok(fs.existsSync(new URL('../contracts/checkpoint126/extraction-intelligence.json', import.meta.url)));

function responseHarness() {
  const headers = new Map();
  let body = '';
  return {
    response: {
      statusCode: 200,
      writableEnded: false,
      setHeader(k, v) { headers.set(String(k).toLowerCase(), String(v)); },
      getHeader(k) { return headers.get(String(k).toLowerCase()); },
      removeHeader(k) { headers.delete(String(k).toLowerCase()); },
      end(value = '') { body += String(value); this.writableEnded = true; return this; },
    },
    headers,
    json() { return JSON.parse(body || '{}'); },
  };
}
const routed = responseHarness();
await dispatchRoute({ method: 'GET', url: '/api/v1/contract/extraction-intelligence', headers: { 'x-request-id': 'cp126-manifest' } }, routed.response);
assert.equal(routed.response.statusCode, 200);
assert.equal(routed.headers.get('x-valorae-extraction-intelligence'), VALORAE_EXTRACTION_INTELLIGENCE_VERSION);
assert.equal(routed.json().version, VALORAE_EXTRACTION_INTELLIGENCE_VERSION);

const apkProtocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const apkContract = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeExtractionIntelligence.kt');
const apkHttp = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
if (apkProtocol !== null || apkContract !== null || apkHttp !== null) {
  assert.ok(apkProtocol?.includes('HeaderExtractionIntelligence'));
  assert.ok(apkProtocol?.includes('HeaderExtractionIntelligenceAccept'));
  assert.ok(apkContract?.includes(VALORAE_EXTRACTION_INTELLIGENCE_VERSION));
  assert.ok(apkContract?.includes(VALORAE_EXTRACTION_INTELLIGENCE_POLICY));
  assert.ok(apkContract?.includes('safeForCurrentApk'));
  assert.ok(apkHttp?.includes('ValoraeExtractionIntelligenceContract.PolicyVersion'));
  assert.ok(apkHttp?.includes('extractionIntelligenceVersion = header(ValoraeMobileProtocol.HeaderExtractionIntelligence)'));
}

process.env = previous;
resetDynamicRenderStateForTests();
console.log('extraction-intelligence-checkpoint126-v362 ok');
