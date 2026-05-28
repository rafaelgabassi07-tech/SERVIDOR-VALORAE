import { spawn } from 'node:child_process';

const base = 'http://127.0.0.1:3000';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function json(path) {
  const res = await fetch(`${base}${path}`, { headers: { 'User-Agent': 'VALORAE-SELF-POLLING-AUDIT/1.0' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

async function waitReady() {
  for (let i = 0; i < 30; i += 1) {
    try {
      await json('/api/server/metrics?audit=boot');
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error('Servidor local não iniciou em tempo hábil.');
}

const server = spawn(process.execPath, ['server.js'], { stdio: 'ignore' });
try {
  await waitReady();
  const samples = [];
  for (let i = 0; i < 5; i += 1) {
    const m = await json(`/api/server/metrics?audit=poll-${i}&ts=${Date.now()}`);
    samples.push([m.summary.requests, m.summary.responses, m.summary.inFlight]);
  }
  const first = samples[0].join(':');
  const stable = samples.every(s => s.join(':') === first);
  if (!stable) throw new Error(`Polling de /api/server/metrics inflou métricas: ${JSON.stringify(samples)}`);
  const beforeRequests = samples[0][0];
  const beforeResponses = samples[0][1];

  const health = await fetch(`${base}/api/health`, { headers: { 'User-Agent': 'VALORAE-AUDIT-REAL-ENDPOINT/1.0' } });
  if (!health.ok) throw new Error(`/api/health -> HTTP ${health.status}`);
  const after = await json(`/api/server/metrics?audit=after-real&ts=${Date.now()}`);
  if (after.summary.requests !== beforeRequests + 1 || after.summary.responses !== beforeResponses + 1) {
    throw new Error(`Endpoint real não foi contado corretamente: antes=${beforeRequests}/${beforeResponses}; depois=${JSON.stringify(after.summary)}`);
  }
  console.log('Self-polling metrics audit OK: /api/server/metrics não infla tráfego; endpoints reais continuam medidos.');
} finally {
  server.kill('SIGTERM');
}
