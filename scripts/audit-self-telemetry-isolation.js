import assert from 'node:assert/strict';
import { dispatchRoute } from '../routes/_router.js';
import { getServerMetricsSnapshot, resetServerMetricsForTests } from '../lib/observability/server-metrics.js';

function makeReq(url, method = 'GET') {
  return {
    url,
    method,
    headers: {
      host: 'localhost:3000',
      'user-agent': 'ValoraeSelfTelemetryAudit/1.0',
      'x-real-ip': '127.0.0.1',
    },
    query: {},
    body: {},
  };
}

function makeRes() {
  const headers = new Map();
  return {
    statusCode: 200,
    writableEnded: false,
    body: '',
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    removeHeader(name) { headers.delete(String(name).toLowerCase()); },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = String(body ?? ''); this.writableEnded = true; return this; },
    end(body = '') { if (body) this.body += String(body); this.writableEnded = true; return this; },
  };
}

async function call(url) {
  const req = makeReq(url);
  const res = makeRes();
  await dispatchRoute(req, res);
  return { req, res };
}

resetServerMetricsForTests();
for (let i = 0; i < 7; i += 1) await call(`/api/server/metrics?ts=${Date.now()}-${i}`);
let snap = getServerMetricsSnapshot();
assert.equal(snap.summary.requests, 0, 'self polling must not increment requests');
assert.equal(snap.summary.responses, 0, 'self polling must not increment responses');
assert.equal(snap.distributions.status.length, 0, 'self polling must not increment HTTP status distribution');
assert.equal(snap.distributions.cache.length, 0, 'self polling must not increment cache distribution');
assert.equal(snap.distributions.source.length, 0, 'self polling must not increment source distribution');
assert.equal(snap.routeDetails.length, 0, 'self polling must not create route details');

await call('/api/health');
snap = getServerMetricsSnapshot();
assert.equal(snap.summary.requests, 1, 'real API route must increment requests');
assert.equal(snap.summary.responses, 1, 'real API route must increment responses');
assert.equal(snap.distributions.status[0]?.name, '200', 'real route must increment HTTP status');
assert.equal(snap.routeDetails[0]?.route, '/api/health', 'real route must create route detail');

console.log('Self telemetry isolation audit OK');
