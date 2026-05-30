import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('public/server.html', 'utf8');
assert.equal(html, fs.readFileSync('public/index.html', 'utf8'), 'index deve espelhar server.html');

for (const needle of [
  '21.12.31-monitor-experience-redesign',
  'executive-monitor-redesign',
  'Centro de comando',
  'Saída do proxy',
  'Performance e Vercel',
  'Qualidade dos dados',
  'Integração e guia',
  'Benchmark e diagnóstico',
  'pageAliases',
  'overview',
  'tests',
  'proxyOutputMonitor',
  'outputFeed',
  'routeOutputs',
  'payloadPreview',
  'function headers(path)',
  'function refresh',
  'function probe',
  'function runBenchmark',
  'x-valorae-app',
  'x-valorae-channel',
]) assert.ok(html.includes(needle), `monitor redesenhado deve conter ${needle}`);

const visibleNavButtons = [...html.matchAll(/<button data-page="([^"]+)"/g)].map(m => m[1]);
assert.deepEqual(visibleNavButtons, ['command', 'output', 'performance', 'quality', 'integration', 'diagnostics', 'settings'], 'menu visível deve ter 7 áreas principais');
assert.ok((html.match(/class="explain-grid"/g) || []).length >= 6, 'cada área principal mantém duas explicações claras');
assert.ok(!html.includes('<input id="tickerInput" value="PETR4" placeholder="Ticker">'), 'ticker não deve voltar ao cabeçalho antigo');
assert.ok(html.length < 110000, 'cockpit redesenhado deve continuar leve para mobile/Vercel Free com gráficos resilientes');

const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
assert.match(manifest.version, /^21\.12\.(31|32|35|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51)$/);
assert.equal(manifest.start_url, '/server.html#command');

const sw = fs.readFileSync('public/service-worker.js', 'utf8');
assert.ok(sw.includes('v21-12-31') || sw.includes('v21-12-32') || sw.includes('v21-12-35') || sw.includes('v21-12-37') || sw.includes('v21-12-38') || sw.includes('v21-12-39') || sw.includes('v21-12-40') || sw.includes('v21-12-41') || sw.includes('v21-12-42') || sw.includes('v21-12-45') || sw.includes('v21-12-48') || sw.includes('v21-12-51'), 'service worker deve usar cache novo do redesign/performance');
assert.ok(sw.includes("pathname.startsWith('/api')") || sw.includes('pathname.startsWith("/api")'), 'service worker não deve cachear API');

const readme = fs.readFileSync('README.md', 'utf8');
assert.ok(readme.includes('v21.12.31') && readme.includes('v21.12.32') && readme.includes('v21.12.35'));
assert.ok(readme.includes('7 áreas principais'));

console.log('monitor-experience-redesign-v21-12-31 ok');
