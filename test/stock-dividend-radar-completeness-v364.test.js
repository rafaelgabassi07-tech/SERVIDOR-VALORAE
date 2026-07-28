import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
const start = source.indexOf('const STOCK_RADAR_MONTHS');
const endMarker = '\nfunction historicalRowValues';
const end = source.indexOf(endMarker, start);
assert.ok(start >= 0 && end > start, 'radar implementation must remain discoverable in stock modal contract');

const context = {
  Date,
  Map,
  Set,
  Math,
  Number,
  Object,
  String,
  Array,
  normalizeLooseText(value = '') {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  },
  round(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }
};
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nthis.buildStockDividendRadarPayload = buildStockDividendRadarPayload;`, context);

const events = [
  { type: 'DIVIDENDO', dataCom: '2023-03-10', paymentDate: '2023-04-02' },
  { type: 'DIVIDENDO', dataCom: '2024-03-12', paymentDate: '2024-04-03' },
  { type: 'JSCP', dataCom: '2025-03-11', paymentDate: '2025-04-04' },
  { type: 'JSCP', dataCom: '11/03/2025', paymentDate: '04/04/2025' },
  { type: 'DIVIDENDO', dataCom: '2025-09-15', paymentDate: '2025-10-01' },
  { type: 'DIVIDENDO', dataCom: String(Date.UTC(2022, 5, 10) / 1000), paymentDate: String(Date.UTC(2022, 5, 20)) },
  { type: 'INVÁLIDO', dataCom: '2025-02-30', paymentDate: '' },
  { type: 'INVÁLIDO', dataCom: 'sem data', paymentDate: '' },
  { type: 'FUTURO', dataCom: `${new Date().getUTCFullYear() + 1}-03-10`, paymentDate: `${new Date().getUTCFullYear() + 1}-04-02` }
];
const radar = context.buildStockDividendRadarPayload({
  ticker: 'TEST3',
  dividendHistory: { events }
});

assert.equal(radar.status, 'OK');
assert.equal(radar.months.length, 12);
assert.equal(radar.eventCount, 5);
assert.equal(radar.dataComEventCount, 5);
assert.equal(radar.paymentEventCount, 5);
assert.equal(radar.observedYears, 4);
assert.equal(radar.months.find(month => month.key === 'mar').dateComCount, 3);
assert.equal(radar.months.find(month => month.key === 'mar').dateComYears, 3);
assert.ok(radar.likelyDateComMonths.includes('mar'));
assert.ok(['MEDIUM', 'HIGH'].includes(radar.confidence));
assert.equal(radar.diagnostics.duplicateEventsRemoved, 1);
assert.equal(radar.months.find(month => month.key === 'jun').dateComCount, 1, 'Unix timestamp in seconds must be accepted');
assert.equal(radar.diagnostics.invalidEvents, 2, 'Impossible calendar dates must be rejected');
assert.equal(radar.diagnostics.futureEvents, 1, 'Future events must not contaminate historical recurrence');
assert.ok(radar.description.includes('Recorrência mensal'));
console.log('stock dividend radar delivers recurrence, coverage and diagnostics');
