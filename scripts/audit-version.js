import fs from 'node:fs';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));const meta=JSON.parse(fs.readFileSync('metadata.json','utf8'));const sw=fs.readFileSync('public/service-worker.js','utf8');
const ok = pkg.valorae.releasePatch.includes('21.13.1') && meta.version === '21.13.1' && sw.includes('v21-13-1');
if(!ok) throw new Error('Version consistency failed');
console.log('Version consistency OK: 21.13.1');
