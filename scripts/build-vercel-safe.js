import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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
];

function assertFile(file) {
  if (!fs.existsSync(file)) {
    console.error(`[vercel-build] Arquivo obrigatório ausente: ${file}`);
    process.exit(1);
  }
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

function checkJs(file) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`[vercel-build] Erro de sintaxe em ${file}`);
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
    process.exit(result.status || 1);
  }
}

console.log('[vercel-build] VALORAE Proxy: validação serverless gratuita iniciada.');
console.log(`[vercel-build] Node ${process.version}`);

for (const file of requiredFiles) assertFile(file);

const jsFiles = runtimeRoots.flatMap((root) => walkJs(root));
for (const file of jsFiles) checkJs(file);

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log(`[vercel-build] Pacote ${pkg.name}@${pkg.version}`);
console.log(`[vercel-build] ${jsFiles.length} arquivos JS runtime validados.`);
console.log('[vercel-build] Build OK para Vercel.');
