import assert from 'node:assert/strict';
import { enrichFiiDividendChartsWithHistoricalYield } from '../lib/analysis/fii-modal-contract.js';

const charts = {
  status: 'OK',
  averageDy5y: null,
  averageDy5yDisplay: '—',
  dividendSeriesByFrequency: {
    monthly: [
      { period: '2025-01', label: '01/2025', year: 2025, month: 1, value: 1, valueDisplay: 'R$ 1,00' },
      { period: '2025-02', label: '02/2025', year: 2025, month: 2, value: 2, valueDisplay: 'R$ 2,00' }
    ],
    yearly: [{ period: '2025', label: '2025', year: 2025, value: 3, valueDisplay: 'R$ 3,00' }]
  },
  yieldSeriesByFrequency: { monthly: [], yearly: [] },
  diagnostics: {}
};
const history = {
  points: [
    { date: '2025-01-02T00:00:00.000Z', close: 10 },
    { date: '2025-02-03T00:00:00.000Z', close: 20 }
  ]
};

const enriched = enrichFiiDividendChartsWithHistoricalYield(charts, history);
assert.equal(enriched.yieldSeriesByFrequency.monthly.length, 2);
assert.equal(enriched.yieldSeriesByFrequency.monthly[0].yieldPercent, 10);
assert.equal(enriched.yieldSeriesByFrequency.monthly[1].yieldPercent, 10);
assert.equal(enriched.yieldSeriesByFrequency.yearly[0].yieldPercent, 30);
assert.equal(enriched.yieldSeriesByFrequency.monthly[0].calculated, true);
assert.equal(enriched.diagnostics.dyDerivedFromCurrentPrice, false);
assert.match(enriched.diagnostics.yieldCalculation, /fechamento histórico/i);

console.log('fii-historical-dividend-yield-v328 ok');
