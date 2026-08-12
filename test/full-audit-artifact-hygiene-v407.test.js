import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

for (const relative of [
  'public/inspector.html',
  'public/manifest.webmanifest',
  'public/server.html',
  'public/service-worker.js',
  'public/tests.html',
]) {
  assert.equal(fs.existsSync(path.join(root, relative)), false, `artefato estático órfão reintroduzido: ${relative}`);
}

const forbiddenDocDirs = ['auditoria', 'benchmarks', 'checkpoints', 'compatibilidade', 'correcoes', 'relatorios', 'validacao', 'archive'];
for (const name of forbiddenDocDirs) {
  assert.equal(fs.existsSync(path.join(root, 'docs', name)), false, `arquivo histórico voltou para docs/${name}`);
}
const docFiles = [];
function walkDocs(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) walkDocs(candidate);
    else docFiles.push(candidate);
  }
}
walkDocs(path.join(root, 'docs'));
assert.equal(docFiles.some(file => /(RELATORIO|AUDITORIA|CHECKPOINT|\bAUDIT\b)/i.test(path.basename(file))), false, 'relatório/auditoria/checkpoint histórico reintroduzido em docs');

const server = read('server.js');
assert.doesNotMatch(server, /\bMAX_LOCAL_BODY_BYTES\b/, 'constante sem consumidor reintroduzida');
assert.doesNotMatch(server, /\bINVALID_JSON\b/, 'constante sem consumidor reintroduzida');

const runner = read('scripts/run-tests.js');
assert.match(runner, /VALORAE_TEST_CONCURRENCY \|\| '8'/, 'runner deve usar paralelismo limitado por padrão');
assert.match(runner, /VALORAE_TEST_TIMEOUT_MS \|\| '30000'/, 'runner deve ter timeout padrão finito e prático');
assert.match(runner, /Math\.min\(8,/, 'runner deve limitar concorrência máxima');
assert.match(runner, /child\.kill\('SIGTERM'\)/, 'runner deve interromper testes travados');
assert.match(runner, /child\.kill\('SIGKILL'\)/, 'runner deve finalizar testes que ignoram SIGTERM');

console.log('full-audit-artifact-hygiene-v407 ok');
