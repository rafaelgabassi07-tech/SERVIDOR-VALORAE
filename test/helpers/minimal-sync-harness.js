import syncHandler from '../../routes/sync.js';

export class MockRes {
  constructor() { this.headers = {}; this.statusCode = 200; this.body = ''; this.finished = false; this.writableEnded = false; }
  setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; return this; }
  getHeader(key) { return this.headers[String(key).toLowerCase()]; }
  removeHeader(key) { delete this.headers[String(key).toLowerCase()]; }
  status(code) { this.statusCode = code; return this; }
  send(value) { this.body = value; this.finished = true; this.writableEnded = true; return this; }
  end(value = '') { this.body = value; this.finished = true; this.writableEnded = true; return this; }
}

export function jsonResponse(body, status = 200, headers = {}) {
  const map = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => map.get(String(name).toLowerCase()) || null },
    text: async () => typeof body === 'string' ? body : JSON.stringify(body),
  };
}

export function syncRequest(action, token, body = {}, method = 'POST') {
  return {
    method,
    url: '/api/sync',
    query: method === 'GET' ? { action, ...body } : {},
    body: method === 'POST' || method === 'DELETE' ? { action, ...body } : undefined,
    headers: {
      host: 'valorae.test',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'content-type': 'application/json',
      'x-valorae-sync-contract': 'valorae-financial-sync-v2',
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

export async function invokeSync(action, { token = `token-${Date.now()}-${Math.random()}`, body = {}, method = 'POST' } = {}) {
  const res = new MockRes();
  await syncHandler(syncRequest(action, token, body, method), res);
  const payload = typeof res.body === 'string' && res.body ? JSON.parse(res.body) : res.body;
  return { res, payload };
}

export async function withMinimalSupabase(fetchImpl, callback) {
  const old = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anon: process.env.SUPABASE_ANON_KEY,
    publishable: process.env.SUPABASE_PUBLISHABLE_KEY,
    fetch: globalThis.fetch,
  };
  process.env.SUPABASE_URL = 'https://minimal.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-minimal';
  process.env.SUPABASE_ANON_KEY = 'anon-minimal';
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  globalThis.fetch = fetchImpl;
  try { return await callback(); }
  finally {
    for (const [key, value] of Object.entries({
      SUPABASE_URL: old.url,
      SUPABASE_SERVICE_ROLE_KEY: old.key,
      SUPABASE_ANON_KEY: old.anon,
      SUPABASE_PUBLISHABLE_KEY: old.publishable,
    })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    globalThis.fetch = old.fetch;
  }
}
