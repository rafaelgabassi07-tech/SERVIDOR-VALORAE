import assert from 'node:assert/strict';
import { sanitizeCapturedJson } from '../lib/scrape/json-safety.js';
import { createNetworkJsonCollector } from '../lib/scrape/network-json-capture.js';
import { isPrivateOrSpecialIpAddress, _test as networkTest } from '../lib/scrape/network-safety.js';

const unsafe = JSON.parse('{"rows":[{"dy":8.5}],"access_token":"secret","email":"user@example.com","__proto__":{"polluted":true}}');
const sanitized = sanitizeCapturedJson(unsafe);
assert.equal(sanitized.ok, true);
assert.deepEqual(sanitized.data.rows, [{ dy: 8.5 }]);
assert.equal('access_token' in sanitized.data, false);
assert.equal('email' in sanitized.data, false);
assert.equal(Object.prototype.polluted, undefined);
assert.ok(sanitized.metrics.sensitiveFieldsRemoved >= 2);
assert.ok(sanitized.metrics.prototypeKeysRemoved >= 1);

let deep = {};
let cursor = deep;
for (let index = 0; index < 30; index += 1) cursor = cursor.next = {};
assert.equal(sanitizeCapturedJson(deep, { maxDepth: 8 }).ok, false);

for (const address of [
  '::ffff:127.0.0.1', '::127.0.0.1', '64:ff9b::7f00:1', '100::1',
  '2001::1', '2001:db8::1', '2002:7f00:1::', '3fff::1', '5f00::1',
  'fec0::1', '2620:4f:8000::1',
]) assert.equal(isPrivateOrSpecialIpAddress(address), true, address);
assert.equal(isPrivateOrSpecialIpAddress('2606:4700:4700::1111'), false);
assert.ok(networkTest.parseIpv6BigInt('2001:0db8::1') !== null);

function response({ delayMs = 0, serverAddress = '8.8.8.8', value = 1 } = {}) {
  const body = Buffer.from(JSON.stringify({ rows: [{ value }], refresh_token: 'remove-me' }));
  return {
    status: () => 200,
    url: () => `https://investidor10.com.br/api/chart/${value}`,
    headers: () => ({ 'content-type': 'application/json', 'content-length': String(body.length) }),
    request: () => ({ method: () => 'GET', resourceType: () => 'xhr' }),
    serverAddr: async () => serverAddress ? { ipAddress: serverAddress, port: 443 } : null,
    body: async () => { if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs)); return body; },
  };
}

const bounded = createNetworkJsonCollector({
  targetUrl: 'https://investidor10.com.br/acoes/petr4/',
  maxDocuments: 2,
  maxPending: 4,
  settleTimeoutMs: 80,
});
for (let index = 0; index < 12; index += 1) bounded.observe(response({ delayMs: 15, value: index + 1 }));
const docs = await bounded.settle();
assert.ok(docs.length <= 2);
assert.ok(bounded.diagnostics().skippedBackpressure >= 1);
assert.ok(docs.every(item => !('refresh_token' in item.data)));

const timed = createNetworkJsonCollector({
  targetUrl: 'https://investidor10.com.br/acoes/petr4/',
  settleTimeoutMs: 50,
});
timed.observe(response({ delayMs: 200 }));
const started = Date.now();
assert.deepEqual(await timed.settle(), []);
assert.ok(Date.now() - started < 180);
assert.equal(timed.diagnostics().settleTimeouts, 1);
await new Promise(resolve => setTimeout(resolve, 220));
assert.deepEqual(timed.documents, []);

const noAddress = createNetworkJsonCollector({ targetUrl: 'https://investidor10.com.br/acoes/petr4/' });
noAddress.observe(response({ serverAddress: '' }));
assert.deepEqual(await noAddress.settle(), []);
assert.equal(noAddress.diagnostics().skippedAddress, 1);

console.log('extraction-runtime-safety-v362 ok');
