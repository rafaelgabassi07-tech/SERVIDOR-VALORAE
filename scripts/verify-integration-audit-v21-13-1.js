import assert from 'node:assert/strict';
import { buildMobilePortfolioSync } from '../lib/contracts/mobile.js';
import { buildDividendsContract } from '../lib/portfolio/dividends-contract.js';
import { buildAssetHistory } from '../lib/portfolio/analysis.js';
import { parseAgendaHtml } from '../lib/sources/agenda-dividends.js';

const mobile = await buildMobilePortfolioSync({
  positions: [{ ticker: 'PETR4', quantity: 10, avgPrice: 20, currentPrice: 23, firstPurchaseDate: '2024-01-02' }],
  includeIpca: false,
  includeDividends: false,
  includeRankings: false
});
assert.equal(mobile.status, 'OK');
assert.equal(mobile.endpoint, 'mobile-portfolio-sync');
assert.equal(mobile.bundleVersion, '21.13.1');
assert.equal(mobile.blockStatus.ipca, 'SKIPPED');
assert.equal(mobile.blockStatus.dividends, 'SKIPPED');

const emptyDiv = await buildDividendsContract({ positions: [], tickers: [] });
assert.equal(emptyDiv.status, 'EMPTY');
assert.equal(emptyDiv.officialEvents.length, 0);
assert.equal(emptyDiv.diagnostics[0].reason, 'emptyTickers');

const compact = 'FISC11 R$ 0,62 20/07/2026 FATN11 R$ 0,80 21/07/2026';
assert.deepEqual(parseAgendaHtml(compact, []).map(e => e.ticker), []);
assert.equal(parseAgendaHtml(compact, ['FISC11'])[0].valuePerShare, 0.62);
assert.equal(parseAgendaHtml(compact, ['FATN11'])[0].valuePerShare, 0.8);

const missingPrice = buildAssetHistory({ ticker: 'PETR4' });
assert.equal(missingPrice.status, 'EMPTY');
assert.equal(missingPrice.ticker, 'PETR4');
const priced = buildAssetHistory({ ticker: 'PETR4', currentPrice: 32, months: 2 });
assert.equal(priced.status, 'OK');
assert.equal(priced.points.length, 2);
console.log('VALORAE Proxy integration audit v21.13.1 OK');
