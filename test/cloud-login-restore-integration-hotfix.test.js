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

function request(action) {
  return {
    method: 'GET',
    url: `/api/sync?action=${action}`,
    query: { action },
    headers: { host: 'valorae.test', authorization: 'Bearer user-access-token' },
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

async function call(action) {
  const res = new MockRes();
  await syncHandler(request(action), res);
  return { res, body: typeof res.body === 'string' ? JSON.parse(res.body) : res.body };
}

const previous = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  anon: process.env.SUPABASE_ANON_KEY,
  fetch: globalThis.fetch,
};
try {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.SUPABASE_ANON_KEY = 'anon-test';
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/auth/v1/user')) {
      return response({ id: 'uuid-user-1', email: 'conta@valorae.com' });
    }
    if (href.includes('/rpc/valorae_sync_get_state')) {
      return response({ revision: 7, deletion_generation: 0, tombstone: false });
    }
    if (href.includes('/valorae_transactions?')) {
      if (href.includes('uuid-user-1')) return response([]);
      if (href.includes('conta%40valorae.com')) {
        return response([{ client_tx_id: 'legacy-1', symbol: 'PETR4', operation: 'COMPRA', quantity: 10, price: 30, gross_value: 300, date: '2026-07-20', payload: {} }]);
      }
    }
    if (href.includes('/valorae_dividend_events?')) {
      if (href.includes('uuid-user-1')) return response([]);
      if (href.includes('conta%40valorae.com')) {
        return response([{ ticker: 'PETR4', date_com: '2026-07-10', payment_date: '2026-08-20', value_per_share: 0.5, quantity: 10, estimated_amount: 5, payload: {} }]);
      }
    }
    return response([]);
  };

  const transactions = await call('get_transactions');
  assert.equal(transactions.res.statusCode, 200);
  assert.equal(transactions.body.ok, true);
  assert.equal(transactions.body.identitySource, 'legacy_verified_email');
  assert.equal(transactions.body.transactions.length, 1);
  assert.equal(transactions.body.transactions[0].symbol, 'PETR4');
  assert.equal(transactions.body.transactions[0].date, '2026-07-20');

  const dividends = await call('get_dividend_events');
  assert.equal(dividends.res.statusCode, 200);
  assert.equal(dividends.body.ok, true);
  assert.equal(dividends.body.identitySource, 'legacy_verified_email');
  assert.equal(dividends.body.events.length, 1);
  assert.equal(dividends.body.events[0].ticker, 'PETR4');
  assert.equal(dividends.body.events[0].valuePerShare, 0.5);
} finally {
  if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
  if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
  if (previous.anon === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previous.anon;
  globalThis.fetch = previous.fetch;
}

console.log('cloud login restore integration hotfix OK');
