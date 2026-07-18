import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const runs = Math.max(3, Math.min(Number(process.env.VALORAE_COLD_START_RUNS || 11), 51));
const target = pathToFileURL(path.resolve('api/router.js')).href;
const samples = [];
for (let index = 0; index < runs; index += 1) {
  const source = `
    const started = process.hrtime.bigint();
    import(${JSON.stringify(target)}).then(() => {
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
      const memory = process.memoryUsage();
      process.stdout.write(JSON.stringify({ elapsedMs, rssBytes: memory.rss, heapUsedBytes: memory.heapUsed }));
    }).catch(error => { console.error(error); process.exit(1); });
  `;
  const result = spawnSync(process.execPath, ['--no-warnings', '-e', source], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, VALORAE_DISABLE_EXTERNAL: '1', VALORAE_SHARED_STATE_MODE: 'memory' },
    timeout: Number(process.env.VALORAE_COLD_START_SAMPLE_TIMEOUT_MS || 15000),
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Falha no benchmark cold start: ${result.error?.message || result.stderr || `status ${result.status}`}`);
  }
  samples.push(JSON.parse(result.stdout.trim()));
}

const sorted = [...samples].sort((a, b) => a.elapsedMs - b.elapsedMs);
const median = sorted[Math.floor(sorted.length / 2)];
const averageMs = samples.reduce((sum, sample) => sum + sample.elapsedMs, 0) / samples.length;
const report = {
  benchmark: 'valorae-v350-router-cold-start',
  node: process.version,
  runs,
  medianMs: Number(median.elapsedMs.toFixed(2)),
  averageMs: Number(averageMs.toFixed(2)),
  minMs: Number(Math.min(...samples.map(sample => sample.elapsedMs)).toFixed(2)),
  maxMs: Number(Math.max(...samples.map(sample => sample.elapsedMs)).toFixed(2)),
  medianRssMiB: Number((median.rssBytes / 1024 / 1024).toFixed(2)),
  medianHeapUsedMiB: Number((median.heapUsedBytes / 1024 / 1024).toFixed(2)),
};
console.log(JSON.stringify(report, null, 2));

const maxMedianMs = Number(process.env.VALORAE_COLD_START_MAX_MEDIAN_MS || 0);
if (maxMedianMs > 0 && report.medianMs > maxMedianMs) {
  console.error(`Cold start ${report.medianMs}ms excedeu o limite ${maxMedianMs}ms.`);
  process.exit(1);
}
