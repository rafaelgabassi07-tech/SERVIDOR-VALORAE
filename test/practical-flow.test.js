import assert from 'node:assert/strict';
import { buildMobilePortfolioSync } from '../lib/contracts/mobile.js';
import { routeManifest } from '../routes/_router.js';

const samplePosition = { ticker: 'PETR4', quantity: 100, avgPrice: 30, currentPrice: 33, firstPurchaseDate: '2024-01-02' };
const practical = await buildMobilePortfolioSync({
  positions: [samplePosition],
  dividendPositions: [samplePosition],
  mode: 'practical',
  practicalMode: true,
  includeAnalysis: true,
  includeHistory: false,
  includeIpca: false,
  includeDividends: true,
  includeRankings: false
});

assert.equal(practical.version, '21.13.9');
assert.equal(practical.dataPolicy.mode, 'practical');
assert.equal(practical.dataPolicy.dividendsInBundle, false);
assert.equal(practical.blockStatus.dividends, 'SKIPPED');
assert.ok(practical.deferredBlocks.includes('dividends'));
assert.ok(practical.nextActions.some(action => action.endpoint === '/api/v1/dividends/batch'));
assert.ok(routeManifest().routes.includes('/mobile/practical-sync'));
