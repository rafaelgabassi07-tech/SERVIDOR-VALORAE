import fs from 'node:fs';

const checks = [];
function check(name, ok, detail = '') { checks.push({ name, ok, detail }); }
function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; }

const server = read('public/server.html');
const index = read('public/index.html');
const tests = read('public/tests.html');
const inspector = read('public/inspector.html');
const vercel = read('vercel.json');
const router = read('routes/_router.js');
const metrics = read('lib/observability/server-metrics.js');

check('single server app entry', fs.existsSync('public/server.html') && fs.existsSync('public/index.html'), 'index.html e server.html devem existir como a mesma experiência.');
check('same app title', server.includes('VALORAE Proxy Server') && index.includes('VALORAE Proxy Server'), 'App principal tem identidade única.');
check('internal tests page', server.includes('id="page-tests"') && server.includes('runInternalTests'), 'Central de testes está dentro do dashboard.');
check('no dashboard external tests', !server.includes('/tests.html') && !index.includes('/tests.html'), 'Dashboard não aponta para /tests.html.');
check('tests redirect only', tests.includes('/server.html#tests') && tests.length < 1000, '/tests.html é apenas compatibilidade/redirect.');
check('inspector redirect only', inspector.includes('/server.html#tests') && inspector.length < 1000, '/inspector.html é apenas compatibilidade/redirect.');
check('vercel tests rewrite to app', vercel.includes('"/tests"') && vercel.includes('"/server.html"'), '/tests reescreve para app principal.');
check('server tests route', router.includes("'/server/tests'") && fs.existsSync('api/server/tests.js'), '/api/server/tests existe como API interna.');
check('metrics header isolation', metrics.includes('x-valorae-telemetry') && metrics.includes('dashboard|internal|test'), 'Probes do dashboard são isolados por header.');
check('service worker no api', read('public/service-worker.js').includes("pathname.startsWith('/api')") || read('public/service-worker.js').includes('pathname.startsWith("/api")'), 'Service worker não cacheia /api.');

const failed = checks.filter(c => !c.ok);
console.log(JSON.stringify({ ok: failed.length === 0, checks, failed }, null, 2));
if (failed.length) process.exit(1);
