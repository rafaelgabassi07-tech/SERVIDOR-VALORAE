import assert from 'node:assert/strict';
import { dispatchRoute } from '../routes/_router.js';

class MockRes {
  constructor() { this.headers = {}; this.statusCode = 200; this.body = ''; this.finished = false; }
  setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; }
  getHeader(k) { return this.headers[String(k).toLowerCase()]; }
  removeHeader(k) { delete this.headers[String(k).toLowerCase()]; }
  status(code) { this.statusCode = code; return this; }
  send(value) { this.body = value; this.finished = true; return this; }
  end(value = '') { this.body = value; this.finished = true; return this; }
}

function req(method, url, body, headers = {}) {
  return {
    method,
    url,
    query: {},
    body,
    headers: { host: 'valorae-proxy.vercel.app', origin: 'https://app.valorae.local', ...headers },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

async function call(request) {
  const res = new MockRes();
  await dispatchRoute(request, res);
  return res;
}

function json(res) {
  return typeof res.body === 'string' && res.body ? JSON.parse(res.body) : res.body;
}

const oldEnv = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  token: process.env.VALORAE_SUPABASE_SYNC_TOKEN,
};
const oldFetch = globalThis.fetch;

try {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const health = await call(req('GET', '/api/sync?action=health'));
  assert.equal(health.statusCode, 200);
  assert.equal(json(health).route, '/api/sync');
  assert.equal(json(health).supabase.configured, false);
  assert.ok(json(health).capabilities.includes('diagnostics'));

  const missing = await call(req('POST', '/api/sync?action=upsert_snapshot', { domain: 'wallet', snapshot_key: 'main', payload: {} }));
  assert.equal(missing.statusCode, 503);
  assert.equal(json(missing).code, 'SUPABASE_NOT_CONFIGURED');

  process.env.SUPABASE_URL = 'https://example.supabase.co/rest/v1';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test_only';
  const seenUrls = [];
  globalThis.fetch = async (url, init = {}) => {
    seenUrls.push(String(url));
    assert.equal(init.headers.apikey, 'sb_secret_test_only');
    assert.equal(init.headers.authorization, 'Bearer sb_secret_test_only');
    return { ok: true, status: 200, text: async () => '[]' };
  };
  const diagnostics = await call(req('GET', '/api/sync?action=diagnostics'));
  assert.equal(diagnostics.statusCode, 200);
  const payload = json(diagnostics);
  assert.equal(payload.ok, true);
  assert.equal(payload.supabase.ok, true);
  assert.equal(payload.supabase.tables.length, 5);
  assert.ok(seenUrls.every((u) => !u.includes('/rest/v1/rest/v1/')), 'SUPABASE_URL com /rest/v1 deve ser normalizada');
  assert.ok(seenUrls.some((u) => u.includes('/rest/v1/valorae_user_snapshots')));

  const cors = await call(req('OPTIONS', '/api/sync', undefined, {
    'access-control-request-headers': 'x-valorae-user-id,x-valorae-client-secret,x-valorae-sync-token',
  }));
  assert.equal(cors.statusCode, 200);
  assert.match(cors.getHeader('access-control-allow-headers'), /X-Valorae-User-Id/i);
  assert.match(cors.getHeader('access-control-allow-headers'), /X-Valorae-Client-Secret/i);
  assert.match(cors.getHeader('access-control-allow-headers'), /X-Valorae-Sync-Token/i);
} finally {
  if (oldEnv.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldEnv.url;
  if (oldEnv.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldEnv.key;
  if (oldEnv.token === undefined) delete process.env.VALORAE_SUPABASE_SYNC_TOKEN; else process.env.VALORAE_SUPABASE_SYNC_TOKEN = oldEnv.token;
  globalThis.fetch = oldFetch;
}

console.log('Supabase sync routing tests OK.');
