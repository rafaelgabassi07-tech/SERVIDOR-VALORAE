import fs from 'node:fs';

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok, detail });
const has = (file, text) => fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(text);

for (const file of [
  'api/server/metrics.js',
  'api/server/tests.js',
  'api/cache/stats.js',
  'api/source/status.js',
  'api/deploy/status.js',
  'api/v1/server/metrics.js',
  'api/v2/server/metrics.js',
  'api/v1/cache/stats.js',
  'api/v2/cache/stats.js',
  'api/v1/source/status.js',
  'api/v2/source/status.js',
]) check(`physical ${file}`, fs.existsSync(file), 'Function física para evitar 404 no Vercel.');

check('router exposes cache stats', has('routes/_router.js', "'/cache/stats'"), 'Catch-all também deve resolver /api/cache/stats.');
check('router exposes source status', has('routes/_router.js', "'/source/status'"), 'Catch-all também deve resolver /api/source/status.');
check('router exposes server tests', has('routes/_router.js', "'/server/tests'"), 'Central de testes integrada.');
check('router exposes deploy status', has('routes/_router.js', "'/deploy/status'"), 'Diagnóstico de deploy.');
check('metrics isolates cache stats', has('lib/observability/server-metrics.js', '/api/cache/stats'), 'cache/stats não entra como tráfego real.');
check('metrics isolates source status', has('lib/observability/server-metrics.js', '/api/source/status'), 'source/status não entra como tráfego real.');
check('metrics isolates test header', has('lib/observability/server-metrics.js', 'x-valorae-telemetry') && has('lib/observability/server-metrics.js', 'dashboard|internal|test'), 'Probes do dashboard são ignorados.');
check('single app has test center', has('public/server.html', 'id="page-tests"') && has('public/server.html', '/api/cache/stats') && has('public/server.html', '/api/source/status'), 'Testes ficam dentro do app principal.');
check('legacy tests redirect only', has('public/tests.html', '/server.html#tests') && fs.readFileSync('public/tests.html','utf8').length < 1000, '/tests.html não é app separado.');

const failed = checks.filter(c => !c.ok);
console.log(JSON.stringify({ ok: failed.length === 0, checks, failed }, null, 2));
if (failed.length) process.exit(1);
