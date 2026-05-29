import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('public/server.html', 'utf8');
assert.equal(html, fs.readFileSync('public/index.html', 'utf8'), 'index deve espelhar server.html');

for (const needle of [
  'VALORAE Proxy Monitor',
  'Monitor profissional do Valorae Engine',
  'Menu lateral de páginas',
  'Centro de comando',
  'Feed de saída',
  'Gráficos e payloads',
  'Rotas e apps',
  'Vercel Runtime',
  'Qualidade e cache',
  'Benchmark e testes',
  'Integração dos apps',
  'Diagnóstico bruto',
  'data-page="vercel"',
  'data-page="quality"',
  'data-page="benchmark"',
  'data-page="integration"',
  'Gerar saída teste',
  'Benchmark rápido',
  'Benchmark profundo',
  'Testar endpoints do plano',
  'function headers(path)',
  'function refresh',
  'function probe',
  'function runBenchmark',
  'proxyOutputMonitor',
  'outputFeed',
  'routeOutputs',
  'x-valorae-app',
  'x-valorae-channel',
  'x-valorae-telemetry',
]) assert.ok(html.includes(needle), `server.html precisa conter ${needle}`);

assert.ok(!html.includes('<input id="tickerInput" value="PETR4" placeholder="Ticker">'), 'ticker não deve ficar no cabeçalho antigo');
assert.ok(html.includes('background:linear-gradient(135deg,#0f3d2e,#23c983 56%,#a7f36f)'), 'logo visual deve usar tons verdes alinhados ao monitor');
assert.ok((html.match(/class="explain-grid"/g) || []).length >= 10, 'cada página principal deve ter duas explicações');
assert.ok(html.length < 85000, 'monitor profissional deve continuar leve para Vercel Free/mobile');

console.log('proxy-monitor-professional-ui-v21-12-21 ok');
