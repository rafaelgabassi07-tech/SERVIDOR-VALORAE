import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';
import { buildPortfolioReturns } from '../lib/portfolio/analysis.js';
import {
  VALORAE_BASELINE_CONTRACT_VERSION,
  VALORAE_REFERENCE_ASSET_MATRIX,
  assessContractPayload,
  buildContractBaselineManifest,
  buildContractShapeSnapshot,
  compareContractPayloads,
  preservePreviousContractFields,
} from '../lib/contract/baseline.js';
import { _test as continuityTest, clearContractContinuityStore, stabilizeContractPayload } from '../lib/contract/continuity-store.js';
import { sendJson } from '../lib/core/http.js';
import { _test as routerTest, dispatchRoute, routeManifest } from '../routes/_router.js';

const snapshots = JSON.parse(fs.readFileSync(new URL('../contracts/checkpoint106/golden-snapshots.json', import.meta.url), 'utf8'));
const manifest = buildContractBaselineManifest();
assert.equal(manifest.version, VALORAE_BASELINE_CONTRACT_VERSION);
assert.equal(manifest.guarantees.additiveChangesOnly, true);
assert.equal(manifest.guarantees.preserveLastGoodOnRegression, true);
assert.deepEqual(VALORAE_REFERENCE_ASSET_MATRIX.indices, ['IBOV', 'IFIX', 'IDIV', 'SMLL']);
assert.ok(routeManifest().routes.includes('/contract/baseline'));

const analysisFixture = {
  ticker: 'PETR4', symbol: 'PETR4', assetClass: 'ACAO', name: 'PETROBRAS PN', price: 38.99, currentPrice: 38.99,
  indicators: { pl: 4.67, pvp: 1.13, dividendYield: 7.15, payout: 33.43, roe: 24.22 },
  dividends: [{ dividendType: 'DIVIDENDO', valuePerShare: 0.55, paymentDate: '2026-02-20', dateCom: '2026-02-10', source: 'statusinvest' }],
  assetChartBundle: { priceHistory: [{ date: '2025-01-01', close: 30 }, { date: '2026-01-01', close: 39 }] },
};
const analysis = buildAnalysisPageResponse(analysisFixture, { ticker: 'PETR4' });
assert.equal(buildContractShapeSnapshot(analysis).sha256, snapshots.analysisPETR4.shapeSha256);
assert.equal(assessContractPayload('analysis', analysis).ok, true);

const returns = await buildPortfolioReturns({
  range: '12M', assetFilter: 'ALL', benchmarks: ['NONE'],
  portfolioHistory: [
    { date: '2026-01-01', totalValue: 1000, investedValue: 1000, returnPercent: 0, source: 'fixture' },
    { date: '2026-02-01', totalValue: 1100, investedValue: 1000, returnPercent: 10, source: 'fixture' },
    { date: '2026-03-01', totalValue: 1050, investedValue: 1000, returnPercent: 5, source: 'fixture' },
  ],
});
assert.equal(buildContractShapeSnapshot(returns).sha256, snapshots.portfolioReturns.shapeSha256);
assert.equal(assessContractPayload('portfolioReturns', returns).ok, true);

const previousAnalysis = {
  endpoint: 'analysis', contract: 'AnalysisPageResponse', ticker: 'PETR4',
  sections: [{ id: 'summary', items: [{ label: 'Cotação', value: 'R$ 38,99' }] }],
  sourceCoverage: [{ id: 'quote', status: 'ready' }], dataQuality: { coveragePercent: 100 },
  summary: { readySections: 1 }, consumerContract: { version: 'v1' }, missingSignals: [],
};
const regressedAnalysis = {
  endpoint: 'analysis', contract: 'AnalysisPageResponse', ticker: 'PETR4',
  sections: [], sourceCoverage: [], dataQuality: {}, summary: {}, consumerContract: null, missingSignals: [],
};
const comparison = compareContractPayloads('analysis', previousAnalysis, regressedAnalysis);
assert.equal(comparison.regression, true);
assert.ok(comparison.losses.some(item => item.path === 'sections'));
const recovered = preservePreviousContractFields('analysis', previousAnalysis, regressedAnalysis);
assert.deepEqual(recovered.sections, previousAnalysis.sections);
assert.deepEqual(recovered.summary, previousAnalysis.summary);
assert.equal(recovered.contractBaseline.regressionBlocked, true);
assert.equal(recovered.contractBaseline.status, 'RECOVERED_FROM_LAST_GOOD');
assert.equal(recovered.partial, true);
const typeRegressedAnalysis = { ...previousAnalysis, sections: { summary: previousAnalysis.sections } };
const typeRecovered = preservePreviousContractFields('analysis', previousAnalysis, typeRegressedAnalysis);
assert.deepEqual(typeRecovered.sections, previousAnalysis.sections);
assert.ok(typeRecovered.contractBaseline.typeChanges.some(item => item.path === 'sections'));
assert.equal(typeRecovered.contractBaseline.regressionBlocked, true);

