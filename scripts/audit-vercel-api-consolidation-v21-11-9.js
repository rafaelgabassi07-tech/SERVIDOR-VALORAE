import fs from 'node:fs';
import path from 'node:path';

const requiredRoutes = [
  '/server/metrics',
  '/server/tests',
  '/cache/stats',
  '/source/status',
  '/deploy/status',
  '/ready',
  '/health',
  '/asset',
  '/assets',
  '/scrape',
  '/batch-scrape',
];
const internalTelemetry = [
  '/api/server/metrics',
  '/api/v1/server/metrics',
  '/api/v2/server/metrics',
  '/api/server/tests',
  '/api/v1/server/tests',
  '/api/v2/server/tests',
  '/api/cache/stats',
  '/api/v1/cache/stats',
  '/api/v2/cache/stats',
  '/api/source/status',
  '/api/v1/source/status',
  '/api/v2/source/status',
  '/api/deploy/status',
];
function read(file) { return fs.readFileSync(file, 'utf8'); }
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}
function assert(ok, msg) { if (!ok) { console.error(msg); process.exit(1); } }

const functions = walk('api').sort();
assert(functions.length === 2 && functions.includes('api/[...path].js') && functions.includes('api/index.js'), `API não está consolidada em 2 functions: ${functions.join(', ')}`);
const router = read('routes/_router.js');
for (const route of requiredRoutes) assert(router.includes(`'${route}'`) || router.includes(`"${route}"`), `Rota ausente no router interno: ${route}`);
const metrics = read('lib/observability/server-metrics.js');
for (const route of internalTelemetry) assert(metrics.includes(route), `Telemetria interna não isola: ${route}`);
assert(read('public/server.html').includes('id="page-tests"'), 'Central de testes precisa estar dentro do app principal.');
assert(!read('public/server.html').includes('/tests.html'), 'App principal não deve depender de /tests.html.');
assert(read('public/tests.html').includes('/server.html#tests'), '/tests.html deve ser redirecionamento compatível.');
assert(read('vercel.json').includes('node scripts/build-vercel-safe.js'), 'Vercel deve usar build seguro.');
console.log(JSON.stringify({ ok: true, functions, requiredRoutes: requiredRoutes.length, internalTelemetry: internalTelemetry.length }, null, 2));
