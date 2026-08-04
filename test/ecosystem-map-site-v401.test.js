import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('public/index.html', 'utf8');
const css = fs.readFileSync('public/ecosystem-map.css', 'utf8');
const js = fs.readFileSync('public/ecosystem-flow-map.js', 'utf8');

for (const expected of [
  'Árvore completa do fluxo APK ↔ Proxy',
  'flowMapViewport',
  'flowJourneyButtons',
  'flowMapSearch',
  'flowHistoryToggle',
  'flowNodeDialog',
  'ecosystem-flow-map.js',
  '/api/v1/sync',
  '2026.07.30.01–03',
  '21.12.400',
]) assert.ok(html.includes(expected), `HTML do mapa precisa conter: ${expected}`);

for (const expected of [
  'flow-map-viewport',
  'flow-node.type-decision',
  'flow-node-dialog',
  '@media(max-width:760px)',
  'prefers-reduced-motion',
  'prefers-color-scheme:light',
]) assert.ok(css.includes(expected), `CSS do mapa precisa conter: ${expected}`);

for (const expected of [
  "id: 'route-home'",
  "id: 'route-modal'",
  "id: 'route-analysis'",
  "id: 'route-sync'",
  "id: 'regression-v398'",
  'ResizeObserver',
  'showModal',
  'setPointerCapture',
  'relatedNodeIds',
  '/api/v1/asset/modal',
  '/api/v1/market/rankings',
  '/api/v1/mobile/daily-close',
]) assert.ok(js.includes(expected), `JavaScript do mapa precisa conter: ${expected}`);

for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'setInterval(', 'localStorage', 'sessionStorage']) {
  assert.ok(!js.includes(forbidden), `mapa não deve iniciar comunicação externa: ${forbidden}`);
}

assert.ok(html.includes("script-src 'self'"), 'CSP deve permitir apenas script local');
assert.ok(html.includes("connect-src 'none'"), 'CSP deve impedir chamadas de rede pelo mapa');
assert.ok(html.includes('<noscript>'), 'deve existir fallback sem JavaScript');
assert.ok(js.match(/id: '[^']+'/g).length >= 35, 'mapa precisa conter pelo menos 35 etapas técnicas');
assert.ok(js.match(/\['[^']+','[^']+'/g).length >= 45, 'mapa precisa conter conexões suficientes');

console.log('ecosystem-map-site-v401 ok');
