import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sendJson } from '../lib/core/http.js';
import { extractSelectorsWithDynamicFallback } from '../lib/scrape/selector-engine.js';
import {
  VALORAE_REAL_CANARY_IMPLEMENTATION,
  VALORAE_REAL_CANARY_POLICY,
  VALORAE_REAL_CANARY_VERSION,
  _test,
  buildRealCanaryManifest,
  realCanaryStats,
  resetRealCanaryStateForTests,
  runRealCanary,
} from '../lib/canary/real-canary.js';
import { acquireSharedLease, releaseSharedLease, resetSharedStateForTests } from '../lib/state/shared-runtime-state.js';
import { dispatchRoute, routeManifest } from '../routes/_router.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const previous = { ...process.env };
process.env.VALORAE_SHARED_STATE_MODE = 'memory';
process.env.VALORAE_REAL_CANARY_ENABLED = '1';
process.env.VALORAE_REAL_CANARY_MODE = 'safe-promote';
process.env.VALORAE_REAL_CANARY_MAX_RUNS_PER_MINUTE = '120';
process.env.VALORAE_REAL_CANARY_CIRCUIT_FAILURES = '3';
process.env.VALORAE_DYNAMIC_RENDER_ENABLED = '0';
await resetSharedStateForTests();
resetRealCanaryStateForTests();

const additive = await runRealCanary({
  endpoint: 'scrape',
  identity: 'fixture-additive',
  forceSelected: true,
  allowedKeys: ['price', 'sector'],
  baselineResults: { price: ['R$ 10,00'], sector: [] },
  candidates: [
    { pipeline: 'standards-html', results: { price: ['R$ 999,00'], sector: ['Energia'], injected: ['não permitido'] } },
    { pipeline: 'structured-data', results: { sector: ['Outro setor'] } },
  ],
});
assert.equal(additive.diagnostics.promoted, true);
assert.deepEqual(additive.results.price, ['R$ 10,00'], 'canário não pode sobrescrever valor legado');
assert.deepEqual(additive.results.sector, ['Energia']);
assert.equal(additive.results.injected, undefined, 'somente chaves declaradas podem entrar');
assert.deepEqual(additive.diagnostics.gainedKeys, ['sector']);
assert.equal(additive.diagnostics.provenance.sector, 'standards-html');

const stableDecisionA = _test.selection('scrape', 'same-real-request');
const stableDecisionB = _test.selection('scrape', 'same-real-request');
assert.equal(stableDecisionA.identityHash, stableDecisionB.identityHash);
assert.equal(stableDecisionA.bucket, stableDecisionB.bucket, 'a mesma identidade precisa permanecer na mesma coorte');

const pollutionPayload = JSON.parse('{"__proto__":{"polluted":true},"sector":["Energia"]}');
const pollutionSafe = await runRealCanary({
  endpoint: 'scrape', identity: 'fixture-prototype', forceSelected: true,
  allowedKeys: ['__proto__', 'sector'], baselineResults: { sector: [] },
  candidates: [{ pipeline: 'standards-html', results: pollutionPayload }],
});
assert.deepEqual(pollutionSafe.results.sector, ['Energia']);
assert.equal(Object.prototype.polluted, undefined, 'prototype pollution não pode escapar do candidato');

process.env.VALORAE_REAL_CANARY_MODE = 'shadow';
const shadow = await runRealCanary({
  endpoint: 'scrape',
  identity: 'fixture-shadow',
  forceSelected: true,
  allowedKeys: ['sector'],
  baselineResults: { sector: [] },
  candidates: [{ pipeline: 'structured-data', results: { sector: ['Energia'] } }],
});
assert.equal(shadow.diagnostics.promoted, false);
assert.equal(shadow.diagnostics.reason, 'shadow-only');
assert.deepEqual(shadow.results.sector, []);
assert.deepEqual(shadow.diagnostics.gainedKeys, ['sector']);

process.env.VALORAE_REAL_CANARY_MODE = 'safe-promote';
const unsafe = await runRealCanary({
  endpoint: 'scrape',
  identity: 'fixture-unsafe',
  forceSelected: true,
  allowedKeys: ['value'],
  baselineResults: { value: [] },
  candidates: [{ pipeline: 'standards-html', results: { value: [Number.POSITIVE_INFINITY] } }],
});
assert.equal(unsafe.diagnostics.promoted, false);
assert.deepEqual(unsafe.results.value, []);
assert.ok(unsafe.diagnostics.rejected.some(item => item.reason === 'non-finite-number'));

