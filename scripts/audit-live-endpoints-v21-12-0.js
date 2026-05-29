import fs from 'node:fs';
import routerHandler from '../api/router.js';

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok, detail });
const has = (file, text) => fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(text);
function apiFiles(){const out=[];function walk(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=`${d}/${e.name}`;if(e.isDirectory())walk(p);else if(p.endsWith('.js'))out.push(p)}}walk('api');return out.sort()}
function mockReq(url) { return { method: 'GET', url, query: {}, headers: { host: 'example.vercel.app', 'x-forwarded-proto': 'https', 'x-valorae-telemetry': 'dashboard-test' }, socket: { remoteAddress: '127.0.0.1' } }; }
function mockRes(){ return { statusCode: 200, body: '', headers: {}, writableEnded: false, setHeader(k,v){this.headers[String(k).toLowerCase()] = v}, getHeader(k){return this.headers[String(k).toLowerCase()]}, status(c){this.statusCode=c;return this}, send(b){this.body=String(b ?? '');this.writableEnded=true;return this}, end(b=''){this.body+=String(b ?? '');this.writableEnded=true;return this} }; }
async function call(path) { const res = mockRes(); await routerHandler(mockReq(`/api/router?path=${encodeURIComponent(path)}`), res); let json = {}; try { json = JSON.parse(res.body || '{}'); } catch {} return { path, res, json }; }

const functions = apiFiles();
check('api consolidated into router rewrite', functions.length === 1 && functions.includes('api/router.js'), `Functions: ${functions.join(', ')}`);
check('vercel rewrites api to router', has('vercel.json', '/api/router?path=') && has('vercel.json', '/api/:path*'), 'Vercel precisa reescrever rotas API para function única.');
for (const route of ["'/cache/stats'", "'/source/status'", "'/server/tests'", "'/server/metrics'", "'/deploy/status'", "'/ready'"]) {
  check(`router exposes ${route}`, has('routes/_router.js', route), 'Router interno deve resolver a rota.');
}
check('metrics isolates cache stats', has('lib/observability/server-metrics.js', '/api/cache/stats') && has('lib/observability/server-metrics.js', '/api/v1/cache/stats'), 'cache/stats não entra como tráfego real.');
check('metrics isolates source status', has('lib/observability/server-metrics.js', '/api/source/status') && has('lib/observability/server-metrics.js', '/api/v1/source/status'), 'source/status não entra como tráfego real.');
check('metrics captures data routes even with telemetry header', has('lib/observability/server-metrics.js', 'Rotas de dados nunca são ignoradas') && has('lib/observability/server-metrics.js', 'isInternalTelemetryRoute(route)'), 'Somente rotas internas são isoladas; respostas de dados continuam aparecendo no feed mesmo com header dashboard/test/probe.');
check('single app has test center', has('public/server.html', 'id="page-tests"') && has('public/server.html', '/api/cache/stats') && has('public/server.html', '/api/source/status'), 'Testes ficam dentro do app principal.');
check('legacy tests redirect only', has('public/tests.html', '/server.html#tests') && fs.readFileSync('public/tests.html','utf8').length < 1000, '/tests.html não é app separado.');

const runtime = [
  ['server/metrics', 200, (j) => Boolean(j.summary), 'métricas devem ter summary'],
  ['server/tests?mode=quick', 200, (j) => Boolean(j.benchmark), 'laboratório deve ter benchmark'],
  ['v1/ready', 200, (j) => j.status === 'READY', 'v1/ready precisa responder READY'],
  ['deploy/status', 200, (j) => Boolean(j.build), 'deploy status precisa ter build'],
  ['cache/stats', 200, (j) => Boolean(j.caches), 'cache stats precisa ter caches'],
  ['source/status', 200, (j) => Array.isArray(j.providers), 'source status precisa ter providers'],
];
for (const [path, expected, validate, detail] of runtime) {
  const { res, json } = await call(path);
  check(`vercel router ${path}`, res.statusCode === expected && validate(json), `${detail}; status=${res.statusCode}; body=${JSON.stringify(json).slice(0,140)}`);
}

const failed = checks.filter(c => !c.ok);
console.log(JSON.stringify({ ok: failed.length === 0, checks, failed }, null, 2));
if (failed.length) process.exit(1);
