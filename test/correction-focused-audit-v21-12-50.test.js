import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RELEASE = '21.12.51-post-benchmark-performance-hardening';
const indexHtml = fs.readFileSync('public/index.html', 'utf8');
const serverHtml = fs.readFileSync('public/server.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
const sw = fs.readFileSync('public/service-worker.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const meta = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));

assert.equal(indexHtml, serverHtml, 'index.html e server.html precisam ser exatamente a mesma experiência do Monitor.');
assert.ok(serverHtml.includes(RELEASE), 'Monitor precisa expor release v21.12.51.');
assert.equal(manifest.version, '21.12.51', 'Manifest PWA precisa apontar para v21.12.51.');
assert.match(sw, /valorae-proxy-server-v21-12-51/, 'Service worker precisa usar cache v21-12-51 para invalidar shell antigo.');
assert.equal(pkg.valorae.releasePatch, RELEASE, 'package.json precisa expor releasePatch v21.12.51.');
assert.equal(meta.releasePatch, RELEASE, 'metadata.json precisa expor releasePatch v21.12.51.');

const forbiddenTopLevelArtifacts = [
  'build.gradle', 'settings.gradle', '.gradle',
  'fix_modal.cjs', 'update.cjs', 'update_menu.cjs',
  'head.html', 'formatted.css', 'ui-styles.css',
  'test.js', 'test_proxy.js'
];
for (const artifact of forbiddenTopLevelArtifacts) {
  assert.equal(fs.existsSync(path.join(process.cwd(), artifact)), false, `${artifact} não deve existir no topo do pacote do proxy.`);
}

for (const token of ['valorae-logo.svg', 'themeToggle', 'custom-select', 'dataReliability', 'canonicalReliabilityUsed']) {
  assert.ok(serverHtml.includes(token), `Monitor v21.12.51 deve preservar ${token}.`);
}

console.log('post-benchmark-performance-hardening-v21-12-51 OK');
