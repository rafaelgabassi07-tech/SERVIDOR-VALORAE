import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dispatchRoute } from './routes/_router.js';
import { applySecurityHeaders } from './lib/security/guard.js';
import { observeServerSocketState } from './lib/observability/metrics.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = resolve(__dirname, 'public');
const PORT = Number(process.env.PORT || process.env.VALORAE_PORT || 3000);
const HOST = process.env.HOST || process.env.VALORAE_HOST || '0.0.0.0';
const MAX_BODY_BYTES = Number(process.env.VALORAE_SERVER_MAX_BODY_BYTES || 1024 * 1024);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.java': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function asJsonError(res, status, code, message) {
  const body = JSON.stringify({ status: 'ERROR', code, error: message });
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', String(Buffer.byteLength(body)));
  res.end(body);
}

function adaptResponse(res) {
  res.status = function status(code) {
    res.statusCode = Number(code) || 200;
    return res;
  };
  res.send = function send(body = '') {
    if (res.writableEnded) return res;
    if (Buffer.isBuffer(body) || typeof body === 'string') return res.end(body);
    return res.end(String(body));
  };
  res.json = function json(payload) {
    const body = JSON.stringify(payload ?? null);
    if (!res.hasHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (!res.hasHeader('Content-Length')) res.setHeader('Content-Length', String(Buffer.byteLength(body)));
    return res.end(body);
  };
  return res;
}

async function readRequestBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return undefined;
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const err = new Error('Corpo da requisição excede o limite permitido.');
      err.status = 413;
      err.code = 'BODY_TOO_LARGE';
      throw err;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return undefined;
  const raw = Buffer.concat(chunks).toString('utf8');
  req.rawBody = raw;
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('application/json')) {
    try { return JSON.parse(raw); } catch {
      const err = new Error('JSON inválido no corpo da requisição.');
      err.status = 400;
      err.code = 'INVALID_JSON_BODY';
      throw err;
    }
  }
  if (contentType.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  return raw;
}

function safePublicPath(urlPathname) {
  const decoded = decodeURIComponent(urlPathname || '/');
  const target = decoded === '/' ? '/index.html' : decoded;
  const full = resolve(PUBLIC_DIR, normalize(`.${target}`));
  if (!full.startsWith(PUBLIC_DIR) || relative(PUBLIC_DIR, full).startsWith('..')) return null;
  return full;
}

async function serveStatic(req, res, pathname) {
  const filePath = safePublicPath(pathname);
  if (!filePath) return asJsonError(res, 403, 'FORBIDDEN', 'Caminho público inválido.');
  try {
    const info = await stat(filePath);
    const finalPath = info.isDirectory() ? join(filePath, 'index.html') : filePath;
    const finalInfo = info.isDirectory() ? await stat(finalPath) : info;
    if (!finalInfo.isFile()) return asJsonError(res, 404, 'NOT_FOUND', 'Arquivo público não encontrado.');
    const type = MIME_TYPES[extname(finalPath).toLowerCase()] || 'application/octet-stream';
    res.statusCode = 200;
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Length', String(finalInfo.size));
    res.setHeader('Cache-Control', type.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600');
    if (req.method === 'HEAD') return res.end();
    createReadStream(finalPath).pipe(res);
  } catch {
    return asJsonError(res, 404, 'NOT_FOUND', 'Arquivo público não encontrado.');
  }
}

async function handle(req, res) {
  adaptResponse(res);
  const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (parsed.pathname.startsWith('/api')) {
      req.query = Object.fromEntries(parsed.searchParams.entries());
      req.body = await readRequestBody(req);
      return dispatchRoute(req, res);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return asJsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET ou HEAD para arquivos públicos.');
    }
    return serveStatic(req, res, parsed.pathname);
  } catch (err) {
    if (parsed.pathname.startsWith('/api')) applySecurityHeaders(req, res, { methods: 'GET, POST, HEAD, OPTIONS' });
    return asJsonError(res, Number(err.status || 500), err.code || 'SERVER_ERROR', err.message || 'Erro interno no servidor.');
  }
}

const server = createServer(handle);
const openSockets = new Set();

server.on('connection', socket => {
  openSockets.add(socket);
  observeServerSocketState(openSockets.size, 1);
  socket.on('close', () => {
    openSockets.delete(socket);
    observeServerSocketState(openSockets.size, 0);
  });
});

server.listen(PORT, HOST, () => {
  const hostLabel = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`Valorae Proxy server online: http://${hostLabel}:${PORT}`);
  console.log(`API: http://${hostLabel}:${PORT}/api`);
});

export { server, handle };
