import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  VALORAE_DYNAMIC_RENDER_VERSION,
  VALORAE_FINAL_DECOMPOSITION_VERSION,
  VALORAE_FORMAL_SCHEMA_VERSION,
  VALORAE_HTML_PARSER_SHADOW_VERSION,
  VALORAE_HTTP_TRANSPORT_VERSION,
  VALORAE_HYBRID_DOCUMENT_VERSION,
  VALORAE_REAL_CANARY_VERSION,
  VALORAE_SHARED_STATE_VERSION,
  VALORAE_STRUCTURED_DATA_VERSION,
} from '../lib/core/feature-versions.js';
import { dispatchRoute } from '../routes/_router.js';

const read = relative => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const coreHttp = read('lib/core/http.js');
const providerTransport = read('lib/http/provider-transport.js');
const formalSchemas = read('lib/contract/formal-schema-validation.js');
const router = read('routes/_router.js');

assert.match(coreHttp, /from '\.\/feature-versions\.js'/);
for (const heavyweight of [
  '../scrape/standard-html-parser.js',
  '../scrape/structured-data-discovery.js',
  '../scrape/dynamic-render-fallback.js',
  '../contract/formal-schema-validation.js',
  '../http/provider-transport.js',
  '../state/shared-runtime-state.js',
  '../canary/real-canary.js',
  '../scrape/document-context.js',
]) {
  assert.equal(coreHttp.includes(`from '${heavyweight}'`), false, `core/http não deve inicializar ${heavyweight} apenas para ler versão`);
}

assert.doesNotMatch(providerTransport, /import\s+\{\s*Pool\s*\}\s+from\s+['"]undici['"]/);
assert.match(providerTransport, /function undiciPoolConstructor\(\)/);
assert.match(providerTransport, /require\('undici'\)/);
assert.match(providerTransport, /const Pool = undiciPoolConstructor\(\)/);

assert.doesNotMatch(formalSchemas, /import\s+Ajv2020\s+from/);
assert.match(formalSchemas, /function ajvInstance\(\)/);
assert.match(formalSchemas, /function validatorFor\(direction, id\)/);
assert.doesNotMatch(formalSchemas, /for \(const \[id, schema\] of Object\.entries\(VALORAE_RESPONSE_SCHEMAS\)\) responseValidators\.set/);

for (const eagerImport of [
  "import { buildMobilePortfolioSync } from '../lib/contracts/mobile.js'",
  "import { buildPortfolioAnalysis, buildRealMarketHistory, buildPortfolioReturns",
  "import { buildAssetDetails, getAssetHistory } from '../lib/sources/asset-details.js'",
  "import { buildFiiModalContract } from '../lib/analysis/fii-modal-contract.js'",
  "import { buildStockModalContract } from '../lib/analysis/stock-modal-contract.js'",
  "import { buildAssetModalContract } from '../lib/analysis/asset-modal-contract.js'",
  "import syncHandler from './sync.js'",
  "import assetsHandler from './assets.js'",
]) {
  assert.equal(router.includes(eagerImport), false, `roteador não pode restaurar import pesado: ${eagerImport}`);
}
assert.match(router, /const lazyFeatureModules = globalThis\.__VALORAE_ROUTER_LAZY_FEATURE_MODULES__/);
assert.match(router, /Promise\.resolve\(\)\.then\(loader\)\.catch/);
assert.match(router, /import\('\.\.\/lib\/contracts\/mobile\.js'\)/);
assert.match(router, /import\('\.\.\/lib\/analysis\/asset-modal-contract\.js'\)/);
assert.match(router, /import\('\.\/sync\.js'\)/);

function responseHarness() {
  const headers = new Map();
  let body = '';
  return {
    response: {
      statusCode: 200,
      writableEnded: false,
      setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
      getHeader(name) { return headers.get(String(name).toLowerCase()); },
      removeHeader(name) { headers.delete(String(name).toLowerCase()); },
      end(value = '') { body += String(value); this.writableEnded = true; return this; },
      status(code) { this.statusCode = code; return this; },
      send(value) { return this.end(value); },
    },
    headers,
    json() { return JSON.parse(body || '{}'); },
  };
}

const ready = responseHarness();
await dispatchRoute({ method: 'GET', url: '/api/v1/ready', headers: { 'x-request-id': 'cold-start-contract' } }, ready.response);
assert.equal(ready.response.statusCode, 200);
assert.equal(ready.json().status, 'OK');
assert.equal(ready.headers.get('x-valorae-html-parser-shadow'), VALORAE_HTML_PARSER_SHADOW_VERSION);
assert.equal(ready.headers.get('x-valorae-structured-data'), VALORAE_STRUCTURED_DATA_VERSION);
assert.equal(ready.headers.get('x-valorae-dynamic-render'), VALORAE_DYNAMIC_RENDER_VERSION);
assert.equal(ready.headers.get('x-valorae-formal-schema'), VALORAE_FORMAL_SCHEMA_VERSION);
assert.equal(ready.headers.get('x-valorae-http-transport'), VALORAE_HTTP_TRANSPORT_VERSION);
assert.equal(ready.headers.get('x-valorae-shared-state'), VALORAE_SHARED_STATE_VERSION);
assert.equal(ready.headers.get('x-valorae-real-canary'), VALORAE_REAL_CANARY_VERSION);
assert.equal(ready.headers.get('x-valorae-final-decomposition'), VALORAE_FINAL_DECOMPOSITION_VERSION);
assert.equal(ready.headers.get('x-valorae-scraping-engine'), VALORAE_HYBRID_DOCUMENT_VERSION);

console.log('cold-start-initialization-v350 ok');
