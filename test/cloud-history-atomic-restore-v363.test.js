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

function request(token = 'atomic-history-token') {
  return {
    method: 'POST',
    url: '/api/sync',
    query: {},
    body: { action: 'restore_transactions', limit: 10000, offset: 0 },
    headers: { host: 'valorae.test', authorization: `Bearer ${token}`, 'content-type': 'application/json' },
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

async function call(token) {
  const res = new MockRes();
  await syncHandler(request(token), res);
  return { res, body: typeof res.body === 'string' ? JSON.parse(res.body) : res.body };
}

const previous = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  anon: process.env.SUPABASE_ANON_KEY,
  table: process.env.VALORAE_SUPABASE_TRANSACTIONS_TABLE,
  fetch: globalThis.fetch,
};

try {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.SUPABASE_ANON_KEY = 'anon-test';
  process.env.VALORAE_SUPABASE_TRANSACTIONS_TABLE = 'wrong_legacy_table';

  const rpcRows = [
    {
      user_id: 'atomic-user-1',
      client_tx_id: 'atomic-1',
      ticker: 'PETR4',
      quantity: 10,
      purchase_price: 30,
      transaction_date: '2026-07-20T00:00:00.000Z',
      payload: { operation: 'COMPRA', date: '2026-07-20', source: 'B3' },
    },
  ];

  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/auth/v1/user')) return response({ id: 'atomic-user-1', email: 'conta@valorae.com' });
    if (href.includes('/rpc/valorae_sync_restore_transactions')) {
      return response({
        ok: true,
        transactions: rpcRows,
        count: 1,
        total_count: 1,
        has_more: false,
        next_offset: null,
        read_fence: '2026-07-26T12:00:00.000Z',
        identity_source: 'supabase_user_id',
        primary_count: 1,
        legacy_count: 0,
        sync_state: { revision: 8, deletion_generation: 0, tombstone: false },
        restore_contract: 'history-restore-atomic-v1',
      });
    }
    throw new Error(`unexpected fetch ${href}`);
  };

  const atomic = await call('atomic-history-token');
  assert.equal(atomic.res.statusCode, 200, JSON.stringify(atomic.body));
  assert.equal(atomic.body.restoreContract, 'history-restore-atomic-v1');
  assert.equal(atomic.body.restoreSource, 'supabase_rpc_canonical');
  assert.equal(atomic.body.totalCount, 1);
  assert.equal(atomic.body.transactions.length, 1);
  assert.equal(atomic.body.transactions[0].symbol, 'PETR4');
  assert.equal(atomic.body.syncState.revision, 8);

  const seen = [];
  globalThis.fetch = async (url) => {
    const href = String(url);
    seen.push(href);
    if (href.includes('/auth/v1/user')) return response({ id: 'atomic-user-2', email: '' });
    if (href.includes('/rpc/valorae_sync_restore_transactions')) {
      return response({ code: 'PGRST202', message: 'Could not find the function public.valorae_sync_restore_transactions' }, 404);
    }
    if (href.includes('/rpc/valorae_sync_get_state')) {
      return response({ revision: 3, deletion_generation: 0, tombstone: false });
    }
    if (href.includes('/rest/v1/valorae_transactions?')) {
      const parsed = new URL(href);
      const offset = Number(parsed.searchParams.get('offset') || 0);
      if (offset > 0) return response([]);
      return response([{ client_tx_id: 'fallback-1', ticker: 'VALE3', quantity: 2, purchase_price: 60, transaction_date: '2026-07-19T00:00:00.000Z', payload: { operation: 'COMPRA', date: '2026-07-19' } }]);
    }
    if (href.includes('/rest/v1/wrong_legacy_table?')) throw new Error('restore must not read configured legacy table');
    return response([]);
  };

  const fallback = await call('atomic-history-token-2');
  assert.equal(fallback.res.statusCode, 200, JSON.stringify(fallback.body));
  assert.equal(fallback.body.restoreSource, 'canonical_rest_fallback');
  assert.equal(fallback.body.atomicRpcAvailable, false);
  assert.equal(fallback.body.transactions.length, 1);
  assert.equal(fallback.body.transactions[0].symbol, 'VALE3');
  assert.ok(seen.some((href) => href.includes('/rest/v1/valorae_transactions?')));
  assert.ok(!seen.some((href) => href.includes('/rest/v1/wrong_legacy_table?')));
} finally {
  if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
  if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
  if (previous.anon === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previous.anon;
  if (previous.table === undefined) delete process.env.VALORAE_SUPABASE_TRANSACTIONS_TABLE; else process.env.VALORAE_SUPABASE_TRANSACTIONS_TABLE = previous.table;
  globalThis.fetch = previous.fetch;
}

console.log('cloud history atomic restore v363 OK');
