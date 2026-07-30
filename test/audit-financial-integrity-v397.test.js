import assert from 'node:assert/strict';
import { _test } from '../routes/sync.js';

const base = {
  ticker: 'PETR4.SA',
  dateCom: '2026-07-01',
  status: 'JCP | previsto',
  quantity: 100,
  estimatedAmount: 10,
};

const first = _test.normalizeDividend({ ...base, valuePerShare: 0.10, source: 'Proxy' });
const sameFromCloud = _test.normalizeDividend({ ...base, valuePerShare: 0.10, paymentDate: '2026-08-01', source: 'Supabase', eventId: 'legacy-source-dependent-id' });
const secondDistribution = _test.normalizeDividend({ ...base, valuePerShare: 0.20, estimatedAmount: 20, source: 'Proxy' });

assert.equal(first.eventId, sameFromCloud.eventId, 'fonte e data de pagamento não podem criar outro evento');
assert.notEqual(first.eventId, secondDistribution.eventId, 'valores por cota distintos devem permanecer como eventos distintos');
assert.equal(_test.dedupeDividendRows([first, sameFromCloud]).length, 1);
assert.equal(_test.dedupeDividendRows([first, secondDistribution]).length, 2);

const unknown = _test.normalizeDividend({ ...base, valuePerShare: 0, estimatedAmount: 0 });
const unambiguous = _test.dedupeDividendRows([unknown, first]);
assert.equal(unambiguous.length, 1);
assert.equal(unambiguous[0].valuePerShare, 0.10);

const ambiguous = _test.dedupeDividendRows([unknown, first, secondDistribution]);
assert.equal(ambiguous.length, 3, 'evento sem valor deve ser preservado quando há mais de uma distribuição possível');

assert.equal(_test.dividendAmountToken({ valuePerShare: 0.1000000001 }), '0.1');
assert.match(_test.dividendEconomicBaseKey(first), /^PETR4\|2026-07-01\|JCP$/);
console.log('audit-financial-integrity-v397 ok');
