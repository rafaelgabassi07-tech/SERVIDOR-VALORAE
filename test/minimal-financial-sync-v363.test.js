import assert from 'node:assert/strict';
import fs from 'node:fs';
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
      'x-valorae-sync-contract': 'valorae-financial-sync-v2',
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
  return { res, body: typeof res.body === 'string' ? JSON.parse(res.body) : res.body };
}

const old = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  anon: process.env.SUPABASE_ANON_KEY,
  fetch: globalThis.fetch,
};

try {
  process.env.SUPABASE_URL = 'https://minimal.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-minimal';
  process.env.SUPABASE_ANON_KEY = 'anon-minimal';

  const downloadCalls = [];
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    downloadCalls.push({ href, init, body: init.body ? JSON.parse(init.body) : null });
    if (href.includes('/auth/v1/user')) return response({ id: '11111111-1111-4111-8111-111111111111', email: 'user@valorae.test' });
    if (href.includes('/rpc/valorae_financial_download_v2')) {
      return response({
        ok: true,
        contract: 'valorae-financial-sync-v2',
        transactions: [{ clientTxId: 'tx-1', date: '2026-07-26', operation: 'COMPRA', symbol: 'PETR4', assetType: 'Ação', quantity: 2, price: 31, grossValue: 62, source: 'B3', importedAt: 1785024000000 }],
        dividends: [{ eventId: 'div-1', ticker: 'PETR4', dateCom: '2026-07-20', paymentDate: '2026-08-01', valuePerShare: 1.2, quantity: 2, estimatedAmount: 2.4, status: 'oficial', source: 'VALORAE' }],
        transactions_count: 1,
        dividends_count: 1,
        transactions_version: 4,
        dividends_version: 2,
      });
    }
    throw new Error(`unexpected fetch ${href}`);
  };

  const download = await call('download_financial_data', 'minimal-download-token');
  assert.equal(download.res.statusCode, 200, JSON.stringify(download.body));
  assert.equal(download.body.contract, 'valorae-financial-sync-v2');
  assert.equal(download.body.transactions.length, 1);
  assert.equal(download.body.transactions[0].symbol, 'PETR4');
  assert.equal(download.body.dividends.length, 1);
  assert.equal(download.body.transactionsCount, 1);
  assert.equal(download.body.dividendsCount, 1);
  assert.equal(downloadCalls.filter(call => call.href.includes('/rest/v1/rpc/')).length, 1, 'download deve executar uma única RPC financeira');
  assert.ok(downloadCalls.some(call => call.href.includes('/rpc/valorae_financial_download_v2')));
  assert.ok(downloadCalls.every(call => !/valorae_user_snapshots|valorae_sync_backups|valorae_runtime_shared_state|valorae_monitor_events/.test(call.href)));

  const uploadCalls = [];
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    uploadCalls.push({ href, init, body: init.body ? JSON.parse(init.body) : null });
    if (href.includes('/auth/v1/user')) return response({ id: '22222222-2222-4222-8222-222222222222', email: 'second@valorae.test' });
    if (href.includes('/rpc/valorae_financial_upload_transactions_v2')) return response({ ok: true, contract: 'valorae-financial-sync-v2', count: 1, deleted: 0, transactions_version: 1 });
    throw new Error(`unexpected fetch ${href}`);
  };

  const upload = await call('upload_transactions', 'minimal-upload-token', {
    mode: 'replace_symbols',
    symbols: ['petr4'],
    transactions: [{ clientTxId: 'tx-2', date: '2026-07-26', operation: 'COMPRA', symbol: 'petr4', asset_type: 'Ação', quantity: 1, price: 30, gross_value: 30, source: 'B3' }],
  });
  assert.equal(upload.res.statusCode, 200, JSON.stringify(upload.body));
  assert.equal(upload.body.ok, true);
  const uploadRpc = uploadCalls.find(call => call.href.includes('/rpc/valorae_financial_upload_transactions_v2'));
  assert.ok(uploadRpc);
  assert.equal(uploadRpc.body.p_user_id, '22222222-2222-4222-8222-222222222222');
  assert.deepEqual(uploadRpc.body.p_replace_symbols, ['PETR4']);
  assert.equal(uploadRpc.body.p_rows.length, 1);
  assert.equal(uploadRpc.body.p_rows[0].symbol, 'PETR4');

  const snapshotCalls = [];
  globalThis.fetch = async (url) => {
    const href = String(url);
    snapshotCalls.push(href);
    if (href.includes('/auth/v1/user')) return response({ id: '33333333-3333-4333-8333-333333333333', email: 'third@valorae.test' });
    throw new Error(`unexpected database call ${href}`);
  };
  const snapshot = await call('upsert_snapshot', 'minimal-snapshot-token', { domain: 'portfolio', snapshot_key: 'latest', payload: { ignored: true } });
  assert.equal(snapshot.res.statusCode, 200, JSON.stringify(snapshot.body));
  assert.equal(snapshot.body.featureDisabled, true);
  assert.equal(snapshotCalls.length, 1, 'snapshot legado deve apenas validar a sessão e não acessar tabelas/RPCs do banco');

  const sql = fs.readFileSync(new URL('../supabase/013_valorae_minimal_financial_sync_v2.sql', import.meta.url), 'utf8');
  const createdTables = [...sql.matchAll(/create table if not exists public\.([a-z0-9_]+)/gi)].map(match => match[1]);
  assert.deepEqual(createdTables, ['valorae_financial_transactions', 'valorae_financial_dividends']);
  assert.match(sql, /user_id uuid not null references auth\.users\(id\)/i);
  assert.match(sql, /where \(public\.valorae_financial_transactions[\s\S]*?is distinct from/i);
  assert.match(sql, /where \(public\.valorae_financial_dividends[\s\S]*?is distinct from/i);
  const newTableSection = sql.slice(0, sql.indexOf('create or replace function'));
  assert.doesNotMatch(newTableSection, /\bpayload\s+jsonb\b/i, 'novas tabelas não devem duplicar linhas em payload JSON');
  assert.doesNotMatch(sql.slice(0, sql.indexOf('-- Migração única do legado.')), /valorae_user_snapshots|valorae_sync_backups|valorae_monitor_events|valorae_runtime_shared_state/i);
} finally {
  if (old.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = old.url;
  if (old.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = old.key;
  if (old.anon === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = old.anon;
  globalThis.fetch = old.fetch;
}

console.log('minimal financial sync v363 OK');
