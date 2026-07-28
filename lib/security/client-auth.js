export const VALORAE_CLIENT_AUTH_VERSION = '21.12.27-private-apk-identity';

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
    mode: required ? 'apk-identity' : 'open',
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
