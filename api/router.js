import { dispatchRoute } from '../routes/_router.js';

function normalizePath(rawPath = '') {
  let value = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || '');
  try { value = decodeURIComponent(value); } catch {}
  value = value.replace(/^\/+/, '').replace(/\/+/g, '/');
  if (value.startsWith('api/')) value = value.slice(4);
  return value;
}

function rewrite(req) {
  const original = req.url || '/api/router';
  const parsed = new URL(original, 'https://valorae.local');
  const path = normalizePath(parsed.searchParams.get('path') || '');
  parsed.searchParams.delete('path');
  const query = parsed.searchParams.toString();
  req.url = `/api/${path}${query ? `?${query}` : ''}`;
  return req;
}

export default async function handler(req, res) {
  return dispatchRoute(rewrite(req), res);
}

export const _test = { normalizePath, rewrite };
