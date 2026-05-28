import fs from 'node:fs';

const checks = [];
function check(name, ok, detail = '') { checks.push({ name, ok, detail }); }
function has(file, text) { return fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(text); }

check('explicit metrics function', fs.existsSync('api/server/metrics.js'), 'Vercel deve publicar /api/server/metrics mesmo se catch-all falhar.');
check('explicit tests function', fs.existsSync('api/server/tests.js'), 'Laboratório interno usa /api/server/tests sem página externa.');
check('explicit ready function', fs.existsSync('api/ready.js'), 'Vercel deve publicar /api/ready.');
check('deploy status function', fs.existsSync('api/deploy/status.js'), 'Diagnóstico de deploy disponível.');
check('v1 metrics alias', fs.existsSync('api/v1/server/metrics.js'), 'Alias versionado v1.');
check('v2 metrics alias', fs.existsSync('api/v2/server/metrics.js'), 'Alias versionado v2.');
check('dashboard failure state', has('public/server.html', 'renderFailure'), 'Dashboard não fica só no skeleton quando métricas falham.');
check('test center inside dashboard', has('public/server.html', 'page-tests') && has('public/server.html', '/api/server/tests'), 'Testes, rede e benchmark ficam dentro do app principal.');
check('no external tests link in dashboard', !has('public/server.html', '/tests.html'), 'Dashboard não deve abrir /tests.html como página separada.');
check('tests page redirects to dashboard', has('public/tests.html', '/server.html#tests'), 'Compatibilidade: /tests.html redireciona para o app principal.');
check('inspector page redirects to dashboard', has('public/inspector.html', '/server.html#tests'), 'Compatibilidade: /inspector.html redireciona para o app principal.');
check('deploy status points to internal tests', has('routes/deploy/status.js', '/server.html#tests'), 'Status de deploy aponta para testes internos.');
check('vercel safe build', has('vercel.json', 'node scripts/build-vercel-safe.js'), 'Vercel não usa build-free.js no deploy principal.');
check('service worker no api cache', has('public/service-worker.js', 'pathname.startsWith(\'/api\')') || has('public/service-worker.js', 'pathname.startsWith("/api")'), 'Service Worker deve excluir /api.');

const failed = checks.filter(c => !c.ok);
console.log(JSON.stringify({ ok: failed.length === 0, checks, failed }, null, 2));
if (failed.length) process.exit(1);
