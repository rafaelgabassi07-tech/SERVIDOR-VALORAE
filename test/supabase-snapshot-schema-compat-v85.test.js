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

function json(res) {
  return typeof res.body === 'string' && res.body ? JSON.parse(res.body) : res.body;
}

const oldEnv = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  anon: process.env.SUPABASE_ANON_KEY,
};
const oldFetch = globalThis.fetch;

try {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.SUPABASE_ANON_KEY = 'anon-test';

  const postedBodies = [];
  let postCount = 0;
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    if (href.includes('/auth/v1/user')) {
      return { ok: true, status: 200, text: async () => '{"id":"user-123","email":"u@valorae.app"}', json: async () => ({ id: 'user-123', email: 'u@valorae.app' }) };
    }
    if (href.includes('/rest/v1/valorae_user_snapshots')) {
      postCount += 1;
      postedBodies.push(JSON.parse(init.body));
      if (postCount === 1) {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ code: 'PGRST204', message: "Could not find the 'cache_scope' column of 'valorae_user_snapshots' in the schema cache" }),
        };
      }
      return { ok: true, status: 201, text: async () => '' };
    }
    return { ok: true, status: 200, text: async () => '[]' };
  };

  const res = await call({ action: 'upsert_snapshot', domain: 'portfolio', snapshot_key: 'latest', payload: { assetsCount: 1 }, cache_scope: 'user' });
  const payload = json(res);
  assert.equal(res.statusCode, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.schemaMode, 'legacy_snapshot_columns');
  assert.equal(payload.degraded, true);
  assert.equal(postedBodies.length, 2);
  assert.equal(postedBodies[0].cache_scope, 'user');
  assert.equal(postedBodies[1].cache_scope, undefined, 'fallback não deve reenviar cache_scope quando a coluna não existe');
  assert.equal(postedBodies[1].user_id, 'user-123');
  assert.deepEqual(postedBodies[1].payload, { assetsCount: 1 });
} finally {
  if (oldEnv.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldEnv.url;
  if (oldEnv.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldEnv.key;
  if (oldEnv.anon === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = oldEnv.anon;
  globalThis.fetch = oldFetch;
}

console.log('Supabase snapshot schema compat v85 tests OK.');
