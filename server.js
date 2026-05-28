import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dispatchRoute } from './routes/_router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

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
    let bodyData = [];
    req.on('data', (chunk) => {
      bodyData.push(chunk);
    });
    req.on('end', async () => {
      const buffer = Buffer.concat(bodyData);
      const text = buffer.toString('utf8');
      if (text) {
        if (req.headers['content-type']?.includes('application/json')) {
          try {
            req.body = JSON.parse(text);
          } catch {
            req.body = {};
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
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            status: 'ERROR',
            error: 'Erro interno no servidor proxy.'
          }));
        }
      }
    });
    return;
  }

  // Handle Static files routing
  let decodedPathname = pathname;
  try { decodedPathname = decodeURIComponent(pathname); } catch { decodedPathname = pathname; }
  let targetPath = path.normalize(path.join(PUBLIC_DIR, decodedPathname));

  // Security check to avoid path traversal and prefix tricks such as /public-evil.
  const relativeToPublic = path.relative(PUBLIC_DIR, targetPath);
  if (relativeToPublic.startsWith('..') || path.isAbsolute(relativeToPublic)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Acesso Negado');
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
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('Não encontrado');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        res.statusCode = 200;
        res.setHeader('Content-Type', mime);
        res.end(data);
      });
    };

    tryServeFile(targetPath);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Valorae Proxy Server running on http://0.0.0.0:${PORT}`);
});
