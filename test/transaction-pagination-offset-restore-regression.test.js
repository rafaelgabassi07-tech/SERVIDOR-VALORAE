import assert from 'node:assert/strict';
import syncHandler from '../routes/sync.js';
import { encodeRevisionCursor } from '../lib/sync/financial-integrity.js';

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
    headers: { host: 'valorae.test', authorization: 'Bearer offset-restore-token' },
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
  client_tx_id: `b3-offset-${String(index).padStart(4, '0')}`,
  ticker: index % 2 === 0 ? 'PETR4' : 'VALE3',
  quantity: 1,
  purchase_price: 10 + index / 100,
  transaction_date: new Date(Date.UTC(2026, 6, 25) - index * 86_400_000).toISOString(),
  payload: {
    operation: 'COMPRA',
    source: 'B3',
    date: new Date(Date.UTC(2026, 6, 25) - index * 86_400_000).toISOString().slice(0, 10),
  },
}));

const previous = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  anon: process.env.SUPABASE_ANON_KEY,
  cursor: process.env.VALORAE_SYNC_CURSOR_SECRET,
  fetch: globalThis.fetch,
};

try {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.SUPABASE_ANON_KEY = 'anon-test';
  process.env.VALORAE_SYNC_CURSOR_SECRET = 'current-deployment-secret';

  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/auth/v1/user')) return response({ id: 'offset-restore-user', email: '' });
    if (href.includes('/rpc/valorae_sync_get_state')) {
      return response({ revision: 44, deletion_generation: 0, tombstone: false });
    }
    if (href.includes('/valorae_transactions?')) {
      const parsed = new URL(href);
      const offset = Number(parsed.searchParams.get('offset') || 0);
      const limit = Number(parsed.searchParams.get('limit') || 500);
      return response(rows.slice(offset, offset + limit));
    }
    return response([]);
  };

  // The APK restore mode should fit a normal B3 history in one response and avoid opaque cursors.
  const restore = await call({ pagination: 'restore-v1', offset: '0', limit: '5000' });
  assert.equal(restore.res.statusCode, 200, JSON.stringify(restore.body));
  assert.equal(restore.body.count, 1620);
  assert.equal(restore.body.has_more, false);
  assert.equal(restore.body.next_offset, null);
  assert.equal(restore.body.paginationMode, 'restore-v1');
  assert.equal(restore.body.paginationProtocol, 'transactions-restore-v1');

  // Offset mode remains available when histories exceed the restore-page cap selected by a client.
  const first = await call({ pagination: 'offset-v1', offset: '0', limit: '600' });
  assert.equal(first.res.statusCode, 200, JSON.stringify(first.body));
  assert.equal(first.body.count, 600);
  assert.equal(first.body.next_offset, 600);
  assert.equal(first.body.has_more, true);

  const second = await call({ pagination: 'offset-v1', offset: String(first.body.next_offset), limit: '600' });
  assert.equal(second.body.count, 600);
  assert.equal(second.body.next_offset, 1200);

  const third = await call({ pagination: 'offset-v1', offset: String(second.body.next_offset), limit: '600' });
  assert.equal(third.body.count, 420);
  assert.equal(third.body.has_more, false);
  assert.equal(third.body.next_offset, null);

  const ids = [...first.body.transactions, ...second.body.transactions, ...third.body.transactions]
    .map((item) => item.clientTxId);
  assert.equal(new Set(ids).size, 1620);

  // A legacy cursor produced by another deployment secret must not reject a read-only page.
  const legacyCursor = encodeRevisionCursor({
    offset: 500,
    revision: 44,
    deletionGeneration: 0,
    tombstone: false,
  }, 'previous-deployment-secret');
  const recovered = await call({ cursor: legacyCursor, limit: '500' });
  assert.equal(recovered.res.statusCode, 200, JSON.stringify(recovered.body));
  assert.equal(recovered.body.count, 500);
  assert.equal(recovered.body.legacyCursorRecovered, true);
} finally {
  if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
  if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
  if (previous.anon === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previous.anon;
  if (previous.cursor === undefined) delete process.env.VALORAE_SYNC_CURSOR_SECRET; else process.env.VALORAE_SYNC_CURSOR_SECRET = previous.cursor;
  globalThis.fetch = previous.fetch;
}

console.log('transaction pagination offset/restore regression OK');
