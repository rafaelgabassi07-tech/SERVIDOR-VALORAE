export const VALORAE_NATIVE_ADAPTIVE_FETCH_VERSION = '21.13.10-native-adaptive-fetch';

const DEFAULT_DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
const DEFAULT_ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36';
const DEFAULT_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,text/plain;q=0.7,*/*;q=0.6';
const SAFE_HEADER_NAME = /^[a-z0-9-]{1,64}$/i;
const BLOCKED_REQUEST_HEADERS = new Set([
  'host', 'connection', 'content-length', 'transfer-encoding', 'upgrade',
  'proxy-authorization', 'proxy-authenticate', 'te', 'trailer', 'expect',
]);

function truthy(value) {
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value || '').toLowerCase());
}

function sanitizeHeaders(headers = {}) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return {};
  const out = {};
  for (const [rawKey, rawValue] of Object.entries(headers)) {
    const key = String(rawKey || '').trim();
    const lower = key.toLowerCase();
    if (!SAFE_HEADER_NAME.test(key) || BLOCKED_REQUEST_HEADERS.has(lower)) continue;
    if (rawValue === undefined || rawValue === null) continue;
    const value = String(rawValue).replace(/[\r\n]/g, ' ').slice(0, 512);
    if (value) out[key] = value;
  }
  return out;
}

function hasHeader(headers = {}, name = '') {
  const lower = String(name || '').toLowerCase();
  return Object.keys(headers || {}).some(key => key.toLowerCase() === lower);
}

function chosenUserAgent(profile = '') {
  const explicit = process.env.VALORAE_USER_AGENT || process.env.USER_AGENT;
  if (explicit) return String(explicit).slice(0, 256);
  const mode = String(profile || process.env.VALORAE_HTTP_CLIENT_PROFILE || '').toLowerCase();
  return mode === 'android' || mode === 'mobile' ? DEFAULT_ANDROID_UA : DEFAULT_DESKTOP_UA;
}

export function buildNativeRequestHeaders(url, inputHeaders = {}, options = {}) {
  const parsed = new URL(url);
  const supplied = sanitizeHeaders(inputHeaders);
  const headers = {
    'User-Agent': chosenUserAgent(options.profile),
    Accept: DEFAULT_ACCEPT,
    'Accept-Language': process.env.VALORAE_ACCEPT_LANGUAGE || 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    Referer: `https://${parsed.hostname}/`,
    ...supplied,
  };
  if (!hasHeader(headers, 'Cache-Control') && truthy(process.env.VALORAE_HTTP_NO_CACHE_HEADER)) headers['Cache-Control'] = 'no-cache';
  return sanitizeHeaders(headers);
}

export function isRetryableHttpStatus(status) {
  const n = Number(status || 0);
  return n === 408 || n === 425 || n === 429 || (n >= 500 && n <= 599);
}

export function retryDelayMs(attempt = 0, { baseMs = 180, maxMs = 2500, jitterRatio = 0.35 } = {}) {
  const base = Math.max(0, Number(baseMs || 0)) * Math.pow(2, Math.max(0, Number(attempt || 0)));
  const jitter = Math.floor(Math.random() * Math.max(1, base * Number(jitterRatio || 0)));
  return Math.min(Math.max(0, Number(maxMs || 0)), Math.floor(base + jitter));
}

export function responseValidators(res) {
  const etag = res?.headers?.get?.('etag') || '';
  const lastModified = res?.headers?.get?.('last-modified') || '';
  return {
    etag: etag ? String(etag).slice(0, 240) : undefined,
    lastModified: lastModified ? String(lastModified).slice(0, 240) : undefined,
  };
}

export function conditionalValidatorHeaders(validators = {}, existingHeaders = {}) {
  const out = {};
  if (validators.etag && !hasHeader(existingHeaders, 'If-None-Match')) out['If-None-Match'] = validators.etag;
  if (validators.lastModified && !hasHeader(existingHeaders, 'If-Modified-Since')) out['If-Modified-Since'] = validators.lastModified;
  return out;
}

export async function readTextLimited(res, { maxBytes = 4_500_000 } = {}) {
  const limit = Math.max(1024, Number(maxBytes || 0));
  const declared = Number(res?.headers?.get?.('content-length') || 0);
  if (Number.isFinite(declared) && declared > limit) {
    const error = new Error(`Resposta remota acima do limite seguro: ${declared} bytes.`);
    error.code = 'REMOTE_BODY_TOO_LARGE';
    error.status = 413;
    throw error;
  }

  if (!res?.body || typeof res.body.getReader !== 'function') {
    const text = await res.text();
    if (Buffer.byteLength(text, 'utf8') > limit) {
      const error = new Error(`Resposta remota acima do limite seguro: ${limit} bytes.`);
      error.code = 'REMOTE_BODY_TOO_LARGE';
      error.status = 413;
      throw error;
    }
    return { text, rawBytes: Buffer.byteLength(text, 'utf8'), truncated: false };
  }

  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    total += chunk.length;
    if (total > limit) {
      try { await reader.cancel(); } catch {}
      const error = new Error(`Resposta remota acima do limite seguro: ${limit} bytes.`);
      error.code = 'REMOTE_BODY_TOO_LARGE';
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return { text: Buffer.concat(chunks).toString('utf8'), rawBytes: total, truncated: false };
}
