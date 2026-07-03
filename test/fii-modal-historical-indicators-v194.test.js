import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

const html = `
<h1>GGRC11</h1>
GGRC11 Cotação
R$ 9,73 0,41%
GGRC11 DY (12M)
12,33%
P/VP
0,88
Liquidez Diária
R$ 11,30 M
VARIAÇÃO (12M)
9,57%
`;
const metrics = _test.extractInvestidor10FiiQuickMetrics(html, 'GGRC11');
assert.equal(metrics.priceDisplay, 'R$ 9,73');
assert.equal(metrics.dy12mDisplay, '12,33%');
assert.equal(metrics.pvpDisplay, '0,88');
assert.equal(metrics.dailyLiquidityDisplay, 'R$ 11,30 M');
assert.equal(metrics.variation12mDisplay, '9,57%');

const history = _test.normalizeFiiHistoricalIndicatorsApi({
  valor_mercado: [
    { year: 'Atual', value: 2080000000, type: 'money_abbr' },
    { year: '2025', value: 2120000000, type: 'money_abbr' }
  ],
  p_vp: [
    { year: 'Atual', value: 0.88, type: 'decimal' },
    { year: '2025', value: 0.88, type: 'decimal' }
  ],
  dividend_yield: [
    { year: 'Atual', value: 12.33, type: 'percent' },
    { year: '2025', value: 12.10, type: 'percent' }
  ]
});
assert.deepEqual(history.columns.slice(0, 2), ['Atual', '2025']);
assert.equal(history.rows[0].label, 'Valor de Mercado');
assert.equal(history.rows.find(row => row.label === 'P/VP')?.values.Atual, '0,88');
assert.equal(history.rows.find(row => row.label === 'Dividend Yield')?.values['2025'], '12,10%');

console.log('FII modal historical indicators v194 test OK.');
