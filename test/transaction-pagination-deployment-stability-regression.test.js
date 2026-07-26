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

function request(query = {}) {
  const params = new URLSearchParams({ action: 'get_transactions', ...query });
  return {
    method: 'GET',
    url: `/api/sync?${params}`,
    query: { action: 'get_transactions', ...query },
    headers: { host: 'valorae.test', authorization: 'Bearer pagination-regression-token' },
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

async function call(query = {}) {
  const res = new MockRes();
  await syncHandler(request(query), res);
  return { res, body: typeof res.body === 'string' ? JSON.parse(res.body) : res.body };
}

const rows = Array.from({ length: 1620 }, (_, index) => ({
  client_tx_id: `b3-${String(index).padStart(4, '0')}`,
  ticker: index % 2 === 0 ? 'PETR4' : 'VALE3',
  quantity: 1,
  purchase_price: 10 + index / 100,
  transaction_date: new Date(Date.UTC(2026, 6, 25) - index * 86400000).toISOString(),
  payload: { operation: 'COMPRA', source: 'B3', date: new Date(Date.UTC(2026, 6, 25) - index * 86400000).toISOString().slice(0, 10) },
}));

const previous = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  anon: process.env.SUPABASE_ANON_KEY,
  cursor: process.env.VALORAE_SYNC_CURSOR_SECRET,
  fetch: globalThis.fetch,
};

let revision = 30;
try {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.SUPABASE_ANON_KEY = 'anon-test';
  process.env.VALORAE_SYNC_CURSOR_SECRET = 'deployment-a-secret';

  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/auth/v1/user')) return response({ id: 'pagination-user-id', email: '' });
    if (href.includes('/rpc/valorae_sync_get_state')) {
      return response({ revision, deletion_generation: 0, tombstone: false });
    }
    if (href.includes('/valorae_transactions?')) {
      const parsed = new URL(href);
      const offset = Number(parsed.searchParams.get('offset') || 0);
      const limit = Number(parsed.searchParams.get('limit') || 500);
      return response(rows.slice(offset, offset + limit));
    }
    return response([]);
  };

  const first = await call({ limit: '500' });
  assert.equal(first.res.statusCode, 200);
  assert.equal(first.body.count, 500);
  assert.equal(first.body.has_more, true);
  assert.match(first.body.next_cursor, /^tx2\./, 'new cursor must not depend on one Vercel instance secret');
  assert.equal(first.body.cursorVersion, 2);

  // Simulates the next page reaching another serverless instance/deployment while an unrelated
  // snapshot/dividend write increments the global user revision.
  process.env.VALORAE_SYNC_CURSOR_SECRET = 'deployment-b-secret';
  revision = 31;
  const second = await call({ limit: '500', cursor: first.body.next_cursor });
  assert.equal(second.res.statusCode, 200, JSON.stringify(second.body));
  assert.equal(second.body.count, 500);
  assert.equal(second.body.has_more, true);
  assert.equal(second.body.unrelatedRevisionChangeObserved, true);
  assert.equal(second.body.readRevision, 30);
  assert.equal(second.body.currentRevision, 31);

  process.env.VALORAE_SYNC_CURSOR_SECRET = 'deployment-c-secret';
  revision = 32;
  const third = await call({ limit: '500', cursor: second.body.next_cursor });
  assert.equal(third.res.statusCode, 200, JSON.stringify(third.body));
  assert.equal(third.body.count, 500);
  assert.equal(third.body.has_more, true);

  process.env.VALORAE_SYNC_CURSOR_SECRET = 'deployment-d-secret';
  revision = 33;
  const fourth = await call({ limit: '500', cursor: third.body.next_cursor });
  assert.equal(fourth.res.statusCode, 200, JSON.stringify(fourth.body));
  assert.equal(fourth.body.count, 120);
  assert.equal(fourth.body.has_more, false);

  const ids = [
    ...first.body.transactions,
    ...second.body.transactions,
    ...third.body.transactions,
    ...fourth.body.transactions,
  ].map((item) => item.clientTxId);
  assert.equal(new Set(ids).size, 1620, 'histories above the default PostgREST row cap must not be truncated');
} finally {
  if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
  if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
  if (previous.anon === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previous.anon;
  if (previous.cursor === undefined) delete process.env.VALORAE_SYNC_CURSOR_SECRET; else process.env.VALORAE_SYNC_CURSOR_SECRET = previous.cursor;
  globalThis.fetch = previous.fetch;
}

console.log('transaction pagination deployment stability regression OK');
