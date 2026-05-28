import fs from 'node:fs';

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok, detail });
const has = (file, text) => fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(text);
function apiFiles(){const out=[];function walk(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=`${d}/${e.name}`;if(e.isDirectory())walk(p);else if(p.endsWith('.js'))out.push(p)}}walk('api');return out.sort()}
const functions = apiFiles();
check('api consolidated into catch-all', functions.length === 2 && functions.includes('api/[...path].js') && functions.includes('api/index.js'), `Functions: ${functions.join(', ')}`);
for (const route of ["'/cache/stats'", "'/source/status'", "'/server/tests'", "'/server/metrics'", "'/deploy/status'", "'/ready'"]) {
  check(`router exposes ${route}`, has('routes/_router.js', route), 'Catch-all deve resolver a rota.');
}
check('metrics isolates cache stats', has('lib/observability/server-metrics.js', '/api/cache/stats') && has('lib/observability/server-metrics.js', '/api/v1/cache/stats'), 'cache/stats não entra como tráfego real.');
check('metrics isolates source status', has('lib/observability/server-metrics.js', '/api/source/status') && has('lib/observability/server-metrics.js', '/api/v1/source/status'), 'source/status não entra como tráfego real.');
check('metrics isolates test header', has('lib/observability/server-metrics.js', 'x-valorae-telemetry') && has('lib/observability/server-metrics.js', 'dashboard|internal|test'), 'Probes do dashboard são ignorados.');
check('single app has test center', has('public/server.html', 'id="page-tests"') && has('public/server.html', '/api/cache/stats') && has('public/server.html', '/api/source/status'), 'Testes ficam dentro do app principal.');
check('legacy tests redirect only', has('public/tests.html', '/server.html#tests') && fs.readFileSync('public/tests.html','utf8').length < 1000, '/tests.html não é app separado.');

const failed = checks.filter(c => !c.ok);
console.log(JSON.stringify({ ok: failed.length === 0, checks, failed }, null, 2));
if (failed.length) process.exit(1);
