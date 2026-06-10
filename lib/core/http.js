export function setSecurityHeaders(res, cacheControl = 'private, max-age=30') {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cache-Control', cacheControl);
}

export function sendJson(req, res, payload, options = {}) {
  if (res.writableEnded) return;
  const status = Number(options.status || payload?.statusCode || 200);
  res.statusCode = Number.isFinite(status) ? status : 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  setSecurityHeaders(res, options.cacheControl || 'private, max-age=30');
  const body = JSON.stringify(payload ?? {});
  res.end(body);
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
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > limitBytes) {
      const error = new Error('Payload muito grande.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  if (!String(req.headers['content-type'] || '').includes('application/json')) return text;
  try { return JSON.parse(text); } catch {
    const error = new Error('JSON inválido no corpo da requisição.');
    error.status = 400;
    throw error;
  }
}