const identityA = routerTest.contractIdentity('portfolioReturns', {
  userId: 'user-a', range: '12M', positions: [{ ticker: 'PETR4', quantity: 10, avgPrice: 30, currentPrice: 38 }]
});
const identityB = routerTest.contractIdentity('portfolioReturns', {
  userId: 'user-a', range: '12M', positions: [{ ticker: 'PETR4', quantity: 10, avgPrice: 30, currentPrice: 42 }]
});
const identityOtherUser = routerTest.contractIdentity('portfolioReturns', {
  userId: 'user-b', range: '12M', positions: [{ ticker: 'PETR4', quantity: 10, avgPrice: 30, currentPrice: 42 }]
});
assert.equal(identityA, identityB, 'cotação volátil não pode fragmentar a continuidade da mesma carteira');
assert.notEqual(identityA, identityOtherUser, 'usuários distintos precisam de identidades isoladas');

clearContractContinuityStore();
const stored = stabilizeContractPayload('analysis', 'PETR4::page', previousAnalysis);
assert.equal(stored.contractBaseline.status, 'COMPATIBLE');
const continuityKey = [...continuityTest.store.keys()][0];
const storedAtBeforeRegression = continuityTest.store.get(continuityKey).storedAt;
const protectedResponse = stabilizeContractPayload('analysis', 'PETR4::page', regressedAnalysis);
assert.deepEqual(protectedResponse.sections, previousAnalysis.sections);
assert.equal(protectedResponse.contractBaseline.canReplacePrevious, true);
assert.equal(continuityTest.store.get(continuityKey).storedAt, storedAtBeforeRegression, 'payload recuperado não pode renovar indefinidamente a idade do último bom');

const headers = new Map();
const response = {
  writableEnded: false, statusCode: 200, body: '',
  setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
  getHeader(name) { return headers.get(String(name).toLowerCase()); },
  removeHeader(name) { headers.delete(String(name).toLowerCase()); },
  end(value = '') { this.body = String(value); this.writableEnded = true; return this; },
  status(code) { this.statusCode = code; return this; },
  send(value) { return this.end(value); },
};
sendJson({ method: 'GET', url: '/api/v1/contract/baseline', headers: {} }, response, manifest);
assert.equal(headers.get('x-valorae-baseline-contract'), VALORAE_BASELINE_CONTRACT_VERSION);
assert.ok(headers.get('access-control-expose-headers') == null || typeof headers.get('access-control-expose-headers') === 'string');

const routeHeaders = new Map();
const routeResponse = {
  writableEnded: false, statusCode: 200, body: '',
  setHeader(name, value) { routeHeaders.set(String(name).toLowerCase(), String(value)); },
  getHeader(name) { return routeHeaders.get(String(name).toLowerCase()); },
  removeHeader(name) { routeHeaders.delete(String(name).toLowerCase()); },
  end(value = '') { this.body = String(value); this.writableEnded = true; return this; },
  status(code) { this.statusCode = code; return this; },
  send(value) { return this.end(value); },
};
await dispatchRoute({ method: 'GET', url: '/api/v1/contract/baseline', headers: {} }, routeResponse);
const routedManifest = JSON.parse(routeResponse.body || '{}');
assert.equal(routeResponse.statusCode, 200);
assert.equal(routedManifest.version, VALORAE_BASELINE_CONTRACT_VERSION);
assert.equal(routedManifest.policyVersion, 'no-regression-field-continuity-v1');
assert.equal(routeHeaders.get('x-valorae-baseline-contract'), VALORAE_BASELINE_CONTRACT_VERSION);

for (const fixturePath of snapshots.existingAssetGoldenFixtures) {
  assert.equal(fs.existsSync(new URL(`../${fixturePath}`, import.meta.url)), true, `${fixturePath} precisa permanecer no baseline`);
}

console.log('contract-baseline-checkpoint106-v336 ok');
