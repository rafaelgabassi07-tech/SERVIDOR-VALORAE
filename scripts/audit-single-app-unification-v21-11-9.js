import fs from 'node:fs';

const checks = [];
function check(name, ok, detail = '') { checks.push({ name, ok, detail }); }
function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; }
function exists(file) { return fs.existsSync(file); }

const server = read('public/server.html');
const index = read('public/index.html');
const tests = read('public/tests.html');
const inspector = read('public/inspector.html');
const router = read('routes/_router.js');
const vercel = read('vercel.json');

check('server entrypoint exists', exists('public/server.html'), 'App principal em /server.html.');
check('index entrypoint exists', exists('public/index.html'), 'App principal em /.');
check('same app entrypoints', server.includes('id="page-tests"') && index.includes('id="page-tests"'), 'Index e server carregam o mesmo app com central interna.');
check('no external tests app', tests.includes('/server.html#tests') && tests.length < 1000, '/tests.html é só redirecionamento.');
check('no external inspector app', inspector.includes('/server.html#tests') && inspector.length < 1000, '/inspector.html é só redirecionamento.');
check('dashboard has tests page', server.includes('Testes e benchmark') && server.includes('/api/server/tests'), 'Testes ficam dentro do app principal.');
check('router server tests route', router.includes("'/server/tests'"), '/api/server/tests via router catch-all.');
check('router metrics route', router.includes("'/server/metrics'"), '/api/server/metrics via router catch-all.');
check('root rewrite to server', vercel.includes('/server.html'), 'Vercel aponta para o app principal.');
check('api consolidated', exists('api/index.js') && exists('api/[...path].js') && !exists('api/server/metrics.js'), 'Sem app/servidor paralelo em functions físicas extras.');

const failed = checks.filter(c => !c.ok);
console.log(JSON.stringify({ ok: failed.length === 0, checks, failed }, null, 2));
if (failed.length) process.exit(1);
