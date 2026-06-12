import { spawnSync } from 'node:child_process';

const commands = [
  ['npm', ['run', 'check']],
  ['npm', ['test']],
  ['npm', ['run', 'typecheck']],
  ['npm', ['run', 'audit:version']],
  ['npm', ['run', 'audit:identity']],
  ['npm', ['run', 'smoke']],
];

for (const [cmd, args] of commands) {
  const label = [cmd, ...args].join(' ');
  console.log(`\n[verify] ${label}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`[verify] Falhou: ${label}`);
    process.exit(result.status || 1);
  }
}
console.log('\nVerify OK: lançamento Valorae validado para GitHub/Vercel free-only e consumo APK.');
