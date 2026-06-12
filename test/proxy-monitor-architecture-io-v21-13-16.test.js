import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getServerMetricsSnapshot, resetServerMetricsForTests } from '../lib/observability/server-metrics.js';

const html = fs.readFileSync('public/server.html', 'utf8');
const css = fs.readFileSync('public/monitor-architecture.css', 'utf8');
const js = fs.readFileSync('public/monitor-architecture.js', 'utf8');

assert.equal(html, fs.readFileSync('public/index.html', 'utf8'), 'index deve continuar espelhando server.html');
for (const needle of [
  'page-architecture',
  'Arquitetura, tecnologias e I/O do Proxy',
  'monitorBlueprint',
  'architectureKpis',
  'architectureFlow',
  'architectureTechStack',
  'architectureInputs',
  'architectureOutputs',
  'architectureRoutes',
  'monitor-architecture.css',
  'monitor-architecture.js',
  'archShortcutBtn',
]) assert.ok(html.includes(needle), `monitor precisa conter ${needle}`);
for (const needle of ['ioMap', 'techCard', 'contractCard', 'controlItem']) assert.ok(css.includes(needle), `css profissional precisa conter ${needle}`);
for (const needle of ['valoraeRenderArchitecture', 'Snapshot mobile', 'Catálogo gráfico', 'Rotas rastreadas']) assert.ok(js.includes(needle), `renderizador precisa conter ${needle}`);
assert.ok(html.length < 110000, 'HTML principal deve continuar leve para mobile/Vercel Free');

resetServerMetricsForTests();
const snap = getServerMetricsSnapshot();
assert.ok(snap.monitorBlueprint, 'snapshot deve expor monitorBlueprint');
assert.ok(Array.isArray(snap.monitorBlueprint.technologies) && snap.monitorBlueprint.technologies.length >= 6, 'blueprint deve listar tecnologias');
assert.ok(Array.isArray(snap.monitorBlueprint.inputChannels) && snap.monitorBlueprint.inputChannels.some(x => x.name.includes('APK')), 'blueprint deve listar entradas do APK');
assert.ok(Array.isArray(snap.monitorBlueprint.outputChannels) && snap.monitorBlueprint.outputChannels.some(x => x.payload === 'graficos_i10 + chart_manifest'), 'blueprint deve listar saída de gráficos');
assert.ok(Array.isArray(snap.monitorBlueprint.dataFlow) && snap.monitorBlueprint.dataFlow.length >= 5, 'blueprint deve ter fluxo ponta a ponta');
assert.ok(Array.isArray(snap.monitorBlueprint.securityControls) && snap.monitorBlueprint.securityControls.length >= 4, 'blueprint deve explicar segurança');
assert.ok(Array.isArray(snap.monitorBlueprint.resilienceControls) && snap.monitorBlueprint.resilienceControls.length >= 4, 'blueprint deve explicar resiliência');

console.log('proxy-monitor-architecture-io-v21-13-16 ok');
