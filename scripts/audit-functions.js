import fs from 'node:fs';
import path from 'node:path';

const allowed = new Set(['api/index.js', 'api/[...path].js']);
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
const missing = [...allowed].filter(f => !found.includes(f));
if (missing.length || extra.length) {
  if (missing.length) console.error('Functions físicas obrigatórias ausentes:', missing.join(', '));
  if (extra.length) console.error('Functions físicas extras detectadas:', extra.join(', '));
  console.error('O projeto deve permanecer consolidado em no máximo 2 functions físicas para Vercel Hobby/Free. Rotas reais ficam no router interno routes/_router.js.');
  process.exit(1);
}
console.log(`Guardrail OK: ${found.length} Functions físicas consolidadas (${found.join(', ')}).`);
