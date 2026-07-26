import assert from 'node:assert/strict';
import syncHandler from '../routes/sync.js';

class MockRes {
  constructor() { this.headers = {}; this.statusCode = 200; this.body = ''; this.finished = false; }
  setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; return this; }
  getHeader(key) { return this.headers[String(key).toLowerCase()]; }
  removeHeader(key) { delete this.headers[String(key).toLowerCase()]; }
  status(code) { this.statusCode = code; return this; }
  send(value) { this.body = value; this.finished = true; return this; }
  end(value = '') { this.body = value; this.finished = true; return this; }
}

function request(action, query = {}) {
  const params = new URLSearchParams({ action, ...query });
  return {
    method: 'GET',
    url: `/api/sync?${params}`,
    query: { action, ...query },
    headers: { host: 'valorae.test', authorization: 'Bearer user-access-token' },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

async function call(action, query = {}) {
  const res = new MockRes();
  await syncHandler(request(action, query), res);
  return { res, body: typeof res.body === 'string' ? JSON.parse(res.body) : res.body };
}

const previous = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  anon: process.env.SUPABASE_ANON_KEY,
  cursor: process.env.VALORAE_SYNC_CURSOR_SECRET,
  fetch: globalThis.fetch,
};

try {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.SUPABASE_ANON_KEY = 'anon-test';
  process.env.VALORAE_SYNC_CURSOR_SECRET = 'uuid-regression-cursor-secret-with-enough-entropy';

  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/auth/v1/user')) {
      return response({ id: '4c12d8d5-1b0b-4c07-bf31-7ab43877e684', email: 'conta@valorae.com' });
    }
    if (href.includes('/rpc/valorae_sync_get_state')) {
      return response({ revision: 11, deletion_generation: 0, tombstone: false });
    }
    if (href.includes('/valorae_transactions?') && href.includes('4c12d8d5-1b0b-4c07-bf31-7ab43877e684')) {
      return response([
        {
          client_tx_id: 'uuid-primary-1',
          ticker: 'PETR4',
          quantity: 10,
          purchase_price: 31.25,
          transaction_date: '2026-07-20',
          payload: { operation: 'COMPRA', source: 'B3' },
        },
      ]);
    }
    if (href.includes('/valorae_transactions?') && href.includes('conta%40valorae.com')) {
      return response({ code: '22P02', message: 'invalid input syntax for type uuid' }, 400);
    }
    return response([]);
  };

  const result = await call('get_transactions', { limit: '500' });
  assert.equal(result.res.statusCode, 200, 'a valid UUID read must not be rejected by the legacy e-mail lookup');
  assert.equal(result.body.ok, true);
  assert.equal(result.body.count, 1);
  assert.equal(result.body.transactions[0].symbol, 'PETR4');
  assert.equal(result.body.identitySource, 'supabase_user_id');
  assert.equal(result.body.legacyIdentitySkipped, true);
  assert.equal(result.body.legacyIdentityError, '22P02');
  assert.equal(result.body.syncState.revision, 11);
} finally {
  if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
  if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
  if (previous.anon === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previous.anon;
  if (previous.cursor === undefined) delete process.env.VALORAE_SYNC_CURSOR_SECRET; else process.env.VALORAE_SYNC_CURSOR_SECRET = previous.cursor;
  globalThis.fetch = previous.fetch;
}

console.log('cloud login UUID identity regression OK');
