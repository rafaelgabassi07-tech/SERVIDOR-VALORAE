import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createEngineRuntimeProfiler, VALORAE_ENGINE_RUNTIME_PROFILER_VERSION } from '../lib/quality/engine-runtime-profiler.js';
import { buildEngineLaunchGate, VALORAE_ENGINE_LAUNCH_GATE_VERSION } from '../lib/quality/engine-launch-gate.js';
import { buildOfficialAppView } from '../lib/quality/app-official-view.js';

const profiler = createEngineRuntimeProfiler({ ticker: 'PETR4', type: 'ACAO', view: 'app', profile: 'fast' });
const t = profiler.start('contracts.app');
profiler.end(t, { appMetrics: 5, appCharts: 1 });

const syntheticPayload = {
  version: '21.12.0',
  schemaVersion: 'asset-v1',
  status: 'OK',
  partial: false,
  ticker: 'PETR4',
  type: 'ACAO',
  view: 'app',
  metrics: { generatedAt: '2026-05-29T00:00:00.000Z' },
  normalized: { precoAtual: { value: 32.5, display: 'R$ 32,50' }, dividendYield: { value: 8.1, display: '8,1%' } },
  appPayload: { metrics: { count: 2, canonical: {} }, charts: { count: 1, bestPointCount: 12 }, quote: { price: 32.5 } },
  appMobileSnapshot: { ticker: 'PETR4', metrics: {}, charts: { series: [] } },
  appSyncEnvelope: { decision: 'replace_snapshot' },
  appResponseIntegrity: { score: 91, renderSafe: true, cacheSafe: true },
  fieldConsistencyGuard: { score: 94, state: 'safe', issueCounts: { total: 0, errors: 0 } },
  payloadBudget: { state: 'good_app', totalBytesApprox: 42000 },
  assetIndicatorCoverage: { completenessPercent: 80, criticalCompletenessPercent: 76 },
  assetActionPlan: { score: 88, releaseDecision: 'render' },
  engineMaturityBooster: { scores: { overall: 86 }, grade: 'A', recommendations: [] },
};
syntheticPayload.engineRuntimeProfiler = profiler.report(syntheticPayload, { resolvedView: 'app', mode: 'app-production-optimized', profile: 'fast' }, {}, { view: 'app', profile: 'fast' });
syntheticPayload.engineLaunchGate = buildEngineLaunchGate(syntheticPayload, { view: 'app' });

assert.equal(syntheticPayload.engineRuntimeProfiler.version, VALORAE_ENGINE_RUNTIME_PROFILER_VERSION);
assert.equal(syntheticPayload.engineLaunchGate.version, VALORAE_ENGINE_LAUNCH_GATE_VERSION);
assert.ok(syntheticPayload.engineRuntimeProfiler.score >= 70, 'profiler deve gerar score saudável para payload sintético');
assert.ok(syntheticPayload.engineLaunchGate.readyForPersonalUse, 'gate deve liberar uso pessoal quando integridade/runtime estão saudáveis');

const official = buildOfficialAppView(syntheticPayload);
assert.ok(official.engineRuntimeProfiler, 'view=app deve preservar engineRuntimeProfiler compacto');
assert.ok(official.engineLaunchGate, 'view=app deve preservar engineLaunchGate compacto');
assert.ok(official.appContract.stableRootOrder.includes('engineLaunchGate'));
assert.ok(official.appContract.stableRootOrder.includes('engineRuntimeProfiler'));

const router = fs.readFileSync('routes/_router.js', 'utf8');
assert.match(router, /\/engine\/performance/);
const openapi = fs.readFileSync('routes/openapi.js', 'utf8');
assert.match(openapi, /\/api\/v1\/engine\/performance/);
const engine = fs.readFileSync('lib/Valorae-engine.js', 'utf8');
assert.match(engine, /createEngineRuntimeProfiler/);
assert.match(engine, /buildEngineLaunchGate/);

console.log('launch-performance-optimizer-v21-12-32 ok');
