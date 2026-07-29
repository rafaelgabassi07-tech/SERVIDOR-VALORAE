import assert from 'node:assert/strict';
import { invokeSync, jsonResponse, withMinimalSupabase } from './helpers/minimal-sync-harness.js';

const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function runSuccessfulUpload(action, body) {
  let rpcBody = null;
  await withMinimalSupabase(async (url, init = {}) => {
    const href = String(url);
    if (href.includes('/auth/v1/user')) return jsonResponse({ id: userId, email: 'sync-date@valorae.test' });
    if (href.includes('/rest/v1/rpc/')) {
      rpcBody = JSON.parse(init.body || '{}');
      return jsonResponse({
        ok: true,
        contract: 'valorae-financial-sync-v2',
        count: Array.isArray(rpcBody.p_rows) ? rpcBody.p_rows.length : 0,
        deleted: 0,
        transactions_version: 1,
        dividends_version: 1,
      });
    }
    throw new Error(`unexpected ${href}`);
  }, async () => {
    const result = await invokeSync(action, {
      token: `${action}-${Date.now()}-${Math.random()}`,
      body,
    });
    assert.equal(result.res.statusCode, 200, JSON.stringify(result.payload));
    assert.equal(result.payload.ok, true, JSON.stringify(result.payload));
  });
  assert.ok(rpcBody, 'a RPC de persistência deve ser chamada');
  return rpcBody;
}

const txRpc = await runSuccessfulUpload('upload_transactions', {
  mode: 'replace_symbols',
  symbols: ['PETR4'],
  transactions: [{
    clientTxId: 'b3-br-date-1',
    date: '29/07/2026',
    operation: 'Compra',
    symbol: 'BVMF:PETR4F',
    assetType: 'Ação',
    quantity: 10,
    price: 31.25,
    grossValue: 312.5,
    source: 'Excel B3',
  }],
});
assert.equal(txRpc.p_rows.length, 1);
assert.equal(txRpc.p_rows[0].date, '2026-07-29', 'data brasileira deve chegar em ISO à RPC');
assert.equal(txRpc.p_rows[0].symbol, 'PETR4');
assert.equal(txRpc.p_rows[0].operation, 'COMPRA');

let invalidTxRpcCalled = false;
await withMinimalSupabase(async (url) => {
  const href = String(url);
  if (href.includes('/auth/v1/user')) return jsonResponse({ id: userId });
  if (href.includes('/rest/v1/rpc/')) {
    invalidTxRpcCalled = true;
    return jsonResponse({ ok: true, contract: 'valorae-financial-sync-v2', count: 0 });
  }
  throw new Error(`unexpected ${href}`);
}, async () => {
  const { res, payload } = await invokeSync('upload_transactions', {
    token: `invalid-date-${Date.now()}-${Math.random()}`,
    body: {
      transactions: [{
        clientTxId: 'invalid-date-row',
        date: '31/02/2026',
        operation: 'COMPRA',
        symbol: 'PETR4',
        quantity: 1,
        price: 30,
        grossValue: 30,
      }],
    },
  });
  assert.equal(res.statusCode, 422, JSON.stringify(payload));
  assert.equal(payload.code, 'SYNC_TRANSACTION_ROWS_REJECTED');
  assert.equal(payload.retryable, false);
});
assert.equal(invalidTxRpcCalled, false, 'lote inválido deve ser recusado antes de tocar no banco');

const dividendRpc = await runSuccessfulUpload('upload_dividends', {
  replaceAll: true,
  events: [
    {
      ticker: 'BVMF:PETR4F',
      date_com: '2026-07-20',
      payment_date: '2026-08-15',
      value_per_share: 1.25,
      quantity: 10,
      estimated_amount: 12.5,
      status: 'Juros sobre capital próprio | Previsto',
      source: 'Nuvem',
    },
    {
      ticker: 'PETR4.SA',
      dateCom: '20/07/2026',
      paymentDate: '',
      valuePerShare: 1.25,
      quantity: 10,
      estimatedAmount: 12.5,
      status: 'JCP | Previsto',
      source: 'Proxy',
    },
  ],
});
assert.equal(dividendRpc.p_rows.length, 1, 'evento anunciado e depois enriquecido com pagamento deve persistir uma única vez');
assert.equal(dividendRpc.p_rows[0].ticker, 'PETR4');
assert.equal(dividendRpc.p_rows[0].dateCom, '2026-07-20');
assert.equal(dividendRpc.p_rows[0].paymentDate, '2026-08-15');
assert.match(dividendRpc.p_rows[0].eventId, /^div-/);

let invalidDividendRpcCalled = false;
await withMinimalSupabase(async (url) => {
  const href = String(url);
  if (href.includes('/auth/v1/user')) return jsonResponse({ id: userId });
  if (href.includes('/rest/v1/rpc/')) {
    invalidDividendRpcCalled = true;
    return jsonResponse({ ok: true, contract: 'valorae-financial-sync-v2', count: 0 });
  }
  throw new Error(`unexpected ${href}`);
}, async () => {
  const { res, payload } = await invokeSync('upload_dividends', {
    token: `invalid-dividend-${Date.now()}-${Math.random()}`,
    body: {
      events: [{ ticker: 'PETR4', dateCom: '31/02/2026', valuePerShare: 1, quantity: 1 }],
    },
  });
  assert.equal(res.statusCode, 422, JSON.stringify(payload));
  assert.equal(payload.code, 'SYNC_DIVIDEND_ROWS_REJECTED');
});
assert.equal(invalidDividendRpcCalled, false, 'provento inválido não pode substituir o histórico existente');

await withMinimalSupabase(async (url) => {
  const href = String(url);
  if (href.includes('/auth/v1/user')) return jsonResponse({ id: userId });
  if (href.includes('/rpc/valorae_financial_upload_transactions_v2')) {
    return jsonResponse({ code: '22023', message: 'IVALID_TRANSACTION_ROWS', details: 'received=1 valid=0 rejected=1' }, 400);
  }
  throw new Error(`unexpected ${href}`);
}, async () => {
  const { res, payload } = await invokeSync('upload_transactions', {
    token: `legacy-sql-error-${Date.now()}-${Math.random()}`,
    body: {
      transactions: [{
        clientTxId: 'legacy-sql-valid-row',
        date: '2026-07-29',
        operation: 'COMPRA',
        symbol: 'PETR4',
        quantity: 1,
        price: 30,
        grossValue: 30,
      }],
    },
  });
  assert.equal(res.statusCode, 422, JSON.stringify(payload));
  assert.equal(payload.code, 'SYNC_TRANSACTION_ROWS_REJECTED');
  assert.equal(payload.retryable, false);
  assert.match(payload.message, /Histórico anterior foi preservado/i);
});

console.log('sync B3 dates and dividend dedupe v406 OK');
