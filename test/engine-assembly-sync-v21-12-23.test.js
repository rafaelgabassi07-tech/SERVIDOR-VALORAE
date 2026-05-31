import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ValoraeEngine, runValoraeSelfTest } from '../lib/Valorae-engine.js';
import { performanceCapabilities } from '../lib/performance/profile.js';

const engine = fs.readFileSync('lib/Valorae-engine.js', 'utf8');
for (const needle of [
  'resolveEngineAssemblyPlan',
  '21.12.23-engine-assembly-sync',
  'buildLiteConsumerDiagnostics',
  'buildLiteAppRenderContract',
  'appRootsAlwaysBuilt',
  'lightweightMobileContracts',
  'forceLiteContracts',
  'appSynchronizedAssembly',
]) assert.ok(engine.includes(needle), `Valorae-engine.js deve conter ${needle}`);

assert.ok(engine.includes("payload.appPayload = buildAppConsumerPayload(payload);"), 'appPayload deve continuar sendo gerado');
assert.ok(engine.includes("payload.appSyncEnvelope = buildAppSyncEnvelope(payload);"), 'appSyncEnvelope deve continuar sendo gerado');
assert.ok(engine.includes("payload.appMobileSnapshot = buildAppMobileSnapshot(payload);"), 'appMobileSnapshot deve continuar sendo gerado');
assert.ok(engine.includes("payload.appResponseIntegrity = buildAppResponseIntegrity(payload);"), 'appResponseIntegrity deve continuar sendo gerado');
assert.ok(engine.indexOf('payload.appPayload = buildAppConsumerPayload(payload);') < engine.indexOf('payload.appSyncEnvelope = buildAppSyncEnvelope(payload);'), 'sync deve ser montado depois do appPayload');
assert.ok(engine.indexOf('payload.appSyncEnvelope = buildAppSyncEnvelope(payload);') < engine.indexOf('payload.appMobileSnapshot = buildAppMobileSnapshot(payload);'), 'snapshot deve referenciar sync já montado');

const types = fs.readFileSync('lib/engine/Valorae-engine-types.ts', 'utf8');
assert.ok(types.includes('engineAssembly'), 'tipos devem expor metrics.engineAssembly');
assert.ok(types.includes("contracts?: 'auto' | 'lite' | 'full' | string"), 'opções devem aceitar contracts');

const html = fs.readFileSync('public/server.html', 'utf8');
assert.equal(html, fs.readFileSync('public/index.html', 'utf8'), 'index deve espelhar server.html');
for (const needle of ['Engine e sincronização', 'performancePolicyBox', 'engineAssemblyBox', 'Modo compacto', 'contratos leves para mobile/watchlist']) {
  assert.ok(html.includes(needle), `monitor deve mostrar ${needle}`);
}

const caps = performanceCapabilities();
assert.match(caps.version, /21\.12\.(23|42|43|44|45|46|47|48|49|50|51|52|54|55|56|57|57|57)-/);
assert.ok(caps.queryParams.some(x => x.includes('contracts=full|lite|auto')), 'capabilities devem documentar contracts');

const self = runValoraeSelfTest();
assert.equal(self.ok, true, 'self-test do engine deve continuar saudável');
assert.equal(ValoraeEngine.version, '21.12.0', 'contrato público do engine permanece estável');

console.log('engine-assembly-sync-v21-12-23 ok');
