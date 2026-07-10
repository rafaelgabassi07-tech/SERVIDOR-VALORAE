import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/asset-modal-runtime.js';

const emptyPartial = {
  ok: true,
  status: 'PARTIAL',
  ticker: 'AESB3',
  quoteSummary: { price: null, priceDisplay: '—' },
  chart: { points: [] },
  metrics: [],
  fundamentalIndicators: { items: [] },
  historicalIndicators: { rows: [], tablesByPeriod: {} }
};

assert.equal(_test.modalPayloadHasUsefulData(emptyPartial), false);
assert.equal(_test.isModalPayloadCacheable(emptyPartial), false);

const usefulPartial = {
  ...emptyPartial,
  quoteSummary: { price: 12.34, priceDisplay: 'R$ 12,34' },
  chart: { points: [{ close: 12.1 }, { close: 12.34 }] }
};

assert.equal(_test.modalPayloadHasUsefulData(usefulPartial), true);
assert.equal(_test.isModalPayloadCacheable(usefulPartial), false);
assert.equal(_test.modalCacheTtlMs(usefulPartial, 45_000), 45_000);

const okPayload = {
  ok: true,
  status: 'OK',
  stage: 'full',
  ticker: 'PETR4',
  quoteSummary: { price: 30.5, priceDisplay: 'R$ 30,50' },
  chart: { points: [{ close: 30.1 }, { close: 30.5 }] },
  metrics: [{ id: 'price', value: 'R$ 30,50' }],
  fundamentalIndicators: { items: [{ id: 'pl', value: '5,2' }] },
  historicalIndicators: { rows: [{ label: 'P/L' }], tablesByPeriod: {} },
  checklist: { items: [{ id: 'dy', passed: true, status: 'PASSED' }] },
  companyProfile: { facts: [{ id: 'segment', value: 'Petróleo' }], sections: [] },
  dividendHistory: { events: [{ date: '2026-06-01', value: 1 }], yieldSeriesByFrequency: {}, dividendSeriesByFrequency: {} },
  revenueByRegion: { items: [{ label: 'Brasil', value: 100 }] },
  returns: { rows: [{ label: '12M', value: '10%' }] },
  resultsStatement: { rows: [{ label: 'Receita', value: '100' }], tablesByPeriod: {} },
  balanceSheetStatement: { rows: [], tablesByPeriod: {} }
};
assert.equal(_test.isModalPayloadCacheable(okPayload), true);
assert.equal(_test.modalCacheTtlMs(okPayload, 45_000), 180_000);
const fastPayload = { ...okPayload, stage: 'fast', mode: 'fast', fullOnly: false };
assert.equal(_test.modalCacheTtlMs(fastPayload, 45_000), 35_000, 'fast deve usar exatamente o TTL publicado');


const timeoutPayload = _test.modalTimeoutPayload({ family: 'stock', ticker: 'AESB3', deadlineMs: 1500, elapsedMs: 1501 });
assert.equal(_test.isModalPayloadCacheable(timeoutPayload), false);

console.log('asset-modal-quality-cache-v296 ok');
