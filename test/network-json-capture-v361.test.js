import assert from 'node:assert/strict';
import { createNetworkJsonCollector, _test } from '../lib/scrape/network-json-capture.js';

function mockResponse({
  url = 'https://investidor10.com.br/api/balancos/resultado/chart/123/3650/?period=10',
  status = 200,
  contentType = 'application/json; charset=utf-8',
  body = { rows: [{ year: 2025, value: 10 }] },
  resourceType = 'xhr',
  serverAddress = '8.8.8.8',
} = {}) {
  const buffer = Buffer.from(JSON.stringify(body));
  return {
    status: () => status,
    url: () => url,
    headers: () => ({ 'content-type': contentType, 'content-length': String(buffer.length) }),
    request: () => ({ method: () => 'GET', resourceType: () => resourceType }),
    body: async () => buffer,
    serverAddr: async () => serverAddress ? { ipAddress: serverAddress, port: 443 } : null,
  };
}

assert.equal(_test.safeStoredUrl('https://investidor10.com.br/api/data?period=10'), 'https://investidor10.com.br/api/data');
assert.equal(_test.safeStoredUrl('https://investidor10.com.br/api/data?token=secret'), '');
assert.equal(_test.contentTypeJson('application/problem+json; charset=utf-8'), true);
assert.equal(_test.apiLikeUrl('https://investidor10.com.br/api/chart/1'), true);
assert.equal(_test.isPrivateOrSpecialHost('127.0.0.1'), true);
assert.equal(_test.isPrivateOrSpecialHost('100.64.0.1'), true);
assert.equal(_test.isPrivateOrSpecialHost('198.18.0.1'), true);
assert.equal(_test.isPrivateOrSpecialHost('::1'), true);
assert.equal(_test.isPrivateOrSpecialHost('fd00::1'), true);
assert.equal(_test.isPrivateOrSpecialHost('::ffff:127.0.0.1'), true);
assert.equal(_test.isPrivateOrSpecialHost('fe80::1'), true);
assert.equal(_test.isPrivateOrSpecialHost('investidor10.com.br'), false);

const collector = createNetworkJsonCollector({
  targetUrl: 'https://investidor10.com.br/acoes/petr4/',
  maxDocuments: 4,
  maxDocumentBytes: 32_000,
  maxTotalBytes: 64_000,
});
collector.observe(mockResponse());
collector.observe(mockResponse());
collector.observe(mockResponse({ url: 'https://evil.example/api/data' }));
collector.observe(mockResponse({ url: 'https://investidor10.com.br/auth/token' }));
collector.observe(mockResponse({ status: 500 }));
collector.observe(mockResponse({ contentType: 'text/html', url: 'https://investidor10.com.br/noticia' }));
collector.observe(mockResponse({ url: 'https://investidor10.com.br/api/private', serverAddress: '127.0.0.1' }));
const captured = await collector.settle();
const diagnostics = collector.diagnostics();
assert.equal(captured.length, 1);
assert.equal(captured[0].url, 'https://investidor10.com.br/api/balancos/resultado/chart/123/3650/');
assert.equal(diagnostics.duplicateDocuments, 1);
assert.equal(diagnostics.skippedHost, 1);
assert.equal(diagnostics.skippedSensitive, 1);
assert.equal(diagnostics.skippedStatus, 1);
assert.equal(diagnostics.skippedType, 1);
assert.equal(diagnostics.skippedAddress, 1);
assert.ok(diagnostics.serverAddressChecks >= 2);
assert.equal(diagnostics.accepted, 1);
assert.ok(diagnostics.capturedBytes > 0);

console.log('network-json-capture-v361 ok');
