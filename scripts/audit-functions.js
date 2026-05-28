import fs from 'node:fs';
import path from 'node:path';

const allowed = new Set(['api/index.js','api/[...path].js','api/server/metrics.js','api/server/tests.js','api/v1/server/metrics.js','api/v2/server/metrics.js','api/ready.js','api/v1/ready.js','api/v2/ready.js','api/deploy/status.js']);
const found = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.js')) found.push(p.replace(/\\/g, '/'));
  }
}
walk('api');
const extra = found.filter(f => !allowed.has(f));
if (extra.length) {
  console.error('Functions físicas extras detectadas:', extra.join(', '));
  process.exit(1);
}
console.log(`Guardrail OK: ${found.length} Functions físicas (${found.join(', ')}).`);
