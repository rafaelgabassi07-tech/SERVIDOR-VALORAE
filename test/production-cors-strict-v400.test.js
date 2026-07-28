import assert from 'node:assert/strict';
import { applySecurityHeaders } from '../lib/security/guard.js';

function responseStub() {
  const headers = new Map();
  return {
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    headers,
  };
}

const previous = { NODE_ENV: process.env.NODE_ENV, VERCEL: process.env.VERCEL, strict: process.env.VALORAE_CORS_STRICT, origins: process.env.VALORAE_CORS_ALLOW_ORIGINS };
try {
  process.env.NODE_ENV = 'production';
  delete process.env.VERCEL;
  delete process.env.VALORAE_CORS_STRICT;
  delete process.env.VALORAE_CORS_ALLOW_ORIGINS;
  const res = responseStub();
  applySecurityHeaders({ headers: { origin: 'https://host-nao-autorizado.example' }, url: '/api/v1/ready' }, res);
  assert.notEqual(res.getHeader('access-control-allow-origin'), '*');
  assert.equal(res.getHeader('access-control-allow-origin'), 'null');
} finally {
  if (previous.NODE_ENV == null) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.NODE_ENV;
  if (previous.VERCEL == null) delete process.env.VERCEL; else process.env.VERCEL = previous.VERCEL;
  if (previous.strict == null) delete process.env.VALORAE_CORS_STRICT; else process.env.VALORAE_CORS_STRICT = previous.strict;
  if (previous.origins == null) delete process.env.VALORAE_CORS_ALLOW_ORIGINS; else process.env.VALORAE_CORS_ALLOW_ORIGINS = previous.origins;
}
console.log('production CORS strict v400 OK');
