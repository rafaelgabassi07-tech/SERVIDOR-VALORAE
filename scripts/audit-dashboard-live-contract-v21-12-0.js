import fs from 'node:fs';

const checks = [];
function check(name, ok, detail = '') { checks.push({ name, ok, detail }); }
function has(file, text) { return fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(text); }
function apiFunctions() {
  const out = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.js')) out.push(p);
    }
  }
  walk('api');
  return out.sort();
}

const functions = apiFunctions();
check('consolidated api function count', functions.length === 1, `Encontradas: ${functions.join(', ')}`);
check('router api function', functions.includes('api/router.js'), 'Todas as rotas /api/* passam pelo router interno via rewrites.');
check('vercel api rewrites', has('vercel.json', '/api/router?path=') && has('vercel.json', '/api/:path*'), '/api e /api/:path* reescritos para api/router.');
check('router metrics route', has('routes/_router.js', "'/server/metrics'"), '/api/server/metrics via router.');
check('router tests route', has('routes/_router.js', "'/server/tests'"), '/api/server/tests via router.');
check('router cache route', has('routes/_router.js', "'/cache/stats'"), '/api/cache/stats via router.');
check('router source route', has('routes/_router.js', "'/source/status'"), '/api/source/status via router.');
check('router deploy route', has('routes/_router.js', "'/deploy/status'"), '/api/deploy/status via router.');
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
