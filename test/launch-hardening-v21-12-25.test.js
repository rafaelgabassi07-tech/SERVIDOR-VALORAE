import assert from 'node:assert/strict';
import { applyPayloadView, resolvePayloadView } from '../lib/quality/views.js';
import { buildCoverageView, buildFundamentalsView } from '../lib/quality/asset-launch-readiness.js';
import { resolveClientAuth } from '../lib/security/client-auth.js';
import { routeManifest } from '../routes/_router.js';

const sample = {
  schemaVersion: 'asset-test',
  version: '21.12.0',
  status: 'OK',
  partial: false,
  ticker: 'PETR4',
  type: 'ACAO',
  cacheStatus: 'LIVE_HTML',
  warnings: [],
  results: { nome: 'Petrobras', dividendos: { historico: [{ data: '2024-01-01', valor: 1.2 }] } },
  normalized: {
    precoAtual: { value: 38.9, display: 'R$ 38,90', unit: 'BRL', confidence: 0.9 },
    dividendYield: { value: 8.1, display: '8,10%', unit: '%', confidence: 0.8 },
    pvp: { value: 1.2, display: '1,20', unit: 'ratio', confidence: 0.8 },
    roe: { value: 18.3, display: '18,30%', unit: '%', confidence: 0.8 },
    patrimonioLiquido: { value: 1000000, display: 'R$ 1 mi', unit: 'BRL', confidence: 0.7 },
  },
  appMobileSnapshot: { ticker: 'PETR4', quote: { price: 38.9 }, metrics: { precoAtual: 38.9 }, charts: [{ points: [{ x: '2024-01', y: 38 }] }], sync: { renderSafe: true }, snapshotHash: 'abc' },
  appPayload: {
    ticker: 'PETR4',
    quote: { price: 38.9 },
    metrics: { count: 5, canonical: { precoAtual: { value: 38.9 }, dividendYield: { value: 8.1 }, pvp: { value: 1.2 }, roe: { value: 18.3 }, patrimonioLiquido: { value: 1000000 } }, aliases: { price: 'precoAtual', dy: 'dividendYield' } },
    charts: { count: 1, series: [{ points: [{ x: 1, y: 2 }] }], bestPointCount: 1 },
    dividends: { count: 1, items: [{ value: 1.2 }] },
    source: { primary: 'test' },
  },
  appSyncEnvelope: { decision: 'replace_snapshot', identity: { payloadHash: 'abc' } },
  appResponseIntegrity: { ok: true, renderSafe: true, cacheSafe: true, score: 92 },
  appDataContract: { renderSafe: true, canReplacePreviousSnapshot: true, uiGuards: { missingCritical: [] } },
  engineEfficiency: { scores: { overall: 88 }, precision: { normalizedFields: 5 }, reliability: { sourceScore: 90 }, delivery: { renderSafe: true } },
  sourceReport: { primarySource: 'unit-test', sourcesTried: [{ provider: 'unit', ok: true, status: 200 }] },
  metrics: { generatedAt: '2026-05-29T00:00:00.000Z' },
};

assert.equal(resolvePayloadView('app').resolved, 'app');
assert.equal(resolvePayloadView('production').resolved, 'app');

const appView = applyPayloadView(sample, 'app');
assert.equal(appView.view, 'app');
assert.ok(String(appView.officialAppContractVersion).startsWith('21.12.'), 'official app contract version should be a 21.12.x launch contract');
assert.ok(appView.appMobileSnapshot, 'view=app preserva appMobileSnapshot');
assert.ok(appView.appPayload, 'view=app preserva appPayload');
assert.ok(appView.appSyncEnvelope, 'view=app preserva appSyncEnvelope');
assert.ok(appView.appResponseIntegrity, 'view=app preserva appResponseIntegrity');
assert.ok(appView.endpointCoverage?.blocks?.quote, 'view=app expõe cobertura oficial');
assert.ok(!('results' in appView), 'view=app remove results bruto do contrato público');
assert.ok(appView.payloadViewProfile.removedRoots.includes('results'));

const fundamentals = buildFundamentalsView(sample);
assert.equal(fundamentals.ticker, 'PETR4');
assert.ok(fundamentals.groups.quote.present >= 1);
assert.ok(fundamentals.groups.dividends.present >= 1);

const coverage = buildCoverageView(sample);
assert.equal(coverage.coverage.quote, true);
assert.equal(coverage.coverage.appContracts, true);
assert.ok(coverage.score >= 80);

const manifest = routeManifest();
assert.ok(manifest.routes.includes('/asset/coverage'));
assert.ok(manifest.routes.includes('/asset/fundamentals'));
assert.ok(manifest.routes.includes('/integration/sdk'));
assert.ok(manifest.routes.includes('/integration/prompts'));

const previousKeys = process.env.VALORAE_CLIENT_KEYS;
process.env.VALORAE_CLIENT_KEYS = 'web:test-secret';
const okReq = { method: 'GET', url: '/api/v1/asset?ticker=PETR4', headers: { 'x-valorae-app-id': 'web', 'x-valorae-client-key': 'test-secret' } };
const badReq = { method: 'GET', url: '/api/v1/asset?ticker=PETR4', headers: { 'x-valorae-app-id': 'web', 'x-valorae-client-key': 'wrong' } };
assert.equal(resolveClientAuth(okReq).ok, true);
assert.equal(resolveClientAuth(badReq).ok, false);
if (previousKeys === undefined) delete process.env.VALORAE_CLIENT_KEYS; else process.env.VALORAE_CLIENT_KEYS = previousKeys;

console.log('launch-hardening-v21-12-25 ok');
