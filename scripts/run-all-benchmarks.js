import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const scriptsDir = path.join(process.cwd(), 'scripts');
const files = fs.readdirSync(scriptsDir)
  .filter((name) => /^benchmark.*\.js$/.test(name))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map((name) => path.join('scripts', name));

const timeoutMs = Number(process.env.VALORAE_BENCH_TIMEOUT_MS || 45000);
const failures = [];
for (const file of files) {
  console.log(`\n[benchmark] ${file}`);
  const result = spawnSync(process.execPath, [file], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) failures.push({ file, status: result.status, signal: result.signal, error: result.error?.message || '' });
}
console.log(`\nVALORAE benchmark runner: ${files.length} benchmarks executados; falhas=${failures.length}`);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
