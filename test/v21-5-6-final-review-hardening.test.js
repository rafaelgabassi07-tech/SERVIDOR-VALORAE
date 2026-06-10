import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dispatchRoute } from '../routes/_router.js';

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    getHeader(k) { return this.headers[String(k).toLowerCase()]; },
    removeHeader(k) { delete this.headers[String(k).toLowerCase()]; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; this.finished = true; return this; },
    end(body = '') { this.body = body; this.finished = true; return this; },
  };
}

const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const hasApiCorsWildcard = (vercel.headers || []).some(entry =>
  String(entry.source || '').includes('/api') &&
  (entry.headers || []).some(h => String(h.key || '').toLowerCase() === 'access-control-allow-origin')
);
assert.equal(hasApiCorsWildcard, false, 'vercel.json não deve sobrescrever CORS runtime da API');

const syncSource = fs.readFileSync('routes/sync.js', 'utf8');
assert.ok(syncSource.includes('supabase_email_password'), 'sync atual deve documentar o modo Supabase Auth sem expor segredo.');
assert.equal(/SERVICE_ROLE_KEY\s*=|SUPABASE_SERVICE_ROLE_KEY\s*=/.test(syncSource), false, 'sync não deve embutir service_role literal, apenas ler ambiente.');

const syncRes = mockRes();
await dispatchRoute({ method: 'GET', url: '/api/sync', query: {}, headers: {}, socket: {} }, syncRes);
const syncPayload = JSON.parse(syncRes.body);
assert.equal(syncRes.statusCode, 200);
assert.equal(syncPayload.route, '/api/sync');
assert.equal(syncPayload.supabase?.authMode, 'supabase_email_password');

const openapi = fs.readFileSync('routes/openapi.js', 'utf8');
assert.ok(openapi.includes('v21.12.0: launch readiness'));
assert.equal(openapi.includes('v20.8 reforça fraquezas'), false);

console.log('v21.12.0 final review hardening tests OK.');
