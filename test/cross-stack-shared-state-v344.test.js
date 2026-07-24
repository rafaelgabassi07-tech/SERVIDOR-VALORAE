import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  VALORAE_SHARED_STATE_POLICY,
  VALORAE_SHARED_STATE_VERSION,
} from '../lib/state/shared-runtime-state.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const http = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const contract = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeSharedState.kt');
const catalog = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeProxyEndpointCatalog.kt');
const build = readSiblingApkFile('app/build.gradle.kts');
const migration = readSiblingApkFile('supabase/valorae_runtime_shared_state_checkpoint114.sql');

if (protocol && http && contract && catalog && build && migration) {
  assert.ok(contract.includes(VALORAE_SHARED_STATE_VERSION));
  assert.ok(contract.includes(VALORAE_SHARED_STATE_POLICY));
  assert.ok(contract.includes('serviceRoleNeverExposedToApk'));
  assert.ok(!contract.includes('SUPABASE_SERVICE_ROLE_KEY'));
  assert.ok(protocol.includes('HeaderSharedStateAccept'));
  assert.ok(protocol.includes('HeaderSharedState'));
  assert.ok(http.includes(`ValoraeSharedStateContract.PolicyVersion`));
  assert.ok(http.includes('sharedStateVersion = header(ValoraeMobileProtocol.HeaderSharedState)'));
  assert.ok(http.includes('fun sharedState()'));
  assert.ok(catalog.includes('/api/v1/contract/shared-state'));
  assert.ok(build.includes('versionCode = 26072305'));
  assert.ok(build.includes('versionName = "2026.07.23.05"'));
  assert.ok(migration.includes('valorae_runtime_shared_state'));
  assert.ok(migration.includes('valorae_shared_state_put'));
  assert.ok(migration.includes('valorae_shared_state_acquire_lease'));
}

assert.ok(fs.existsSync(new URL('./test/shared-state-checkpoint114-v344.test.js', new URL('../', import.meta.url))));
assert.ok(fs.existsSync(new URL('./supabase/004_valorae_runtime_shared_state_checkpoint114.sql', new URL('../', import.meta.url))));
console.log('cross-stack-shared-state-v344 ok');
