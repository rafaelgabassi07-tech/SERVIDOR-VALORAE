import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('public/server.html', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');

for (const needle of [
  'VALORAE Proxy Server',
  'id="page-tests"',
  'renderFailure',
  '/api/asset',
  '/api/server/tests',
  '/api/cache/stats',
  '/api/source/status',
  'engineCoreChart',
  'engineCoreList',
  'Engine Core',
  'HTML family hit',
  'localStorage',
  'appMobileSnapshot',
  'appPayload',
  'chartSeries',
]) assert.ok(html.includes(needle), `server.html precisa conter ${needle}`);

assert.equal(html, index, 'index.html e server.html devem ser a mesma experiência');
assert.ok(!html.includes('/tests.html'), 'app principal não deve abrir /tests.html');
assert.ok(html.length < 65000, 'app reconstruído deve ser menor que o painel antigo');

console.log('app-clean-rebuild-v21-12-13 OK');
