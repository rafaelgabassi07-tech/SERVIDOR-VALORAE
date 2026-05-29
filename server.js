import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dispatchRoute } from './routes/_router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_LOCAL_BODY_BYTES = Number(process.env.VALORAE_MAX_BODY_BYTES || 512 * 1024);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function applyStaticSecurityHeaders(res, cacheControl = 'public, max-age=300') {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cache-Control', cacheControl);
}


function normalizeLocalRouterPath(rawPath = '') {
  let value = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || '');
  try { value = decodeURIComponent(value); } catch {}
  value = value.replace(/^\/+/, '').replace(/\/+/g, '/');
  if (value.startsWith('api/')) value = value.slice(4);
  if (value === 'router') value = '';
  return value;
}

function rewriteLocalRouterQuery(req, parsedUrl) {
  if (parsedUrl.pathname !== '/api/router') return;
  const proxyPath = normalizeLocalRouterPath(parsedUrl.searchParams.get('path') || '');
  if (!proxyPath) return;
  parsedUrl.searchParams.delete('path');
  const query = parsedUrl.searchParams.toString();
  req.__valoraeOriginalUrl = req.url;
  req.url = `/api/${proxyPath}${query ? `?${query}` : ''}`;
}

function sendText(res, statusCode, text) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  applyStaticSecurityHeaders(res, 'no-store');
  res.end(text);
}

const server = http.createServer((req, res) => {
  // Decorate response with Express/Vercel compat methods used by Valorae performance/http
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.send = function(body) {
    this.end(body);
    return this;
  };

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Handle API routing
  if (pathname.startsWith('/api')) {
    rewriteLocalRouterQuery(req, parsedUrl);
    let bodyData = [];
    let bodyBytes = 0;
    let rejectedBody = false;
    req.on('data', (chunk) => {
      bodyBytes += chunk.length;
      if (bodyBytes > MAX_LOCAL_BODY_BYTES) {
        rejectedBody = true;
        bodyData = [];
        req.pause();
        if (!res.writableEnded) {
          res.statusCode = 413;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ status: 'ERROR', code: 'PAYLOAD_TOO_LARGE', error: `Payload muito grande. Limite local: ${MAX_LOCAL_BODY_BYTES} bytes.` }));
        }
        return;
      }
      bodyData.push(chunk);
    });
    req.on('end', async () => {
      if (rejectedBody) return;
      const buffer = Buffer.concat(bodyData);
      const text = buffer.toString('utf8');
      if (text) {
        if (req.headers['content-type']?.includes('application/json')) {
          try {
            req.body = JSON.parse(text);
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ status: 'ERROR', code: 'INVALID_JSON', error: 'JSON inválido no corpo da requisição.' }));
            return;
          }
        } else {
          req.body = text;
        }
      } else {
        req.body = {};
      }

      try {
        await dispatchRoute(req, res);
      } catch (err) {
        console.error('API Error:', err);
        if (!res.writableEnded) {
          const status = Number(err?.status || 500);
          res.statusCode = Number.isFinite(status) ? status : 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            status: 'ERROR',
            code: err?.code || (res.statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
            error: res.statusCode >= 500 ? 'Erro interno no servidor proxy.' : (err?.message || 'Erro ao processar a requisição.')
          }));
        }
      }
    });
    return;
  }

  // Keep VALORAE Proxy Server as the single visual app.
  // Clean routes open the main app; legacy .html files only redirect for compatibility.
  const singleAppPaths = new Set(['/', '/server', '/tests', '/inspector']);
  if (singleAppPaths.has(pathname)) {
    const data = fs.readFileSync(path.join(PUBLIC_DIR, 'server.html'));
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME_TYPES['.html']);
    applyStaticSecurityHeaders(res, 'public, max-age=60');
    res.end(data);
    return;
  }

  // Handle Static files routing
  let decodedPathname = pathname;
  try { decodedPathname = decodeURIComponent(pathname); } catch { decodedPathname = pathname; }
  let targetPath = path.normalize(path.join(PUBLIC_DIR, decodedPathname));

  // Security check to avoid path traversal and prefix tricks such as /public-evil.
  const relativeToPublic = path.relative(PUBLIC_DIR, targetPath);
  if (relativeToPublic.startsWith('..') || path.isAbsolute(relativeToPublic)) {
    sendText(res, 403, 'Acesso Negado');
    return;
  }

  // Check if requested path is a directory, if so default to server.html for the dashboard
  fs.stat(targetPath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      targetPath = path.join(targetPath, 'server.html');
    }

    // Try finding file, or append .html if not found (clean URL support)
    const tryServeFile = (filePath) => {
      fs.readFile(filePath, (readFileErr, data) => {
        if (readFileErr) {
          // If pathname doesn't have extension and .html exists, try that
          const ext = path.extname(filePath);
          if (!ext && !filePath.endsWith('.html')) {
            return tryServeFile(filePath + '.html');
          }
          
          // File actually not found, serve 404
          sendText(res, 404, 'Não encontrado');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        res.statusCode = 200;
        res.setHeader('Content-Type', mime);
        applyStaticSecurityHeaders(res, ext === '.html' ? 'public, max-age=60' : 'public, max-age=300');
        res.end(data);
      });
    };

    tryServeFile(targetPath);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Valorae Proxy Server running on http://0.0.0.0:${PORT}`);
});
