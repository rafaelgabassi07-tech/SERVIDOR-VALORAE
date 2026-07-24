import { spawn } from 'node:child_process';
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
const concurrency = Math.max(1, Math.min(8, Number.parseInt(process.env.VALORAE_TEST_CONCURRENCY || '1', 10) || 1));
const timeoutMs = Math.max(10_000, Math.min(300_000, Number.parseInt(process.env.VALORAE_TEST_TIMEOUT_MS || '180000', 10) || 180_000));
const maxOutputBytes = 16 * 1024 * 1024;
const missingDependencyPatterns = [
  /Cannot find package ['"](cheerio|undici|ajv[^'"]*)['"]/i,
  /Cannot find module ['"](cheerio|undici|ajv[^'"]*)['"]/i,
  /ERR_MODULE_NOT_FOUND[\s\S]{0,240}(cheerio|undici|ajv)/i,
];

function missingDependency(output) {
  for (const pattern of missingDependencyPatterns) {
    const match = output.match(pattern);
    if (match) return String(match[1] || 'declared dependency').replace(/\/dist\/.*$/i, '');
  }
  return null;
}

function runTest(testFile) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.resolve(testFile)], {
      cwd: process.cwd(),
      env: { ...process.env, VALORAE_TEST_FILE: testFile },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let outputTruncated = false;
    let timedOut = false;
    const append = (target, chunk) => {
      if (outputBytes >= maxOutputBytes) {
        outputTruncated = true;
        return target;
      }
      const text = chunk.toString('utf8');
      const remaining = maxOutputBytes - outputBytes;
      const accepted = Buffer.byteLength(text, 'utf8') > remaining ? Buffer.from(text).subarray(0, remaining).toString('utf8') : text;
      outputBytes += Buffer.byteLength(accepted, 'utf8');
      if (accepted.length < text.length) outputTruncated = true;
      return target + accepted;
    };
    child.stdout.on('data', chunk => { stdout = append(stdout, chunk); });
    child.stderr.on('data', chunk => { stderr = append(stderr, chunk); });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      const force = setTimeout(() => child.kill('SIGKILL'), 2_000);
      force.unref?.();
    }, timeoutMs);
    timer.unref?.();
    child.on('error', error => {
      clearTimeout(timer);
      resolve({ testFile, status: null, error, output: `${stdout}${stderr}`, timedOut, outputTruncated });
    });
    child.on('close', status => {
      clearTimeout(timer);
      resolve({ testFile, status, error: null, output: `${stdout}${stderr}`, timedOut, outputTruncated });
    });
  });
}

const results = new Array(tests.length);
let nextIndex = 0;
async function worker() {
  while (true) {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= tests.length) return;
    results[index] = await runTest(tests[index]);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, tests.length || 1) }, () => worker()));

let passed = 0;
let blocked = 0;
let failures = 0;
const blockedByDependency = new Map();
for (const result of results) {
  if (result.status === 0 && !result.error && !result.timedOut) {
    passed += 1;
    console.log('ok', result.testFile);
    continue;
  }
  const dependency = missingDependency(result.output);
  if (dependency) {
    blocked += 1;
    blockedByDependency.set(dependency, (blockedByDependency.get(dependency) || 0) + 1);
    console.warn('blocked', result.testFile, `missing=${dependency}`);
    continue;
  }
  failures += 1;
  const reason = result.timedOut ? `timeout=${timeoutMs}` : `exit=${result.status ?? 'spawn-error'}`;
  console.error('fail', result.testFile, reason);
  if (result.error) console.error(result.error);
  if (result.output.trim()) console.error(result.output.trim());
  if (result.outputTruncated) console.error('[output truncated]');
}

const dependencySummary = [...blockedByDependency.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([name, count]) => `${name}:${count}`)
  .join(', ');
console.log(`${tests.length} test files; passed=${passed}; blocked=${blocked}; failures=${failures}; concurrency=${concurrency}${dependencySummary ? `; blockedBy=${dependencySummary}` : ''}`);

if (failures > 0) process.exit(1);
if (blocked > 0 && !allowMissingDependencies) {
  console.error('Dependências declaradas ausentes bloquearam testes. Instale node_modules ou use VALORAE_ALLOW_MISSING_TEST_DEPS=1 somente para auditoria de pacote sem dependências vendorizadas.');
  process.exit(2);
}
