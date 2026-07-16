import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VALORAE_FINAL_DECOMPOSITION_IMPLEMENTATION,
  VALORAE_FINAL_DECOMPOSITION_POLICY,
  VALORAE_FINAL_DECOMPOSITION_VERSION,
  buildFinalDecompositionManifest,
  finalDecompositionModules,
} from '../lib/architecture/final-decomposition.js';
import {
  buildProviderTransportManifest,
  providerNameForUrl,
  resolveProviderTransportProfile,
} from '../lib/http/provider-transport.js';
import {
  acquireSharedLease,
  getSharedState,
  releaseSharedLease,
  resetSharedStateForTests,
  setSharedState,
} from '../lib/state/shared-runtime-state.js';
import {
  resetRealCanaryStateForTests,
  runRealCanary,
} from '../lib/canary/real-canary.js';
import { sendJson } from '../lib/core/http.js';
import { dispatchRoute, routeManifest } from '../routes/_router.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previous = { ...process.env };
process.env.VALORAE_SHARED_STATE_MODE = 'memory';
process.env.VALORAE_REAL_CANARY_ENABLED = '1';
process.env.VALORAE_REAL_CANARY_MODE = 'safe-promote';
process.env.VALORAE_REAL_CANARY_MAX_RUNS_PER_MINUTE = '120';
await resetSharedStateForTests();
resetRealCanaryStateForTests();

const manifest = buildFinalDecompositionManifest();
assert.equal(manifest.version, VALORAE_FINAL_DECOMPOSITION_VERSION);
assert.equal(manifest.policyVersion, VALORAE_FINAL_DECOMPOSITION_POLICY);
assert.equal(manifest.implementation, VALORAE_FINAL_DECOMPOSITION_IMPLEMENTATION);
assert.equal(manifest.scope.completed, true);
assert.equal(manifest.scope.moduleCount, 3);
assert.equal(manifest.scope.internalModuleCount, 4);
assert.equal(manifest.invariants.facadeImportPathsPreserved, true);
assert.equal(manifest.invariants.financialPayloadShapeUnchanged, true);
assert.equal(manifest.dependencyRules.circularDependenciesForbidden, true);

const modules = finalDecompositionModules();
const requiredFacades = new Map([
  ['lib/http/provider-transport.js', ['providerFetch', 'providerNameForUrl', 'resolveProviderTransportProfile', 'providerTransportStats', 'buildProviderTransportManifest', 'resetProviderTransportForTests']],
  ['lib/state/shared-runtime-state.js', ['getSharedState', 'setSharedState', 'deleteSharedState', 'acquireSharedLease', 'releaseSharedLease', 'sharedStateDriverInfo', 'sharedStateStats', 'buildSharedStateManifest']],
  ['lib/canary/real-canary.js', ['runRealCanary', 'realCanaryMode', 'realCanaryStats', 'buildRealCanaryManifest', 'resetRealCanaryStateForTests']],
]);
for (const module of modules) {
  assert.ok(fs.existsSync(path.join(root, module.facade)), `fachada ausente: ${module.facade}`);
  for (const internal of module.internals) {
    const full = path.join(root, internal);
    assert.ok(fs.existsSync(full), `módulo interno ausente: ${internal}`);
    const source = fs.readFileSync(full, 'utf8');
    assert.doesNotMatch(source, /from\s+['"]\.\.\/\.\.\/routes\//, `${internal} não pode importar rotas`);
  }
  const imported = await import(new URL(`../${module.facade}`, import.meta.url));
  for (const exported of requiredFacades.get(module.facade) || []) {
    assert.equal(typeof imported[exported], 'function', `export público perdido: ${module.facade}#${exported}`);
  }
}

const purePolicyFiles = [
  'lib/http/provider-transport-profile.js',
  'lib/canary/real-canary-policy.js',
];
for (const relative of purePolicyFiles) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(/, `${relative} precisa permanecer sem I/O de rede`);
  assert.doesNotMatch(source, /\bPool\s*\(/, `${relative} não pode criar pool`);
}

function localImports(relative) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const found = [];
  const regex = /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(source))) {
    if (!match[1].startsWith('.')) continue;
    let target = path.normalize(path.join(path.dirname(relative), match[1]));
    if (!path.extname(target)) target += '.js';
    if (fs.existsSync(path.join(root, target))) found.push(target.replaceAll('\\', '/'));
  }
  return found;
}

