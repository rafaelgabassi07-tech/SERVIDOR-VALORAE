let routerModulePromise;

async function dispatchRouteLazy(req, res) {
  routerModulePromise ||= import('../routes/_router.js');
  const { dispatchRoute } = await routerModulePromise;
  return dispatchRoute(req, res);
}

function normalizePath(rawPath = '') {
  let value = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || '');
  try { value = decodeURIComponent(value); } catch {}
  value = value.replace(/^\/+/, '').replace(/\/+/g, '/');
  if (value.startsWith('api/')) value = value.slice(4);
  return value;
}

function appendQueryValue(searchParams, key, rawValue) {
  if (rawValue === undefined || rawValue === null || key === 'path') return;
  const values = Array.isArray(rawValue) ? rawValue : [rawValue];
  for (const value of values) {
    if (value === undefined || value === null) continue;
    searchParams.append(key, String(value));
  }
}

function rewrite(req) {
  const original = req.url || '/api/router';
  const parsed = new URL(original, 'https://valorae.local');
  const queryPath = req?.query && Object.prototype.hasOwnProperty.call(req.query, 'path')
    ? req.query.path
    : undefined;
  const hasUrlPath = parsed.searchParams.has('path');
  const hasQueryPath = queryPath !== undefined && queryPath !== null;
  if (!hasUrlPath && !hasQueryPath) return req;

  const rawPath = hasUrlPath ? parsed.searchParams.getAll('path') : queryPath;
  const path = normalizePath(rawPath || '');
  parsed.searchParams.delete('path');

  // Vercel pode materializar parâmetros de rewrite em req.query sem mantê-los em req.url.
  // O roteador interno lê a query a partir da URL, então reconstruímos apenas os campos ausentes.
  const urlKeys = new Set([...parsed.searchParams.keys()]);
  for (const [key, value] of Object.entries(req?.query || {})) {
    if (key === 'path' || urlKeys.has(key)) continue;
    appendQueryValue(parsed.searchParams, key, value);
  }

  if (req?.query && typeof req.query === 'object') {
    const { path: _discardedPath, ...rest } = req.query;
    req.query = rest;
  }

  const query = parsed.searchParams.toString();
  req.url = `/api/${path}${query ? `?${query}` : ''}`;
  return req;
}

export default async function handler(req, res) {
  return dispatchRouteLazy(rewrite(req), res);
}

export const _test = { normalizePath, rewrite, rewriteRequestForInternalRouter: rewrite, appendQueryValue };
