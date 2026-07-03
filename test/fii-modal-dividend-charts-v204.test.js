import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

assert.equal(_test.FII_MODAL_VERSION, '26.asset-modal.fii.v20');

const canonical = {
  fii: {
    dividendHistory: [
      { type: 'Dividendos', dataCom: '2026-07-01', paymentDate: '2026-07-08', valuePerShare: 0.1, ticker: 'GGRC11' },
      { type: 'Dividendos', dataCom: '2026-06-01', paymentDate: '2026-06-09', valuePerShare: 0.1, ticker: 'GGRC11' },
      { type: 'Dividendos', dataCom: '2026-05-04', paymentDate: '2026-05-11', valuePerShare: 0.1, ticker: 'GGRC11' },
      { type: 'Dividendos', dataCom: '2026-04-01', paymentDate: '2026-04-09', valuePerShare: 0.1, ticker: 'GGRC11' }
    ],
    dividendMonthly: [
      { period: '04/2026', value: 0.1 },
      { period: '05/2026', value: 0.1 },
      { period: '06/2026', value: 0.1 },
      { period: '07/2026', value: 0.1 }
    ],
    dividendYearly: [
      { year: '2026', value: 0.4 }
    ],
    dividendYieldHistory: [
      { period: '04/2026', value: 1.01 },
      { period: '05/2026', value: 1.02 },
      { period: '06/2026', value: 1.00 },
      { period: '07/2026', value: 1.03 }
    ]
  }
};

const payload = _test.buildFiiDividendChartsPayload({
  canonical,
  ticker: 'GGRC11',
  quickMetrics: { dy12m: 12.33 },
  distributions12m: { items: [{ key: '12m', yieldPercent: 12.33, amount: 1.2 }] },
  referencePrice: 9.7
});

assert.equal(payload.status, 'OK');
assert.equal(payload.title, 'Dividend Yield GGRC11');
assert.equal(payload.dividendsTitle, 'GGRC11 Dividendos');
assert.deepEqual(payload.frequencyOptions.map(item => item.key), ['monthly', 'yearly']);
assert.deepEqual(payload.periodOptions.map(item => item.key), ['1y', '5y', 'max']);
assert.equal(payload.currentDyDisplay, '12,33%');
assert.equal(payload.yieldSeriesByFrequency.monthly.length, 4);
assert.equal(payload.dividendSeriesByFrequency.monthly.length, 4);
assert.equal(payload.events.length, 4);
assert.equal(payload.events[0].dataComDisplay, '01/07/2026');
assert.equal(payload.events[0].paymentDateDisplay, '08/07/2026');
assert.equal(payload.events[0].valueDisplay, '0,10000000');
assert.ok(payload.summary.includes('GGRC11 pagou o total'));

const derived = _test.buildFiiDividendChartsPayload({
  canonical: { fii: { dividendMonthly: [{ period: '07/2026', value: 0.1 }] } },
  ticker: 'GGRC11',
  referencePrice: 10
});
assert.equal(derived.status, 'OK');
assert.equal(derived.diagnostics.dyDerivedFromDividends, true);
assert.equal(derived.yieldSeriesByFrequency.monthly[0].yieldDisplay, '1,00%');

const empty = _test.buildFiiDividendChartsPayload({ canonical: {}, ticker: 'GGRC11' });
assert.equal(empty.status, 'EMPTY');

console.log('fii-modal-dividend-charts-v204 ok');
