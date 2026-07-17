import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const pnpmLock = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8');
const packageLockText = JSON.stringify(packageLock);

assert.doesNotMatch(
  packageLockText,
  /packages\.applied-caas-gateway1\.internal\.api\.openai\.org/i,
  'package-lock.json must not depend on the audit environment internal registry',
);
assert.match(packageLockText, /https:\/\/registry\.npmjs\.org\//i);

function parsePnpmRootImporter(text) {
  const lines = text.split(/\r?\n/);
  const result = {};
  let inRoot = false;
  let section = null;
  let currentName = null;

  for (const line of lines) {
    if (line === '  .:') {
      inRoot = true;
      continue;
    }
    if (!inRoot) continue;
    if (line === 'packages:') break;

    const sectionMatch = line.match(/^    (dependencies|devDependencies|optionalDependencies):$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      result[section] = {};
      currentName = null;
      continue;
    }

    const nameMatch = line.match(/^      ([^\s][^:]*):$/);
    if (nameMatch && section) {
      currentName = nameMatch[1];
      result[section][currentName] = {};
      continue;
    }

    const valueMatch = line.match(/^        (specifier|version):\s*(.+)$/);
    if (valueMatch && section && currentName) {
      result[section][currentName][valueMatch[1]] = valueMatch[2].replace(/^['"]|['"]$/g, '');
    }
  }

  return result;
}

const importer = parsePnpmRootImporter(pnpmLock);
for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  const expected = packageJson[section] ?? {};
  const actual = importer[section] ?? {};
  assert.deepEqual(
    Object.keys(actual).sort(),
    Object.keys(expected).sort(),
    `pnpm-lock.yaml root importer differs from package.json in ${section}`,
  );
  for (const [name, specifier] of Object.entries(expected)) {
    assert.equal(actual[name]?.specifier, specifier, `${name} specifier differs in pnpm-lock.yaml`);
    assert.ok(actual[name]?.version, `${name} has no resolved version in pnpm-lock.yaml`);
    const resolved = String(actual[name].version).split('(')[0];
    assert.match(pnpmLock, new RegExp(`^  ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}@${resolved.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`, 'm'));
  }
}

assert.deepEqual(
  packageLock.packages?.['']?.dependencies ?? {},
  packageJson.dependencies ?? {},
  'package-lock.json dependencies differ from package.json',
);
assert.deepEqual(
  packageLock.packages?.['']?.optionalDependencies ?? {},
  packageJson.optionalDependencies ?? {},
  'package-lock.json optionalDependencies differ from package.json',
);

console.log('Vercel npm/pnpm lockfile consistency v346 hotfix test OK.');
