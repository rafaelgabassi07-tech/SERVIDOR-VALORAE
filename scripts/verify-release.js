import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { assertSiblingApkAvailable } from '../test/helpers/cross-stack-apk.js';

function fail(message) {
  console.error(`release gate failed: ${message}`);
  process.exit(1);
}

const major = Number(process.versions.node.split('.')[0]);
if (major !== 22) fail(`Node 22.x é obrigatório; encontrado ${process.version}.`);

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

const qualityGate = path.join(apkRoot, 'tools', 'quality_gate.sh');
if (!fs.existsSync(qualityGate)) fail(`quality gate do APK não encontrado em ${qualityGate}.`);
if (process.platform === 'win32') {
  fail('o gate de distribuição Android exige ambiente POSIX/CI com sh; execute-o em Linux/WSL e preserve a evidência gerada.');
}

console.log('\n[release] Android distribution quality gate');
const android = spawnSync('sh', [qualityGate, '--mode', 'distribution', '--with-static-analysis'], {
  cwd: apkRoot,
  env,
  stdio: 'inherit',
  windowsHide: true,
});
if (android.error || android.status !== 0) fail(`quality gate Android distribution terminou com código ${android.status ?? 'spawn-error'}.`);

const evidencePath = path.join(apkRoot, 'build', 'reports', 'valorae', 'quality', 'release-evidence.json');
if (!fs.existsSync(evidencePath)) fail(`evidência Android ausente após quality gate: ${evidencePath}.`);
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
if (evidence.releaseApproved !== true || evidence.distributionArtifactVerified !== true || evidence.deviceGateVerified !== true) {
  fail('evidência Android não comprova release distribuível + assinatura + gate de dispositivo da mesma geração.');
}

console.log(`release gate OK: Proxy ${JSON.parse(fs.readFileSync('package.json','utf8')).valorae.publicVersion}; APK ${JSON.parse(fs.readFileSync(path.join(apkRoot,'metadata.json'),'utf8')).versionName}.`);
