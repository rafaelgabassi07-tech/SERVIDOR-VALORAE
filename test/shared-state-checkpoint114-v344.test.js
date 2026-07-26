import assert from 'node:assert/strict';
import {
  acquireSharedLease,
  buildSharedStateManifest,
  getSharedState,
  releaseSharedLease,
  resetSharedStateForTests,
  setSharedState,
  sharedStateDriverInfo,
  sharedStateStats,
} from '../lib/state/shared-runtime-state.js';
import { sharedStateDriver, sharedStateMode, remoteAllowed } from '../lib/state/shared-state-foundation.js';

const keys=['VALORAE_SHARED_STATE_ENABLED','VALORAE_SHARED_STATE_MODE','VALORAE_SHARED_STATE_REMOTE_ENABLED','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
const oldFetch=globalThis.fetch;
let fetchCalls=0;
try {
  process.env.VALORAE_SHARED_STATE_ENABLED='1';
  process.env.VALORAE_SHARED_STATE_MODE='supabase';
  process.env.VALORAE_SHARED_STATE_REMOTE_ENABLED='1';
  process.env.SUPABASE_URL='https://must-not-be-used.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY='must-not-be-used';
  globalThis.fetch=async()=>{ fetchCalls+=1; throw new Error('remote shared state forbidden'); };
  await resetSharedStateForTests();

  assert.equal(sharedStateMode(),'memory');
  assert.equal(sharedStateDriver(),'memory');
  assert.equal(remoteAllowed(),false);
  assert.equal(sharedStateDriverInfo().driver,'memory');
  const manifest=buildSharedStateManifest();
  assert.equal(manifest.hiddenFromUi,true);
  assert.equal(manifest.rollback.memoryOnly,'VALORAE_SHARED_STATE_MODE=memory');

  const stored=await setSharedState('minimal-test','alpha',{ok:true},{ttlMs:5000});
  assert.equal(stored.stored,true);
  assert.equal(stored.remoteStored,false);
  assert.equal(stored.driver,'memory');
  const read=await getSharedState('minimal-test','alpha');
  assert.deepEqual(read.value,{ok:true});
  assert.equal(read.source,'memory');

  const a=await acquireSharedLease('minimal-lease','same',{owner:'a',ttlMs:5000});
  const b=await acquireSharedLease('minimal-lease','same',{owner:'b',ttlMs:5000});
  assert.equal(a.acquired,true);
  assert.equal(b.acquired,false);
  assert.equal((await releaseSharedLease('minimal-lease','same',{owner:'a'})).released,true);
  assert.equal(fetchCalls,0,'estado operacional não pode acessar Supabase');
  assert.equal(sharedStateStats().driver,'memory');
} finally {
  globalThis.fetch=oldFetch;
  await resetSharedStateForTests();
  for(const k of keys){ if(saved[k]===undefined) delete process.env[k]; else process.env[k]=saved[k]; }
}
console.log('shared-state memory-only isolation v363 OK');
