import assert from 'node:assert/strict';
import { buildDividendsContract } from '../lib/portfolio/dividends-contract.js';

process.env.VALORAE_DISABLE_EXTERNAL = '1';
delete process.env.VALORAE_STATUSINVEST_ENABLED;
delete process.env.VALORAE_INVESTIDOR10_AGENDA_ENABLED;
delete process.env.VALORAE_AGENDA_ENABLED;

const contract = await buildDividendsContract({
  positions: [{ ticker: 'PETR4', quantity: 10, avgPrice: 30, currentPrice: 32, firstPurchaseDate: '2024-01-02' }],
  dividendPositions: [{ ticker: 'PETR4', quantity: 10, avgPrice: 30, currentPrice: 32, firstPurchaseDate: '2024-01-02' }],
  tickers: ['PETR4'],
  mode: 'mobile',
  timeoutMs: 900,
  agendaTimeoutMs: 900,
  includeCalendar: true
});

assert.equal(contract.status, 'PARTIAL');
assert.equal(contract.sourceStatus, 'SOURCE_TIMEOUT');
assert.equal(contract.partial, true);
assert.equal(Array.isArray(contract.officialEvents), true);
assert.equal(contract.retryAfterMs, 30000);
assert.ok(contract.diagnostics.some(d => d.provider === 'statusinvest' || d.provider === 'investidor10-agenda'));
