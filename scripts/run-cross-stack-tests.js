import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { assertSiblingApkAvailable, resolveSiblingApkRoot } from '../test/helpers/cross-stack-apk.js';

process.env.VALORAE_REQUIRE_APK = '1';
const apkRoot = assertSiblingApkAvailable();
const testRoot = path.resolve('test');
const selected = fs.readdirSync(testRoot)
  .filter(name => name.endsWith('.test.js'))
  .map(name => path.join(testRoot, name))
  .filter(file => fs.readFileSync(file, 'utf8').includes('./helpers/cross-stack-apk.js'))
  .sort((left, right) => left.localeCompare(right));

if (!selected.length) throw new Error('Nenhum teste APK/Proxy foi localizado.');
const allowMissingDependencies = process.env.VALORAE_ALLOW_MISSING_TEST_DEPS === '1';
const dependencyPatterns = [
  /Cannot find package ['\"](cheerio|undici|ajv[^'\"]*)['\"]/i,
  /Cannot find module ['\"](cheerio|undici|ajv[^'\"]*)['\"]/i,
  /ERR_MODULE_NOT_FOUND[\s\S]{0,240}(cheerio|undici|ajv)/i,
];
let passed = 0;
let blocked = 0;
let failures = 0;
const blockedBy = new Map();

for (const file of selected) {
  const result = spawnSync(process.execPath, [file], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VALORAE_REQUIRE_APK: '1',
      VALORAE_APK_ROOT: apkRoot,
      VALORAE_TEST_FILE: path.relative(process.cwd(), file),
    },
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 180_000,
    windowsHide: true,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status === 0 && !result.error) {
    passed += 1;
    console.log('ok', path.relative(process.cwd(), file));
    continue;
  }
  let dependency = null;
  for (const pattern of dependencyPatterns) {
    const match = output.match(pattern);
    if (match) { dependency = String(match[1] || 'declared dependency').replace(/\/dist\/.*$/i, ''); break; }
  }
  if (dependency) {
    blocked += 1;
    blockedBy.set(dependency, (blockedBy.get(dependency) || 0) + 1);
    console.warn('blocked', path.relative(process.cwd(), file), `missing=${dependency}`);
    continue;
  }
  failures += 1;
  console.error('fail', path.relative(process.cwd(), file), `exit=${result.status ?? 'spawn-error'}`);
  if (result.error) console.error(result.error);
  if (output.trim()) console.error(output.trim());
}

const dependencySummary = [...blockedBy.entries()].sort().map(([name, count]) => `${name}:${count}`).join(', ');
console.log(`${selected.length} testes cross-stack; passed=${passed}; blocked=${blocked}; failures=${failures}${dependencySummary ? `; blockedBy=${dependencySummary}` : ''}; apkRoot=${resolveSiblingApkRoot()}`);
if (failures) process.exit(1);
if (blocked && !allowMissingDependencies) process.exit(2);
