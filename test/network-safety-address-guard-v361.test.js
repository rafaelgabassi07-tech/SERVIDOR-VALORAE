import assert from 'node:assert/strict';
import {
  isPrivateOrSpecialHost,
  isPrivateOrSpecialIpAddress,
  resetNetworkSafetyStateForTests,
  resolvePublicHost,
} from '../lib/scrape/network-safety.js';

for (const value of ['127.0.0.1', '10.0.0.1', '100.64.0.1', '169.254.1.1', '198.18.0.1', '203.0.113.1', '::1', 'fd00::1', 'fe80::1', '2001:db8::1', '::ffff:127.0.0.1', '::ffff:7f00:1']) {
  assert.equal(isPrivateOrSpecialIpAddress(value), true, `${value} deveria ser bloqueado`);
}
for (const value of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
  assert.equal(isPrivateOrSpecialIpAddress(value), false, `${value} deveria ser público`);
}
assert.equal(isPrivateOrSpecialHost('service.internal'), true);
assert.equal(isPrivateOrSpecialHost('investidor10.com.br'), false);

resetNetworkSafetyStateForTests();
let lookups = 0;
const publicLookup = async () => { lookups += 1; return [{ address: '8.8.8.8', family: 4 }, { address: '2606:4700:4700::1111', family: 6 }]; };
const first = await resolvePublicHost('public.example', { lookup: publicLookup, ttlMs: 60_000 });
const second = await resolvePublicHost('public.example', { lookup: publicLookup, ttlMs: 60_000 });
assert.equal(first.length, 2);
assert.equal(second.length, 2);
assert.equal(lookups, 1, 'resoluções públicas devem usar cache limitado');

await assert.rejects(
  resolvePublicHost('rebind.example', { lookup: async () => [{ address: '192.168.1.10', family: 4 }] }),
  error => error?.code === 'UNSAFE_RESOLVED_ADDRESS',
);
await assert.rejects(
  resolvePublicHost('empty.example', { lookup: async () => [] }),
  error => error?.code === 'HOST_RESOLUTION_EMPTY',
);

console.log('network-safety-address-guard-v361 ok');
