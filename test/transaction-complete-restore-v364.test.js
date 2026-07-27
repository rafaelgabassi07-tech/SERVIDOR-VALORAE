import assert from 'node:assert/strict';
import fs from 'node:fs';
import { invokeSync, jsonResponse, withMinimalSupabase } from './helpers/minimal-sync-harness.js';

const user = { id: '44444444-4444-4444-8444-444444444444', email: 'complete@valorae.test' };

const calls = [];
await withMinimalSupabase(async (url, init = {}) => {
  const href = String(url);
  const body = init.body ? JSON.parse(init.body) : null;
  calls.push({ href, body });
  if (href.includes('/auth/v1/user')) return jsonResponse(user);
  if (href.includes('/rpc/valorae_financial_upload_transactions_v2')) {
    return jsonResponse({ ok: true, contract: 'valorae-financial-sync-v2', count: body.p_rows.length, deleted: 0 });
  }
  throw new Error(`unexpected fetch ${href}`);
}, async () => {
  const { res, payload } = await invokeSync('upload_transactions', {
    token: 'complete-upload-token',
    body: {
      transactions: [
        { clientTxId: 'legacy-collision', date: '2026-01-10', operation: 'COMPRA', symbol: 'PETR4', quantity: 5, price: 30, grossValue: 150, source: 'B3' },
        { clientTxId: 'legacy-collision', date: '2026-01-10', operation: '', symbol: 'PETR4', quantity: -5, price: 31, grossValue: -155, source: 'B3' },
      ],
    },
  });
  assert.equal(res.statusCode, 200, JSON.stringify(payload));
  const rpc = calls.find(call => call.href.includes('/rpc/valorae_financial_upload_transactions_v2'));
  assert.ok(rpc);
  assert.equal(rpc.body.p_rows.length, 2, 'compra e venda não podem ser consolidadas pela colisão do ID');
  assert.notEqual(rpc.body.p_rows[0].clientTxId, rpc.body.p_rows[1].clientTxId);
  const sale = rpc.body.p_rows.find(row => row.operation === 'VENDA');
  assert.ok(sale, 'quantidade/valor assinados devem inferir VENDA');
  assert.equal(sale.quantity, 5);
  assert.equal(sale.grossValue, 155);
  assert.equal(payload.receivedCount, 2);
  assert.equal(payload.normalizedCount, 2);
});

let rpcReached = false;
await withMinimalSupabase(async (url) => {
  const href = String(url);
  if (href.includes('/auth/v1/user')) return jsonResponse(user);
  if (href.includes('/rpc/')) rpcReached = true;
  return jsonResponse({ ok: true, contract: 'valorae-financial-sync-v2' });
}, async () => {
  const { res, payload } = await invokeSync('upload_transactions', {
    token: 'complete-invalid-token',
    body: { transactions: [{ clientTxId: 'bad-row', operation: 'VENDA', symbol: 'PETR4', quantity: 1 }] },
  });
  assert.equal(res.statusCode, 422, JSON.stringify(payload));
  assert.equal(payload.code, 'SYNC_TRANSACTION_ROWS_REJECTED');
  assert.equal(rpcReached, false, 'lote parcial não deve alcançar a RPC');
});

await withMinimalSupabase(async (url) => {
  const href = String(url);
  if (href.includes('/auth/v1/user')) return jsonResponse(user);
  if (href.includes('/rpc/valorae_financial_download_v2')) return jsonResponse({
    ok: true,
    contract: 'valorae-financial-sync-v2',
    transactions: [
      { clientTxId: 'duplicate', date: '2026-01-10', operation: 'COMPRA', symbol: 'PETR4', quantity: 5, price: 30, grossValue: 150 },
      { clientTxId: 'duplicate', date: '2026-02-10', operation: 'VENDA', symbol: 'PETR4', quantity: 5, price: 31, grossValue: 155 },
    ],
    dividends: [],
    transactions_count: 2,
    dividends_count: 0,
  });
  throw new Error(`unexpected fetch ${href}`);
}, async () => {
  const { res, payload } = await invokeSync('download_financial_data', { token: 'complete-download-token' });
  assert.equal(res.statusCode, 502, JSON.stringify(payload));
  assert.equal(payload.code, 'MINIMAL_SYNC_TRANSACTION_IDENTITY_INVALID');
});

const sql = fs.readFileSync(new URL('../supabase/015_valorae_restore_all_transactions_repair.sql', import.meta.url), 'utf8');
assert.match(sql, /t\.ctid::text as row_locator/i);
assert.match(sql, /abs\(public\.valorae_financial_safe_numeric_v2/i);
assert.match(sql, /row_number\(\) over/i);
assert.match(sql, /duplicate_ordinal/i);
assert.doesNotMatch(sql, /delete from public\.valorae_financial_transactions\s*;/i, 'reparo não pode apagar todo o Histórico');

console.log('transaction complete restore v364 OK');
