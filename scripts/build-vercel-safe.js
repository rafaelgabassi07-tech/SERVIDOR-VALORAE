import fs from 'node:fs';

const requiredFiles = [
  'api/router.js',
  'routes/_router.js',
  'server.js',
  'public/server.html',
  'public/manifest.webmanifest'
];

const ignoredDirectories = new Set(['node_modules', '.git', '.vercel']);

function isForbiddenArtifactName(name) {
  return /\.(bak|tmp|orig)$/i.test(name) || name.endsWith('~') || name === '.DS_Store';
}

function normalizePath(filePath) {
  return filePath.replace(/^\.\//, '');
}

function walkAndPrune(dir, removedArtifacts) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;

    const full = `${dir}/${entry.name}`;
    if (isForbiddenArtifactName(entry.name)) {
      fs.rmSync(full, { recursive: true, force: true });
      removedArtifacts.push(normalizePath(full));
      continue;
    }

    if (entry.isDirectory()) walkAndPrune(full, removedArtifacts);
  }
}

function collectForbiddenArtifacts(dir, forbiddenArtifacts = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;

    const full = `${dir}/${entry.name}`;
    if (isForbiddenArtifactName(entry.name)) {
      forbiddenArtifacts.push(normalizePath(full));
      continue;
    }

    if (entry.isDirectory()) collectForbiddenArtifacts(full, forbiddenArtifacts);
  }
  return forbiddenArtifacts;
}

const removedArtifacts = [];
walkAndPrune('.', removedArtifacts);

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error(`Arquivo obrigatório ausente: ${file}`);
}

const forbiddenArtifacts = collectForbiddenArtifacts('.');
if (forbiddenArtifacts.length) {
  throw new Error(`Artefatos temporários/de backup não devem ir para release: ${forbiddenArtifacts.join(', ')}`);
}

if (removedArtifacts.length) {
  console.warn(`Artefatos temporários/de backup removidos antes do build: ${removedArtifacts.join(', ')}`);
}
console.log('Build OK para Vercel');
