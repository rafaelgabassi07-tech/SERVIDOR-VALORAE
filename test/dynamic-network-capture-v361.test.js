import assert from 'node:assert/strict';
import {
  buildDynamicRenderManifest,
  captureDynamicPageData,
  dynamicNetworkCaptureMode,
  resetDynamicRenderStateForTests,
  setDynamicRenderRuntimeForTests,
} from '../lib/scrape/dynamic-render-fallback.js';

const previous = { ...process.env };
process.env.VALORAE_DYNAMIC_RENDER_ENABLED = '1';
process.env.VALORAE_DYNAMIC_NETWORK_CAPTURE_ENABLED = '1';
process.env.VALORAE_DYNAMIC_NETWORK_CAPTURE_MODE = 'known-endpoint-gap-fill';
process.env.VALORAE_DYNAMIC_RENDER_MAX_RUNS_PER_MINUTE = '20';

const docs = [{
  id: 'network-json-1',
  kind: 'network-json',
  source: 'playwright-response',
  url: 'https://investidor10.com.br/api/balancos/indicadores/chart/123/3650/',
  status: 200,
  contentType: 'application/json',
  bytes: 32,
  data: { indicators: [{ dy: 8.5 }] },
}];

resetDynamicRenderStateForTests();
setDynamicRenderRuntimeForTests(async url => ({
  html: '<html><body><div id="app">ready</div></body></html>',
  finalUrl: url,
  status: 200,
  runtime: 'fixture-browser',
  waitStrategy: 'networkidle',
  networkDocuments: docs,
  networkDiagnostics: { observed: 2, documents: 1, capturedBytes: 32, parseFailures: 0 },
}));

assert.equal(dynamicNetworkCaptureMode(), 'known-endpoint-gap-fill');
const first = await captureDynamicPageData({
  url: 'https://investidor10.com.br/acoes/petr4/',
  staticHtml: '<html><body>partial</body></html>',
});
assert.equal(first.diagnostics.ran, true);
assert.equal(first.diagnostics.outputPolicy, 'known-endpoint-json-gap-fill-only');
assert.equal(first.networkDocuments.length, 1);
const second = await captureDynamicPageData({
  url: 'https://investidor10.com.br/acoes/petr4/',
  staticHtml: '<html><body>partial</body></html>',
});
assert.equal(second.diagnostics.cache, 'HIT');
assert.equal(second.networkDocuments.length, 1);

const blocked = await captureDynamicPageData({
  url: 'https://evil.example/data',
  staticHtml: '<html></html>',
});
assert.equal(blocked.diagnostics.ran, false);
assert.equal(blocked.diagnostics.reason, 'host-not-allowed');

const manifest = buildDynamicRenderManifest();
assert.equal(manifest.networkCapturePolicy, 'known-endpoint-gap-fill');
assert.equal(manifest.safety.sensitiveEndpointsAndQueryKeysRejected, true);
assert.equal(manifest.safety.dnsResolutionPreflightEnabled, true);
assert.equal(manifest.safety.actualServerAddressVerifiedWhenAvailable, true);
assert.ok(manifest.limits.networkMaxDocumentBytes > 0);
assert.equal(manifest.rollback.disableNetworkCapture, 'VALORAE_DYNAMIC_NETWORK_CAPTURE_ENABLED=0');
assert.equal(manifest.rollback.disableDnsGuard, 'VALORAE_DYNAMIC_DNS_GUARD_ENABLED=0');

process.env = previous;
resetDynamicRenderStateForTests();
console.log('dynamic-network-capture-v361 ok');
