import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dispatchRoute } from '../routes/_router.js';

function mockReq(url, headers = {}) {
  return {
    method: 'OPTIONS',
    url,
    query: {},
    headers: { host: 'example.vercel.app', origin: 'https://app.example.com', ...headers },
    socket: { remoteAddress: '127.0.0.1' },
  };
}
function mockGetReq(url) {
  return { method: 'GET', url, query: {}, headers: { host: 'example.vercel.app' }, socket: { remoteAddress: '127.0.0.1' } };
}
function mockRes() {
  return {
    statusCode: 200,
    body: '',
    headers: {},
    writableEnded: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = String(v); },
    getHeader(k) { return this.headers[String(k).toLowerCase()]; },
    removeHeader(k) { delete this.headers[String(k).toLowerCase()]; },
    status(c) { this.statusCode = c; return this; },
    send(b) { this.body += String(b ?? ''); this.writableEnded = true; return this; },
    end(b = '') { this.body += String(b ?? ''); this.writableEnded = true; return this; },
  };
}

const optionsReq = mockReq('/api/v1/asset', { 'access-control-request-headers': 'x-valorae-app-version,x-valorae-build,x-valorae-client-key' });
const optionsRes = mockRes();
await dispatchRoute(optionsReq, optionsRes);
assert.equal(optionsRes.statusCode, 200);
const allowHeaders = optionsRes.headers['access-control-allow-headers'].toLowerCase();
for (const header of ['x-valorae-app', 'x-valorae-channel', 'x-valorae-app-version', 'x-valorae-build', 'x-valorae-app-id', 'x-valorae-client-key']) {
  assert.ok(allowHeaders.includes(header), `CORS deve liberar ${header}`);
}
const exposed = optionsRes.headers['access-control-expose-headers'].toLowerCase();
for (const header of ['x-valorae-auth-mode', 'x-valorae-response-bytes', 'x-valorae-cache-policy']) {
  assert.ok(exposed.includes(header), `CORS deve expor ${header}`);
}

const sdkRes = mockRes();
await dispatchRoute(mockGetReq('/api/v1/integration/sdk'), sdkRes);
assert.equal(sdkRes.statusCode, 200);
const sdk = JSON.parse(sdkRes.body);
assert.ok(sdk.stableRoots.includes('engineLaunchGate'));
assert.ok(sdk.stableRoots.includes('engineRuntimeProfiler'));
assert.ok(sdk.examples.javascript.includes('AbortController'));
assert.ok(sdk.examples.javascript.includes('shouldReplaceLocalCache'));
assert.ok(sdk.headers.includes('x-valorae-build'));

const server = fs.readFileSync('server.js', 'utf8');
assert.ok(server.includes('MAX_LOCAL_BODY_BYTES'));
assert.ok(server.includes('INVALID_JSON'));
assert.ok(server.includes('applyStaticSecurityHeaders'));

const readme = fs.readFileSync('README.md', 'utf8');
assert.ok(readme.includes('Política de manutenção'));
assert.ok(fs.readFileSync('.env.example', 'utf8').includes('VALORAE_PUBLIC_BASE_URL'));

console.log('personal-launch-polish-v21-12-33 ok');
