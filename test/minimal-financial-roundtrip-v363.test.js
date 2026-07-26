import assert from 'node:assert/strict';
import { invokeSync, jsonResponse, withMinimalSupabase } from './helpers/minimal-sync-harness.js';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const database = { transactions: [], dividends: [] };
const rpcCalls = [];

await withMinimalSupabase(async (url, init = {}) => {
  const href = String(url);
  const body = init.body ? JSON.parse(init.body) : {};
  if (href.includes('/auth/v1/user')) {
    return jsonResponse({ id: userId, email: 'roundtrip@valorae.test' });
  }
  rpcCalls.push({ href, body });
  if (href.includes('/rpc/valorae_financial_upload_transactions_v2')) {
    assert.equal(body.p_user_id, userId);
    database.transactions = body.p_rows;
    return jsonResponse({ ok: true, contract: 'valorae-financial-sync-v2', count: database.transactions.length, deleted: 0, transactions_version: 0 });
  }
  if (href.includes('/rpc/valorae_financial_upload_dividends_v2')) {
    assert.equal(body.p_user_id, userId);
    database.dividends = body.p_rows;
    return jsonResponse({ ok: true, contract: 'valorae-financial-sync-v2', count: database.dividends.length, deleted: 0, dividends_version: 0 });
  }
  if (href.includes('/rpc/valorae_financial_download_v2')) {
    assert.equal(body.p_user_id, userId);
    return jsonResponse({
      ok: true,
      contract: 'valorae-financial-sync-v2',
      transactions: database.transactions,
      dividends: database.dividends,
      transactions_count: database.transactions.length,
      dividends_count: database.dividends.length,
      transactions_version: 0,
      dividends_version: 0,
    });
  }
  throw new Error(`unexpected ${href}`);
}, async () => {
  const txUpload = await invokeSync('upload_transactions', {
    token: 'install-one-token',
    body: {
      mode: 'replace_symbols',
      symbols: ['PETR4'],
      transactions: [{
        clientTxId: 'b3-petr4-2026-07-26',
        date: '2026-07-26',
        operation: 'COMPRA',
        symbol: 'PETR4',
        assetType: 'Ação',
        quantity: 10,
        price: 31.5,
        grossValue: 315,
        source: 'B3',
      }],
    },
  });
  assert.equal(txUpload.res.statusCode, 200, JSON.stringify(txUpload.payload));
  assert.equal(txUpload.payload.ok, true);

  const dividendUpload = await invokeSync('upload_dividends', {
    token: 'install-one-token',
    body: {
      dividends: [{
        eventId: 'petro-div-2026-08',
        ticker: 'PETR4',
        dateCom: '2026-07-20',
        paymentDate: '2026-08-20',
        valuePerShare: 1.1,
        quantity: 10,
        estimatedAmount: 11,
        status: 'oficial',
        source: 'VALORAE',
      }],
    },
  });
  assert.equal(dividendUpload.res.statusCode, 200, JSON.stringify(dividendUpload.payload));

  // Simula APK reinstalado: token novo, mesmo UUID autenticado, banco local vazio.
  const restore = await invokeSync('download_financial_data', { token: 'install-two-token' });
  assert.equal(restore.res.statusCode, 200, JSON.stringify(restore.payload));
  assert.equal(restore.payload.contract, 'valorae-financial-sync-v2');
  assert.equal(restore.payload.transactionsCount, 1);
  assert.equal(restore.payload.dividendsCount, 1);
  assert.equal(restore.payload.transactions[0].clientTxId, 'b3-petr4-2026-07-26');
  assert.equal(restore.payload.transactions[0].symbol, 'PETR4');
  assert.equal(restore.payload.dividends[0].eventId, 'petro-div-2026-08');
  assert.equal(restore.payload.verifiedEmpty, false);
});

assert.equal(rpcCalls.filter(call => call.href.includes('/rpc/')).length, 3, 'upload de transações, upload de dividendos e uma única restauração');
assert.ok(rpcCalls.every(call => !/snapshot|backup|monitor|runtime_shared_state|sync_user_state|financial_state/.test(call.href)));
console.log('minimal financial upload/reinstall/restore roundtrip v363 OK');
