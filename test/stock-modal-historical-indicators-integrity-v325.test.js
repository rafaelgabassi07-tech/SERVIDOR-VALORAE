import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const currentYear = String(new Date().getFullYear());
const dedicated = {
  title: 'Histórico dedicado',
  columns: ['Atual', currentYear, '2025', '2024'],
  rows: [
    { id: 'pl', label: 'P/L', values: { Atual: '4,54', [currentYear]: '999,00', '2025': '5,10', '2024': '6,20' }, source: 'Investidor10 endpoint dedicado' },
    { id: 'roe', label: 'ROE', values: { Atual: '24,17%', [currentYear]: '999%', '2025': '26,49%', '2024': '10,00%' }, source: 'Investidor10 endpoint dedicado' }
  ]
};
const conflictingGeneric = {
  historicalIndicators: {
    columns: ['Atual', '2025', '2024', '2099'],
    rows: [
      { label: 'P/L', values: { Atual: '99,99', '2025': '98,00', '2024': '97,00', '2099': '1,00' } },
      { label: 'ROE', values: { Atual: '99%', '2025': '98%', '2024': '97%', '2099': '1%' } }
    ]
  },
  fundamentals: { rows: [{ label: 'P/L', values: { Atual: '123,00' } }], columns: ['Atual'] }
};
const sources = _test.buildStockHistoricalIndicatorSources({
  ticker: 'PETR4',
  apiExtras: { rawJson: { stockHistoricalIndicatorsNormalized: dedicated, assetTickerRest: conflictingGeneric } }
});
const built = _test.buildStockHistoricalIndicators(sources, 'PETR4', {});
assert.equal(built.status, 'OK');
assert.equal(built.quality.realHistorical, true);
assert.equal(built.rows.find(row => row.label === 'P/L')?.values.Atual, '4,54', 'fonte genérica não pode sobrescrever endpoint dedicado');
assert.equal(built.rows.find(row => row.label === 'P/L')?.values['2025'], '5,10');
assert.equal(built.columns.includes(currentYear), false, 'ano corrente deve ser deduplicado quando Atual existe');
assert.equal(built.columns.includes('2099'), false, 'ano futuro deve ser descartado');
assert.equal(_test.collectStockHistoricalIndicatorCandidates({ fundamentals: { columns: ['Atual'], rows: [{ label: 'P/L', values: { Atual: '4,54' } }] } }).length, 0, 'snapshot atual isolado não pode virar histórico');
assert.equal(built.diagnostics.policy, 'dedicated_sources_first_generic_sources_fill_missing_only_current_only_payloads_rejected');
console.log('stock-modal-historical-indicators-integrity-v325 ok');
