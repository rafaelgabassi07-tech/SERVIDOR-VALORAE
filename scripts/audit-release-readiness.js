import fs from 'node:fs';
import path from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import { routeManifest } from '../routes/_router.js';

const failures = [];
const warnings = [];
function assert(cond, msg) { if (!cond) failures.push(msg); }
function warn(cond, msg) { if (!cond) warnings.push(msg); }
function exists(file) { return fs.existsSync(file); }
function read(file) { return fs.readFileSync(file, 'utf8'); }

const manifest = routeManifest();
const requiredFiles = [
  'README.md', 'package.json', 'vercel.json', '.gitignore', '.vercelignore',
  'docs/CHANGELOG.md', 'docs/API_CONTRACT.md', 'docs/DEPLOY_VERCEL_FREE.md',
  'docs/MIGRATION_GUIDE.md', 'docs/WEB_TYPESCRIPT_GUIDE.md', 'docs/ANDROID_JAVA_GUIDE.md',
  'docs/RELEASE_CHECKLIST.md', 'docs/OPERATIONS.md', 'docs/RELIABILITY_MATRIX.md',
  'docs/ENVIRONMENT.md', 'docs/TROUBLESHOOTING.md', 'docs/ARCHITECTURE.md', 'docs/QUALITY_MATRIX.md',
  'api/index.js', 'api/[...path].js', 'api/server/metrics.js', 'api/server/tests.js', 'api/cache/stats.js', 'api/source/status.js', 'api/ready.js', 'api/deploy/status.js', 'routes/_router.js', 'lib/Valorae-engine.js',
  'public/index.html', 'public/inspector.html'
];
for (const file of requiredFiles) assert(exists(file), `Arquivo obrigatório de lançamento ausente: ${file}`);

assert(Object.keys(pkg.dependencies || {}).length === 0, 'package.json deve continuar sem dependencies obrigatórias.');
assert(!pkg.devDependencies || Object.keys(pkg.devDependencies).length === 0, 'package.json deve continuar sem devDependencies obrigatórias para deploy simples.');
assert(!['preinstall','postinstall','prepare'].some(s => pkg.scripts?.[s]), 'Scripts lifecycle de instalação não devem existir.');
assert(String(pkg.scripts?.build || '') === 'node scripts/build-vercel-safe.js', 'build deve usar scripts/build-vercel-safe.js para deploy Vercel seguro.');
assert(String(pkg.scripts?.['build:strict'] || '') === 'node scripts/build-free.js', 'build:strict deve preservar scripts/build-free.js para auditoria local completa.');
assert(fs.readFileSync('scripts/build-free.js', 'utf8').includes('audit-release-readiness.js'), 'build-free deve executar audit:release no modo estrito.');
assert(exists('scripts/build-vercel-safe.js'), 'scripts/build-vercel-safe.js deve existir para deploy Vercel.');
assert(String(pkg.scripts?.verify || '') === 'node scripts/verify-release.js', 'verify deve usar orquestrador Node estável.');
assert(String(pkg.scripts?.typecheck || '').includes('typecheck-free.js'), 'typecheck deve ser livre de tsc externo.');

for (const route of ['/ready','/manifest','/env','/schema','/source/status','/health','/asset','/assets','/compare','/scrape','/batch-scrape','/cache/stats','/fields','/errors','/openapi']) {
  assert(manifest.routes.includes(route), `Rota essencial de lançamento ausente no manifesto: ${route}`);
}
for (const required of ['api/index.js','api/[...path].js','api/server/metrics.js','api/server/tests.js','api/cache/stats.js','api/source/status.js','api/ready.js','api/deploy/status.js']) assert(manifest.physicalFunctions.includes(required), `Function física essencial ausente no manifesto: ${required}`);

const rootFiles = fs.readdirSync('.', { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name);
const legacyRootDocs = rootFiles.filter(name => /^(AUDITORIA|COMPARATIVO|SCRAPER_|SECURITY_|QUALITY_|PERFORMANCE_|MARKET_|INVESTMENT_|SCHEMA_|PROFESSIONAL_)/.test(name));
warn(legacyRootDocs.length === 0, `Documentos históricos deveriam ficar em docs/audits ou docs/reference: ${legacyRootDocs.join(', ')}`);

const vercel = JSON.parse(read('vercel.json'));
assert(!vercel.crons, 'vercel.json não deve configurar crons para esta build free-only.');
assert(!JSON.stringify(vercel).includes('Access-Control-Allow-Origin'), 'CORS da API não deve ser fixado no vercel.json.');

const publicIndex = read('public/index.html');
assert(publicIndex.includes(String(pkg.version)), 'public/index.html deve exibir a versão atual.');
assert(publicIndex.includes('/api/v1/ready'), 'public/index.html deve apontar readiness de lançamento.');

const openapi = read('routes/openapi.js');
for (const route of ['/api/v1/ready','/api/v1/manifest','/api/v1/env','/api/v1/schema','/api/v1/source/status','/api/v1/cache/stats']) {
  assert(openapi.includes(route), `OpenAPI deve declarar ${route}.`);
}

if (failures.length) {
  console.error('Release readiness audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  if (warnings.length) {
    console.error('Warnings:');
    for (const w of warnings) console.error(`- ${w}`);
  }
  process.exit(1);
}
for (const w of warnings) console.warn(`Release readiness warning: ${w}`);
console.log(`Release readiness OK: ${pkg.version}, ${manifest.routes.length} rotas internas, ${manifest.physicalFunctions.length} Functions físicas críticas, sem dependências obrigatórias.`);
