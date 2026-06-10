import fs from 'node:fs';
for (const file of ['api/router.js','routes/_router.js','server.js','public/server.html','public/manifest.webmanifest']) {
  if (!fs.existsSync(file)) throw new Error(`Arquivo obrigatório ausente: ${file}`);
}
console.log('Build OK para Vercel');
