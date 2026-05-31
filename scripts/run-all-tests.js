import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const testDir = path.join(process.cwd(), 'test');
const files = fs.readdirSync(testDir)
  .filter((name) => name.endsWith('.test.js'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map((name) => path.join('test', name));

const timeoutMs = Number(process.env.VALORAE_TEST_TIMEOUT_MS || 30000);
const failures = [];
const timings = [];

for (const file of files) {
  const start = Date.now();
  const useUnixTimeout = process.platform !== 'win32';
  const command = useUnixTimeout ? 'timeout' : process.execPath;
  const args = useUnixTimeout ? [`${Math.ceil(timeoutMs / 1000)}s`, process.execPath, file] : [file];
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: timeoutMs + 5000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const elapsedMs = Date.now() - start;
  timings.push({ file, elapsedMs, status: result.status, signal: result.signal });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) {
    failures.push({ file, status: result.status, signal: result.signal, error: result.error?.message || '' });
    console.error(`[FAIL] ${file} status=${result.status} signal=${result.signal || ''} ${result.error?.message || ''}`);
  } else {
    console.log(`[PASS] ${file} ${elapsedMs}ms`);
  }
}

const slow = timings.filter((item) => item.elapsedMs > 5000).map((item) => `${item.file}:${item.elapsedMs}ms`);
console.log(`VALORAE test runner: ${files.length} arquivos executados; falhas=${failures.length}; lentos=${slow.length ? slow.join(', ') : 'nenhum'}`);
if (failures.length) process.exit(1);
