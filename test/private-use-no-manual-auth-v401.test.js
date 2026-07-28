import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VALORAE_REQUEST_HEADERS } from '../lib/core/mobile-protocol.js';

const envExample = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../lib/security/client-auth.js', import.meta.url), 'utf8');
assert.doesNotMatch(envExample, /VALORAE_CLIENT_KEYS|VALORAE_CLIENT_AUTH_MAX_SKEW_MS/);
assert.doesNotMatch(auth, /createHmac|timingSafeEqual|replayState|VALORAE_CLIENT_KEYS/);
for (const header of ['X-Valorae-Signature', 'X-Valorae-Timestamp', 'X-Valorae-Nonce', 'X-Valorae-Content-SHA256']) {
  assert.equal(VALORAE_REQUEST_HEADERS.includes(header), false);
}
console.log('Private use without manual HMAC configuration v401 OK');
