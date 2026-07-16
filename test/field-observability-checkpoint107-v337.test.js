import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  VALORAE_FIELD_OBSERVABILITY_VERSION,
  attachFieldObservability,
  buildFieldObservability,
  buildFieldObservabilityManifest,
  _test,
} from '../lib/observability/field-observability.js';
import { sendJson } from '../lib/core/http.js';
import { dispatchRoute, routeManifest } from '../routes/_router.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const fixture = {
  requestId: 'trace-cp107-001',
  status: 'OK',
  ticker: 'PETR4',
  generatedAt: '2026-07-14T18:00:00.000Z',
  normalized: {
    price: { display: 'R$ 38,99', value: 38.99, unit: 'BRL', source: 'Yahoo Finance Chart API', confidence: 0.96, observedAt: '2026-07-14T17:59:00.000Z' },
    payout: { display: '33,43%', value: 33.43, unit: 'percent', source: 'Investidor10 página do ativo', extractionMethod: 'html-dom', validated: true },
  },
  sections: [
    { id: 'summary', status: 'READY', source: 'VALORAE aggregation', value: 'ready' },
    { id: 'checklist', status: 'PARTIAL', source: 'cache stale fallback', value: 'partial', fallback: true, cacheStatus: 'STALE_IF_ERROR' },
  ],
  diagnostics: [
    { provider: 'Yahoo Finance Chart API', status: 'OK', elapsedMs: 112, cacheStatus: 'MISS' },
    { provider: 'Investidor10', status: 'OK', elapsedMs: 284, cacheStatus: 'HIT' },
  ],
  raw: '<html>must-not-appear</html>',
};

const observability = buildFieldObservability('asset', fixture, { traceId: fixture.requestId });
assert.equal(observability.version, VALORAE_FIELD_OBSERVABILITY_VERSION);
assert.equal(observability.traceId, fixture.requestId);
assert.equal(observability.hiddenFromUi, true);
assert.ok(observability.summary.fieldCount >= 4);
assert.ok(observability.providers.some(item => item.name.includes('Yahoo Finance')));
assert.ok(observability.methods.some(item => item.name === 'structured-api'));
assert.ok(observability.methods.some(item => item.name === 'html-dom'));
assert.ok(observability.fallbackFields.some(item => item.field === 'checklist'));
assert.ok(observability.sourceTimings.some(item => item.provider === 'Investidor10' && item.elapsedMs === 284));
assert.equal(JSON.stringify(observability).includes('must-not-appear'), false);
assert.ok(observability.fields.every(item => item.evidence && Array.isArray(item.evidence.keys)));

const attached = attachFieldObservability('asset', fixture, { traceId: fixture.requestId });
assert.equal(attached.fieldObservability.version, VALORAE_FIELD_OBSERVABILITY_VERSION);
assert.equal(attached.raw, fixture.raw, 'observabilidade não deve alterar o contrato funcional');
assert.notEqual(attached, fixture);
assert.equal(fixture.fieldObservability, undefined);
assert.ok(attached.fieldObservability.fields.length <= _test.MAX_RESPONSE_FIELDS);
assert.ok(attached.fieldObservability.sourceTimings.length <= _test.MAX_RESPONSE_TIMINGS);
assert.equal(attached.fieldObservability.fullTraceAvailable, true);

const manifest = buildFieldObservabilityManifest();
assert.equal(manifest.guarantees.additiveMetadataOnly, true);
assert.equal(manifest.guarantees.noUiContractChange, true);
assert.equal(manifest.guarantees.noRawHtmlOrSecrets, true);
assert.ok(routeManifest().routes.includes('/contract/observability'));

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
sendJson({ method: 'GET', url: '/api/v1/asset', headers: { 'x-request-id': fixture.requestId } }, direct.response, attached);
assert.equal(direct.headers.get('x-valorae-field-observability'), VALORAE_FIELD_OBSERVABILITY_VERSION);
assert.equal(direct.headers.get('x-valorae-trace-id'), fixture.requestId);

const routed = mockResponse();
await dispatchRoute({ method: 'GET', url: '/api/v1/contract/observability', headers: { 'x-request-id': 'manifest-trace' } }, routed.response);
const routedBody = JSON.parse(routed.response.body || '{}');
assert.equal(routed.response.statusCode, 200);
assert.equal(routedBody.version, VALORAE_FIELD_OBSERVABILITY_VERSION);
assert.equal(routed.headers.get('x-valorae-field-observability'), VALORAE_FIELD_OBSERVABILITY_VERSION);

const traceResponse = mockResponse();
await dispatchRoute({ method: 'GET', url: `/api/v1/contract/observability?traceId=${fixture.requestId}`, headers: { 'x-request-id': 'trace-reader' } }, traceResponse.response);
const traceBody = JSON.parse(traceResponse.response.body || '{}');
assert.equal(traceBody.status, 'OK');
assert.equal(traceBody.trace.traceId, fixture.requestId);
assert.ok(traceBody.trace.fields.length >= attached.fieldObservability.fields.length);
assert.equal(JSON.stringify(traceBody.trace).includes('must-not-appear'), false);

const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const clientModel = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeFieldObservability.kt');
if (protocol !== null || clientModel !== null) {
  assert.ok(protocol?.includes('HeaderFieldObservability'));
  assert.ok(protocol?.includes('HeaderTraceId'));
  assert.ok(clientModel?.includes(VALORAE_FIELD_OBSERVABILITY_VERSION));
  assert.ok(clientModel?.includes('hiddenFromUi'));
}

assert.equal(fs.existsSync(new URL('../contracts/checkpoint107/field-observability.json', import.meta.url)), true);
console.log('field-observability-checkpoint107-v337 ok');
