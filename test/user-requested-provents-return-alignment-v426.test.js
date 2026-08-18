import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { benchmarkAccumulatedMonthMap, selectPortfolioRowsForRange } from '../lib/portfolio/return-metrics.js';
import { applyDividendTax } from '../lib/sources/status-dividends.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const text = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// Return: preserve January's real monthly return by using previous close only as hidden YTD baseline.
const ytd = selectPortfolioRowsForRange([
  { month: '2025-12', monthlyReturnPercent: 2, portfolioReturnPercent: 2 },
  { month: '2026-01', monthlyReturnPercent: 10, portfolioReturnPercent: 12.2 },
  { month: '2026-02', monthlyReturnPercent: -5, portfolioReturnPercent: 6.59 }
], 'YTD', 12, new Date('2026-08-17T12:00:00Z'));
assert.deepEqual(ytd.rows.map(row => row.month), ['2026-01', '2026-02']);
assert.equal(Math.round(ytd.rows.at(-1).portfolioReturnPercent * 100) / 100, 4.5);

// A missing exact prior base month must preserve the first visible index return instead of forcing it to 0%.
const benchmark = benchmarkAccumulatedMonthMap([
  { month: '2026-01', accumulatedPercent: 5 },
  { month: '2026-02', accumulatedPercent: 10 }
], 'accumulatedPercent', '2026-01', '2025-12');
assert.equal(benchmark.has('2026-01'), true);
assert.equal(benchmark.has('2026-02'), true);
assert.equal(benchmark.get('2026-01'), 5);
assert.ok(benchmark.get('2026-02') > 0);

// Dividend contract provides explicit gross/net/tax data; APK should consume rather than re-tax it.
const taxed = applyDividendTax({ ticker: 'TEST3', assetClass: 'ACAO', dividendType: 'JCP', paymentDate: '2026-06-15' }, {
  dividendType: 'JCP',
  grossValuePerShare: 1,
  netValuePerShare: 0.825,
  taxRate: 0.175
});
assert.equal(taxed.grossValuePerShare, 1);
assert.equal(taxed.netValuePerShare, 0.825);
assert.equal(taxed.taxRate, 0.175);
assert.equal(taxed.taxWithheldPerShare, 0.175);
assert.ok(String(taxed.taxRule).startsWith('IRRF_JCP_ACOES_'));

const analysis = text('lib/portfolio/analysis.js');
assert.ok(analysis.includes("Promise.all([directPromise, genericPromise])"));
assert.ok(analysis.includes("providerParity: directEligible"));
assert.ok(analysis.includes("'asset-modal-parallel-direct-plus-history'"));
assert.ok(analysis.includes('benchmarkMonths + 2'));

const dividends = text('lib/portfolio/dividends-contract.js');
assert.ok(dividends.includes("status: 'MERGED_PARTIAL_COVERAGE'"));
assert.ok(dividends.includes("cacheStatus: staleOfficialEvents.length ? 'LIVE_PLUS_STALE_COVERAGE' : 'LIVE'"));
assert.ok(dividends.includes('dedupeEvents([...staleOfficialEvents, ...officialEvents])'));
assert.ok(dividends.includes('taxWithheldAmount'));
assert.ok(dividends.includes('estimatedAmount: netAmount'));

console.log('user-requested provents/return APK-Proxy alignment v426: OK');
