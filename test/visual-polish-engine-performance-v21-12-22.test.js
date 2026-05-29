import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ValoraeEngine, runValoraeSelfTest } from '../lib/Valorae-engine.js';

const html = fs.readFileSync('public/server.html', 'utf8');
assert.equal(html, fs.readFileSync('public/index.html', 'utf8'), 'index deve espelhar server.html');

for (const needle of [
  '--top:58px',
  'compact-header',
  'Centro de comando',
  'Feed de saída',
  'Benchmark e testes',
  'function headers(path)',
  'function refresh',
  'function probe',
  'function runBenchmark',
  'visibilitychange',
  'proxyOutputMonitor',
  'outputFeed',
  'routeOutputs',
  'x-valorae-app',
  'x-valorae-channel',
  'Monitor profissional do Valorae Engine',
]) assert.ok(html.includes(needle), `server.html precisa conter ${needle}`);

assert.ok(!html.includes('<input id="tickerInput" value="PETR4" placeholder="Ticker">'), 'ticker não deve voltar para o cabeçalho antigo');
assert.ok(html.includes('background:linear-gradient(135deg,#0f3d2e,#23c983 56%,#a7f36f)'), 'logo deve preservar identidade verde/cinza');
assert.ok((html.match(/class="explain-grid"/g) || []).length >= 10, 'páginas devem continuar explicativas');
assert.ok(html.length < 85000, 'HTML polido deve continuar leve para mobile/Vercel Free');

const engine = fs.readFileSync('lib/Valorae-engine.js', 'utf8');
for (const needle of [
  'cloneAndMeasureJson',
  'single-json-pass',
  'resolveChartSeriesLimit',
  'compactViewsUseLowerChartBudget',
  'viewAwareChartSeriesBudget',
  'singlePassResultCachePacking',
]) assert.ok(engine.includes(needle), `Valorae-engine.js precisa conter otimização ${needle}`);

assert.equal((engine.match(/function safeText/g) || []).length, 1, 'helper safeText não deve estar duplicado');

const self = runValoraeSelfTest();
assert.equal(self.ok, true, 'self-test do engine deve continuar saudável');
assert.equal(ValoraeEngine.version, '21.12.0', 'contrato público do engine permanece estável');
const stats = ValoraeEngine.cacheStats();
assert.ok(stats.performance?.profiles?.fast, 'perfis de performance continuam disponíveis');
assert.ok(stats.engineCore, 'estatísticas de maturidade do núcleo continuam disponíveis');

console.log('visual-polish-engine-performance-v21-12-22 ok');
