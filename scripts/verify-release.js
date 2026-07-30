import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { assertSiblingApkAvailable } from '../test/helpers/cross-stack-apk.js';

function fail(message) {
  console.error(`release gate failed: ${message}`);
  process.exit(1);
}

const major = Number(process.versions.node.split('.')[0]);
if (major !== 24) fail(`Node 24.x é obrigatório; encontrado ${process.version}.`);

const root = process.cwd();
const apkRoot = assertSiblingApkAvailable();
for (const packageName of ['ajv', 'cheerio', 'undici']) {
  try { await import(packageName); }
  catch { fail(`dependência obrigatória ausente: ${packageName}. Execute npm ci com o lockfile íntegro.`); }
}

const steps = [
  ['build', ['run', 'build']],
  ['syntax', ['run', 'check:syntax']],
  ['on-demand imports', ['run', 'audit:on-demand']],
  ['runtime reachability', ['run', 'audit:dead-code']],
  ['minimal SQL', ['run', 'audit:sql']],
  ['full tests', ['test']],
  ['cross-stack tests', ['run', 'test:cross-stack']],
  ['strict version audit', ['run', 'audit:version']],
];

const env = {
  ...process.env,
  VALORAE_REQUIRE_APK: '1',
  VALORAE_APK_ROOT: apkRoot,
  VALORAE_ALLOW_MISSING_TEST_DEPS: '0',
};
for (const [label, args] of steps) {
  console.log(`\n[release] ${label}`);
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: root,
    env,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error || result.status !== 0) fail(`${label} terminou com código ${result.status ?? 'spawn-error'}.`);
}

const gradlew = path.join(apkRoot, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
if (!fs.existsSync(gradlew)) fail(`Gradle wrapper do APK não encontrado em ${gradlew}.`);
const gradleArgs = ['--no-daemon', 'lintRelease', 'testReleaseUnitTest', 'assembleRelease'];
console.log('\n[release] Android release build');
const android = spawnSync(gradlew, gradleArgs, { cwd: apkRoot, env, stdio: 'inherit', windowsHide: true });
if (android.error || android.status !== 0) fail(`build Android terminou com código ${android.status ?? 'spawn-error'}.`);

if (!['1', 'true', 'yes', 'on'].includes(String(process.env.VALORAE_DEVICE_GATE_COMPLETED || '').toLowerCase())) {
  fail('o gate de dispositivo/macrobenchmark não foi comprovado; defina VALORAE_DEVICE_GATE_COMPLETED=1 somente após executar tools/run_performance_device_gate.sh em dispositivo homologado.');
}

console.log(`release gate OK: Proxy ${JSON.parse(fs.readFileSync('package.json','utf8')).valorae.publicVersion}; APK ${JSON.parse(fs.readFileSync(path.join(apkRoot,'metadata.json'),'utf8')).versionName}.`);
