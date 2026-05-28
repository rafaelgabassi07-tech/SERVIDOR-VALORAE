import assert from 'node:assert/strict';
import { buildNormalizedChartSeries } from '../lib/quality/chart-series.js';
import { buildChartReadinessReport } from '../lib/quality/chart-readiness.js';

const source = {
  yahooOhlc: [
    [1714521600000, 10, 11, 9, 10.5],
    [1714608000000, 10.5, 12, 10, 11.75],
    [1714694400000, 11.75, 12.2, 11.1, 12],
  ],
  dateKeyed: {
    '2024-01': 'R$ 10,10',
    '2024-02': 'R$ 10,30',
    '2024-03': 'R$ 10,80',
  },
  dividendRows: [
    { data: '01/01/2024', rendimento: '0,90', preco: '100,00', dy: '0,90%' },
    { data: '01/02/2024', rendimento: '0,95', preco: '102,00', dy: '0,93%' },
    { data: '01/03/2024', rendimento: '1,10', preco: '103,00', dy: '1,07%' },
  ],
  table: {
    columns: ['data', 'lucro', 'receita'],
    rows: [
      ['2023', '10', '100'],
      ['2024', '12', '120'],
      ['2025', '14', '150'],
    ],
  },
};

const normalized = buildNormalizedChartSeries(source, { maxSeries: 20 });
assert.equal(normalized.version, '21.12.2-chart-series-deep-consumer-normalizer');
assert.ok(normalized.count >= 7, `expected at least 7 detected series, got ${normalized.count}`);

const byKey = new Map(normalized.series.map(s => [s.key, s]));
assert.equal(byKey.get('yahooOhlc')?.summary.last, 12, 'OHLC arrays should prefer close as y value');
assert.equal(byKey.get('dateKeyed')?.sourceFormat, 'date-keyed-map');
assert.ok([...byKey.keys()].some(k => /dividendRows\.rendimento/.test(k)), 'object arrays should expose rendimento series');
assert.ok([...byKey.keys()].some(k => /dividendRows\.preco/.test(k)), 'object arrays should expose preco series');
assert.ok([...byKey.keys()].some(k => /table\.lucro/.test(k)), 'table rows/columns should expose lucro series');
assert.ok([...byKey.keys()].some(k => /table\.receita/.test(k)), 'table rows/columns should expose receita series');

const readiness = buildChartReadinessReport(source);
assert.equal(readiness.ready, true);
assert.ok(readiness.sourceFormats.includes('date-keyed-map'));
assert.ok(readiness.normalizedSeriesVersion.includes('21.12.2'));

console.log('chart-series deep consumer normalizer tests OK');
