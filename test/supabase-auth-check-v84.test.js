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

function req(headers = {}, url = '/api/sync?action=auth_check') {
  return {
    method: 'GET',
    url,
    query: { action: 'auth_check' },
    body: undefined,
    headers: { host: 'valorae-proxy.test', ...headers },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

async function call(request) {
  const res = new MockRes();
  await syncHandler(request, res);
  return res;
}

function json(res) {
  return typeof res.body === 'string' && res.body ? JSON.parse(res.body) : res.body;
}

const oldEnv = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  anon: process.env.SUPABASE_ANON_KEY,
  token: process.env.VALORAE_SUPABASE_SYNC_TOKEN,
};
const oldFetch = globalThis.fetch;

try {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.SUPABASE_ANON_KEY = 'anon-test';
  delete process.env.VALORAE_SUPABASE_SYNC_TOKEN;

  let missing = await call(req());
  assert.equal(missing.statusCode, 200);
  assert.equal(json(missing).ok, false);
  assert.equal(json(missing).code, 'AUTH_TOKEN_MISSING');

  globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => '{"message":"bad jwt"}', json: async () => ({ message: 'bad jwt' }) });
  let invalid = await call(req({ authorization: 'Bearer jwt-from-other-project' }));
  assert.equal(invalid.statusCode, 200);
  assert.equal(json(invalid).ok, false);
  assert.equal(json(invalid).code, 'SUPABASE_BEARER_INVALID');

  const writeInvalid = await call({
    ...req({ authorization: 'Bearer jwt-from-other-project' }, '/api/sync?action=upsert_snapshot'),
    method: 'POST',
    query: { action: 'upsert_snapshot' },
    body: { action: 'upsert_snapshot', domain: 'portfolio', snapshot_key: 'latest', payload: {} },
  });
  assert.equal(writeInvalid.statusCode, 401);
  assert.equal(json(writeInvalid).code, 'SUPABASE_BEARER_INVALID');

  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ id: 'user-123', email: 'a@b.com' }), text: async () => '{"id":"user-123"}' });
  let valid = await call(req({ authorization: 'Bearer valid-jwt' }));
  assert.equal(valid.statusCode, 200);
  assert.equal(json(valid).ok, true);
  assert.equal(json(valid).authenticated, true);
  assert.equal(json(valid).authMode, 'supabase_auth');
} finally {
  if (oldEnv.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldEnv.url;
  if (oldEnv.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldEnv.key;
  if (oldEnv.anon === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = oldEnv.anon;
  if (oldEnv.token === undefined) delete process.env.VALORAE_SUPABASE_SYNC_TOKEN; else process.env.VALORAE_SUPABASE_SYNC_TOKEN = oldEnv.token;
  globalThis.fetch = oldFetch;
}

console.log('Supabase auth check v84 tests OK.');
