import fs from 'node:fs';
import path from 'node:path';

const words = [
  [65,101,114,111,83,99,114,97,112,101],
  [65,101,114,111,83,99,114,97,112,101,114],
  [86,101,115,116,111],
].map(chars => String.fromCharCode(...chars));
const banned = words.map(w => new RegExp(`\\b${w}\\b`, 'i'));
const roots = ['api','routes','lib','public','scripts','test','docs','server.js','package.json','metadata.json','README.md'];
const hits=[];
function scan(file){const text=fs.readFileSync(file,'utf8');for(const re of banned){if(re.test(text))hits.push(`${file}: ${re}`)}}
function walk(p){if(!fs.existsSync(p))return;const st=fs.statSync(p);if(st.isDirectory()){for(const e of fs.readdirSync(p))walk(path.join(p,e));}else if(/\.(js|json|html|md|webmanifest|txt|status)$/.test(p))scan(p)}
roots.forEach(walk);
if(hits.length){console.error(hits.join('\n'));process.exit(1)}
console.log('Identidade VALORAE OK: 0 ocorrências externas.');
