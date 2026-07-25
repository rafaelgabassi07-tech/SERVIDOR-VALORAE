import assert from 'node:assert/strict';
import { _test } from '../routes/sync.js';

const legacyTransaction = _test.storedTransactionToClient({
  id: 91,
  client_tx_id: 'legacy-91',
  symbol: 'petr4',
  operation: 'compra',
  quantity: 12,
  price: 31.5,
  gross_value: 378,
  date: '24/07/2026',
  type: 'acao',
  source: 'legacy-import',
  payload: {},
});
assert.equal(legacyTransaction.symbol, 'PETR4');
assert.equal(legacyTransaction.date, '2026-07-24');
assert.equal(legacyTransaction.operation, 'COMPRA');
assert.equal(legacyTransaction.operationCode, 'BUY');
assert.equal(legacyTransaction.quantity, 12);
assert.equal(legacyTransaction.price, 31.5);
assert.equal(legacyTransaction.grossValue, 378);
assert.equal(legacyTransaction.assetType, 'acao');
assert.equal(legacyTransaction.clientTxId, 'legacy-91');

const currentTransaction = _test.storedTransactionToClient({
  client_tx_id: 'current-1',
  ticker: 'VALE3',
  quantity: 5,
  purchase_price: 62.1,
  transaction_date: '2026-07-23T00:00:00.000Z',
  asset_type: 'stock',
  is_sell: true,
  payload: {
    operation: 'VENDA',
    source: 'APK',
    grossValue: 310.5,
  },
});
assert.equal(currentTransaction.symbol, 'VALE3');
assert.equal(currentTransaction.date, '2026-07-23');
assert.equal(currentTransaction.isSell, true);
assert.equal(currentTransaction.grossValue, 310.5);

const legacyDividendWithEmptyPayload = _test.storedDividendToClient({
  ticker: 'bbas3',
  date_com: '2026-07-10',
  payment_date: '2026-08-15',
  value_per_share: 0.42,
  quantity: 100,
  estimated_amount: 42,
  status: 'A pagar',
  category: 'future',
  source: 'Supabase legado',
  payload: {},
});
assert.equal(legacyDividendWithEmptyPayload.ticker, 'BBAS3');
assert.equal(legacyDividendWithEmptyPayload.dateCom, '2026-07-10');
assert.equal(legacyDividendWithEmptyPayload.paymentDate, '2026-08-15');
assert.equal(legacyDividendWithEmptyPayload.valuePerShare, 0.42);
assert.equal(legacyDividendWithEmptyPayload.estimatedAmount, 42);
assert.equal(legacyDividendWithEmptyPayload.source, 'Supabase legado');

const partialPayloadDividend = _test.storedDividendToClient({
  ticker: 'ITUB4',
  date_com: '2026-07-01',
  payment_date: '2026-08-01',
  value_per_share: 0.18,
  payload: { status: 'oficial' },
});
assert.equal(partialPayloadDividend.ticker, 'ITUB4');
assert.equal(partialPayloadDividend.dateCom, '2026-07-01');
assert.equal(partialPayloadDividend.paymentDate, '2026-08-01');
assert.equal(partialPayloadDividend.valuePerShare, 0.18);
assert.equal(partialPayloadDividend.status, 'oficial');

console.log('cloud restore compatibility hotfix OK');

const previousUrl = process.env.SUPABASE_URL;
const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const previousFetch = globalThis.fetch;
try {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    const body = String(url).includes(encodeURIComponent('conta@valorae.com'))
      ? [{ user_id: 'conta@valorae.com', ticker: 'PETR4' }]
      : [];
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify(body),
    };
  };
  const fallback = await _test.fetchRowsWithLegacyIdentityFallback(
    (identity) => `/rest/v1/valorae_transactions?user_id=eq.${encodeURIComponent(identity)}&select=*`,
    { mode: 'supabase_auth', userId: 'uuid-user-1', email: 'Conta@Valorae.com' },
  );
  assert.equal(fallback.identity, 'legacy_verified_email');
  assert.equal(fallback.rows.length, 1);
  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[0], /uuid-user-1/);
  assert.match(requestedUrls[1], /conta%40valorae\.com/);
} finally {
  if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
  if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  globalThis.fetch = previousFetch;
}

console.log('verified-email legacy identity fallback OK');
