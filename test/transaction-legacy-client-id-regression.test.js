import assert from 'node:assert/strict';
import syncHandler from '../routes/sync.js';

class MockRes {
  constructor() { this.headers = {}; this.statusCode = 200; this.body = ''; }
  setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; return this; }
  getHeader(key) { return this.headers[String(key).toLowerCase()]; }
  removeHeader(key) { delete this.headers[String(key).toLowerCase()]; }
  status(code) { this.statusCode = code; return this; }
  send(value) { this.body = value; return this; }
  end(value = '') { this.body = value; return this; }
}
const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  text: async () => JSON.stringify(body),
  json: async () => body,
});
const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, anon: process.env.SUPABASE_ANON_KEY, fetch: globalThis.fetch };
try {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.SUPABASE_ANON_KEY = 'anon-test';
  const legacyRows = [
    { ticker: 'PETR4', quantity: 10, purchase_price: 30, transaction_date: '2026-01-10', payload: { operation: 'COMPRA', source: 'B3' } },
    { ticker: 'VALE3', quantity: 5, purchase_price: 60, transaction_date: '2026-02-11', payload: { operation: 'COMPRA', source: 'B3' } },
    { ticker: 'PETR4', quantity: 2, purchase_price: 35, transaction_date: '2026-03-12', payload: { operation: 'COMPRA', source: 'B3' } },
  ];
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/auth/v1/user')) return response({ id: 'legacy-id-user', email: '' });
    if (href.includes('/rpc/valorae_sync_get_state')) return response({ revision: 4, deletion_generation: 0, tombstone: false });
    if (href.includes('/valorae_transactions?')) return response(legacyRows);
    return response([]);
  };
  const req = {
    method: 'GET', url: '/api/sync?action=get_transactions&limit=500',
    query: { action: 'get_transactions', limit: '500' },
    headers: { host: 'valorae.test', authorization: 'Bearer legacy-client-id-token' },
    socket: { remoteAddress: '127.0.0.1' },
  };
  const res = new MockRes();
  await syncHandler(req, res);
  const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
  assert.equal(res.statusCode, 200);
  assert.equal(body.count, 3, 'legacy rows without client_tx_id must not collapse into one record');
  assert.equal(new Set(body.transactions.map((tx) => tx.clientTxId)).size, 3);
} finally {
  if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
  if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
  if (previous.anon === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previous.anon;
  globalThis.fetch = previous.fetch;
}
console.log('transaction legacy client id regression OK');
