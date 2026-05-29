import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('public/server.html', 'utf8');
assert.equal(html, fs.readFileSync('public/index.html', 'utf8'), 'index deve espelhar server.html');
for (const needle of [
  'Menu lateral de páginas',
  'hamburger',
  'drawer',
  'data-page="overview"',
  'data-page="feed"',
  'data-page="charts"',
  'data-page="routes"',
  'data-page="pipeline"',
  'data-page="diagnostics"',
  'Pausar',
  'Exportar JSON',
  'Exportar feed CSV',
  'Limpar filtros',
  'feedSearch',
  'feedStatus',
  'feedPayload',
  'function headers(path)',
  'function refresh',
  'function probe',
  'proxyOutputMonitor',
  'outputFeed',
  'routeOutputs',
  'Gerar saída teste',
  'proxy-output-probe',
]) assert.ok(html.includes(needle), `server.html precisa conter ${needle}`);
assert.ok(html.length < 85000, 'página com menu lateral deve continuar leve para Vercel Free/mobile');

console.log('proxy-output-hamburger-pages-v21-12-19 ok');
