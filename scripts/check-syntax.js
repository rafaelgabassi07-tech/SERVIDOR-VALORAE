import fs from 'node:fs';
import path from 'node:path';
import child_process from 'node:child_process';
const roots = ['api','routes','lib','scripts','test'];
const files = [];
function walk(dir){ if(!fs.existsSync(dir)) return; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const p=path.join(dir,e.name); if(e.isDirectory()) walk(p); else if(p.endsWith('.js')) files.push(p); } }
roots.forEach(walk);
for (const f of files) child_process.execFileSync(process.execPath, ['--check', f], {stdio:'inherit'});
console.log(`Checked ${files.length} JS files`);
