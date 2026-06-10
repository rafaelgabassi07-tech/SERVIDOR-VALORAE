import fs from 'node:fs';
import path from 'node:path';
const tests=[];function walk(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.test.js'))tests.push(p)}}walk('test');let failures=0;for(const t of tests){try{await import(path.resolve(t));console.log('ok',t)}catch(e){failures++;console.error('fail',t,e)}}if(failures)process.exit(1);console.log(`${tests.length} test files; failures=0`);
