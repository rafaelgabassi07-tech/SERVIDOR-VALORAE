import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const publicDir = path.join(root, 'public');
const read = (relative) => fs.readFileSync(path.join(publicDir, relative), 'utf8');
const index = read('index.html');
const server = read('server.html');
const manifest = JSON.parse(read('manifest.webmanifest'));
const worker = read('service-worker.js');
const logo = read('assets/valorae-logo.svg');

assert.equal(index, server, 'index.html e server.html devem manter a mesma marca e estrutura');
assert.match(logo, /Símbolo exclusivo do VALORAE Proxy/);
assert.match(logo, /Gateway \/ ponte de dados/);
assert.match(logo, /Rotas do Proxy/);
assert.doesNotMatch(logo, /Marca VALORAE do aplicativo com um pequeno indicador/);

for (const ref of [
  '/assets/valorae-logo.svg',
  '/assets/valorae-favicon-48.png',
  '/assets/valorae-icon-192.png',
]) assert.ok(index.includes(ref), `referência ausente no monitor: ${ref}`);

const expectedAssets = [
  'assets/valorae-logo.svg',
  'assets/valorae-favicon-48.png',
  'assets/valorae-icon-192.png',
  'assets/valorae-icon-512.png',
  'assets/valorae-icon-1024.png',
];
for (const asset of expectedAssets) {
  const stat = fs.statSync(path.join(publicDir, asset));
  assert.ok(stat.size > 500, `asset inválido ou vazio: ${asset}`);
  assert.ok(worker.includes(`/${asset}`), `service worker não pré-carrega ${asset}`);
}

assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ['192x192', '512x512', '1024x1024']);
assert.ok(manifest.icons.every((icon) => icon.src.startsWith('/assets/valorae-icon-')));
assert.match(index, /valorae-monitor-gateway-experience-v359/);
assert.match(index, /Core v362 · UI v359/);

console.log('proxy-monitor-brand-assets-v356 ok');
