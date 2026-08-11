import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const forbidden = [
  '.gradle',
  'build.gradle.kts',
  'settings.gradle.kts',
  'src/assets/images/valorae_logo_design_1784950912955.jpg',
  'public/monitor-architecture.css',
  'public/monitor-valorae.css'
];
for (const relative of forbidden) {
  assert.equal(fs.existsSync(path.join(ROOT, relative)), false, `artefato órfão não pode voltar ao Proxy: ${relative}`);
}

const downloads = [
  'public/downloads/valorae-android-kotlin.kt.txt',
  'public/downloads/valorae-mobile-kotlin.txt'
];
for (const relative of downloads) assert.equal(fs.existsSync(path.join(ROOT, relative)), true, `alias público de compatibilidade ausente: ${relative}`);
assert.deepEqual(
  fs.readFileSync(path.join(ROOT, downloads[0])),
  fs.readFileSync(path.join(ROOT, downloads[1])),
  'aliases públicos precisam permanecer byte a byte equivalentes'
);
console.log('ecosystem-package-hygiene-v414: ok');
