import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  VALORAE_FORMAL_SCHEMA_IMPLEMENTATION,
  VALORAE_FORMAL_SCHEMA_POLICY,
  VALORAE_FORMAL_SCHEMA_VERSION,
  buildFormalSchemaManifest,
  formalRequestSchemaMode,
  formalSchemaMode,
  validateFormalContractPayload,
  validateFormalRequestPayload,
} from '../lib/contract/formal-schema-validation.js';
import { clearContractContinuityStore, stabilizeContractPayload } from '../lib/contract/continuity-store.js';
import { sendJson } from '../lib/core/http.js';
import { dispatchRoute, routeManifest } from '../routes/_router.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(pkg.dependencies.ajv, '^8.20.0');
assert.equal(formalSchemaMode(), 'guard-last-good');
assert.equal(formalRequestSchemaMode(), 'shadow');
assert.equal(VALORAE_FORMAL_SCHEMA_IMPLEMENTATION, 'ajv-8.20.0-strict-draft-2020-12');

const validAnalysis = {
  endpoint: 'analysis',
  contract: 'AnalysisPageResponse',
  ticker: 'PETR4',
  sections: [{ id: 'summary', items: [] }],
  sourceCoverage: [],
  dataQuality: {},
  summary: { readySections: 1 },
  missingSignals: [],
};
const valid = validateFormalContractPayload('analysis', validAnalysis);
assert.equal(valid.ok, true);
assert.match(valid.schemaId, /analysis\.schema\.json$/);

const invalidAnalysis = { ...validAnalysis, ticker: 1234 };
const invalid = validateFormalContractPayload('analysis', invalidAnalysis);
assert.equal(invalid.ok, false);
assert.ok(invalid.errors.some(error => error.instancePath === '/ticker' && error.keyword === 'type'));

const invalidRequest = validateFormalRequestPayload('/analysis', { ticker: { bad: true } });
assert.equal(invalidRequest.ok, false);
assert.equal(invalidRequest.direction, 'request');

clearContractContinuityStore();
const stored = stabilizeContractPayload('analysis', 'PETR4::page', validAnalysis);
assert.equal(stored.contractSchemaValidation.ok, true);
assert.equal(stored.contractSchemaValidation.canReplacePrevious, true);
const blocked = stabilizeContractPayload('analysis', 'PETR4::page', invalidAnalysis);
assert.equal(blocked.ticker, 'PETR4', 'ticker inválido não pode substituir o último payload válido');
assert.equal(blocked.contractSchemaValidation.ok, false);
assert.equal(blocked.contractSchemaValidation.previousPreserved, true);
assert.equal(blocked.contractSchemaValidation.canReplacePrevious, false);
assert.equal(blocked.contractBaseline.status, 'FORMAL_SCHEMA_BLOCKED_USING_LAST_GOOD');

clearContractContinuityStore();
const firstInvalid = stabilizeContractPayload('asset', 'broken::first', {
  ticker: 1234,
  status: 'OK',
  results: {},
});
assert.equal(firstInvalid.contractSchemaValidation.ok, false);
assert.equal(firstInvalid.contractSchemaValidation.previousPreserved, false);
assert.equal(firstInvalid.contractSchemaValidation.canReplacePrevious, false);
assert.equal(firstInvalid.contractBaseline.status, 'FORMAL_SCHEMA_INVALID_NO_BASELINE');

const manifest = buildFormalSchemaManifest();
assert.equal(manifest.version, VALORAE_FORMAL_SCHEMA_VERSION);
assert.equal(manifest.policyVersion, VALORAE_FORMAL_SCHEMA_POLICY);
assert.equal(manifest.draft, '2020-12');
assert.equal(manifest.strictMode, true);
assert.equal(manifest.guarantees.invalidResponseUsesLastGoodWhenAvailable, true);
assert.equal(manifest.guarantees.financialValuesNotCoerced, true);
assert.ok(manifest.catalog.response.analysis.id.includes('/analysis.schema.json'));
assert.ok(routeManifest().routes.includes('/contract/formal-schemas'));

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
      status(code) { this.statusCode = code; return this; },
      send(value) { return this.end(value); },
    },
    headers,
    json() { return JSON.parse(body || '{}'); },
  };
}

const routed = responseHarness();
await dispatchRoute({ method: 'GET', url: '/api/v1/contract/formal-schemas', headers: { 'x-request-id': 'cp112-manifest' } }, routed.response);
assert.equal(routed.response.statusCode, 200);
assert.equal(routed.headers.get('x-valorae-formal-schema'), VALORAE_FORMAL_SCHEMA_VERSION);
assert.equal(routed.json().version, VALORAE_FORMAL_SCHEMA_VERSION);

const a = responseHarness();
sendJson({ method: 'GET', url: '/api/v1/test', headers: {} }, a.response, {
  status: 'OK', value: 1, contractSchemaValidation: { version: VALORAE_FORMAL_SCHEMA_VERSION, ok: true, errorCount: 0 }
});
const b = responseHarness();
sendJson({ method: 'GET', url: '/api/v1/test', headers: {} }, b.response, {
  status: 'OK', value: 1, contractSchemaValidation: { version: VALORAE_FORMAL_SCHEMA_VERSION, ok: false, errorCount: 2 }
});
assert.equal(a.headers.get('etag'), b.headers.get('etag'), 'metadado formal volátil não pode fragmentar ETag financeiro');

console.log('formal-schema-checkpoint112-v342 ok');
