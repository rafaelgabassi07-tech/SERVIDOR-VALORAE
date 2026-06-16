import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';

const roots = ['api', 'routes', 'lib', 'scripts', 'test'];
const files = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
}

function checkFile(file) {
  return new Promise((resolve) => {
    childProcess.execFile(process.execPath, ['--check', file], { maxBuffer: 1024 * 1024 }, (error, stdout = '', stderr = '') => {
      resolve({ file, ok: !error, stdout, stderr, error });
    });
  });
}

async function runPool(items, workerCount = 12) {
  const failures = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const file = items[index++];
      const result = await checkFile(file);
      if (!result.ok) failures.push(result);
    }
  }
  await Promise.all(Array.from({ length: Math.min(workerCount, items.length || 1) }, worker));
  return failures;
}

roots.forEach(walk);
const failures = await runPool(files, Number(process.env.VALORAE_CHECK_SYNTAX_WORKERS || 12));
if (failures.length) {
  for (const failure of failures) {
    console.error(`Syntax check failed: ${failure.file}`);
    if (failure.stdout) process.stderr.write(failure.stdout);
    if (failure.stderr) process.stderr.write(failure.stderr);
    if (failure.error && !failure.stderr) console.error(failure.error.message);
  }
  process.exit(1);
}
console.log(`Checked ${files.length} JS files`);
