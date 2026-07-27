import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));

const packageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');
const vercelConfig = readJson('vercel.json');
const packageLockText = JSON.stringify(packageLock);

assert.equal(packageJson.packageManager, 'npm@10.9.2', 'package.json must pin npm 10.9.2');
assert.equal(packageLock.lockfileVersion, 3, 'package-lock.json must use npm lockfileVersion 3');
assert.equal(vercelConfig.installCommand, 'npm ci', 'Vercel must install through npm ci');

for (const competingLockfile of ['pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'vlt-lock.json']) {
  assert.equal(
    fs.existsSync(path.join(root, competingLockfile)),
    false,
    `${competingLockfile} must not coexist with package-lock.json`,
  );
}

assert.doesNotMatch(
  packageLockText,
  /packages\.applied-caas-gateway1\.internal\.api\.openai\.org/i,
  'package-lock.json must not depend on the audit environment internal registry',
);
assert.match(packageLockText, /https:\/\/registry\.npmjs\.org\//i);

for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  assert.deepEqual(
    packageLock.packages?.['']?.[section] ?? {},
    packageJson[section] ?? {},
    `package-lock.json ${section} differ from package.json`,
  );
}

console.log('Vercel npm-only lockfile consistency test OK.');
