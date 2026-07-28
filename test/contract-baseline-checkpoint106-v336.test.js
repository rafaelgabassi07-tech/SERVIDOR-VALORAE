import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPortfolioReturns } from '../lib/portfolio/analysis.js';
import {
  VALORAE_BASELINE_CONTRACT_VERSION,
  VALORAE_REFERENCE_ASSET_MATRIX,
  assessContractPayload,
  buildContractBaselineManifest,
  buildContractShapeSnapshot,
} from '../lib/contract/baseline.js';
import { sendJson } from '../lib/core/http.js';
import { dispatchRoute, routeManifest } from '../routes/_router.js';

const snapshots = JSON.parse(fs.readFileSync(new URL('../contracts/checkpoint106/golden-snapshots.json', import.meta.url), 'utf8'));
const manifest = buildContractBaselineManifest();
assert.equal(manifest.version, VALORAE_BASELINE_CONTRACT_VERSION);
assert.equal(manifest.guarantees.additiveChangesOnly, true);
assert.equal(manifest.guarantees.preserveLastGoodOnRegression, true);
assert.deepEqual(VALORAE_REFERENCE_ASSET_MATRIX.indices, ['IBOV', 'IFIX', 'IDIV', 'SMLL']);
assert.ok(routeManifest().routes.includes('/contract/baseline'));
assert.ok(!routeManifest().routes.includes('/analysis'));
assert.ok(!routeManifest().routes.includes('/asset/analysis'));

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
