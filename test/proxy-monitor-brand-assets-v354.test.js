import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const publicDir = path.join(root, 'public');
const read = relative => fs.readFileSync(path.join(publicDir, relative), 'utf8');
const index = read('index.html');
const server = read('server.html');
const manifest = JSON.parse(read('manifest.webmanifest'));
const worker = read('service-worker.js');
const logo = read('assets/valorae-logo.svg');

assert.equal(index, server);
assert.match(logo, /<title id="title">V-Proxy<\/title>/);
assert.match(logo, /Monograma VP do V-Proxy/);
for (const ref of ['/assets/valorae-logo.svg','/assets/valorae-favicon-48.png','/assets/valorae-icon-192.png']) assert.ok(index.includes(ref));
for (const asset of ['assets/valorae-logo.svg','assets/valorae-favicon-48.png','assets/valorae-icon-192.png','assets/valorae-icon-512.png','assets/valorae-icon-1024.png']) {
  assert.ok(fs.statSync(path.join(publicDir, asset)).size > 500, `asset inválido: ${asset}`);
  assert.ok(worker.includes(`/${asset}`), `asset fora do cache: ${asset}`);
}
assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192','512x512','1024x1024']);
assert.match(index, /valorae-monitor-professional-v364/);
assert.match(index, /Core v362 · Monitor v364/);

console.log('proxy-monitor-brand-assets-v364 ok');
