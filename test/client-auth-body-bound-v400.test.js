import assert from 'node:assert/strict';
import { isCanonicalValoraeApkRequest, resolveClientAuth, shouldRequireClientAuth } from '../lib/security/client-auth.js';

const saved = { NODE_ENV: process.env.NODE_ENV, VERCEL: process.env.VERCEL, APK_ONLY: process.env.VALORAE_APK_ONLY };
const headers = {
  'x-valorae-app': 'VALORAE Android',
  'x-valorae-channel': 'android',
  'x-valorae-app-id': 'com.aistudio.carteira.kxmpzq',
  'x-valorae-mobile-protocol': '2026.07.10.10',
  'x-valorae-app-version': '2026.07.27.02',
  'x-valorae-build': 'release',
  'x-request-id': 'private-use-test',
};
try {
  process.env.NODE_ENV = 'production';
  process.env.VERCEL = '1';
  const req = { method: 'POST', url: '/api/v1/mobile/alerts', headers, body: { includeNews: true } };
  assert.equal(isCanonicalValoraeApkRequest(req), true);
  assert.equal(resolveClientAuth(req).ok, true);
  assert.equal(shouldRequireClientAuth(), false);

  const invalid = { ...req, headers: { ...headers, 'x-valorae-app-id': 'outro.app' } };
  assert.equal(isCanonicalValoraeApkRequest(invalid), false);
  assert.equal(resolveClientAuth(invalid).ok, true, 'HMAC opcional não deve bloquear: o roteador aplica APK_ONLY separadamente');

  assert.equal(shouldRequireClientAuth({ requireClientAuth: true }), true);
  assert.equal(resolveClientAuth(req, { requireClientAuth: true }).ok, true);
  assert.equal(resolveClientAuth(invalid, { requireClientAuth: true }).ok, false);
  assert.equal(resolveClientAuth(invalid, { requireClientAuth: true }).reason, 'invalid_apk_identity');

  assert.equal('VALORAE_CLIENT_KEYS' in process.env, false);
  console.log('Private APK identity v401 OK');
} finally {
  for (const [key, value] of Object.entries(saved)) {
    const env = key === 'APK_ONLY' ? 'VALORAE_APK_ONLY' : key;
    if (value === undefined) delete process.env[env]; else process.env[env] = value;
  }
}
