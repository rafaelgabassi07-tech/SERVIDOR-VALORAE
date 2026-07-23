import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const tests = [];
function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(candidate);
    else if (candidate.endsWith('.test.js')) tests.push(candidate);
  }
}
walk('test');
tests.sort((left, right) => left.localeCompare(right));

const allowMissingDependencies = process.env.VALORAE_ALLOW_MISSING_TEST_DEPS === '1';
const missingDependencyPatterns = [
  /Cannot find package ['\"](cheerio|undici|ajv[^'\"]*)['\"]/i,
  /Cannot find module ['\"](cheerio|undici|ajv[^'\"]*)['\"]/i,
  /ERR_MODULE_NOT_FOUND[\s\S]{0,240}(cheerio|undici|ajv)/i,
];

let passed = 0;
let blocked = 0;
let failures = 0;
const blockedByDependency = new Map();

function combinedOutput(result) {
  return `${result.stdout || ''}${result.stderr || ''}`;
}

function missingDependency(output) {
  for (const pattern of missingDependencyPatterns) {
    const match = output.match(pattern);
    if (match) return String(match[1] || 'declared dependency').replace(/\/dist\/.*$/i, '');
  }
  return null;
}

for (const testFile of tests) {
  const result = spawnSync(process.execPath, [path.resolve(testFile)], {
    cwd: process.cwd(),
    env: { ...process.env, VALORAE_TEST_FILE: testFile },
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 180_000,
    windowsHide: true,
  });
  const output = combinedOutput(result);
  if (result.status === 0 && !result.error) {
    passed += 1;
    console.log('ok', testFile);
    continue;
  }

  const dependency = missingDependency(output);
  if (dependency) {
    blocked += 1;
    blockedByDependency.set(dependency, (blockedByDependency.get(dependency) || 0) + 1);
    console.warn('blocked', testFile, `missing=${dependency}`);
    continue;
  }

  failures += 1;
  console.error('fail', testFile, `exit=${result.status ?? 'spawn-error'}`);
  if (result.error) console.error(result.error);
  if (output.trim()) console.error(output.trim());
}

const dependencySummary = [...blockedByDependency.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([name, count]) => `${name}:${count}`)
  .join(', ');
console.log(`${tests.length} test files; passed=${passed}; blocked=${blocked}; failures=${failures}${dependencySummary ? `; blockedBy=${dependencySummary}` : ''}`);

if (failures > 0) process.exit(1);
if (blocked > 0 && !allowMissingDependencies) {
  console.error('Dependências declaradas ausentes bloquearam testes. Instale node_modules ou use VALORAE_ALLOW_MISSING_TEST_DEPS=1 somente para auditoria de pacote sem dependências vendorizadas.');
  process.exit(2);
}
