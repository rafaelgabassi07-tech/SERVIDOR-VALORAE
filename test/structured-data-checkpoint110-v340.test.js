import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  VALORAE_STRUCTURED_DATA_IMPLEMENTATION,
  VALORAE_STRUCTURED_DATA_POLICY,
  VALORAE_STRUCTURED_DATA_VERSION,
  buildStructuredDataManifest,
  classifyKnownInternalEndpoint,
  discoverStructuredPageData,
  discoveredKnownInternalEndpoints,
  extractStructuredSelectors,
  resetStructuredDataMetricsForTests,
  runStructuredDataShadow,
} from '../lib/scrape/structured-data-discovery.js';
import { _test as assetDetailsTest } from '../lib/sources/asset-details.js';
import { sendJson } from '../lib/core/http.js';
import { dispatchRoute, routeManifest } from '../routes/_router.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const html = `<!doctype html><html><head>
<script type="application/ld+json">{"@type":"Corporation","name":"Petrobras"}</script>
<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"asset":{"ticker":"PETR4","price":38.99,"companyId":123,"tickerId":456}}}}</script>
<script type="application/json" id="financial-data">{"indicators":{"pl":4.67,"pvp":1.13}}</script>
<script>
window._sectorIndicators = {"roe":24.2,"roic":18.1};
window.companyRevenuesChartPie = {"labels":["Brasil","Exterior"],"series":[80,20]};
Highcharts.chart('container', {"series":[{"name":"Lucro","data":[1,2,3]}]});
fetch('/api/balancos/receitaliquida/chart/123/3650/false/');
axios.get('/api/acoes/payout-chart/123/456/PETR4/3650');
</script></head><body><div id="fallback">HTML</div></body></html>`;

resetStructuredDataMetricsForTests();
const discovery = discoverStructuredPageData(html, { url: 'https://investidor10.com.br/acoes/petr4/' });
assert.equal(discovery.ok, true);
assert.equal(discovery.version, VALORAE_STRUCTURED_DATA_VERSION);
assert.ok(discovery.summary.jsonLd >= 1);
assert.ok(discovery.summary.nextData >= 1);
assert.ok(discovery.summary.applicationJson >= 1);
assert.ok(discovery.summary.inlineAssignments >= 2);
assert.ok(discovery.summary.chartConfigurations >= 1);
assert.ok(discovery.summary.endpoints >= 2);

const known = discoveredKnownInternalEndpoints(discovery);
assert.ok(known.some(item => item.key === 'receitasLucros'));
assert.ok(known.some(item => item.key === 'payoutHistorico'));
assert.equal(classifyKnownInternalEndpoint('https://evil.example/api/balancos/receitaliquida/chart/1/'), '');

const selectors = {
  price: { selector: '.missing-price', structuredPath: '$.props.pageProps.asset.price', structuredKinds: ['next-data'] },
  ticker: { selector: '.missing-ticker', structuredPath: '$.props.pageProps.asset.ticker', structuredKinds: ['next-data'] },
};
const extracted = extractStructuredSelectors(discovery, selectors);
assert.deepEqual(extracted.results.price, [38.99]);
assert.deepEqual(extracted.results.ticker, ['PETR4']);

process.env.VALORAE_STRUCTURED_DATA_MODE = 'shadow';
const shadow = runStructuredDataShadow(html, selectors, { price: [], ticker: [] }, { url: 'https://investidor10.com.br/acoes/petr4/' });
assert.equal(shadow.diagnostics.promoted, false);
assert.equal(shadow.diagnostics.outputSource, 'legacy-preserved');
assert.equal(shadow.diagnostics.comparison.gainedKeyCount, 2);
assert.deepEqual(shadow.results, { price: [], ticker: [] });


process.env.VALORAE_STRUCTURED_DATA_MODE = 'prefer-structured';
const promoted = runStructuredDataShadow(html, selectors, { price: [], ticker: [] }, { url: 'https://investidor10.com.br/acoes/petr4/' });
assert.equal(promoted.diagnostics.promoted, true);
assert.equal(promoted.diagnostics.outputSource, 'structured-gap-fill');
assert.deepEqual(promoted.results.price, [38.99]);
assert.deepEqual(promoted.results.ticker, ['PETR4']);
delete process.env.VALORAE_STRUCTURED_DATA_MODE;

const embedded = assetDetailsTest.extractInvestidor10EmbeddedAnalysisData(html);
assert.deepEqual(embedded.advancedMetrics, { roe: 24.2, roic: 18.1 });
assert.deepEqual(embedded.revenueGeography, { labels: ['Brasil', 'Exterior'], series: [80, 20] });
assert.ok(embedded.structuredData.internalEndpoints.some(item => item.key === 'receitasLucros'));
assert.equal(embedded.structuredData.outputPolicy, 'legacy-first-structured-fallback-only');

const manifest = buildStructuredDataManifest();
assert.equal(manifest.version, VALORAE_STRUCTURED_DATA_VERSION);
assert.equal(manifest.policyVersion, VALORAE_STRUCTURED_DATA_POLICY);
assert.equal(manifest.implementation, VALORAE_STRUCTURED_DATA_IMPLEMENTATION);
assert.equal(manifest.contractImpact, 'none');
assert.equal(manifest.safety.executesPageJavaScript, false);
assert.equal(manifest.safety.usesEval, false);
assert.ok(routeManifest().routes.includes('/contract/structured-data'));

function mockResponse() {
  const headers = new Map();
  return {
    headers,
    response: {
      writableEnded: false, statusCode: 200, body: '',
      setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
      getHeader(name) { return headers.get(String(name).toLowerCase()); },
      removeHeader(name) { headers.delete(String(name).toLowerCase()); },
      end(value = '') { this.body = String(value); this.writableEnded = true; return this; },
      status(code) { this.statusCode = code; return this; },
      send(value) { return this.end(value); },
    },
  };
}

const direct = mockResponse();
sendJson({ method: 'GET', url: '/api/v1/ready', headers: {} }, direct.response, { status: 'OK' });
assert.equal(direct.headers.get('x-valorae-structured-data'), VALORAE_STRUCTURED_DATA_VERSION);

const routed = mockResponse();
await dispatchRoute({ method: 'GET', url: '/api/v1/contract/structured-data', headers: { 'x-request-id': 'cp110-manifest' } }, routed.response);
const body = JSON.parse(routed.response.body || '{}');
assert.equal(routed.response.statusCode, 200);
assert.equal(body.version, VALORAE_STRUCTURED_DATA_VERSION);
assert.equal(body.outputPolicy, 'legacy-output-always-preserved');
assert.equal(routed.headers.get('x-valorae-structured-data'), VALORAE_STRUCTURED_DATA_VERSION);

assert.ok(fs.existsSync(new URL('../contracts/checkpoint110/structured-data.json', import.meta.url)));
const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const clientContract = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeStructuredData.kt');
const clientHttp = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
if (protocol !== null || clientContract !== null || clientHttp !== null) {
  assert.ok(protocol?.includes('HeaderStructuredData'));
  assert.ok(protocol?.includes('HeaderStructuredDataAccept'));
  assert.ok(clientContract?.includes(VALORAE_STRUCTURED_DATA_VERSION));
  assert.ok(clientContract?.includes('hiddenFromUi'));
  assert.ok(clientHttp?.includes('structured-data-first-shadow-v1'));
}

console.log('structured-data-checkpoint110-v340 ok');
