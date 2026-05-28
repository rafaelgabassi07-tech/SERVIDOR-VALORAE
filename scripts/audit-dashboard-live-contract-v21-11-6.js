import fs from 'node:fs';

const checks = [];
function check(name, ok, detail = '') { checks.push({ name, ok, detail }); }
function has(file, text) { return fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(text); }

check('explicit metrics function', fs.existsSync('api/server/metrics.js'), 'Vercel deve publicar /api/server/metrics mesmo se catch-all falhar.');
check('explicit ready function', fs.existsSync('api/ready.js'), 'Vercel deve publicar /api/ready.');
check('deploy status function', fs.existsSync('api/deploy/status.js'), 'Diagnóstico de deploy disponível.');
check('v1 metrics alias', fs.existsSync('api/v1/server/metrics.js'), 'Alias versionado v1.');
check('v2 metrics alias', fs.existsSync('api/v2/server/metrics.js'), 'Alias versionado v2.');
check('tests page', fs.existsSync('public/tests.html'), 'Página de testes em tempo real criada.');
check('dashboard failure state', has('public/server.html', 'renderFailure'), 'Dashboard não fica só no skeleton quando métricas falham.');
check('dashboard links tests', has('public/server.html', '/tests.html'), 'Menu aponta para a página de testes.');
check('tests checks metrics', has('public/tests.html', '/api/server/metrics'), 'Testes validam endpoint de métricas.');
check('tests checks deploy status', has('public/tests.html', '/api/deploy/status'), 'Testes validam status de deploy.');
check('vercel safe build', has('vercel.json', 'node scripts/build-vercel-safe.js'), 'Vercel não usa build-free.js no deploy principal.');
check('service worker no api cache', has('public/service-worker.js', 'pathname.startsWith(\'/api\')') || has('public/service-worker.js', 'pathname.startsWith("/api")'), 'Service Worker deve excluir /api.');

const failed = checks.filter(c => !c.ok);
console.log(JSON.stringify({ ok: failed.length === 0, checks, failed }, null, 2));
if (failed.length) process.exit(1);
