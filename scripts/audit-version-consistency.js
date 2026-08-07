import fs from 'node:fs';
import path from 'node:path';
import pkg from '../package.json' with { type: 'json' };

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const metadata = JSON.parse(read('metadata.json'));
const monitorHtml = read('public/index.html');
const version = String(pkg.version || '');
const releasePatch = String(pkg.valorae?.releasePatch || '');
const publicVersion = String(pkg.valorae?.publicVersion || '');
const checkpoint = String(pkg.valorae?.checkpoint || '');
const releaseLabel = String(pkg.valorae?.releaseLabel || '');
const compatibilitySource = read('lib/core/apk-compatibility.js');
const failures = [];
const expect = (actual, expected, label) => {
  if (String(actual ?? '') !== String(expected ?? '')) failures.push(`${label}: ${actual ?? '<ausente>'} != ${expected}`);
};
if (!read('lib/Valorae-engine.js').includes(`${version}-`)) failures.push(`Valorae-engine.js não contém prefixo ${version}-`);
const currentReleaseSource = read('lib/release/current.js');
const coreReleaseSource = read('lib/core/release.js');
const syncRouteSource = read('routes/sync.js');
if (!currentReleaseSource.includes(`VALORAE_PUBLIC_VERSION = '${publicVersion}'`)) failures.push('lib/release/current.js não expõe a versão pública atual.');
if (!currentReleaseSource.includes(releasePatch)) failures.push('lib/release/current.js não expõe o patch atual.');
if (!coreReleaseSource.includes(releasePatch)) failures.push('lib/core/release.js não expõe o patch atual.');
if (!syncRouteSource.includes(releasePatch)) failures.push('routes/sync.js não expõe o patch de sincronização atual.');
if (!releasePatch || !/^21\.12\.\d+-/.test(releasePatch)) failures.push('releasePatch precisa estar explícito como patch interno.');
expect(pkg.releasePatch, releasePatch, 'package.releasePatch');
for (const [name, block] of [['config', pkg.config], ['releaseMetadata', pkg.releaseMetadata]]) {
  expect(block?.releasePatch, releasePatch, `package.${name}.releasePatch`);
  expect(block?.publicVersion, publicVersion, `package.${name}.publicVersion`);
  expect(block?.checkpoint, checkpoint, `package.${name}.checkpoint`);
  expect(block?.releaseLabel, releaseLabel, `package.${name}.releaseLabel`);
}
expect(metadata.version, version, 'metadata.version');
expect(metadata.releasePatch, releasePatch, 'metadata.releasePatch');
expect(metadata.publicVersion, publicVersion, 'metadata.publicVersion');
expect(metadata.checkpoint, checkpoint, 'metadata.checkpoint');
expect(metadata.label, releaseLabel, 'metadata.label');
expect(pkg.valorae?.apkVersion, metadata.apkVersion, 'package.valorae.apkVersion');
expect(pkg.releaseMetadata?.apkVersion, metadata.apkVersion, 'package.releaseMetadata.apkVersion');
expect(pkg.valorae?.minSupportedApkVersion, metadata.minSupportedApkVersion, 'package.valorae.minSupportedApkVersion');
expect(pkg.valorae?.maxTestedApkVersion, metadata.maxTestedApkVersion, 'package.valorae.maxTestedApkVersion');
if (!compatibilitySource.includes(`pairedVersion: '${metadata.apkVersion}'`)) failures.push('apk-compatibility.js não declara o APK pareado do metadata.');
if (!compatibilitySource.includes(`minSupportedVersion: '${metadata.minSupportedApkVersion}'`)) failures.push('apk-compatibility.js não declara o APK mínimo do metadata.');
if (!compatibilitySource.includes(`maxTestedVersion: '${metadata.maxTestedApkVersion}'`)) failures.push('apk-compatibility.js não declara o APK máximo homologado do metadata.');
const apkCheckpointMatch = String(metadata.apkCheckpoint || '').match(/^v(\d+)/);
if (!apkCheckpointMatch) failures.push('metadata.apkCheckpoint precisa iniciar com v<numero>.');
else if (!String(metadata.contractVersion || '').includes(`APK v${apkCheckpointMatch[1]} / Proxy ${publicVersion}`)) failures.push('metadata.contractVersion não corresponde ao apkCheckpoint/publicVersion.');
const explicitApkRoot = String(process.env.VALORAE_APK_ROOT || '').trim();
const strictApkPairing = ['1', 'true', 'yes', 'on'].includes(String(process.env.VALORAE_REQUIRE_APK || '').trim().toLowerCase());
if (explicitApkRoot || strictApkPairing) {
  const apkRoot = path.resolve(explicitApkRoot || path.join(root, '..', 'apk'));
  const apkMetadataPath = path.join(apkRoot, 'metadata.json');
  const apkBuildPath = path.join(apkRoot, 'app/build.gradle.kts');
  if (!fs.existsSync(apkMetadataPath) || !fs.existsSync(apkBuildPath)) failures.push(`APK pareado não encontrado em ${apkRoot}.`);
  else {
    const apkMetadata = JSON.parse(fs.readFileSync(apkMetadataPath, 'utf8'));
    const apkBuild = fs.readFileSync(apkBuildPath, 'utf8');
    expect(metadata.apkVersion, apkMetadata.versionName, 'proxy.metadata.apkVersion x apk.metadata.versionName');
    if (!apkBuild.includes(`versionCode = ${apkMetadata.versionCode}`)) failures.push('APK build.gradle.kts não corresponde ao versionCode do metadata.json.');
    if (!apkBuild.includes(`versionName = "${apkMetadata.versionName}"`)) failures.push('APK build.gradle.kts não corresponde ao versionName do metadata.json.');
    if (!String(metadata.contractVersion || '').startsWith(`APK v${String(apkMetadata.checkpoint || '').match(/^v(\d+)/)?.[1] || '?'} / Proxy ${publicVersion}`)) failures.push('Contrato do Proxy não corresponde ao checkpoint do APK real.');
  }
}
if (!monitorHtml.includes(publicVersion)) failures.push('public/index.html não exibe a versão pública atual.');
if (!monitorHtml.includes(metadata.apkVersion)) failures.push('public/index.html não exibe o APK pareado atual.');
if (!monitorHtml.includes(String(pkg.valorae?.contract || ''))) failures.push('public/index.html não exibe o contrato móvel atual.');
if (!monitorHtml.includes('/api/sync')) failures.push('public/index.html não documenta /api/sync como rota canônica de sincronização.');
if (monitorHtml.includes('/api/v1/sync')) failures.push('public/index.html ainda documenta o alias /api/v1/sync em vez da rota canônica /api/sync.');
if (/fetch\s*\(|XMLHttpRequest|EventSource|WebSocket|setInterval\s*\(/.test(monitorHtml)) failures.push('public/index.html não pode iniciar consultas de rede.');
const forbiddenControl = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
for (const directory of ['api', 'routes', 'lib', 'scripts']) {
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js') && forbiddenControl.test(fs.readFileSync(full, 'utf8'))) failures.push(`caractere de controle proibido em ${path.relative(root, full)}`);
    }
  };
  walk(path.join(root, directory));
}
if (failures.length) {
  console.error('Version consistency audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Version consistency OK: core ${version}; public ${publicVersion}; release ${releasePatch}.`);
