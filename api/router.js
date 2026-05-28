import { dispatchRoute } from '../routes/_router.js';

function queryToObject(params) {
  const out = {};
  for (const [key, value] of params.entries()) {
    if (key === 'path') continue;
    if (out[key] === undefined) out[key] = value;
    else if (Array.isArray(out[key])) out[key].push(value);
    else out[key] = [out[key], value];
  }
  return out;
}

function normalizeProxyPath(rawPath = '') {
  let path = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || '');
  try { path = decodeURIComponent(path); } catch {}
  path = path.replace(/^\/+/, '').replace(/\/+/g, '/');
  if (path === 'router') path = '';
  if (path.startsWith('api/')) path = path.slice(4);
  return path;
}

function rewriteRequestForInternalRouter(req) {
  const originalUrl = req?.url || '/api/router';
  const parsed = new URL(originalUrl, 'https://valorae.vercel.local');
  let proxyPath = normalizeProxyPath(parsed.searchParams.get('path') || req?.query?.path || '');
  if (!proxyPath && parsed.pathname && parsed.pathname !== '/api/router') {
    proxyPath = normalizeProxyPath(parsed.pathname.replace(/^\/api\/?/, ''));
  }
  parsed.searchParams.delete('path');
  const query = parsed.searchParams.toString();
  const cleanPath = proxyPath ? `/api/${proxyPath}` : '/api';
  req.__valoraeOriginalUrl = originalUrl;
  req.url = `${cleanPath}${query ? `?${query}` : ''}`;
  req.query = queryToObject(parsed.searchParams);
  return req;
}

export default async function handler(req, res) {
  return dispatchRoute(rewriteRequestForInternalRouter(req), res);
}

export const _test = { normalizeProxyPath, rewriteRequestForInternalRouter };
