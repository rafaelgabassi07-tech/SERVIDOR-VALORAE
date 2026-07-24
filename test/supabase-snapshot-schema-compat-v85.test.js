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

async function call() {
  const res = new MockRes();
  await syncHandler({
    method: 'GET',
    url: '/api/sync?action=get_snapshot&domain=portfolio&snapshot_key=latest',
    query: { action: 'get_snapshot', domain: 'portfolio', snapshot_key: 'latest' },
    body: undefined,
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

  const snapshotCalls = [];
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    if (href.includes('/auth/v1/user')) {
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ id: 'user-123', email: 'u@valorae.app' }), text: async () => '{"id":"user-123"}' };
    }
    if (href.includes('/rpc/valorae_sync_get_state')) {
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ revision: 4, deletion_generation: 0, tombstone: false }) };
    }
    if (href.includes('/rest/v1/valorae_user_snapshots')) {
      snapshotCalls.push(href);
      if (href.includes('cache_scope')) {
        return {
          ok: false,
          status: 400,
          headers: { get: () => null },
          text: async () => JSON.stringify({ code: 'PGRST204', message: "Could not find the 'cache_scope' column of 'valorae_user_snapshots' in the schema cache" }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify([{ user_id: 'user-123', domain: 'portfolio', snapshot_key: 'latest', payload: { assetsCount: 1 }, updated_at: '2026-06-19T04:49:23.444Z' }]),
      };
    }
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => '[]' };
  };

  const res = await call();
  const payload = json(res);
  assert.equal(res.statusCode, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.schemaMode, 'legacy_snapshot_columns');
  assert.equal(payload.degraded, true);
  assert.equal(snapshotCalls.length, 2);
  assert.match(snapshotCalls[0], /cache_scope/);
  assert.doesNotMatch(snapshotCalls[1], /cache_scope/);
  assert.equal(payload.snapshot.payload.assetsCount, 1);
  assert.equal(payload.syncState.revision, 4);
} finally {
  if (oldEnv.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldEnv.url;
  if (oldEnv.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldEnv.key;
  if (oldEnv.anon === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = oldEnv.anon;
  globalThis.fetch = oldFetch;
}

console.log('Supabase snapshot schema compat v85 tests OK.');
