import { createHash } from 'node:crypto';
import { transformResponsePayload } from '../contract/response.js';

const VOLATILE_ETAG_KEYS = new Set(['generatedAt', 'checkedAt', 'requestId', 'now']);

function stripVolatileForEtag(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripVolatileForEtag);
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (VOLATILE_ETAG_KEYS.has(key)) continue;
    out[key] = stripVolatileForEtag(val);
  }
  return out;
}

function stableBody(payload) {
  return JSON.stringify(payload ?? {});
}

function responseQuery(req = {}) {
  let fromUrl = {};
  try { fromUrl = queryObject(new URL(req.url || '/api', 'https://valorae.local').searchParams); } catch {}
  const fromReq = req.query && typeof req.query === 'object' ? req.query : {};
  return { ...fromUrl, ...fromReq };
}

function applyCors(req = {}, res) {
  const origin = req?.headers?.origin;
  if (!origin) return;
  const allowed = String(process.env.VALORAE_CORS_ALLOW_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    const vary = String(res.getHeader?.('Vary') || res.getHeader?.('vary') || '');
    res.setHeader('Vary', vary ? (vary.includes('Origin') ? vary : `${vary}, Origin`) : 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Valorae-App, X-Valorae-Channel, X-Valorae-App-Version, X-Valorae-Build, X-Valorae-App-Id, X-Valorae-Client-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  }
}

export function setSecurityHeaders(res, cacheControl = 'private, max-age=30') {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cache-Control', cacheControl);
}

export function sendJson(req, res, payload, options = {}) {
  if (res.writableEnded) return;
  const status = Number(options.status || payload?.statusCode || 200);
  const finalStatus = Number.isFinite(status) ? status : 200;
  const requestForTransform = { ...req, query: responseQuery(req) };
  const effectivePayload = transformResponsePayload(payload ?? {}, requestForTransform);
  const body = stableBody(effectivePayload);
  const etag = `"${createHash('sha1').update(stableBody(stripVolatileForEtag(effectivePayload))).digest('base64url')}"`;
  const reqEtag = String(req?.headers?.['if-none-match'] || '');
  const notModified = finalStatus === 200 && reqEtag.split(',').map(s => s.trim()).includes(etag);

  res.statusCode = notModified ? 304 : finalStatus;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('ETag', etag);
  res.setHeader('Content-Length', String(Buffer.byteLength(body, 'utf8')));
  res.setHeader('X-Valorae-Response-Bytes', String(Buffer.byteLength(body, 'utf8')));
  setSecurityHeaders(res, options.cacheControl || (finalStatus >= 400 ? 'no-store' : 'private, max-age=30'));
  applyCors(req, res);

  if (notModified) {
    res.removeHeader?.('Content-Length');
    if (typeof res.status === 'function') return res.status(304).end('');
    return res.end('');
  }
  if (String(req?.method || 'GET').toUpperCase() === 'HEAD') {
    if (typeof res.status === 'function') return res.status(finalStatus).end('');
    return res.end('');
  }
  if (typeof res.status === 'function' && typeof res.send === 'function') return res.status(finalStatus).send(body);
  return res.end(body);
}

export function sendText(res, statusCode, text, type = 'text/plain; charset=utf-8') {
  if (res.writableEnded) return;
  res.statusCode = statusCode;
  res.setHeader('Content-Type', type);
  setSecurityHeaders(res, statusCode >= 400 ? 'no-store' : 'public, max-age=60');
  res.end(text);
}

export function queryObject(searchParams) {
  const out = {};
  for (const [key, value] of searchParams.entries()) {
    if (out[key] === undefined) out[key] = value;
    else if (Array.isArray(out[key])) out[key].push(value);
    else out[key] = [out[key], value];
  }
  return out;
}

export async function readJsonBody(req, limitBytes = 512 * 1024) {
  if (req.body !== undefined) return req.body || {};
  if (!req || typeof req[Symbol.asyncIterator] !== 'function') return {};
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    bytes += buffer.length;
    if (bytes > limitBytes) {
      const error = new Error('Payload muito grande.');
      error.status = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  if (!String(req.headers?.['content-type'] || '').includes('application/json')) return text;
  try { return JSON.parse(text); } catch {
    const error = new Error('JSON inválido no corpo da requisição.');
    error.status = 400;
    throw error;
  }
}
