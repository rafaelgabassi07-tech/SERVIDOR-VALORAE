import assert from 'node:assert/strict';
import { extractSelectorsWithDynamicFallback } from '../lib/scrape/selector-engine.js';
import {
  VALORAE_DYNAMIC_RENDER_VERSION,
  VALORAE_DYNAMIC_RENDER_POLICY,
  buildDynamicRenderManifest,
  resetDynamicRenderStateForTests,
  setDynamicRenderRuntimeForTests,
} from '../lib/scrape/dynamic-render-fallback.js';
import { routeManifest } from '../routes/_router.js';
import { dispatchRoute } from '../routes/_router.js';

const previous = { ...process.env };
process.env.VALORAE_DYNAMIC_RENDER_ENABLED = '1';
process.env.VALORAE_DYNAMIC_RENDER_MODE = 'shadow';
process.env.VALORAE_DYNAMIC_RENDER_MIN_STATIC_COVERAGE = '0.9';
process.env.VALORAE_DYNAMIC_RENDER_MAX_RUNS_PER_MINUTE = '20';

const selectors = {
  price: { selector: '#price', text: true },
  sector: { selector: '#sector', text: true },
};
const staticHtml = '<html><body><div id="price">R$ 10,00</div></body></html>';
const renderedHtml = '<html><body><div id="price">R$ 10,00</div><div id="sector">Energia</div></body></html>';

resetDynamicRenderStateForTests();
setDynamicRenderRuntimeForTests(async url => ({ html: renderedHtml, finalUrl: url, status: 200, runtime: 'fixture-browser' }));
const shadow = await extractSelectorsWithDynamicFallback(staticHtml, selectors, { minCoverage: 0.9 }, { url: 'https://investidor10.com.br/acoes/petr4/', blocked: false });
assert.equal(shadow.results.price[0], 'R$ 10,00');
assert.deepEqual(shadow.results.sector, [], 'shadow não pode promover campo novo');
assert.equal(shadow.dynamicRenderFallback.ran, true);
assert.equal(shadow.dynamicRenderFallback.promoted, false);
assert.deepEqual(shadow.dynamicRenderFallback.comparison.gainedKeys, ['sector']);

process.env.VALORAE_DYNAMIC_RENDER_MODE = 'prefer-rendered';
resetDynamicRenderStateForTests();
setDynamicRenderRuntimeForTests(async url => ({ html: renderedHtml, finalUrl: url, status: 200, runtime: 'fixture-browser' }));
const promoted = await extractSelectorsWithDynamicFallback(staticHtml, selectors, { minCoverage: 0.9 }, { url: 'https://investidor10.com.br/acoes/petr4/', blocked: false });
assert.equal(promoted.results.price[0], 'R$ 10,00');
assert.equal(promoted.results.sector[0], 'Energia');
assert.equal(promoted.dynamicRenderFallback.promoted, true);
assert.equal(promoted.strategy, 'dynamic-render-gap-fill');

resetDynamicRenderStateForTests();
setDynamicRenderRuntimeForTests(async url => ({ html: '<html><body><div id="sector">Energia</div></body></html>', finalUrl: url, status: 200, runtime: 'fixture-browser' }));
const lossBlocked = await extractSelectorsWithDynamicFallback(staticHtml, selectors, { minCoverage: 0.9 }, { url: 'https://investidor10.com.br/acoes/petr4/', blocked: false });
assert.equal(lossBlocked.dynamicRenderFallback.promoted, false, 'perda de campo estático deve bloquear promoção');
assert.equal(lossBlocked.results.price[0], 'R$ 10,00');
assert.deepEqual(lossBlocked.results.sector, []);

const blocked = await extractSelectorsWithDynamicFallback(staticHtml, selectors, { minCoverage: 0.9 }, { url: 'https://evil.example/test', blocked: false });
assert.equal(blocked.dynamicRenderFallback.ran, false);
assert.equal(blocked.dynamicRenderFallback.reason, 'host-not-allowed');

const manifest = buildDynamicRenderManifest();
assert.equal(manifest.version, VALORAE_DYNAMIC_RENDER_VERSION);
assert.equal(manifest.policyVersion, VALORAE_DYNAMIC_RENDER_POLICY);
assert.equal(manifest.safety.browserIsNeverMandatoryForFinancialContract, true);
assert.equal(manifest.runtime.optional, true);
assert.ok(routeManifest().routes.includes('/contract/dynamic-render'));

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
await dispatchRoute({ method: 'GET', url: '/api/v1/contract/dynamic-render', headers: { 'x-request-id': 'cp111-manifest' } }, routed.response);
assert.equal(routed.response.statusCode, 200);
assert.equal(routed.headers.get('x-valorae-dynamic-render'), VALORAE_DYNAMIC_RENDER_VERSION);
assert.equal(routed.json().version, VALORAE_DYNAMIC_RENDER_VERSION);

process.env = previous;
resetDynamicRenderStateForTests();
console.log('dynamic-render-checkpoint111-v341 ok');
