import assert from 'node:assert/strict';
import { invokeSync, jsonResponse, withMinimalSupabase } from './helpers/minimal-sync-harness.js';

const USER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

// Partial deployment: the v2 table exists, but PostgREST has not exposed the RPC yet.
// The Proxy must write directly through the service-role REST path and acknowledge the outbox.
await withMinimalSupabase(async (url, init = {}) => {
  const href = String(url);
  if (href.includes('/auth/v1/user')) return jsonResponse({ id: USER_ID, email: 'cloud@valorae.test' });
  if (href.includes('/rpc/valorae_financial_upload_transactions_v2')) {
    return jsonResponse({ code: 'PGRST202', message: 'Could not find the function in the schema cache' }, 404);
  }
  if (href.includes('/rest/v1/valorae_financial_transactions')) {
    assert.equal(init.method, 'POST');
    assert.match(String(init.headers?.prefer || ''), /resolution=merge-duplicates/);
    const rows = JSON.parse(init.body);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, USER_ID);
    assert.equal(rows[0].client_tx_id, 'tx-cloud-recovery');
    assert.equal(rows[0].symbol, 'PETR4');
    return jsonResponse([{ client_tx_id: rows[0].client_tx_id, updated_at: '2026-07-30T19:00:00.000Z' }]);
  }
  throw new Error(`unexpected ${href}`);
}, async () => {
  const { res, payload } = await invokeSync('upload_transactions', {
    token: 'cloud-recovery-token',
    body: {
      transactions: [{
        clientTxId: 'tx-cloud-recovery',
        date: '2026-07-30',
        operation: 'COMPRA',
        symbol: 'PETR4',
        quantity: 2,
        price: 35,
        grossValue: 70,
        source: 'Manual',
      }],
    },
  });
  assert.equal(res.statusCode, 200, JSON.stringify(payload));
  assert.equal(payload.ok, true);
  assert.equal(payload.count, 1);
  assert.equal(payload.transport, 'postgrest-fallback');
});

// Incomplete deployment: neither RPC nor v2 table exists. The response must remain retryable,
// because deploying the migration later should automatically release the APK outbox.
await withMinimalSupabase(async (url) => {
  const href = String(url);
  if (href.includes('/auth/v1/user')) return jsonResponse({ id: USER_ID });
  if (href.includes('/rpc/valorae_financial_upload_transactions_v2')) {
    return jsonResponse({ code: 'PGRST202', message: 'Could not find the function' }, 404);
  }
  if (href.includes('/rest/v1/valorae_financial_transactions')) {
    return jsonResponse({ code: 'PGRST205', message: "Could not find the table 'public.valorae_financial_transactions' in the schema cache" }, 404);
  }
  throw new Error(`unexpected ${href}`);
}, async () => {
  const { res, payload } = await invokeSync('upload_transactions', {
    token: 'cloud-migration-token',
    body: {
      transactions: [{
        clientTxId: 'tx-await-migration',
        date: '2026-07-30',
        operation: 'COMPRA',
        symbol: 'VALE3',
        quantity: 1,
        price: 60,
        grossValue: 60,
      }],
    },
  });
  assert.equal(res.statusCode, 503, JSON.stringify(payload));
  assert.equal(payload.code, 'MINIMAL_SYNC_MIGRATION_REQUIRED');
  assert.equal(payload.retryable, true);
  assert.ok(Number(payload.retryAfterMs) >= 15 * 60 * 1000);
});


// Invalid zero-value records must be rejected before either RPC or REST fallback, preserving
// parity with the canonical SQL validation and preventing empty cloud transactions.
await withMinimalSupabase(async (url) => {
  const href = String(url);
  if (href.includes('/auth/v1/user')) return jsonResponse({ id: USER_ID });
  throw new Error(`financial transport should not run for invalid transaction: ${href}`);
}, async () => {
  const { res, payload } = await invokeSync('upload_transactions', {
    token: 'cloud-invalid-row-token',
    body: {
      transactions: [{
        clientTxId: 'tx-zero-value',
        date: '2026-07-30',
        operation: 'COMPRA',
        symbol: 'PETR4',
        quantity: 0,
        price: 0,
        grossValue: 0,
      }],
    },
  });
  assert.equal(res.statusCode, 422, JSON.stringify(payload));
  assert.equal(payload.code, 'SYNC_TRANSACTION_ROWS_REJECTED');
  assert.equal(payload.retryable, false);
});

console.log('cloud transaction recovery v400 OK');
