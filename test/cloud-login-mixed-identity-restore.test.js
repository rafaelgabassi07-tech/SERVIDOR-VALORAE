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

function request(query = {}) {
  const params = new URLSearchParams({ action: 'get_transactions', ...query });
  return {
    method: 'GET',
    url: `/api/sync?${params}`,
    query: { action: 'get_transactions', ...query },
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

async function call(query = {}) {
  const res = new MockRes();
  await syncHandler(request(query), res);
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
  process.env.VALORAE_SYNC_CURSOR_SECRET = 'mixed-identity-cursor-secret-with-enough-entropy';
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/auth/v1/user')) {
      return response({ id: 'uuid-user-1', email: 'conta@valorae.com' });
    }
    if (href.includes('/rpc/valorae_sync_get_state')) {
      return response({ revision: 9, deletion_generation: 0, tombstone: false });
    }
    if (href.includes('/valorae_transactions?')) {
      if (href.includes('uuid-user-1')) {
        return response([
          { client_tx_id: 'uuid-only', ticker: 'VALE3', quantity: 2, purchase_price: 60, transaction_date: '2026-07-25', payload: { operation: 'COMPRA' } },
          { client_tx_id: 'shared-1', ticker: 'PETR4', quantity: 10, purchase_price: 30, transaction_date: '2026-07-24', payload: { operation: 'COMPRA' } },
        ]);
      }
      if (href.includes('conta%40valorae.com')) {
        return response([
          { client_tx_id: 'shared-1', symbol: 'PETR4', quantity: 999, price: 1, date: '2026-07-24', payload: { operation: 'COMPRA' } },
          { client_tx_id: 'legacy-only', symbol: 'ITUB4', quantity: 5, price: 35, date: '2026-07-23', payload: { operation: 'COMPRA' } },
        ]);
      }
    }
    return response([]);
  };

  const first = await call({ limit: '2' });
  assert.equal(first.res.statusCode, 200);
  assert.equal(first.body.ok, true);
  assert.equal(first.body.identitySource, 'supabase_user_id+legacy_verified_email');
  assert.equal(first.body.transactions.length, 2);
  assert.equal(first.body.has_more, true);
  assert.ok(first.body.next_cursor);
  assert.deepEqual(first.body.transactions.map((item) => item.symbol), ['VALE3', 'PETR4']);
  assert.equal(first.body.transactions.find((item) => item.clientTxId === 'shared-1').quantity, 10, 'UUID must win duplicate logical records');

  const second = await call({ limit: '2', cursor: first.body.next_cursor });
  assert.equal(second.res.statusCode, 200);
  assert.equal(second.body.transactions.length, 1);
  assert.equal(second.body.transactions[0].symbol, 'ITUB4');
  assert.equal(second.body.has_more, false);
  assert.equal(second.body.next_cursor, null);
} finally {
  if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
  if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
  if (previous.anon === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previous.anon;
  if (previous.cursor === undefined) delete process.env.VALORAE_SYNC_CURSOR_SECRET; else process.env.VALORAE_SYNC_CURSOR_SECRET = previous.cursor;
  globalThis.fetch = previous.fetch;
}

console.log('cloud login mixed identity restore OK');
