import assert from 'node:assert/strict';
import {
  VALORAE_SHARED_STATE_IMPLEMENTATION,
  VALORAE_SHARED_STATE_POLICY,
  VALORAE_SHARED_STATE_VERSION,
  acquireSharedLease,
  buildSharedStateManifest,
  getSharedState,
  releaseSharedLease,
  resetSharedStateForTests,
  setSharedState,
  sharedStateDriverInfo,
  sharedStateStats,
} from '../lib/state/shared-runtime-state.js';
import {
  clearContractContinuityStore,
  stabilizeContractPayloadShared,
} from '../lib/contract/continuity-store.js';
import {
  getProviderHealthSnapshot,
  hydrateProviderHealthFromSharedState,
  recordProviderResult,
  resetProviderHealth,
} from '../lib/resilience/circuit-breaker.js';
import {
  clearFailureCache,
  getFailureCacheShared,
  setFailureCache,
} from '../lib/resilience/failure-cache.js';
import { dispatchRoute, routeManifest } from '../routes/_router.js';

const originalFetch = globalThis.fetch;
const envKeys = [
  'VALORAE_SHARED_STATE_ENABLED',
  'VALORAE_SHARED_STATE_MODE',
  'VALORAE_SHARED_STATE_SCOPE',
  'VALORAE_SHARED_STATE_REMOTE_TIMEOUT_MS',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];
const savedEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

