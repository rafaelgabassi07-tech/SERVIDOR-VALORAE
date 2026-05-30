import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('public/server.html', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');

for (const needle of [
  'VALORAE Proxy Output Server',
  'Espelho de saída do proxy',
  'Feed de tudo que saiu do proxy',
  'proxyOutputMonitor',
  '/api/asset',
  '/api/server/metrics',
  'appMobileSnapshot',
  'appPayload',
  'chartSeries',
  'localStorage',
  'Gerar saída teste',
  'routeOutputs',
]) assert.ok(html.includes(needle), `server.html precisa conter ${needle}`);

assert.equal(html, index, 'index.html e server.html devem ser a mesma experiência');
assert.ok(!html.includes('/tests.html'), 'app principal não deve abrir /tests.html');
assert.ok(html.length < 110000, 'página-servidor deve continuar leve mesmo com gráficos profissionais adicionais');

console.log('app-clean-rebuild-v21-12-13 OK');
