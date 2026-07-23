import fs from 'node:fs';
import path from 'node:path';
import pkg from '../package.json' with { type: 'json' };

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const metadata = JSON.parse(read('metadata.json'));
const manifest = JSON.parse(read('public/manifest.webmanifest'));
const version = String(pkg.version || '');
const releasePatch = String(pkg.valorae?.releasePatch || '');
const publicVersion = String(pkg.valorae?.publicVersion || '');
const checkpoint = String(pkg.valorae?.checkpoint || '');
const releaseLabel = String(pkg.valorae?.releaseLabel || '');
const failures = [];
const expect = (actual, expected, label) => {
  if (String(actual ?? '') !== String(expected ?? '')) failures.push(`${label}: ${actual ?? '<ausente>'} != ${expected}`);
};
if (!read('lib/Valorae-engine.js').includes(`${version}-`)) failures.push(`Valorae-engine.js não contém prefixo ${version}-`);
const currentReleaseSource = read('lib/release/current.js');
const coreReleaseSource = read('lib/core/release.js');
const syncRouteSource = read('routes/sync.js');
if (!currentReleaseSource.includes(`VALORAE_PUBLIC_VERSION = '${publicVersion}'`)) failures.push('lib/release/current.js não expõe a versão pública atual.');
if (!currentReleaseSource.includes(releasePatch)) failures.push('lib/release/current.js não expõe o patch atual.');
if (!coreReleaseSource.includes(releasePatch)) failures.push('lib/core/release.js não expõe o patch atual.');
if (!syncRouteSource.includes(releasePatch)) failures.push('routes/sync.js não expõe o patch de sincronização atual.');
if (!releasePatch || !/^21\.12\.\d+-/.test(releasePatch)) failures.push('releasePatch precisa estar explícito como patch interno.');
expect(pkg.releasePatch, releasePatch, 'package.releasePatch');
for (const [name, block] of [['config', pkg.config], ['releaseMetadata', pkg.releaseMetadata]]) {
  expect(block?.releasePatch, releasePatch, `package.${name}.releasePatch`);
  expect(block?.publicVersion, publicVersion, `package.${name}.publicVersion`);
  expect(block?.checkpoint, checkpoint, `package.${name}.checkpoint`);
  expect(block?.releaseLabel, releaseLabel, `package.${name}.releaseLabel`);
}
expect(metadata.version, version, 'metadata.version');
expect(metadata.releasePatch, releasePatch, 'metadata.releasePatch');
expect(metadata.publicVersion, publicVersion, 'metadata.publicVersion');
expect(metadata.checkpoint, checkpoint, 'metadata.checkpoint');
expect(metadata.label, releaseLabel, 'metadata.label');
expect(manifest.version, publicVersion, 'manifest.version');
const readmeHead = read('README.md').match(/^## Release atual — ([^\n]+)/m)?.[1] || '';
const changelogHead = read('docs/CHANGELOG.md').match(/^## ([^\n]+)/m)?.[1] || '';
if (!readmeHead.includes(publicVersion)) failures.push(`README atual não inicia em ${publicVersion}.`);
if (!changelogHead.includes(publicVersion)) failures.push(`CHANGELOG atual não inicia em ${publicVersion}.`);
const forbiddenControl = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
for (const directory of ['api', 'routes', 'lib', 'scripts']) {
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js') && forbiddenControl.test(fs.readFileSync(full, 'utf8'))) failures.push(`caractere de controle proibido em ${path.relative(root, full)}`);
    }
  };
  walk(path.join(root, directory));
}
if (failures.length) {
  console.error('Version consistency audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Version consistency OK: core ${version}; public ${publicVersion}; release ${releasePatch}.`);
