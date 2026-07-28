import { createHmac, timingSafeEqual } from 'node:crypto';

export const VALORAE_CLIENT_AUTH_VERSION = '21.12.25-light-client-auth';

function header(req, name) {
  const h = req?.headers || {};
  return String(h[name] ?? h[name.toLowerCase()] ?? h[name.toUpperCase()] ?? '').trim();
}

function parseKeys() {
  const raw = String(process.env.VALORAE_CLIENT_KEYS || '').trim();
  const map = new Map();
  if (!raw) return map;
  for (const item of raw.split(',')) {
    const [id, ...rest] = item.split(':');
    const key = rest.join(':');
    if (id?.trim() && key?.trim()) map.set(id.trim(), key.trim());
  }
  return map;
}

function safeEqual(a = '', b = '') {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  try { return timingSafeEqual(ab, bb); } catch { return false; }
}

function signatureBase(req, timestamp) {
  let url;
  try { url = new URL(req?.url || '/', 'https://valorae.local'); } catch { url = { pathname: '/', search: '' }; }
  return [String(req?.method || 'GET').toUpperCase(), url.pathname, url.search || '', String(timestamp || '')].join('\n');
}

export function resolveClientAuth(req) {
  const keys = parseKeys();
  const configured = keys.size > 0;
  let query = {};
  try { query = Object.fromEntries(new URL(req?.url || '/', 'https://valorae.local').searchParams.entries()); } catch {}
  const appId = header(req, 'x-valorae-app-id') || header(req, 'x-valorae-app') || query.appId || query.app || '';
  const clientKey = header(req, 'x-valorae-client-key') || query.clientKey || '';
  const signature = header(req, 'x-valorae-signature') || query.signature || '';
  const timestamp = header(req, 'x-valorae-timestamp') || query.timestamp || '';

  if (!configured) {
    return { version: VALORAE_CLIENT_AUTH_VERSION, mode: 'open', configured: false, required: false, ok: true, appId: appId || undefined, strategy: 'no_keys_configured' };
  }
  const expectedKey = keys.get(String(appId));
  if (!appId || !expectedKey) {
    return { version: VALORAE_CLIENT_AUTH_VERSION, mode: 'configured', configured: true, required: false, ok: false, appId: appId || undefined, reason: 'unknown_app_id' };
  }
  if (clientKey && safeEqual(clientKey, expectedKey)) {
    return { version: VALORAE_CLIENT_AUTH_VERSION, mode: 'configured', configured: true, required: false, ok: true, appId, strategy: 'client_key' };
  }
  if (signature && timestamp) {
    const expected = createHmac('sha256', expectedKey).update(signatureBase(req, timestamp)).digest('hex');
    if (safeEqual(signature.replace(/^sha256=/, ''), expected)) {
      return { version: VALORAE_CLIENT_AUTH_VERSION, mode: 'configured', configured: true, required: false, ok: true, appId, strategy: 'hmac' };
    }
    return { version: VALORAE_CLIENT_AUTH_VERSION, mode: 'configured', configured: true, required: false, ok: false, appId, reason: 'invalid_signature' };
  }
  return { version: VALORAE_CLIENT_AUTH_VERSION, mode: 'configured', configured: true, required: false, ok: false, appId, reason: 'missing_client_key_or_signature' };
}

export function shouldRequireClientAuth(options = {}) {
  if (options.requireClientAuth === true) return true;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(process.env.VALORAE_REQUIRE_CLIENT_AUTH || '').toLowerCase());
}

export function isCanonicalValoraeApkRequest(req) {
  const app = header(req, 'x-valorae-app').toLowerCase();
  const channel = header(req, 'x-valorae-channel').toLowerCase();
  const appId = header(req, 'x-valorae-app-id');
  const protocol = header(req, 'x-valorae-mobile-protocol');
  const appVersion = header(req, 'x-valorae-app-version');
  const build = header(req, 'x-valorae-build').toLowerCase();
  const expectedAppId = String(process.env.VALORAE_ANDROID_APP_ID || 'com.aistudio.carteira.kxmpzq').trim();
  const expectedProtocol = String(process.env.VALORAE_MOBILE_PROTOCOL || '2026.07.10.10').trim();
  return channel === 'android'
    && app === 'valorae android'
    && appId === expectedAppId
    && protocol === expectedProtocol
    && appVersion.length >= 3
    && (build === 'release' || build === 'debug');
}

export function shouldRequireValoraeApkRequest(options = {}) {
  if (options.requireApkOnly === true) return true;
  if (options.requireApkOnly === false) return false;
  const configured = String(process.env.VALORAE_APK_ONLY || '').trim().toLowerCase();
  if (['0', 'false', 'no', 'nao', 'não', 'off'].includes(configured)) return false;
  if (['1', 'true', 'yes', 'sim', 'on'].includes(configured)) return true;
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}
