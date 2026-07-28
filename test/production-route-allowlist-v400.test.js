import assert from 'node:assert/strict';
import { _test } from '../routes/_router.js';

const saved = { NODE_ENV: process.env.NODE_ENV, VERCEL: process.env.VERCEL, internal: process.env.VALORAE_ENABLE_INTERNAL_ROUTES };
try {
  process.env.NODE_ENV = 'production';
  process.env.VERCEL = '1';
  delete process.env.VALORAE_ENABLE_INTERNAL_ROUTES;
  for (const route of _test.PRODUCTION_ROUTE_ALLOWLIST) {
    assert.equal(_test.routeAllowedInCurrentRuntime(route), true, `allowlisted route rejected: ${route}`);
  }
  for (const route of ['/admin/status', '/cache/stats', '/scrape', '/batch-scrape', '/openapi', '/contract/observability', '/mobile/bootstrap']) {
    assert.equal(_test.routeAllowedInCurrentRuntime(route), false, `internal route exposed: ${route}`);
  }
  process.env.VALORAE_ENABLE_INTERNAL_ROUTES = '1';
  assert.equal(_test.routeAllowedInCurrentRuntime('/admin/status'), true);
} finally {
  if (saved.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved.NODE_ENV;
  if (saved.VERCEL === undefined) delete process.env.VERCEL; else process.env.VERCEL = saved.VERCEL;
  if (saved.internal === undefined) delete process.env.VALORAE_ENABLE_INTERNAL_ROUTES; else process.env.VALORAE_ENABLE_INTERNAL_ROUTES = saved.internal;
}
console.log('production-route-allowlist-v400 ok');
