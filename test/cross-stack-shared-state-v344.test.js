import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VALORAE_SHARED_STATE_POLICY, VALORAE_SHARED_STATE_VERSION, buildSharedStateManifest } from '../lib/state/shared-runtime-state.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const http = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const contract = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeSharedState.kt');
const manifest = buildSharedStateManifest();

assert.equal(VALORAE_SHARED_STATE_POLICY, 'memory-only-instance-state-v2');
assert.equal(manifest.driver, 'memory');
assert.equal(manifest.storage.table, null);
assert.equal(manifest.storage.migration, null);
assert.equal(manifest.guarantees.crossInstanceContractContinuity, false);
assert.equal(manifest.guarantees.atomicLeaseSupport, false);
assert.equal(manifest.guarantees.serviceRoleNeverExposedToApk, true);
assert.equal(fs.readdirSync(new URL('../supabase/', import.meta.url)).filter(name => name.endsWith('.sql')).length, 3);

if (protocol && http && contract) {
  assert.ok(contract.includes(VALORAE_SHARED_STATE_VERSION));
  assert.ok(contract.includes(VALORAE_SHARED_STATE_POLICY));
  assert.ok(!contract.includes('SUPABASE_SERVICE_ROLE_KEY'));
  assert.ok(protocol.includes('HeaderSharedStateAccept'));
  assert.ok(http.includes('sharedStateVersion = header(ValoraeMobileProtocol.HeaderSharedState)'));
}
console.log('cross-stack-shared-state memory-only v344 OK');
