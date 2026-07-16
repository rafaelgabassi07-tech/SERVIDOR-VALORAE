import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  VALORAE_SOURCE_ADAPTER_POLICY_VERSION,
  VALORAE_SOURCE_ADAPTER_VERSION,
  buildSourceAdapterManifest,
  executeSourceAdapter,
  executeSourceFallback,
  registerSourceAdapter,
  resetSourceAdapterMetricsForTests,
  sourceAdapterMetrics,
  unregisterSourceAdapterForTests,
} from '../lib/sources/adapters/index.js';
import { sendJson } from '../lib/core/http.js';
import { dispatchRoute, routeManifest } from '../routes/_router.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const manifest = buildSourceAdapterManifest({ includeMetrics: false });
assert.equal(manifest.version, VALORAE_SOURCE_ADAPTER_VERSION);
assert.equal(manifest.policyVersion, VALORAE_SOURCE_ADAPTER_POLICY_VERSION);
assert.equal(manifest.contractImpact, 'none');
assert.equal(manifest.compatibility, 'additive-hidden-from-ui');
for (const id of ['yahoo', 'investidor10', 'statusinvest', 'b3', 'bcb']) {
  assert.ok(manifest.adapters.some(adapter => adapter.id === id), `adapter ${id} ausente`);
}
assert.ok(manifest.adapters.find(adapter => adapter.id === 'yahoo').operations.some(operation => operation.name === 'history'));
assert.ok(manifest.adapters.find(adapter => adapter.id === 'bcb').operations.some(operation => operation.name === 'cdi'));
assert.ok(routeManifest().routes.includes('/contract/source-adapters'));

resetSourceAdapterMetricsForTests();
registerSourceAdapter({
  id: 'cp108-primary', label: 'CP108 primary', operations: {
    read: async () => ({ ok: false, status: 'EMPTY', values: [] }),
  },
});
registerSourceAdapter({
  id: 'cp108-fallback', label: 'CP108 fallback', operations: {
    read: async input => ({ ok: true, status: 'OK', value: input, contract: 'unchanged' }),
  },
});
try {
  const result = await executeSourceFallback([
    { adapterId: 'cp108-primary', operation: 'read', args: ['first'] },
    { adapterId: 'cp108-fallback', operation: 'read', args: ['preserved-value'] },
  ]);
  assert.deepEqual(result, { ok: true, status: 'OK', value: 'preserved-value', contract: 'unchanged' });
  const fallbackMetric = sourceAdapterMetrics('cp108-fallback', 'read');
  assert.equal(fallbackMetric.fallbackWins, 1);

  process.env.VALORAE_ADAPTER_CP108_FALLBACK_READ_ENABLED = '0';
  const disabled = await executeSourceAdapter('cp108-fallback', 'read', ['x'], {
    onDisabled: () => ({ ok: false, status: 'DISABLED', value: 'safe-sentinel' }),
  });
  assert.equal(disabled.status, 'DISABLED');
  assert.equal(sourceAdapterMetrics('cp108-fallback', 'read').disabled, 1);
  delete process.env.VALORAE_ADAPTER_CP108_FALLBACK_READ_ENABLED;
} finally {
  unregisterSourceAdapterForTests('cp108-primary');
  unregisterSourceAdapterForTests('cp108-fallback');
}

function mockResponse() {
  const headers = new Map();
  return {
    headers,
    response: {
      writableEnded: false,
      statusCode: 200,
      body: '',
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
assert.equal(direct.headers.get('x-valorae-source-adapters'), VALORAE_SOURCE_ADAPTER_VERSION);

const routed = mockResponse();
await dispatchRoute({ method: 'GET', url: '/api/v1/contract/source-adapters', headers: { 'x-request-id': 'cp108-manifest' } }, routed.response);
const body = JSON.parse(routed.response.body || '{}');
assert.equal(routed.response.statusCode, 200);
assert.equal(body.version, VALORAE_SOURCE_ADAPTER_VERSION);
assert.equal(body.policyVersion, VALORAE_SOURCE_ADAPTER_POLICY_VERSION);
assert.equal(routed.headers.get('x-valorae-source-adapters'), VALORAE_SOURCE_ADAPTER_VERSION);

const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const clientContract = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeSourceAdapters.kt');
const clientHttp = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
if (protocol !== null || clientContract !== null || clientHttp !== null) {
  assert.ok(protocol?.includes('HeaderSourceAdapters'));
  assert.ok(protocol?.includes('HeaderSourceAdaptersAccept'));
  assert.ok(clientContract?.includes(VALORAE_SOURCE_ADAPTER_VERSION));
  assert.ok(clientContract?.includes('hiddenFromUi'));
  assert.ok(clientHttp?.includes('isolated-provider-adapters-v1'));
}

assert.equal(fs.existsSync(new URL('../contracts/checkpoint108/source-adapters.json', import.meta.url)), true);
console.log('source-adapters-checkpoint108-v338 ok');
