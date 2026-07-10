import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const helperDirectory = path.dirname(fileURLToPath(import.meta.url));
const siblingApkRoot = path.resolve(helperDirectory, '../../../apk');

/**
 * Lê um arquivo do APK pareado quando a auditoria é executada no workspace conjunto.
 * No ZIP autônomo do Proxy, retorna null para que os testes do runtime continuem
 * executáveis sem duplicar fontes Kotlin dentro do pacote do servidor.
 */
export function readSiblingApkFile(relativePath) {
  const target = path.join(siblingApkRoot, relativePath);
  if (!fs.existsSync(target)) return null;
  return fs.readFileSync(target, 'utf8');
}

export function hasSiblingApk() {
  return fs.existsSync(siblingApkRoot);
}
