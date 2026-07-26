import assert from 'node:assert/strict';
import fs from 'node:fs';
import { monitorPersistenceConfig } from '../lib/observability/monitor-persistence.js';
import { sharedStateDriver, sharedStateMode, remoteAllowed } from '../lib/state/shared-state-foundation.js';

const keys=['VALORAE_SHARED_STATE_ENABLED','VALORAE_SHARED_STATE_MODE','VALORAE_SHARED_STATE_REMOTE_ENABLED','VALORAE_MONITOR_PERSISTENCE_ENABLED','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
try {
  process.env.VALORAE_SHARED_STATE_ENABLED='1';
  process.env.VALORAE_SHARED_STATE_MODE='supabase';
  process.env.VALORAE_SHARED_STATE_REMOTE_ENABLED='1';
  process.env.VALORAE_MONITOR_PERSISTENCE_ENABLED='1';
  process.env.SUPABASE_URL='https://resource-guard.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY='resource-guard';
  assert.equal(sharedStateMode(),'memory');
  assert.equal(sharedStateDriver(),'memory');
  assert.equal(remoteAllowed(),false);
  const monitor=monitorPersistenceConfig();
  assert.equal(monitor.requested,true);
  assert.equal(monitor.enabled,false);
  assert.equal(monitor.active,false);

  const route=fs.readFileSync(new URL('../routes/sync.js',import.meta.url),'utf8');
  const runtimeSection=route.slice(0,route.indexOf('export const _test'));
  assert.doesNotMatch(runtimeSection,/\/rest\/v1\/(?:valorae_user_snapshots|valorae_sync_backups|valorae_monitor_events|valorae_runtime_shared_state|valorae_sync_clients)/);
  for(const table of ['valorae_financial_transactions','valorae_financial_dividends']) assert.match(route,new RegExp(table));
} finally {
  for(const k of keys){ if(saved[k]===undefined) delete process.env[k]; else process.env[k]=saved[k]; }
}
console.log('minimal Supabase resource isolation v363 OK');
