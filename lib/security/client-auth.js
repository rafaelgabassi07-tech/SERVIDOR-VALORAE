export const VALORAE_CLIENT_AUTH_VERSION = '21.12.398-apk-compatibility-v1';

import { normalizeApkVersion } from '../core/apk-compatibility.js';

function header(req, name) {
  const headers = req?.headers || {};
  return String(headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()] ?? '').trim();
}

function productionRuntime() {
  return process.env.VERCEL === '1' || String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function disabled(value) {
  return ['0', 'false', 'no', 'nao', 'não', 'off'].includes(String(value || '').trim().toLowerCase());
}

export function isValoraeApkIdentityAttempt(req) {
  const app = header(req, 'x-valorae-app').toLowerCase();
  const channel = header(req, 'x-valorae-channel').toLowerCase();
  const appId = header(req, 'x-valorae-app-id');
  const protocol = header(req, 'x-valorae-mobile-protocol');
  const build = header(req, 'x-valorae-build').toLowerCase();
  const expectedAppId = String(process.env.VALORAE_ANDROID_APP_ID || 'com.aistudio.carteira.kxmpzq').trim();
  const expectedProtocol = String(process.env.VALORAE_MOBILE_PROTOCOL || '2026.07.10.10').trim();
  return channel === 'android'
    && app === 'valorae android'
    && appId === expectedAppId
    && protocol === expectedProtocol
    && (build === 'release' || build === 'debug');
}

export function isCanonicalValoraeApkRequest(req) {
  return isValoraeApkIdentityAttempt(req)
    && Boolean(normalizeApkVersion(header(req, 'x-valorae-app-version')));
}

/**
 * Identificação leve para uso privado. Não exige segredo embutido no APK.
 * A sincronização financeira continua protegida pelo Bearer do Supabase.
 */
export function resolveClientAuth(req, options = {}) {
  const required = shouldRequireClientAuth(options);
  const canonical = isCanonicalValoraeApkRequest(req);
  const appId = header(req, 'x-valorae-app-id') || undefined;
  return {
    version: VALORAE_CLIENT_AUTH_VERSION,
    mode: canonical || required ? 'apk-identity' : 'open',
    configured: true,
    required,
    ok: !required || canonical,
    appId,
    strategy: canonical ? 'canonical_apk_headers' : 'none',
    reason: required && !canonical ? 'invalid_apk_identity' : undefined,
  };
}

export function shouldRequireClientAuth(options = {}) {
  if (options.requireClientAuth === true) return true;
  if (options.requireClientAuth === false) return false;
  return false;
}

export function shouldRequireValoraeApkRequest(options = {}) {
  if (options.requireApkOnly === true) return true;
  if (options.requireApkOnly === false) return false;
  const configured = process.env.VALORAE_APK_ONLY;
  if (configured !== undefined && configured !== null && configured !== '') return !disabled(configured);
  return productionRuntime();
}

export const _test = { header, productionRuntime, disabled };
