import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const productionRoots = ['api', 'routes', 'lib', 'scripts', 'public'];
const sourceExtensions = new Set(['.js', '.mjs', '.cjs']);
const ignoredDirectories = new Set(['node_modules', '.git', '.forgedesk']);

function walk(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [relative.replaceAll('\\', '/')];
  const rows = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    rows.push(...walk(path.join(relative, entry.name)));
  }
  return rows;
}

const jsFiles = new Set(
  productionRoots.flatMap(walk)
    .filter(file => sourceExtensions.has(path.extname(file)))
    .map(file => file.replaceAll('\\', '/'))
);
if (fs.existsSync(path.join(root, 'server.js'))) jsFiles.add('server.js');

function resolveDependency(fromFile, request) {
  if (!request.startsWith('.')) return null;
  const base = path.resolve(root, path.dirname(fromFile), request);
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}.cjs`, path.join(base, 'index.js')];
  for (const candidate of candidates) {
    const relative = path.relative(root, candidate).replaceAll('\\', '/');
    if (jsFiles.has(relative)) return relative;
  }
  return null;
}

function relativeDependencyExists(fromFile, request) {
  if (!request.startsWith('.')) return true;
  const base = path.resolve(root, path.dirname(fromFile), request);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.cjs`,
    `${base}.json`,
    path.join(base, 'index.js'),
  ];
  return candidates.some(candidate => fs.existsSync(candidate));
}

const dependencyPattern = /(?:import\s+(?:[^'";]+?\s+from\s+)?|export\s+[^'";]*?\s+from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g;
const graph = new Map();
const unresolvedRelativeDependencies = [];
for (const file of jsFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const dependencies = new Set();
  for (const match of source.matchAll(dependencyPattern)) {
    const request = match[1];
    const resolved = resolveDependency(file, request);
    if (resolved) dependencies.add(resolved);
    else if (!relativeDependencyExists(file, request)) unresolvedRelativeDependencies.push(`${file} -> ${request}`);
  }
  graph.set(file, dependencies);
}
if (unresolvedRelativeDependencies.length) {
  console.error('Runtime reachability audit failed. Imports relativos sem destino:');
  unresolvedRelativeDependencies.sort().forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

const entries = new Set(['server.js']);
for (const file of jsFiles) if (file.startsWith('api/')) entries.add(file);
for (const command of Object.values(packageJson.scripts || {})) {
  for (const match of String(command).matchAll(/(?:^|\s)(?:node(?:\s+--[^\s]+)*\s+)?([\w./-]+\.(?:js|mjs|cjs))(?:\s|$)/g)) {
    const candidate = match[1].replace(/^\.\//, '');
    if (jsFiles.has(candidate)) entries.add(candidate);
  }
}
for (const html of walk('public').filter(file => file.endsWith('.html'))) {
  const source = fs.readFileSync(path.join(root, html), 'utf8');
  for (const match of source.matchAll(/<script[^>]+src=["']\/([^"']+)["']/gi)) {
    const candidate = `public/${match[1]}`.replaceAll('//', '/');
    if (jsFiles.has(candidate)) entries.add(candidate);
  }
}
for (const worker of ['public/service-worker.js']) if (jsFiles.has(worker)) entries.add(worker);

const reachable = new Set();
const stack = [...entries];
while (stack.length) {
  const file = stack.pop();
  if (!file || reachable.has(file)) continue;
  reachable.add(file);
  for (const dependency of graph.get(file) || []) stack.push(dependency);
}

const ignoredPublicModules = new Set();
const unreachable = [...jsFiles]
  .filter(file => !reachable.has(file))
  .filter(file => !file.startsWith('test/'))
  .filter(file => !ignoredPublicModules.has(file))
  .sort();

if (unreachable.length) {
  console.error('Runtime reachability audit failed. Arquivos JavaScript sem consumidor:');
  unreachable.forEach(file => console.error(`- ${file}`));
  process.exit(1);
}
console.log(`Runtime reachability OK: ${reachable.size}/${jsFiles.size} módulos JavaScript alcançáveis por runtime, monitor ou tooling declarado.`);
