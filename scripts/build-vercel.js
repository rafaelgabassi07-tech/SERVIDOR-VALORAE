import fs from 'node:fs';
import path from 'node:path';

const requiredFiles = [
  'api/index.js',
  'api/[...path].js',
  'routes/_router.js',
  'routes/observability.js',
  'lib/observability/metrics.js',
  'lib/Valorae-engine.js',
  'public/index.html',
  'public/inspector.html',
  'public/manifest.webmanifest',
  'public/sw.js',
  'public/logo-mark.svg',
  'public/logo.svg',
  'public/pwa-icon-192.png',
  'public/pwa-icon-512.png',
  'public/downloads/valorae-proxy-integration-prompt.md',
  'public/downloads/valorae-proxy-integration-coordinates.json',
  'vercel.json',
  'package.json',
];

function fail(message) {
  console.error(`[vercel-build] ${message}`);
  process.exit(1);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`JSON inválido em ${file}: ${error.message}`);
  }
}

function assertFile(file) {
  if (!fs.existsSync(file)) fail(`arquivo obrigatório ausente: ${file}`);
  const stat = fs.statSync(file);
  if (!stat.isFile()) fail(`caminho obrigatório não é arquivo: ${file}`);
}

console.log(`[vercel-build] Node ${process.version}`);
console.log('[vercel-build] validação leve de deploy iniciada');

for (const file of requiredFiles) assertFile(file);

const packageJson = readJson('package.json');
const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
if (Object.keys(deps).length > 0) fail('o deploy free-only deve continuar sem dependências externas obrigatórias.');

const vercel = readJson('vercel.json');
if (vercel.outputDirectory !== 'public') fail('vercel.json precisa usar outputDirectory="public" para servir o app.');

const html = fs.readFileSync('public/index.html', 'utf8');
for (const needle of [
  'VALORAE Proxy Observability',
  '/api/observability',
  '/api/health',
  '/api/ready',
  'id="nav"',
  'id="menu-toggle"',
  'aria-expanded="false"',
  'id="theme-toggle"',
  'data-label=',
  'role="region"',
  '@media (max-width:640px)',
  'X-Valorae-Dashboard-Probe',
  'liveChecks',
  'delivery',
  'publicAssets',
  'Dados, arquivos e bytes enviados aos usuários',
  'Teste Real',
  'Tecnologia',
  'Executar teste real agora',
  'X-Valorae-Client-Id',
  'manifest.webmanifest',
  'serviceWorker',
  'beforeinstallprompt',
  'Tecnologia e Integração',
  'data-download-id="aiPrompt"',
  'Copiar prompt completo para IA',
  'valorae-proxy-integration-prompt.md',
  'id="open-settings"',
  'logo-mark.svg',
  'nav-section',
]) {
  if (!html.includes(needle)) fail(`dashboard incompleto: não encontrei ${needle}`);
}

if (html.includes('<b>Health</b><span class="badge ok">OK</span>')) {
  fail('dashboard não pode exibir Health/Ready como OK fixo; use probes reais.');
}

const manifest = readJson('public/manifest.webmanifest');
if (manifest.name !== 'Valorae Proxy') fail('manifest PWA precisa manter name="Valorae Proxy".');
if (manifest.display !== 'standalone') fail('manifest PWA precisa usar display="standalone".');
if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) fail('manifest PWA precisa declarar ícones 192/512.');
const sw = fs.readFileSync('public/sw.js', 'utf8');
if (!sw.includes("url.pathname.startsWith('/api/')")) fail('service worker não pode cachear rotas /api/* do Proxy.');
if (!sw.includes('CACHE_NAME')) fail('service worker precisa usar cache versionado.');

const routeExports = [
  ['routes/errors.js', 'export default'],
  ['routes/observability.js', 'export default'],
  ['routes/_router.js', 'export async function dispatchRoute'],
];
for (const [routeFile, expectedExport] of routeExports) {
  const source = fs.readFileSync(routeFile, 'utf8');
  if (!source.includes(expectedExport)) fail(`${routeFile} não contém export esperado: ${expectedExport}`);
}

const publicFiles = [];
function walkPublic(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkPublic(fullPath);
    else publicFiles.push(fullPath);
  }
}
walkPublic('public');
if (publicFiles.length < 2) fail('pasta public parece incompleta.');

console.log('[vercel-build] OK: build leve para Vercel concluído.');
console.log('[vercel-build] Para auditoria completa local, rode: npm run build:strict && npm test && npm run verify');