const graphFiles = [...new Set(modules.flatMap(module => [module.facade, ...module.internals]))];
const graphSet = new Set(graphFiles);
const graph = new Map(graphFiles.map(file => [file, localImports(file).filter(item => graphSet.has(item))]));
const visiting = new Set();
const visited = new Set();
function visit(node, stack = []) {
  if (visiting.has(node)) throw new Error(`dependência circular: ${[...stack, node].join(' -> ')}`);
  if (visited.has(node)) return;
  visiting.add(node);
  for (const child of graph.get(node) || []) visit(child, [...stack, node]);
  visiting.delete(node);
  visited.add(node);
}
for (const file of graphFiles) visit(file);
assert.equal(visited.size, graphFiles.length);

assert.equal(providerNameForUrl('https://query1.finance.yahoo.com/v8/finance/chart/PETR4.SA'), 'yahoo');
assert.equal(resolveProviderTransportProfile('https://investidor10.com.br/acoes/petr4/').provider, 'investidor10');
assert.equal(buildProviderTransportManifest().guarantees.financialPayloadShapeUnchanged, true);

const stored = await setSharedState('checkpoint116', 'facade', { ok: true }, { ttlMs: 5000 });
assert.equal(stored.ok, true);
assert.deepEqual((await getSharedState('checkpoint116', 'facade'))?.value, { ok: true });
const lease = await acquireSharedLease('checkpoint116', 'lease', { owner: 'cp116-test', ttlMs: 5000 });
assert.equal(lease.acquired, true);
assert.equal((await releaseSharedLease('checkpoint116', 'lease', { owner: 'cp116-test' })).released, true);

const canary = await runRealCanary({
  endpoint: 'scrape',
  identity: 'checkpoint116-decomposition',
  forceSelected: true,
  allowedKeys: ['price', 'sector'],
  baselineResults: { price: ['R$ 10,00'], sector: [] },
  candidates: [{ pipeline: 'standards-html', results: { price: ['R$ 999,00'], sector: ['Energia'] } }],
});
assert.deepEqual(canary.results.price, ['R$ 10,00']);
assert.deepEqual(canary.results.sector, ['Energia']);
assert.equal(canary.diagnostics.promoted, true);

function responseHarness() {
  const headers = new Map();
  let body = '';
  return {
    response: {
      statusCode: 200,
      writableEnded: false,
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
assert.equal(direct.headers.get('x-valorae-final-decomposition'), VALORAE_FINAL_DECOMPOSITION_VERSION);
assert.ok(routeManifest().routes.includes('/contract/final-decomposition'));
const routed = responseHarness();
await dispatchRoute({ method: 'GET', url: '/api/v1/contract/final-decomposition', headers: { 'x-request-id': 'cp116-manifest' } }, routed.response);
assert.equal(routed.response.statusCode, 200);
assert.equal(routed.json().version, VALORAE_FINAL_DECOMPOSITION_VERSION);
assert.equal(routed.headers.get('x-valorae-final-decomposition'), VALORAE_FINAL_DECOMPOSITION_VERSION);
assert.ok(fs.existsSync(path.join(root, 'contracts/checkpoint116/final-decomposition.json')));

const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const clientContract = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeFinalDecomposition.kt');
const clientHttp = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const endpointCatalog = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeProxyEndpointCatalog.kt');
if (protocol !== null || clientContract !== null || clientHttp !== null || endpointCatalog !== null) {
  assert.ok(protocol?.includes('HeaderFinalDecomposition'));
  assert.ok(protocol?.includes('HeaderFinalDecompositionAccept'));
  assert.ok(clientContract?.includes(VALORAE_FINAL_DECOMPOSITION_VERSION));
  assert.ok(clientContract?.includes('facadeImportPathsPreserved'));
  assert.ok(clientHttp?.includes('ValoraeFinalDecompositionContract.PolicyVersion'));
  assert.ok(endpointCatalog?.includes('/api/v1/contract/final-decomposition'));
}

process.env = previous;
await resetSharedStateForTests();
resetRealCanaryStateForTests();
console.log('final-decomposition-checkpoint116-v346 ok');
