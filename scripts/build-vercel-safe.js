import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const runtimeRoots = ['api', 'routes', 'lib'];
const requiredFiles = [
  'api/index.js',
  'api/[...path].js',
  'routes/_router.js',
  'routes/server/metrics.js',
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

function ensureDashboardEntry() {
  const indexFile = 'public/index.html';
  const serverFile = 'public/server.html';
  if (!fs.existsSync(serverFile) && fs.existsSync(indexFile)) {
    fs.copyFileSync(indexFile, serverFile);
    console.log('[vercel-build] public/server.html ausente; gerado a partir de public/index.html para preservar /server.html.');
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

async function main() {
  console.log('[vercel-build] VALORAE Proxy: validação serverless gratuita iniciada.');
  console.log(`[vercel-build] Node ${process.version}`);

  ensureDashboardEntry();
  for (const file of requiredFiles) assertFile(file);

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (Object.keys(pkg.dependencies || {}).length > 0) fail('package.json deve continuar sem dependencies obrigatórias.');
  if (pkg.scripts?.preinstall || pkg.scripts?.postinstall || pkg.scripts?.prepare) fail('Scripts lifecycle de instalação não são permitidos.');

  const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  if (vercel.crons) fail('vercel.json não deve declarar crons nesta build free-only.');
  if (String(vercel.buildCommand || '') !== 'node scripts/build-vercel-safe.js') {
    fail('vercel.json deve usar node scripts/build-vercel-safe.js como buildCommand.');
  }

  const serviceWorker = fs.readFileSync('public/service-worker.js', 'utf8');
  if (!/url\.pathname\.startsWith\(['"]\/api['"]\)/.test(serviceWorker) && !serviceWorker.includes('/api')) {
    fail('service-worker.js deve manter exclusão explícita de /api.');
  }

  const jsFiles = runtimeRoots.flatMap((root) => walkJs(root));
  for (const file of jsFiles) await importRuntimeFile(file);

  console.log(`[vercel-build] Pacote ${pkg.name}@${pkg.version}`);
  console.log(`[vercel-build] ${jsFiles.length} arquivos JS runtime importados/validados.`);
  console.log('[vercel-build] Build OK para Vercel.');
}

main();
