import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runValoraeSelfTest, ValoraeEngine } from '../lib/Valorae-engine.js';
import { buildEngineEfficiencyReport, buildEngineModuleTree, VALORAE_ENGINE_EFFICIENCY_VERSION } from '../lib/quality/engine-efficiency.js';

const engine = fs.readFileSync('lib/Valorae-engine.js', 'utf8');
for (const needle of [
  'buildEngineEfficiencyReport',
  'buildEngineModuleTree',
  'VALORAE_ENGINE_EFFICIENCY_VERSION',
  'ENGINE_ASSEMBLY_PLAN_CACHE',
  'singleRuntimeStatsSnapshot',
  'assemblyPlanMemoized',
  'payload.engineEfficiency = buildEngineEfficiencyReport',
]) assert.ok(engine.includes(needle), `Valorae-engine.js deve conter ${needle}`);

const report = buildEngineEfficiencyReport({
  ticker: 'PETR4', type: 'ACAO', status: 'OK', partial: false, cacheStatus: 'LIVE_HTML',
  normalized: { precoAtual: { value: 38.5, display: 'R$ 38,50', unit: 'BRL' }, dividendYield: { value: 8.2, display: '8,20%', unit: '%' } },
  appPayload: { metrics: { canonical: { precoAtual: { value: 38.5, display: 'R$ 38,50', unit: 'BRL' }, dividendYield: { value: 8.2, display: '8,20%', unit: '%' } } } },
  chartSeries: { series: [{ key: 'preco', points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }] },
  appSyncEnvelope: { decision: 'replace_snapshot' }, appMobileSnapshot: { snapshotHash: 'abc' }, appResponseIntegrity: { renderSafe: true, cacheSafe: true },
  metrics: { generatedAt: '2026-05-29T00:00:00.000Z', sourcesTried: [{ ok: true, status: 200 }] }, warnings: []
}, { mode: 'mobile-optimized', profile: 'fast', resolvedView: 'compact', skippedRootsWhenMobileOptimized: ['chartReadiness'] }, { caches: { assetResult: { entries: 1 }, html: { entries: 2 } } }, { view: 'compact' });
assert.equal(report.version, VALORAE_ENGINE_EFFICIENCY_VERSION);
assert.ok(report.scores.overall >= 70, 'score geral deve ser alto para payload saudável');
assert.equal(report.precision.units.currency, 1);
assert.equal(report.precision.units.percent, 1);
assert.equal(report.delivery.chartSeries, 1);
assert.equal(report.assembly.recommendedAppRoot, 'appMobileSnapshot');

const tree = buildEngineModuleTree();
assert.ok(tree.groups.some(g => g.key === 'engine-core'));
assert.ok(tree.groups.some(g => g.key === 'app-contracts'));
assert.ok(tree.totalModulesListed >= 20);

const html = fs.readFileSync('public/server.html', 'utf8');
assert.equal(html, fs.readFileSync('public/index.html', 'utf8'), 'index deve espelhar server.html');
for (const needle of [
  'Prompts prontos para IA',
  'Funcionalidades do Valorae Engine',
  'Tecnologias e funcionamento',
  'Árvore de módulos',
  'data-page="prompts"',
  'data-page="features"',
  'data-page="technology"',
  'data-page="modules"',
  'moduleGroups',
  'promptGrid',
  'featuresGrid',
  'techGrid',
  'moduleTree',
  'engineEfficiency',
  '21.12.24-efficiency-precision-ecosystem',
]) assert.ok(html.includes(needle), `monitor deve conter ${needle}`);
assert.ok((html.match(/class="explain-grid"/g) || []).length >= 14, 'novas páginas devem ter duas explicações claras');
assert.ok(html.length < 85000, 'monitor deve continuar leve');

const fields = fs.readFileSync('routes/fields.js', 'utf8');
assert.ok(fields.includes('engineEfficiency.scores'));
assert.ok(fields.includes('engineEfficiency.moduleTreeSummary'));
const openapi = fs.readFileSync('routes/openapi.js', 'utf8');
assert.ok(openapi.includes('engineEfficiency'));

const self = runValoraeSelfTest();
assert.equal(self.ok, true);
assert.equal(ValoraeEngine.version, '21.12.0');

console.log('engine-ecosystem-surprise-v21-12-24 ok');
