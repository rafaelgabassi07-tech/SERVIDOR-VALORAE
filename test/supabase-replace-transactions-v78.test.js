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

function req(body) {
  return {
    method: 'POST',
    url: '/api/sync?action=replace_transactions_for_symbols',
    query: { action: 'replace_transactions_for_symbols' },
    body,
    headers: { host: 'valorae-proxy.test', authorization: 'Bearer admin-test-token' },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

async function call(body) {
  const res = new MockRes();
  await syncHandler(req(body), res);
  return res;
}

function json(res) { return typeof res.body === 'string' && res.body ? JSON.parse(res.body) : res.body; }

const oldEnv = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  token: process.env.VALORAE_SUPABASE_SYNC_TOKEN,
};
const oldFetch = globalThis.fetch;

try {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.VALORAE_SUPABASE_SYNC_TOKEN = 'admin-test-token';

  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/rpc/valorae_sync_replace_transactions')) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify({ count: 2, deleted: 2, revision: 8, deletion_generation: 0, tombstone: false }),
      };
    }
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => '[]' };
  };

  const res = await call({
    user_id: 'valorae-test-user-00000000000000000000',
    sync_state: { revision: 7, deletion_generation: 0, tombstone: false },
    action_created_at: 1781844563444,
    symbols: ['MXRF11', 'HGLG11'],
    transactions: [
      { id: 77, client_tx_id: 'apk-local-77', date: '01/02/2026', operation: 'COMPRA', symbol: 'MXRF11', asset_type: 'FII Papel', quantity: 10, price: 10.5, gross_value: 105, source: 'B3', imported_at: 123 },
      { id: 88, client_tx_id: 'apk-local-88', date: '02/02/2026', operation: 'COMPRA', symbol: 'HGLG11', asset_type: 'FII Tijolo', quantity: 2, price: 150, gross_value: 300, source: 'B3', imported_at: 124 },
      { id: 99, client_tx_id: 'apk-local-99', date: '03/02/2026', operation: 'COMPRA', symbol: 'PETR4', asset_type: 'Ação', quantity: 1, price: 30, gross_value: 30, source: 'B3', imported_at: 125 },
    ],
  });

  const payload = json(res);
  assert.equal(res.statusCode, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.count, 2);
  assert.equal(payload.deleted, 2);
  assert.equal(payload.syncState.revision, 8);
  const rpc = calls.find((c) => c.url.includes('/rpc/valorae_sync_replace_transactions'));
  assert.ok(rpc, 'deve usar a RPC transacional com trava/revisão');
  const args = JSON.parse(rpc.init.body);
  assert.deepEqual(args.p_symbols, ['MXRF11', 'HGLG11']);
  assert.equal(args.p_expected_revision, 7);
  assert.equal(args.p_expected_deletion_generation, 0);
  assert.equal(args.p_expected_tombstone, false);
  assert.deepEqual(args.p_rows.map((row) => row.client_tx_id), ['apk-local-77', 'apk-local-88']);
  assert.ok(!args.p_rows.some((row) => row.ticker === 'PETR4'));
} finally {
  if (oldEnv.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldEnv.url;
  if (oldEnv.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldEnv.key;
  if (oldEnv.token === undefined) delete process.env.VALORAE_SUPABASE_SYNC_TOKEN; else process.env.VALORAE_SUPABASE_SYNC_TOKEN = oldEnv.token;
  globalThis.fetch = oldFetch;
}

console.log('Supabase replace transactions v78/current-integrity tests OK.');
