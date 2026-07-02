import fs from 'node:fs';
for (const file of ['api/router.js','routes/_router.js','server.js','public/server.html','public/manifest.webmanifest']) {
  if (!fs.existsSync(file)) throw new Error(`Arquivo obrigatório ausente: ${file}`);
}

const forbiddenArtifacts = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(full);
    else if (/\.(bak|tmp|orig)$/.test(entry.name) || entry.name.endsWith('~') || entry.name === '.DS_Store') forbiddenArtifacts.push(full.replace(/^\.\//, ''));
  }
}
walk('.');
if (forbiddenArtifacts.length) throw new Error(`Artefatos temporários/de backup não devem ir para release: ${forbiddenArtifacts.join(', ')}`);
console.log('Build OK para Vercel');
