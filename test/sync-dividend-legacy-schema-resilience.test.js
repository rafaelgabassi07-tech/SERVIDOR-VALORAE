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

function request(category = '') {
  const query = { action: 'get_dividend_events', ...(category ? { category } : {}) };
  const params = new URLSearchParams(query);
  return {
    method: 'GET',
    url: `/api/sync?${params}`,
    query,
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

async function call(category = '') {
  const res = new MockRes();
  await syncHandler(request(category), res);
  return { res, body: JSON.parse(res.body) };
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
  const seenDividendUrls = [];
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/auth/v1/user')) return response({ id: 'uuid-user-1', email: 'conta@valorae.com' });
    if (href.includes('/rpc/valorae_sync_get_state')) return response({ revision: 7, deletion_generation: 0, tombstone: false });
    if (href.includes('/valorae_dividend_events?')) {
      seenDividendUrls.push(href);
      if (href.includes('uuid-user-1')) {
        return response([
          {
            event_key: 'uuid-dividend-1',
            user_id: 'uuid-user-1',
            ticker: 'PETR4',
            payload: {
              paymentDate: '2026-08-20',
              dateCom: '2026-07-30',
              category: 'future',
              valuePerShare: 0.55,
            },
          },
        ]);
      }
      if (href.includes('conta%40valorae.com')) {
        return response({ code: '22P02', message: 'invalid input syntax for type uuid' }, 400);
      }
    }
    return response([]);
  };

  const result = await call('future');
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.count, 1);
  assert.equal(result.body.events[0].ticker, 'PETR4');
  assert.equal(result.body.events[0].paymentDate, '2026-08-20');
  assert.equal(result.body.identitySource, 'supabase_user_id');
  assert.equal(result.body.legacyIdentitySkipped, true);
  assert.equal(result.body.legacyIdentityError, '22P02');
  assert.equal(seenDividendUrls.length, 2);
  assert.ok(seenDividendUrls.every((href) => !href.includes('order=payment_date')), 'query must not depend on legacy payment_date column');
  assert.ok(seenDividendUrls.every((href) => !href.includes('category=eq.')), 'category must be filtered after payload normalization');
} finally {
  if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
  if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
  if (previous.anon === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previous.anon;
  globalThis.fetch = previous.fetch;
}

console.log('sync dividend legacy schema resilience OK');