const hash = _test.identityHash('scrape', 'fixture-lease');
const leaseKey = `scrape-${hash.slice(0, 32)}`;
const held = await acquireSharedLease('real-canary', leaseKey, { owner: 'held-by-test', ttlMs: 5000 });
assert.equal(held.acquired, true);
const leaseRejected = await runRealCanary({
  endpoint: 'scrape',
  identity: 'fixture-lease',
  forceSelected: true,
  allowedKeys: ['sector'],
  baselineResults: { sector: [] },
  candidates: [{ pipeline: 'standards-html', results: { sector: ['Energia'] } }],
});
assert.equal(leaseRejected.diagnostics.reason, 'lease-not-acquired');
assert.deepEqual(leaseRejected.results.sector, []);
await releaseSharedLease('real-canary', leaseKey, { owner: 'held-by-test' });

const malformedHtml = '<table id="indicators"><tr class="indicator"><td>P/L<td>8,42</tr></table>';
const integrated = await extractSelectorsWithDynamicFallback(
  malformedHtml,
  { row: { selector: '#indicators > tbody > tr.indicator', extract: 'cells' } },
  { maxSelectors: 10, maxPerSelector: 10, forceRealCanary: true, realCanaryEndpoint: 'scrape' },
  { url: 'https://investidor10.com.br/acoes/petr4/', provider: 'direct', blocked: false },
);
assert.equal(integrated.realCanary.selected, true);
assert.equal(integrated.realCanary.promoted, true);
assert.equal(integrated.strategy, 'real-canary-gap-fill');
assert.deepEqual(integrated.results.row, [['P/L', '8,42']]);

process.env.VALORAE_REAL_CANARY_MODE = 'safe-promote';
process.env.VALORAE_REAL_CANARY_MAX_VALUE_BYTES = '8000';
for (let index = 0; index < 3; index += 1) {
  const blocked = await runRealCanary({
    endpoint: 'batch-scrape', identity: `fixture-circuit-${index}`, forceSelected: true,
    allowedKeys: ['large'], baselineResults: { large: [] },
    candidates: [{ pipeline: 'structured-data', results: { large: ['x'.repeat(9000)] } }],
  });
  assert.equal(blocked.diagnostics.reason, 'payload-oversize');
}
const circuitOpen = await runRealCanary({
  endpoint: 'batch-scrape', identity: 'fixture-circuit-open', forceSelected: true,
  allowedKeys: ['sector'], baselineResults: { sector: [] },
  candidates: [{ pipeline: 'standards-html', results: { sector: ['Energia'] } }],
});
assert.equal(circuitOpen.diagnostics.reason, 'circuit-open');
delete process.env.VALORAE_REAL_CANARY_MAX_VALUE_BYTES;

const manifest = buildRealCanaryManifest();
assert.equal(manifest.version, VALORAE_REAL_CANARY_VERSION);
assert.equal(manifest.policyVersion, VALORAE_REAL_CANARY_POLICY);
assert.equal(manifest.implementation, VALORAE_REAL_CANARY_IMPLEMENTATION);
assert.equal(manifest.safety.legacyValuesNeverOverwritten, true);
assert.equal(manifest.safety.circuitBreakerSharedAcrossInstances, true);
assert.ok(routeManifest().routes.includes('/contract/real-canaries'));
assert.ok(realCanaryStats().promotions >= 2);

function responseHarness() {
  const headers = new Map();
  let body = '';
  return {
    response: {
      statusCode: 200, writableEnded: false,
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
assert.equal(direct.headers.get('x-valorae-real-canary'), VALORAE_REAL_CANARY_VERSION);

const routed = responseHarness();
await dispatchRoute({ method: 'GET', url: '/api/v1/contract/real-canaries', headers: { 'x-request-id': 'cp115-manifest' } }, routed.response);
assert.equal(routed.response.statusCode, 200);
assert.equal(routed.json().version, VALORAE_REAL_CANARY_VERSION);
assert.equal(routed.headers.get('x-valorae-real-canary'), VALORAE_REAL_CANARY_VERSION);

assert.ok(fs.existsSync(new URL('../contracts/checkpoint115/real-canaries.json', import.meta.url)));
const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const clientContract = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeRealCanary.kt');
const clientHttp = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
if (protocol !== null || clientContract !== null || clientHttp !== null) {
  assert.ok(protocol?.includes('HeaderRealCanary'));
  assert.ok(protocol?.includes('HeaderRealCanaryAccept'));
  assert.ok(clientContract?.includes(VALORAE_REAL_CANARY_VERSION));
  assert.ok(clientContract?.includes('legacyValuesNeverOverwritten'));
  assert.ok(clientHttp?.includes('ValoraeRealCanaryContract.PolicyVersion'));
}

process.env = previous;
await resetSharedStateForTests();
resetRealCanaryStateForTests();
console.log('real-canaries-checkpoint115-v345 ok');
