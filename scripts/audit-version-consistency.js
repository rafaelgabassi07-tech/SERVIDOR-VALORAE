import fs from 'node:fs';
import path from 'node:path';
import pkg from '../package.json' with { type: 'json' };

const root = process.cwd();
const version = String(pkg.version || '');
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'metadata.json'), 'utf8'));
const releasePatch = String(pkg.valorae?.releasePatch || metadata.releasePatch || metadata.release || '');
const expectedPrefix = `${version}-`;
const failures = [];

const engineFile = fs.readFileSync(path.join(root, 'lib/Valorae-engine.js'), 'utf8');
if (!engineFile.includes(expectedPrefix)) failures.push(`Valorae-engine.js não contém prefixo ${expectedPrefix}`);

for (const file of ['README.md', 'public/index.html', 'docs/CHANGELOG.md']) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  if (!content.includes(version)) failures.push(`${file} não referencia ${version}`);
}

const pkgText = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
if (!pkgText.includes(`"version": "${version}"`)) failures.push('package.json não contém versão coerente.');

if (metadata.publicEngineContract && metadata.publicEngineContract !== version) failures.push(`metadata.publicEngineContract (${metadata.publicEngineContract}) diverge do core package.version (${version})`);
if (metadata.coreVersion && metadata.coreVersion !== version) failures.push(`metadata.coreVersion (${metadata.coreVersion}) diverge do core package.version (${version})`);
if (!releasePatch || !/^21\.12\.\d+-/.test(releasePatch)) failures.push('releasePatch precisa estar explícito como patch interno, ex: 21.12.38-nome.');
if (String(metadata.version || '') !== version) failures.push(`metadata.version deve representar o core semver ${version}; use releasePatch para patch interno.`);
if (failures.length) {
  console.error('Version consistency audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Version consistency OK: core ${version}; release ${releasePatch}.`);
