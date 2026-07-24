import assert from 'node:assert/strict';
import syncHandler from '../routes/sync.js';

class MockRes {
  constructor() { this.headers = {}; this.statusCode = 200; this.body = ''; this.finished = false; }
  setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; }
  getHeader(k) { return this.headers[String(k).toLowerCase()]; }
  removeHeader(k) { delete this.headers[String(k).toLowerCase()]; }
  status(code) { this.statusCode = code; return this; }
  send(value) { this.body = value; this.finished = true; return this; }
  end(value = '') { this.body = value; this.finished = true; return this; }
}

async function call(body) {
  const res = new MockRes();
  await syncHandler({
    method: 'POST',
    url: '/api/sync?action=upsert_snapshot',
    query: { action: 'upsert_snapshot' },
    body,
    headers: { host: 'valorae-proxy.test', authorization: 'Bearer valid-user-jwt' },
    socket: { remoteAddress: '127.0.0.1' },
  }, res);
  return res;
}

function json(res) { return typeof res.body === 'string' && res.body ? JSON.parse(res.body) : res.body; }

const oldEnv = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, anon: process.env.SUPABASE_ANON_KEY };
const oldFetch = globalThis.fetch;

try {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.SUPABASE_ANON_KEY = 'anon-test';

  let rpcArgs = null;
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    if (href.includes('/auth/v1/user')) {
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ id: 'user-123', email: 'u@valorae.app' }), text: async () => '{"id":"user-123"}' };
    }
    if (href.includes('/rpc/valorae_sync_upsert_snapshots')) {
      rpcArgs = JSON.parse(init.body);
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ count: 1, revision: 2, deletion_generation: 0, tombstone: false }) };
    }
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => '[]' };
  };

  const res = await call({
    action: 'upsert_snapshot',
    domain: 'portfolio',
    snapshot_key: 'latest',
    payload: { assetsCount: 1 },
    source_updated_at: '1781844563444',
    updated_at: 1781844563444,
    expires_at: '1781848163444',
    sync_state: { revision: 1, deletion_generation: 0, tombstone: false },
    action_created_at: 1781844563444,
  });
  const payload = json(res);
  assert.equal(res.statusCode, 200);
  assert.equal(payload.ok, true);
  assert.ok(rpcArgs);
  assert.equal(rpcArgs.p_rows.length, 1);
  assert.equal(rpcArgs.p_rows[0].source_updated_at, '2026-06-19T04:49:23.444Z');
  assert.equal(rpcArgs.p_rows[0].updated_at, '2026-06-19T04:49:23.444Z');
  assert.equal(rpcArgs.p_rows[0].expires_at, '2026-06-19T05:49:23.444Z');
  assert.equal(rpcArgs.p_expected_revision, 1);
  assert.equal(payload.syncState.revision, 2);
} finally {
  if (oldEnv.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldEnv.url;
  if (oldEnv.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldEnv.key;
  if (oldEnv.anon === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = oldEnv.anon;
  globalThis.fetch = oldFetch;
}

console.log('Supabase snapshot timestamp v86 tests OK.');
