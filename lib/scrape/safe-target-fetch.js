import { resolvePublicHost, isPrivateOrSpecialHost } from './network-safety.js';
import { fetchText } from '../sources/fetch.js';

export const VALORAE_SAFE_TARGET_FETCH_POLICY = 'allowlisted-dns-validated-manual-redirects-v1';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const SENSITIVE_PATH = /(?:^|\/)(?:auth|login|logout|oauth|token|session|captcha|password|register|signup|signin|signout|account\/me|user\/me)(?:\/|$)/i;
const SENSITIVE_QUERY_KEYS = new Set([
  'token', 'accesstoken', 'refreshtoken', 'idtoken', 'auth', 'authorization',
  'secret', 'password', 'passwd', 'session', 'sessionid', 'cookie', 'email',
  'cpf', 'clientkey', 'apikey',
]);

function normalizedQueryKey(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? Math.floor(number) : fallback));
}

function normalizedAllowedHosts(values = []) {
  const input = values instanceof Set ? [...values] : Array.isArray(values) ? values : String(values || '').split(',');
  return new Set(input.map(value => String(value || '').trim().replace(/^\.+|\.+$/g, '').toLowerCase()).filter(Boolean));
}

function hostAllowed(hostname = '', allowedHosts = [], allowSubdomains = true) {
  const host = String(hostname || '').trim().replace(/\.$/, '').toLowerCase();
  if (!host) return false;
  for (const base of normalizedAllowedHosts(allowedHosts)) {
    if (host === base || (allowSubdomains && host.endsWith(`.${base}`))) return true;
  }
  return false;
}

function safeDiagnosticUrl(value = '') {
  try {
    const url = new URL(String(value || ''));
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function targetError(code, message, status = 400, extras = {}) {
  const error = new Error(message);
  error.name = 'ValoraeSafeTargetError';
  error.code = code;
  error.status = status;
  error.retryable = false;
  Object.assign(error, extras);
  return error;
}

export function validatePublicScrapeTarget(rawUrl = '', { allowedHosts = [], allowSubdomains = true } = {}) {
  let url;
  try { url = new URL(String(rawUrl || '').trim()); }
  catch { throw targetError('INVALID_TARGET_URL', 'URL de scraping inválida.'); }
  if (url.protocol !== 'https:') throw targetError('INVALID_TARGET_URL_PROTOCOL', 'Somente HTTPS é aceito para scraping controlado.');
  if (url.username || url.password) throw targetError('INVALID_TARGET_URL_CREDENTIALS', 'URL de scraping não pode conter credenciais.');
  if (isPrivateOrSpecialHost(url.hostname)) throw targetError('UNSAFE_TARGET_HOST', 'Host privado ou especial não é permitido.', 403);
  if (!hostAllowed(url.hostname, allowedHosts, allowSubdomains)) throw targetError('SCRAPE_HOST_NOT_ALLOWED', 'Host fora da allowlist do Valorae Proxy.', 403, { hostname: url.hostname });
  if (SENSITIVE_PATH.test(url.pathname)) throw targetError('SENSITIVE_TARGET_PATH', 'Caminho sensível não é permitido para scraping.', 403);
  for (const key of url.searchParams.keys()) {
    if (SENSITIVE_QUERY_KEYS.has(normalizedQueryKey(key))) throw targetError('SENSITIVE_TARGET_QUERY', 'Parâmetro sensível não é permitido para scraping.', 403);
  }
  url.hash = '';
  return url;
}

async function defaultFetcher(url, options = {}) {
  return fetchText(url, {
    timeoutMs: options.timeoutMs,
    headers: options.headers,
    signal: options.signal,
    retries: 0,
    ttlMs: 30_000,
    staleMs: 0,
    redirect: 'manual',
  });
}

/**
 * Fetches an allowlisted public HTTPS target while validating DNS before every
 * request and every redirect. Redirects are followed manually so neither the
 * allowlist nor the public-network boundary can be bypassed by an origin.
 */
export async function fetchAllowedScrapeText(rawUrl, {
  allowedHosts = [],
  timeoutMs = 5_500,
  maxRedirects = 3,
  allowSubdomains = true,
  headers = {},
  signal,
  resolver = resolvePublicHost,
  fetcher = defaultFetcher,
} = {}) {
  const safeTimeoutMs = boundedInteger(timeoutMs, 5_500, 250, 30_000);
  const safeMaxRedirects = boundedInteger(maxRedirects, 3, 0, 5);
  const startedAt = Date.now();
  const visited = new Set();
  const hops = [];
  let current = validatePublicScrapeTarget(rawUrl, { allowedHosts, allowSubdomains });

  for (let redirectCount = 0; ; redirectCount += 1) {
    const canonical = current.toString();
    if (visited.has(canonical)) throw targetError('SCRAPE_REDIRECT_LOOP', 'Loop de redirecionamento detectado.', 502);
    visited.add(canonical);

    const elapsed = Date.now() - startedAt;
    const remainingMs = safeTimeoutMs - elapsed;
    if (remainingMs <= 0) throw targetError('SCRAPE_DEADLINE_EXCEEDED', 'O scraping excedeu o prazo total permitido.', 504);

    try {
      await resolver(current.hostname, { forceRefresh: true, ttlMs: 30_000, maxEntries: 64 });
    } catch (cause) {
      const unsafe = ['UNSAFE_NETWORK_HOST', 'UNSAFE_RESOLVED_ADDRESS'].includes(String(cause?.code || ''));
      throw targetError(
        cause?.code || 'HOST_RESOLUTION_FAILED',
        unsafe ? 'O destino resolveu para uma rede privada ou especial.' : 'Não foi possível validar o DNS público do destino.',
        unsafe ? 403 : 502,
        { cause },
      );
    }
    const fetched = await fetcher(canonical, { timeoutMs: remainingMs, headers, signal, redirect: 'manual' });
    const status = Number(fetched?.status || 0);
    hops.push({ status, url: safeDiagnosticUrl(canonical) });

    if (!REDIRECT_STATUSES.has(status)) {
      return {
        ...fetched,
        url: canonical,
        finalUrl: fetched?.finalUrl || canonical,
        diagnosticUrl: safeDiagnosticUrl(fetched?.finalUrl || canonical),
        redirectCount,
        hops,
        networkSafetyPolicy: VALORAE_SAFE_TARGET_FETCH_POLICY,
      };
    }

    if (redirectCount >= safeMaxRedirects) throw targetError('SCRAPE_REDIRECT_LIMIT', 'A origem excedeu o limite seguro de redirecionamentos.', 502);
    const location = String(fetched?.location || '').trim();
    if (!location) throw targetError('SCRAPE_REDIRECT_LOCATION_MISSING', 'Redirecionamento sem destino válido.', 502);
    let next;
    try { next = new URL(location, current); }
    catch { throw targetError('SCRAPE_REDIRECT_INVALID', 'Destino de redirecionamento inválido.', 502); }
    current = validatePublicScrapeTarget(next.toString(), { allowedHosts, allowSubdomains });
  }
}

export const _test = {
  boundedInteger,
  normalizedAllowedHosts,
  hostAllowed,
  safeDiagnosticUrl,
  SENSITIVE_PATH,
  normalizedQueryKey,
  SENSITIVE_QUERY_KEYS,
};
