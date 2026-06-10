import assert from 'node:assert/strict';
import { buildMobilePortfolioSync } from '../lib/contracts/mobile.js';
const result = await buildMobilePortfolioSync({positions:[{ticker:'PETR4',quantity:100,avgPrice:30,currentPrice:33,firstPurchaseDate:'2024-01-02'}],includeIpca:false,includeDividends:false,includeRankings:false});
assert.equal(result.endpoint, 'mobile-portfolio-sync');
assert.equal(result.analysis.summary.count, 1);
assert.equal(result.requestedBlocks.includeRankings, false);
