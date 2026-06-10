import fs from 'node:fs';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const meta = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));
const release = fs.readFileSync('lib/core/release.js', 'utf8');
const sw = fs.readFileSync('public/service-worker.js', 'utf8');
const monitor = fs.readFileSync('public/server.html', 'utf8');
const expected = '21.13.3';
const ok = pkg.version === expected
  && pkg.valorae.releasePatch.includes(expected)
  && meta.version === expected
  && release.includes(`version: '${expected}'`)
  && sw.includes('v21-13-3')
  && monitor.includes('VALORAE Proxy Monitor');
if (!ok) throw new Error(`Version consistency failed for ${expected}`);
console.log(`Version consistency OK: ${expected}`);
