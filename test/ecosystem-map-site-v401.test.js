import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('public/index.html', 'utf8');
const css = fs.readFileSync('public/ecosystem-map.css', 'utf8');

for (const expected of [
  'Árvore completa do fluxo APK → Proxy → APK',
  'Arquitetura operacional estática',
  'static-flow-shell',
  'gateway-flow',
  'route-tree',
  'processing-tree',
  'failure-grid',
  'Modo do mapa</strong> estático, sem rede',
  '/api/v1/sync',
  '2026.07.30.01–03',
  '21.12.400',
]) assert.ok(html.includes(expected), `HTML do mapa estático precisa conter: ${expected}`);

for (const expected of [
  '.static-flow-shell',
  '.static-flow-chain',
  '.route-tree',
  '.processing-tree',
  '.failure-grid',
  '@media(max-width:760px)',
  'prefers-color-scheme:light',
]) assert.ok(css.includes(expected), `CSS do mapa estático precisa conter: ${expected}`);

for (const forbidden of [
  'flowMapViewport',
  'flowJourneyButtons',
  'flowMapSearch',
  'flowHistoryToggle',
  'flowNodeDialog',
  'ecosystem-flow-map.js',
  '<script ',
  '<dialog',
  'role="application"',
]) assert.ok(!html.includes(forbidden), `mapa estático não deve depender de componente interativo: ${forbidden}`);

assert.ok(html.includes("script-src 'none'"), 'CSP deve impedir scripts no monitor estático');
assert.ok(html.includes("connect-src 'none'"), 'CSP deve impedir chamadas de rede');
assert.equal(fs.existsSync('public/ecosystem-flow-map.js'), false, 'arquivo JavaScript antigo deve ser removido');
assert.ok((html.match(/class="static-flow-node"/g) || []).length >= 7, 'fluxo precisa mostrar as etapas principais');
assert.equal((html.match(/class="route-branch"/g) || []).length, 8, 'árvore precisa mostrar as oito jornadas de rota');
assert.ok((html.match(/class="processing-node"/g) || []).length >= 4, 'cache, fontes, qualidade e fallback devem estar visíveis');
assert.ok((html.match(/<article><b>/g) || []).length >= 6, 'caminhos de falha precisam estar visíveis');

console.log('ecosystem-map-site-v402 ok');
