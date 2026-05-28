import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const runtimeRoots = ['api', 'routes', 'lib'];
const requiredFiles = [
  'api/index.js',
  'api/[...path].js',
  'api/server/metrics.js',
  'api/server/tests.js',
  'api/cache/stats.js',
  'api/source/status.js',
  'api/ready.js',
  'api/deploy/status.js',
  'routes/_router.js',
  'routes/server/metrics.js',
  'routes/server/tests.js',
  'routes/cache/stats.js',
  'routes/source/status.js',
  'lib/Valorae-engine.js',
  'lib/http/route.js',
  'lib/observability/server-metrics.js',
  'lib/performance/http.js',
  'public/index.html',
  'public/server.html',
  'public/manifest.webmanifest',
  'public/service-worker.js',
];

function fail(message, error) {
  console.error(`[vercel-build] ${message}`);
  if (error?.stack) console.error(error.stack);
  else if (error) console.error(String(error));
  process.exit(1);
}

function ensureServerEntrypoint() {
  if (!fs.existsSync('public/server.html') && fs.existsSync('public/index.html')) {
    fs.copyFileSync('public/index.html', 'public/server.html');
    console.log('[vercel-build] public/server.html recriado a partir de public/index.html.');
  }
  if (!fs.existsSync('public/index.html') && fs.existsSync('public/server.html')) {
    fs.copyFileSync('public/server.html', 'public/index.html');
    console.log('[vercel-build] public/index.html recriado a partir de public/server.html.');
  }
}

function assertFile(file) {
  if (!fs.existsSync(file)) fail(`Arquivo obrigatório ausente: ${file}`);
}

function walkJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(file, out);
    else if (file.endsWith('.js')) out.push(file);
  }
  return out;
}

async function importRuntimeFile(file) {
  try {
    await import(pathToFileURL(path.resolve(file)).href);
  } catch (error) {
    fail(`Erro ao validar/importar runtime JS: ${file}`, error);
  }
}

function read(file) { return fs.readFileSync(file, 'utf8'); }

async function main() {
  console.log('[vercel-build] VALORAE Proxy: validação serverless gratuita iniciada.');
  console.log(`[vercel-build] Node ${process.version}`);

  ensureServerEntrypoint();
  for (const file of requiredFiles) assertFile(file);

  const pkg = JSON.parse(read('package.json'));
  if (Object.keys(pkg.dependencies || {}).length > 0) fail('package.json deve continuar sem dependencies obrigatórias.');
  if (pkg.scripts?.preinstall || pkg.scripts?.postinstall || pkg.scripts?.prepare) fail('Scripts lifecycle de instalação não são permitidos.');

  const vercel = JSON.parse(read('vercel.json'));
  if (vercel.crons) fail('vercel.json não deve declarar crons nesta build free-only.');
  if (String(vercel.buildCommand || '') !== 'node scripts/build-vercel-safe.js') {
    fail('vercel.json deve usar node scripts/build-vercel-safe.js como buildCommand.');
  }
  const rewriteText = JSON.stringify(vercel.rewrites || []);
  if (!rewriteText.includes('/server.html')) fail('vercel.json deve apontar /, /server ou /tests para o app principal server.html.');

  const serviceWorker = read('public/service-worker.js');
  if (!/pathname\.startsWith\(['"]\/api['"]\)/.test(serviceWorker) && !serviceWorker.includes('/api')) {
    fail('service-worker.js deve manter exclusão explícita de /api.');
  }

  const serverHtml = read('public/server.html');
  if (!serverHtml.includes('VALORAE Proxy Server') || !serverHtml.includes('id="page-tests"')) {
    fail('public/server.html deve ser o app principal com central interna de testes.');
  }
  if (serverHtml.includes('/tests.html')) fail('O app principal não deve abrir /tests.html como experiência separada.');

  const metrics = read('lib/observability/server-metrics.js');
  for (const route of ['/api/server/metrics','/api/server/tests','/api/cache/stats','/api/source/status','/api/deploy/status']) {
    if (!metrics.includes(route)) fail(`Métricas internas precisam isolar ${route}.`);
  }

  const router = read('routes/_router.js');
  for (const route of ["'/server/metrics'", "'/server/tests'", "'/cache/stats'", "'/source/status'", "'/deploy/status'"]) {
    if (!router.includes(route)) fail(`Router interno precisa expor ${route}.`);
  }

  const jsFiles = runtimeRoots.flatMap((root) => walkJs(root));
  for (const file of jsFiles) await importRuntimeFile(file);

  console.log(`[vercel-build] Pacote ${pkg.name}@${pkg.version}`);
  console.log(`[vercel-build] ${jsFiles.length} arquivos JS runtime importados/validados.`);
  console.log('[vercel-build] Build OK para Vercel.');
}

main();
