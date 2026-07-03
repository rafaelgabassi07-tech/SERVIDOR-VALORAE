import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

const variantHtml = `
<div>Topo grande que antes fazia o corte passar da primeira dobra</div>
<section>
  <strong>HGLG11 Cotação</strong>
  <span>R$ 158,42 +0,87%</span>
  <strong>HGLG11 DY (12M)</strong>
  <span>8,91%</span>
  <strong>P/VP</strong>
  <span>1,02</span>
  <strong>Liquidez Média Diária</strong>
  <span>R$ 32,40 M</span>
  <strong>VARIAÇÃO (12)</strong>
  <span>-4,20%</span>
</section>`;
const quick = _test.extractInvestidor10FiiQuickMetrics(variantHtml, 'HGLG11');
assert.equal(quick.priceDisplay, 'R$ 158,42');
assert.equal(quick.changeDisplay, '+0,87%');
assert.equal(quick.dy12mDisplay, '8,91%');
assert.equal(quick.pvpDisplay, '1,02');
assert.equal(quick.dailyLiquidityDisplay, 'R$ 32,40 M');
assert.equal(quick.variation12mDisplay, '-4,20%');

const history = _test.normalizeComparisonPoints({
  points: [
    { date: '2024-07-01T00:00:00.000Z', close: 100 },
    { date: '2025-07-01T00:00:00.000Z', close: 112.49 },
    { date: '2026-07-01T00:00:00.000Z', close: 120 }
  ]
});
assert.equal(history.length, 3);
assert.equal(history[1].returnPercent, 12.49);
assert.equal(history[2].investedValue, 1200);
const item = _test.comparisonItemFromSeries({ id: 'asset', code: 'GGRC11', label: 'GGRC11', points: history, source: 'Yahoo Finance Chart API ativo' }, '2y');
assert.equal(item.investedValueDisplay, 'R$ 1.200,00');
assert.equal(item.returnDisplay, '+20,00%');

console.log('FII modal Yahoo comparison v196 test OK.');
