import assert from 'node:assert/strict';
import syncHandler from '../routes/sync.js';

const CONTRACT = 'valorae-financial-sync-v2';
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

class MockRes {
  constructor() { this.headers = {}; this.statusCode = 200; this.body = ''; this.finished = false; }
  setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; return this; }
  getHeader(key) { return this.headers[String(key).toLowerCase()]; }
  removeHeader(key) { delete this.headers[String(key).toLowerCase()]; }
  status(code) { this.statusCode = code; return this; }
  send(value) { this.body = value; this.finished = true; return this; }
  end(value = '') { this.body = value; this.finished = true; return this; }
}

function request(action, token, body = {}) {
  return {
    method: 'POST',
    url: '/api/sync',
    query: {},
    body: { action, ...body },
    headers: {
      host: 'valorae.test',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-valorae-sync-contract': CONTRACT,
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
  };
}

async function call(action, token, body = {}) {
  const res = new MockRes();
  await syncHandler(request(action, token, body), res);
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

const old = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  anon: process.env.SUPABASE_ANON_KEY,
  fetch: globalThis.fetch,
};

try {
  process.env.SUPABASE_URL = 'https://financial-e2e.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-e2e';
  process.env.SUPABASE_ANON_KEY = 'anon-e2e';

  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ href, body });
    if (href.includes('/auth/v1/user')) return response({ id: USER_ID, email: 'owner@valorae.test' });
    if (href.includes('/rpc/valorae_financial_upload_transactions_v2')) {
      assert.equal(body.p_user_id, USER_ID);
      assert.equal(body.p_rows.length, 2, 'colisões de ID com operações diferentes devem preservar as duas linhas');
      assert.notEqual(body.p_rows[0].clientTxId, body.p_rows[1].clientTxId);
      assert.deepEqual(body.p_rows.map(row => row.quantity).sort((a,b)=>a-b), [1, 3]);
      assert.deepEqual(body.p_replace_symbols, ['PETR4']);
      return response({ ok: true, contract: CONTRACT, count: 2, deleted: 0 });
    }
    if (href.includes('/rpc/valorae_financial_upload_dividends_v2')) {
      assert.equal(body.p_user_id, USER_ID);
      assert.deepEqual(body.p_rows, [], 'agenda vazia autoritativa deve chegar como lista vazia');
      assert.equal(body.p_replace_all, true, 'agenda vazia deve limpar eventos obsoletos');
      return response({ ok: true, contract: CONTRACT, count: 0, deleted: 2 });
    }
    if (href.includes('/rpc/valorae_financial_download_v2')) {
      return response({
        ok: true,
        contract: CONTRACT,
        transactions: [{ clientTxId: 'tx-1', date: '2026-07-26', operation: 'COMPRA', symbol: 'PETR4', quantity: 3, price: 30, grossValue: 90, source: 'B3' }],
        dividends: [],
        transactions_count: 1,
        dividends_count: 0,
      });
    }
    if (href.includes('/rpc/valorae_financial_status_v2')) {
      return response({ ok: true, contract: CONTRACT, transactions_count: 1, dividends_count: 0 });
    }
    if (href.includes('/rpc/valorae_financial_delete_v2')) {
      return response({ ok: true, contract: CONTRACT, count: 1, transactions_deleted: 1, dividends_deleted: 0 });
    }
    throw new Error(`acesso Supabase inesperado: ${href}`);
  };

  const upload = await call('upload_transactions', 'e2e-upload', {
    mode: 'replace_symbols',
    symbols: ['petr4'],
    transactions: [
      { clientTxId: 'same', date: '2026-07-26', operation: 'COMPRA', symbol: 'PETR4', quantity: 1, price: 30, grossValue: 30 },
      { clientTxId: 'same', date: '2026-07-26', operation: 'COMPRA', symbol: 'PETR4', quantity: 3, price: 30, grossValue: 90 },
    ],
  });
  assert.equal(upload.status, 200, JSON.stringify(upload.body));

  const emptyDividends = await call('upload_dividends', 'e2e-dividends', { events: [], replaceAll: true });
  assert.equal(emptyDividends.status, 200, JSON.stringify(emptyDividends.body));
  assert.equal(emptyDividends.body.deleted, 2);

  const download = await call('download_financial_data', 'e2e-download');
  assert.equal(download.status, 200, JSON.stringify(download.body));
  assert.equal(download.body.transactionsCount, 1);
  assert.equal(download.body.dividendsCount, 0);
  assert.equal(download.body.transactions[0].quantity, 3);

  const status = await call('get_financial_status', 'e2e-status');
  assert.equal(status.status, 200, JSON.stringify(status.body));
  assert.equal(status.body.transactionsCount, 1);

  const deletion = await call('delete_financial_data', 'e2e-delete');
  assert.equal(deletion.status, 200, JSON.stringify(deletion.body));
  assert.equal(deletion.body.count, 1);

  const databaseCalls = calls.filter(({ href }) => href.includes('/rest/v1/'));
  assert.equal(databaseCalls.length, 5, 'cada operação financeira deve usar exatamente uma RPC');
  assert.ok(databaseCalls.every(({ href }) => href.includes('/rest/v1/rpc/valorae_financial_')));
  assert.ok(calls.every(({ href }) => !/valorae_user_snapshots|valorae_sync_backups|valorae_monitor_events|valorae_runtime_shared_state|valorae_sync_clients/.test(href)));
} finally {
  if (old.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = old.url;
  if (old.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = old.key;
  if (old.anon === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = old.anon;
  globalThis.fetch = old.fetch;
}

console.log('minimal financial sync end-to-end v367 OK');
