import fs from 'node:fs';
import path from 'node:path';
const words = ['Aero'+'Scrape', 'Aero'+'Scraper', 'Ves'+'to'];
const banned = words.map(w => new RegExp(w, 'i'));
const roots = ['api','routes','lib','public','scripts','test','docs','server.js','package.json','metadata.json','README.md'];
const hits=[];
function scan(file){const text=fs.readFileSync(file,'utf8');for(const re of banned){if(re.test(text))hits.push(`${file}: ${re}`)}}
function walk(p){if(!fs.existsSync(p))return;const st=fs.statSync(p);if(st.isDirectory()){for(const e of fs.readdirSync(p))walk(path.join(p,e));}else if(/\.(js|json|html|md|webmanifest|txt)$/.test(p))scan(p)}
roots.forEach(walk);
if(hits.length){console.error(hits.join('\n'));process.exit(1)}
console.log('Identidade VALORAE OK: 0 ocorrências externas.');
