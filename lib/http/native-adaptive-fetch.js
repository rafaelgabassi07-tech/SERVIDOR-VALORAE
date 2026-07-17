export const VALORAE_NATIVE_ADAPTIVE_FETCH_VERSION = '21.13.10-native-adaptive-fetch';
export const VALORAE_RESPONSE_DECODING_VERSION = '2026.07.16-checkpoint117-charset-v1';
export const VALORAE_FETCH_HARDENING_VERSION = '2026.07.17-checkpoint118-v1';

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

export function responseRetryAfterMs(responseOrHeaders, { nowMs = Date.now(), maxMs = 30_000 } = {}) {
  const headers = responseOrHeaders?.headers || responseOrHeaders;
  const raw = String(headers?.get?.('retry-after') || '').trim();
  if (!raw) return 0;
  let delayMs = 0;
  if (/^\d+(?:\.\d+)?$/.test(raw)) delayMs = Number(raw) * 1000;
  else {
    const timestamp = Date.parse(raw);
    if (Number.isFinite(timestamp)) delayMs = timestamp - Number(nowMs || Date.now());
  }
  if (!Number.isFinite(delayMs) || delayMs <= 0) return 0;
  return Math.min(Math.max(0, Number(maxMs || 0)), Math.ceil(delayMs));
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

function normalizeEncodingLabel(raw = '') {
  const label = String(raw || '').trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  if (!label || label.length > 48) return '';
  const aliases = {
    'utf8': 'utf-8',
    'utf_8': 'utf-8',
    'latin1': 'windows-1252',
    'latin-1': 'windows-1252',
    'iso-8859-1': 'windows-1252',
    'iso8859-1': 'windows-1252',
    'cp1252': 'windows-1252',
    'windows1252': 'windows-1252',
    'utf16': 'utf-16le',
    'utf-16': 'utf-16le',
  };
  return aliases[label] || label;
}

export function detectResponseEncoding(buffer, contentType = '') {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { encoding: 'utf-8', source: 'bom' };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { encoding: 'utf-16le', source: 'bom' };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { encoding: 'utf-16be', source: 'bom' };
  }

  const headerMatch = String(contentType || '').match(/(?:^|;)\s*charset\s*=\s*([^;\s]+)/i);
  const headerEncoding = normalizeEncodingLabel(headerMatch?.[1]);
  if (headerEncoding) return { encoding: headerEncoding, source: 'content-type' };

  const head = bytes.subarray(0, Math.min(bytes.length, 4096)).toString('latin1');
  const directMeta = head.match(/<meta\b[^>]*\bcharset\s*=\s*["']?\s*([^\s"'/>;]+)/i);
  const httpEquivMeta = head.match(/<meta\b[^>]*\bcontent\s*=\s*["'][^"']*?charset\s*=\s*([^\s"';>]+)[^"']*["'][^>]*>/i);
  const metaEncoding = normalizeEncodingLabel(directMeta?.[1] || httpEquivMeta?.[1]);
  if (metaEncoding) return { encoding: metaEncoding, source: 'html-meta' };
  const textLike = !String(contentType || '').trim() || /(?:^|\b)(?:text\/|html|xml)/i.test(String(contentType));
  if (textLike && bytes.length) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return { encoding: 'windows-1252', source: 'invalid-utf8-text-fallback' };
    }
  }
  return { encoding: 'utf-8', source: 'default' };
}

function decodeResponseBuffer(buffer, contentType = '') {
  const detected = detectResponseEncoding(buffer, contentType);
  try {
    const decoder = new TextDecoder(detected.encoding, { fatal: false, ignoreBOM: false });
    return { text: decoder.decode(buffer), ...detected };
  } catch {
    return { text: Buffer.from(buffer).toString('utf8'), encoding: 'utf-8', source: 'unsupported-label-fallback' };
  }
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
    return { text, rawBytes: Buffer.byteLength(text, 'utf8'), truncated: false, encoding: 'response-text', encodingSource: 'runtime' };
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
  const decoded = decodeResponseBuffer(Buffer.concat(chunks), res?.headers?.get?.('content-type') || '');
  return {
    text: decoded.text,
    rawBytes: total,
    truncated: false,
    encoding: decoded.encoding,
    encodingSource: decoded.source,
    decodingVersion: VALORAE_RESPONSE_DECODING_VERSION,
  };
}
