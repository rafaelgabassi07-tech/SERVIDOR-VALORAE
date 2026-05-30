import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const html = fs.readFileSync('public/server.html', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');
const script = html.slice(html.indexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));

assert.equal(html, index, 'index.html e server.html devem permanecer espelhados');

for (const id of [
  'flowChart',
  'latencyChart',
  'bytesChart',
  'statusChart',
  'profileChart',
  'cacheSourceChart',
  'richDataChart',
  'completenessChart',
  'reliabilityChart',
  'benchmarkChart',
  'healthChart',
]) {
  assert.match(html, new RegExp(`id="${id}"`), `monitor deve conter canvas ${id}`);
}

for (const token of [
  'drawEmptyState',
  'seriesFromBuckets',
  'seedSeries',
  'reliabilityItemsFromSignals',
  'profileItems',
  'richDataItems',
  'chartEmptyLabel',
  'drawAll(d)',
]) {
  assert.ok(script.includes(token), `script do monitor deve conter ${token}`);
}

assert.doesNotMatch(script, /function statusCode\([^)]*\).*function statusCode\(/s, 'não deve haver duas declarações concorrentes de statusCode');
assert.match(script, /function derive\(m\).*metrics:m/s, 'derive deve preservar o snapshot completo para gráficos agregados');
assert.match(script, /drawBars\('reliabilityChart'/, 'drawAll deve desenhar confiabilidade por bloco');
assert.match(script, /drawBars\('cacheSourceChart'/, 'drawAll deve desenhar cache e fonte');
assert.match(script, /drawBars\('richDataChart'/, 'drawAll deve desenhar dados ricos');
assert.match(script, /drawLine\('benchmarkChart'/, 'drawAll deve desenhar benchmark visual');
assert.match(html, /21\.12\.48-monitor-responsive-settings-theme/, 'HTML deve expor release v21.12.52');

fs.writeFileSync('/tmp/valorae-monitor-chart-rendering-v21-12-48.js', script);
execFileSync(process.execPath, ['--check', '/tmp/valorae-monitor-chart-rendering-v21-12-48.js'], { stdio: 'inherit' });

console.log('monitor-chart-rendering-v21-12-48 OK');
