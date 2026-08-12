import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('public/index.html', 'utf8');
const css = fs.readFileSync('public/ecosystem-map.css', 'utf8');

for (const expected of [
  'Todo o caminho, ligado etapa por etapa',
  'Ciclo vertical APK ↔ Proxy',
  'vertical-flow-shell',
  'flow-rail',
  'flow-step',
  'gateway-flow',
  'route-tree',
  'processing-tree',
  'failure-grid',
  'Mapa</strong> HTML + CSS local',
  '/api/sync',
  '2026.07.30.01–03',
  '21.12.408',
]) assert.ok(html.includes(expected), `HTML do fluxo vertical precisa conter: ${expected}`);

for (const expected of [
  '.vertical-flow-shell',
  '.flow-rail',
  '.flow-step',
  '.flow-marker',
  '.flow-path',
  '.route-tree',
  '.processing-tree',
  '.failure-grid',
  'animation-timeline:view()',
  '@media(max-width:640px)',
  'prefers-reduced-motion:reduce',
  'prefers-color-scheme:light',
]) assert.ok(css.includes(expected), `CSS do fluxo vertical precisa conter: ${expected}`);

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
]) assert.ok(!html.includes(forbidden), `fluxo não deve depender de componente interativo: ${forbidden}`);

assert.ok(html.includes("script-src 'none'"), 'CSP deve impedir scripts no monitor');
assert.ok(html.includes("connect-src 'none'"), 'CSP deve impedir chamadas de rede');
assert.equal(fs.existsSync('public/ecosystem-flow-map.js'), false, 'arquivo JavaScript antigo deve permanecer removido');
assert.equal((html.match(/class="flow-step static-flow-node"/g) || []).length, 10, 'fluxo deve mostrar dez etapas principais');
assert.equal((html.match(/class="route-branch"/g) || []).length, 8, 'fluxo precisa mostrar as oito jornadas de rota');
assert.ok((html.match(/class="processing-node"/g) || []).length >= 4, 'qualidade e composição devem estar visíveis');
assert.ok((html.match(/<article><b>/g) || []).length >= 6, 'caminhos de falha precisam estar visíveis');

console.log('ecosystem-map-site-v403 ok');