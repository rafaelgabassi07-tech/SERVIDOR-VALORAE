import assert from 'node:assert/strict';
import fs from 'node:fs';
import { portfolioInceptionDate } from '../lib/portfolio/positions.js';

const analysis = fs.readFileSync(new URL('../lib/portfolio/analysis.js', import.meta.url), 'utf8');
const market = fs.readFileSync(new URL('../lib/market/indices.js', import.meta.url), 'utf8');
const stock = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');

// A closed historical first position must still define portfolio inception.
const inception = portfolioInceptionDate(
  [{ ticker: 'NEW4', quantity: 2, firstPurchaseDate: '2025-06-01' }],
  [
    { ticker: 'OLD3', side: 'BUY', quantity: 1, price: 10, date: '2024-01-05' },
    { ticker: 'OLD3', side: 'SELL', quantity: 1, price: 12, date: '2024-04-05' },
    { ticker: 'NEW4', side: 'BUY', quantity: 2, price: 20, date: '2025-06-01' }
  ]
);
assert.equal(inception, '2024-01-05');
assert.match(analysis, /portfolioStartDate\(payload, positions, transactions\)/);
assert.match(analysis, /portfolioInceptionDate\(positions, transactions, explicit\)/);
assert.doesNotMatch(analysis, /slice\(0, Number\(payload\.maxHistoryTickers \|\| 35\)\)/);
assert.match(analysis, /const tickers = \[\.\.\.new Set\(transactions\.map\(t => t\.ticker\)\.filter\(Boolean\)\)\]/);
assert.match(analysis, /const historyConcurrency = Math\.max\(1, Math\.min\(24,/);
assert.match(analysis, /const hasMonthActivity = monthFlows\.contributions > 0 \|\| monthFlows\.withdrawals > 0 \|\| dividendsInMonth > 0/);
assert.match(analysis, /if \(!active\.length && !hasMonthActivity\) continue/);
assert.match(analysis, /const hasCashFlow = point\.monthlyWithdrawals > 0 \|\| point\.monthlyContributions > 0 \|\| point\.dividendsInMonth > 0/);
assert.match(analysis, /previous && previous\.marketValue > 0 && \(point\.marketValue > 0 \|\| hasCashFlow\)/);

assert.match(analysis, /const adjustedEnd = point\.marketValue \+ Math\.max\(0, point\.monthlyWithdrawals \|\| 0\) \+ Math\.max\(0, point\.dividendsInMonth \|\| 0\) - Math\.max\(0, point\.monthlyContributions \|\| 0\)/);

// Same trading date: a real variation is more useful than a price-only duplicate.
assert.match(market, /function tickerQuoteHasVariation/);
assert.match(market, /const derivedVariationPct = Number\.isFinite\(Number\(q\.variationPct\)\)/);
assert.match(market, /: percentVariation\(q\.price, q\.previousClose\)/);
assert.match(market, /variationPct: derivedVariationPct/);
assert.match(market, /variationPercent: derivedVariationPct/);
assert.match(market, /variationPercent: row\.variationPct/);
assert.match(market, /variationOrder = Number\(tickerQuoteHasVariation\(b\)\) - Number\(tickerQuoteHasVariation\(a\)\)/);
assert.match(market, /enrichTickerQuoteVariation\(yahoo, \[bcb\]\)/);
assert.match(market, /chooseFreshestTickerQuote\(\[yahooWithVariation, bcb\]\) \|\| chooseUsableTickerQuoteByQuality/);
assert.match(market, /enrichTickerQuoteVariation\(yahoo, \[b3\]\)/);
assert.match(market, /chooseFreshestTickerQuote\(\[yahooWithVariation, b3\]\) \|\| chooseUsableTickerQuoteByQuality/);
assert.match(market, /enrichTickerQuoteVariation\(yahoo, \[b3, parallelDirect\]\.filter\(Boolean\)\)/);
assert.match(market, /function mergePartialTickerWithStale/);
assert.match(market, /variationRecoveredFromSameDayCache: true/);

// Comparator: one canonical market history per instrument, then local 2y/5y/10y slicing.
assert.match(stock, /const officialPromise = officialReturnComparisonSeries/);
assert.match(stock, /const yahooPromise = yahooComparisonSeries/);
assert.match(stock, /settleFastModalSource\(officialPromise, 2400, null\)/);
assert.match(stock, /settleFastModalSource\(yahooPromise, 800, null\)/);
assert.match(stock, /settleFastModalSource\(officialPromise, 450, null\)/);
assert.match(stock, /optionalComparisonBudgetMs/);
assert.match(stock, /const canonicalPeriod = STOCK_COMPARISON_PERIODS\.find\(period => period\.key === '10y'\)/);
assert.match(stock, /const canonicalMarketTasks = \[/);
assert.match(stock, /const canonicalMarketPromise = Promise\.allSettled\(canonicalMarketTasks\)/);
assert.match(stock, /comparisonSeriesForPeriod\(seriesItem, period\)/);
assert.match(stock, /const activePeriodKey = preferredPeriodKeys\.find/);
assert.match(stock, /defaultPeriod: activePeriodKey/);
assert.doesNotMatch(stock, /const periodMarketTasks = STOCK_COMPARISON_PERIODS\.map/);
assert.match(stock, /sourcePolicy: 'Uma série histórica real canônica por ativo\/índice é reutilizada entre 2 A, 5 A e 10 A/);

console.log('apk-v670-financial-regressions-v420: ok');