try {
  process.env.VALORAE_SHARED_STATE_ENABLED = '1';
  process.env.VALORAE_SHARED_STATE_MODE = 'memory';
  process.env.VALORAE_SHARED_STATE_SCOPE = 'test-cp114';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  await resetSharedStateForTests();
  resetProviderHealth();
  clearContractContinuityStore();
  clearFailureCache();

  const manifest = buildSharedStateManifest();
  assert.equal(manifest.version, VALORAE_SHARED_STATE_VERSION);
  assert.equal(manifest.policyVersion, VALORAE_SHARED_STATE_POLICY);
  assert.equal(manifest.implementation, VALORAE_SHARED_STATE_IMPLEMENTATION);
  assert.equal(manifest.hiddenFromUi, true);
  assert.equal(manifest.guarantees.crossInstanceContractContinuity, true);
  assert.equal(manifest.guarantees.crossInstanceProviderHealth, true);
  assert.equal(manifest.guarantees.atomicLeaseSupport, true);
  assert.equal(manifest.guarantees.financialPayloadShapeUnchanged, true);
  assert.equal(manifest.rollback.memoryOnly, 'VALORAE_SHARED_STATE_MODE=memory');
  assert.equal(sharedStateDriverInfo().driver, 'memory');

  const stored = await setSharedState('test-state', 'alpha', { ok: true, count: 1 }, { ttlMs: 5000 });
  assert.equal(stored.stored, true);
  const local = await getSharedState('test-state', 'alpha');
  assert.deepEqual(local.value, { ok: true, count: 1 });
  assert.equal(local.source, 'memory');

  const leaseOne = await acquireSharedLease('canary', 'asset-petr4', { owner: 'instance-a', ttlMs: 5000 });
  const leaseTwo = await acquireSharedLease('canary', 'asset-petr4', { owner: 'instance-b', ttlMs: 5000 });
  assert.equal(leaseOne.acquired, true);
  assert.equal(leaseTwo.acquired, false);
  assert.equal((await releaseSharedLease('canary', 'asset-petr4', { owner: 'instance-a' })).released, true);
  assert.equal((await acquireSharedLease('canary', 'asset-petr4', { owner: 'instance-b', ttlMs: 5000 })).acquired, true);

  // O último contrato válido sobrevive à limpeza do store local graças ao namespace compartilhado.
  const previousAnalysis = {
    endpoint: 'analysis', contract: 'AnalysisPageResponse', ticker: 'PETR4',
    sections: [{ id: 'summary', items: [{ label: 'Cotação', value: 'R$ 38,99' }] }],
    sourceCoverage: [{ id: 'quote', status: 'ready' }], dataQuality: { coveragePercent: 100 },
    summary: { readySections: 1 }, consumerContract: { version: 'v1' }, missingSignals: [],
  };
  const regressedAnalysis = {
    endpoint: 'analysis', contract: 'AnalysisPageResponse', ticker: 'PETR4',
    sections: [], sourceCoverage: [], dataQuality: {}, summary: {}, consumerContract: null, missingSignals: [],
  };
  const first = await stabilizeContractPayloadShared('analysis', 'PETR4::page', previousAnalysis);
  assert.equal(first.contractBaseline.status, 'COMPATIBLE');
  await sleep(0);
  clearContractContinuityStore();
  const recovered = await stabilizeContractPayloadShared('analysis', 'PETR4::page', regressedAnalysis);
  assert.deepEqual(recovered.sections, previousAnalysis.sections);
  assert.equal(recovered.contractBaseline.regressionBlocked, true);

  // Circuit breaker compartilhado: estado degradado é reidratado após reset local.
  for (let i = 0; i < 4; i += 1) recordProviderResult('Investidor10', false, { status: 503, retryable: true, error: 'fixture' });
  await sleep(60);
  assert.equal(getProviderHealthSnapshot().Investidor10.status, 'degraded');
  resetProviderHealth('Investidor10');
  assert.equal(getProviderHealthSnapshot().Investidor10.status, 'healthy');
  const hydration = await hydrateProviderHealthFromSharedState(['Investidor10'], { force: true });
  assert.equal(hydration.hits, 1);
  assert.equal(getProviderHealthSnapshot().Investidor10.status, 'degraded');

  // Cache negativo curto também é recuperado do estado compartilhado.
  const failureKey = 'https://investidor10.com.br/acoes/petr4/::fixture';
  setFailureCache(failureKey, { ok: false, status: 503, error: 'temporário' }, 5000);
  await sleep(0);
  clearFailureCache();
  const sharedFailure = await getFailureCacheShared(failureKey);
  assert.equal(sharedFailure.ok, false);
  assert.equal(sharedFailure.cache, 'SHARED_NEGATIVE_HIT');
  assert.equal(sharedFailure.network.sharedFailureCache, true);

  // Driver Supabase realista: REST, hidratação e RPC de lease, sem expor a service role.
  await resetSharedStateForTests();
  process.env.VALORAE_SHARED_STATE_MODE = 'supabase';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-fixture';
  process.env.VALORAE_SHARED_STATE_REMOTE_TIMEOUT_MS = '2000';
  const remoteRows = new Map();
  let rpcOwner = null;
  globalThis.fetch = async (url, init = {}) => {
    assert.equal(init.headers.apikey, 'service-role-fixture');
    assert.equal(init.headers.authorization, 'Bearer service-role-fixture');
    const parsed = new URL(String(url));
    if (parsed.pathname.endsWith('/rpc/valorae_shared_state_put')) {
      const body = JSON.parse(init.body);
      const mapKey = `${body.p_scope}:${body.p_namespace}:${body.p_state_key}`;
      const existing = remoteRows.get(mapKey);
      const stored = !existing
        || Number(existing.version || 0) < Number(body.p_version || 0)
        || (Number(existing.version || 0) === Number(body.p_version || 0) && existing.checksum === body.p_checksum);
      if (stored) {
        remoteRows.set(mapKey, {
          scope: body.p_scope,
          namespace: body.p_namespace,
          state_key: body.p_state_key,
          value: body.p_value,
          version: body.p_version,
          checksum: body.p_checksum,
          owner: body.p_owner,
          created_at: body.p_created_at,
          updated_at: body.p_updated_at,
          expires_at: body.p_expires_at,
        });
      }
      return new Response(JSON.stringify({ stored, ...remoteRows.get(mapKey) }), { status: 200 });
    }
    if (parsed.pathname.endsWith('/rpc/valorae_shared_state_acquire_lease')) {
      const body = JSON.parse(init.body);
      if (!rpcOwner || rpcOwner === body.p_owner) rpcOwner = body.p_owner;
      return new Response(JSON.stringify([{ acquired: rpcOwner === body.p_owner, owner: rpcOwner, expires_at: new Date(Date.now() + 5000).toISOString() }]), { status: 200 });
    }
    if (parsed.pathname.endsWith('/rpc/valorae_shared_state_release_lease')) {
      const body = JSON.parse(init.body);
      const released = rpcOwner === body.p_owner;
      if (released) rpcOwner = null;
      return new Response(JSON.stringify(released), { status: 200 });
    }
    if (init.method === 'POST') {
      const row = JSON.parse(init.body);
      remoteRows.set(`${row.scope}:${row.namespace}:${row.state_key}`, row);
      return new Response('', { status: 201 });
    }
    if (init.method === 'GET') {
      const scope = String(parsed.searchParams.get('scope') || '').replace(/^eq\./, '');
      const namespace = String(parsed.searchParams.get('namespace') || '').replace(/^eq\./, '');
      const stateKey = String(parsed.searchParams.get('state_key') || '').replace(/^eq\./, '');
      const row = remoteRows.get(`${scope}:${namespace}:${stateKey}`);
      return new Response(JSON.stringify(row ? [row] : []), { status: 200 });
    }
    return new Response('', { status: 204 });
  };

  const remoteSet = await setSharedState('remote-test', 'beta', { source: 'remote' }, { ttlMs: 5000 });
  assert.equal(remoteSet.remoteStored, true);
  const staleSet = await setSharedState('remote-test', 'beta', { source: 'stale' }, { ttlMs: 5000, version: remoteSet.record.version - 1 });
  assert.equal(staleSet.remoteStored, false);
  assert.equal(staleSet.warning, 'SHARED_STATE_STALE_WRITE_REJECTED');
  assert.deepEqual(staleSet.record.value, { source: 'remote' });
  await resetSharedStateForTests();
  const remoteGet = await getSharedState('remote-test', 'beta');
  assert.deepEqual(remoteGet.value, { source: 'remote' });
  assert.equal(remoteGet.source, 'supabase');
  const sharedLeaseA = await acquireSharedLease('canary', 'remote', { owner: 'remote-a', ttlMs: 5000, requireShared: true });
  const sharedLeaseB = await acquireSharedLease('canary', 'remote', { owner: 'remote-b', ttlMs: 5000, requireShared: true });
  assert.equal(sharedLeaseA.acquired, true);
  assert.equal(sharedLeaseA.shared, true);
  assert.equal(sharedLeaseB.acquired, false);
  assert.equal((await releaseSharedLease('canary', 'remote', { owner: 'remote-a' })).released, true);
  assert.ok(sharedStateStats().metrics.remoteReads >= 1);

  globalThis.fetch = originalFetch;
  process.env.VALORAE_SHARED_STATE_MODE = 'memory';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  await resetSharedStateForTests();

  const routed = responseHarness();
  await dispatchRoute({ method: 'GET', url: '/api/v1/contract/shared-state', headers: { 'x-request-id': 'cp114-shared' } }, routed.response);
  assert.equal(routed.response.statusCode, 200);
  assert.equal(routed.headers.get('x-valorae-shared-state'), VALORAE_SHARED_STATE_VERSION);
  assert.equal(routed.json().version, VALORAE_SHARED_STATE_VERSION);
  assert.ok(routeManifest().routes.includes('/contract/shared-state'));
} finally {
  globalThis.fetch = originalFetch;
  resetProviderHealth();
  clearContractContinuityStore();
  clearFailureCache();
  await resetSharedStateForTests();
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
}

console.log('shared-state-checkpoint114-v344 ok');
