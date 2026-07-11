import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const helperDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultSiblingApkRoot = path.resolve(helperDirectory, '../../../apk');

function explicitApkRoot() {
  const explicit = String(process.env.VALORAE_APK_ROOT || '').trim();
  return explicit ? path.resolve(explicit) : null;
}

function configuredApkRoot() {
  return explicitApkRoot() || defaultSiblingApkRoot;
}

function strictCrossStackMode() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.VALORAE_REQUIRE_APK || '').trim().toLowerCase());
}

export function resolveSiblingApkRoot() {
  return configuredApkRoot();
}

/**
 * Lê o arquivo correspondente do APK pareado.
 *
 * - execução autônoma do Proxy: retorna null quando o APK não está disponível;
 * - auditoria integrada (VALORAE_REQUIRE_APK=1): falha de forma explícita se o
 *   projeto ou o arquivo esperado estiver ausente;
 * - VALORAE_APK_ROOT permite apontar para qualquer checkout/extração do APK.
 */
export function readSiblingApkFile(relativePath) {
  // A suíte autônoma do Proxy não deve acoplar-se por acidente a um checkout
  // global ou desatualizado. A leitura cruzada só é habilitada quando a raiz é
  // informada explicitamente ou quando o modo estrito foi solicitado.
  if (!explicitApkRoot() && !strictCrossStackMode()) return null;

  const apkRoot = configuredApkRoot();
  const target = path.resolve(apkRoot, relativePath);
  const normalizedRoot = `${path.resolve(apkRoot)}${path.sep}`;
  if (!target.startsWith(normalizedRoot)) {
    throw new Error(`Caminho APK inválido fora da raiz configurada: ${relativePath}`);
  }
  if (!fs.existsSync(target)) {
    if (strictCrossStackMode()) {
      throw new Error(`APK pareado obrigatório não encontrado: ${target}. Configure VALORAE_APK_ROOT corretamente.`);
    }
    return null;
  }
  return fs.readFileSync(target, 'utf8');
}

export function hasSiblingApk() {
  if (!explicitApkRoot() && !strictCrossStackMode()) return false;
  return fs.existsSync(configuredApkRoot());
}

export function assertSiblingApkAvailable() {
  const apkRoot = configuredApkRoot();
  const required = [
    'app/build.gradle.kts',
    'app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt',
    'app/src/main/java/com/example/data/proxy/ValoraeProxyEndpointCatalog.kt',
  ];
  const missing = required.filter(relativePath => !fs.existsSync(path.join(apkRoot, relativePath)));
  if (missing.length) {
    throw new Error(`Auditoria APK/Proxy incompleta em ${apkRoot}; arquivos ausentes: ${missing.join(', ')}`);
  }
  return apkRoot;
}
