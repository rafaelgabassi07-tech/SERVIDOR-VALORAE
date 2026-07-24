import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import syncHandler, { _test } from '../routes/sync.js';

class MockRes {
  constructor() { this.headers = {}; this.statusCode = 200; this.body = ''; this.finished = false; }
  setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; }
  getHeader(k) { return this.headers[String(k).toLowerCase()]; }
  removeHeader(k) { delete this.headers[String(k).toLowerCase()]; }
  status(code) { this.statusCode = code; return this; }
  send(value) { this.body = value; this.finished = true; return this; }
  end(value = '') { this.body = value; this.finished = true; return this; }
}

function request({ action, method = 'POST', body = {}, token = 'admin-test-token' }) {
  return {
    method,
    url: `/api/sync?action=${action}`,
    query: { action },
    body: method === 'GET' ? undefined : { action, ...body },
    headers: { host: 'valorae-proxy.test', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

async function call(options) {
  const res = new MockRes();
  await syncHandler(request(options), res);
  return res;
}
function json(res) { return typeof res.body === 'string' && res.body ? JSON.parse(res.body) : res.body; }
function response({ ok, status, body, retryAfter = null, user = null }) {
  return {
    ok,
    status,
    headers: { get: (name) => String(name).toLowerCase() === 'retry-after' ? retryAfter : null },
    text: async () => typeof body === 'string' ? body : JSON.stringify(body ?? null),
    json: async () => user ?? body,
  };
}

assert.equal(_test.isRetryableSyncStatus(400), false);
assert.equal(_test.isRetryableSyncStatus(409), true);
assert.equal(_test.isRetryableSyncStatus(503), true);
assert.equal(_test.syncErrorResponseMeta({ status: 503, code: 'SUPABASE_NOT_CONFIGURED', retryable: false }).retryable, false);

const oldEnv = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  anon: process.env.SUPABASE_ANON_KEY,
  token: process.env.VALORAE_SUPABASE_SYNC_TOKEN,
};
const oldFetch = globalThis.fetch;

try {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  let res = await call({ action: 'upsert_snapshot', body: {} });
  let payload = json(res);
  assert.equal(res.statusCode, 503);
  assert.equal(payload.code, 'SUPABASE_NOT_CONFIGURED');
  assert.equal(payload.retryable, false);
  assert.equal(res.getHeader('x-valorae-sync-retryable'), 'false');

  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.SUPABASE_ANON_KEY = 'anon-test';
  process.env.VALORAE_SUPABASE_SYNC_TOKEN = 'admin-test-token';

  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/rpc/valorae_sync_upsert_snapshots')) {
      return response({ ok: false, status: 409, body: { code: 'P0001', message: 'SYNC_REVISION_CONFLICT' } });
    }
    if (href.includes('/rpc/valorae_sync_get_state')) {
      return response({ ok: true, status: 200, body: { revision: 12, deletion_generation: 3, tombstone: false } });
    }
    return response({ ok: true, status: 200, body: [] });
  };
  res = await call({
    action: 'upsert_snapshot',
    body: {
      user_id: 'user-123', domain: 'portfolio', snapshot_key: 'latest', payload: {},
      sync_state: { revision: 11, deletion_generation: 3, tombstone: false }, action_created_at: Date.now(),
    },
  });
  payload = json(res);
  assert.equal(res.statusCode, 409);
  assert.equal(payload.code, 'SYNC_REVISION_CONFLICT');
  assert.equal(payload.retryable, true);
  assert.equal(payload.conflict, true);
  assert.equal(payload.currentSyncState.revision, 12);
  assert.equal(res.getHeader('x-valorae-sync-conflict'), 'true');
  assert.equal(res.getHeader('x-valorae-sync-retryable'), 'true');

  globalThis.fetch = async () => { throw Object.assign(new Error('network down'), { name: 'TypeError' }); };
  res = await call({
    action: 'upsert_snapshot',
    body: {
      user_id: 'user-123', domain: 'portfolio', snapshot_key: 'latest', payload: {},
      sync_state: { revision: 1, deletion_generation: 0, tombstone: false }, action_created_at: Date.now(),
    },
  });
  payload = json(res);
  assert.equal(res.statusCode, 503);
  assert.equal(payload.code, 'SUPABASE_UNAVAILABLE');
  assert.equal(payload.retryable, true);
  assert.equal(res.getHeader('retry-after'), '30');

  delete process.env.VALORAE_SUPABASE_SYNC_TOKEN;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/auth/v1/user')) return response({ ok: false, status: 503, body: { message: 'auth unavailable' }, retryAfter: '5' });
    return response({ ok: true, status: 200, body: [] });
  };
  res = await call({ action: 'auth_check', method: 'GET', token: 'user-jwt' });
  payload = json(res);
  assert.equal(res.statusCode, 503);
  assert.equal(payload.code, 'SUPABASE_AUTH_UNAVAILABLE');
  assert.equal(payload.retryable, true);
  assert.equal(res.getHeader('retry-after'), '5');

  globalThis.fetch = async (url) => {
    if (String(url).includes('/auth/v1/user')) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => { throw new SyntaxError('invalid auth json'); },
      };
    }
    return response({ ok: true, status: 200, body: [] });
  };
  res = await call({ action: 'auth_check', method: 'GET', token: 'user-jwt' });
  payload = json(res);
  assert.equal(res.statusCode, 503);
  assert.equal(payload.code, 'SUPABASE_AUTH_INVALID_RESPONSE');
  assert.equal(payload.retryable, true);

  process.env.VALORAE_SUPABASE_SYNC_TOKEN = 'admin-test-token';
  globalThis.fetch = async () => response({ ok: true, status: 200, body: '<html>invalid upstream body</html>' });
  res = await call({
    action: 'upsert_snapshot',
    body: {
      user_id: 'user-123', domain: 'portfolio', snapshot_key: 'latest', payload: {},
      sync_state: { revision: 1, deletion_generation: 0, tombstone: false }, action_created_at: Date.now(),
    },
  });
  payload = json(res);
  assert.equal(res.statusCode, 503);
  assert.equal(payload.code, 'SUPABASE_INVALID_RESPONSE');
  assert.equal(payload.retryable, true);

  res = await call({ action: 'does_not_exist', body: {}, token: 'admin-test-token' });
  payload = json(res);
  assert.equal(res.statusCode, 400);
  assert.equal(payload.code, 'UNKNOWN_SYNC_ACTION');
  assert.equal(payload.retryable, false);

  const sql = await readFile(new URL('../supabase/006_valorae_financial_sync_integrity_v358.sql', import.meta.url), 'utf8');
  assert.match(sql, /from jsonb_array_elements\(coalesce\(p_rows, '\[\]'::jsonb\)\) r\s+where r->>'ticker' = any/);
  assert.doesNotMatch(sql, /from jsonb_array_elements\(coalesce\(p_rows, '\[\]'::jsonb\)\) r\s+and r->>'ticker'/);
} finally {
  for (const [key, value] of Object.entries(oldEnv)) {
    const envKey = key === 'url' ? 'SUPABASE_URL' : key === 'key' ? 'SUPABASE_SERVICE_ROLE_KEY' : key === 'anon' ? 'SUPABASE_ANON_KEY' : 'VALORAE_SUPABASE_SYNC_TOKEN';
    if (value === undefined) delete process.env[envKey]; else process.env[envKey] = value;
  }
  globalThis.fetch = oldFetch;
}

console.log('Sync resilience tests OK.');
