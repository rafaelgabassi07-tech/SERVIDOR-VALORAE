import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dispatchRoute } from './routes/_router.js';
import { sendText, setSecurityHeaders } from './lib/core/http.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_LOCAL_BODY_BYTES = Number(process.env.MAX_LOCAL_BODY_BYTES || 512 * 1024);
const INVALID_JSON = 'INVALID_JSON';
const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png' };

function applyStaticSecurityHeaders(res, cacheControl = 'public, max-age=60') {
  return setSecurityHeaders(res, cacheControl);
}

function rewriteRouter(req, parsed) {
  if (parsed.pathname !== '/api/router') return;
  let p = parsed.searchParams.get('path') || '';
  try { p = decodeURIComponent(p); } catch {}
  p = p.replace(/^\/+/, '').replace(/\/+/g, '/');
  parsed.searchParams.delete('path');
  const q = parsed.searchParams.toString();
  req.url = `/api/${p}${q ? `?${q}` : ''}`;
}

const server = http.createServer(async (req, res) => {
  res.status = function(code){ this.statusCode = code; return this; };
  res.send = function(body){ this.end(body); return this; };
  const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (parsed.pathname.startsWith('/api')) {
    rewriteRouter(req, parsed);
    return dispatchRoute(req, res);
  }
  const clean = ['/', '/server', '/monitor', '/tests', '/inspector'].includes(parsed.pathname) ? '/server.html' : parsed.pathname;
  const target = path.normalize(path.join(PUBLIC_DIR, clean));
  const relative = path.relative(PUBLIC_DIR, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return sendText(res, 403, 'Acesso negado');
  fs.readFile(target, (err, data) => {
    if (err) return sendText(res, 404, 'Não encontrado');
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[path.extname(target)] || 'application/octet-stream');
    applyStaticSecurityHeaders(res, path.extname(target) === '.html' ? 'public, max-age=60' : 'public, max-age=300');
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`VALORAE Proxy rodando em http://0.0.0.0:${PORT}`));
