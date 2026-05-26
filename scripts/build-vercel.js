import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'api/index.js',
  'api/[...path].js',
  'routes/_router.js',
  'routes/observability.js',
  'lib/observability/metrics.js',
  'lib/Valorae-engine.js',
  'public/index.html',
  'public/inspector.html',
  'vercel.json',
  'package.json',
];

function fail(message) {
  console.error(`[vercel-build] ${message}`);
  process.exit(1);
}

function run(label, cmd, args) {
  console.log(`[vercel-build] ${label}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) fail(`falhou: ${label}`);
}

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) fail(`arquivo obrigatório ausente: ${file}`);
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
if (Object.keys(deps).length > 0) fail('o deploy free-only deve continuar sem dependências externas obrigatórias.');

const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
if (vercel.outputDirectory !== 'public') fail('vercel.json precisa usar outputDirectory="public" para servir o app.');

const runtimeFiles = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (fullPath.endsWith('.js')) runtimeFiles.push(fullPath);
  }
}
['api', 'routes', 'lib'].forEach(walk);
for (const file of runtimeFiles) run(`node --check ${file}`, process.execPath, ['--check', file]);

const html = fs.readFileSync('public/index.html', 'utf8');
for (const needle of ['VALORAE Proxy Observability', '/api/observability', 'id="nav"', 'id="menu-toggle"', 'id="theme-toggle"']) {
  if (!html.includes(needle)) fail(`dashboard incompleto: não encontrei ${needle}`);
}

console.log(`[vercel-build] OK: ${runtimeFiles.length} arquivos JS runtime verificados; public pronto para deploy.`);
