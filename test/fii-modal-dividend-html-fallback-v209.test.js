import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

assert.equal(_test.FII_MODAL_VERSION, '26.asset-modal.fii.v21');

const html = `
  <h2>DIVIDEND YIELD GGRC11</h2>
  Mensal Anual 1 A 5 A MAX
  <h3>DY atual: 12,33%</h3>
  <h3>DY médio em 5 anos: 10,01%</h3>
  <h2>GGRC11 DIVIDENDOS</h2>
  Mensal Anual 1 A 5 A MAX
  <h3>GGRC11 pagou o total de R$ 1,21 nos últimos 12 meses.</h3>
  ARRASTE O QUADRO PARA VER MAIS DADOS
  <h3>tipo</h3><h3>data com</h3><h3>pagamento</h3><h3>valor</h3>
  Dividendos 01/07/2026 08/07/2026 0,10000000
  Dividendos 01/06/2026 09/06/2026 0,10000000
  Dividendos 04/05/2026 11/05/2026 0,10000000
  Dividendos 01/04/2026 09/04/2026 0,10000000
  Dividendos 02/03/2026 09/03/2026 0,10000000
  Dividendos 02/02/2026 09/02/2026 0,10000000
  Dividendos 02/01/2026 09/01/2026 0,10000000
  Dividendos 01/12/2025 08/12/2025 0,10000000
  Dividendos 03/11/2025 10/11/2025 0,10000000
  Dividendos 01/10/2025 08/10/2025 0,10000000
  <h2>LISTA DE IMÓVEIS</h2>
`;

const payload = _test.buildFiiDividendChartsPayload({
  canonical: {},
  html,
  ticker: 'GGRC11',
  quickMetrics: { dy12m: 12.33 },
  distributions12m: { items: [{ key: '12m', yieldPercent: 12.33, amount: 1.21 }] },
  referencePrice: 9.73
});

assert.equal(payload.status, 'OK');
assert.equal(payload.currentDyDisplay, '12,33%');
assert.equal(payload.averageDy5yDisplay, '10,01%');
assert.equal(payload.total12mDisplay, 'R$ 1,21');
assert.equal(payload.events.length, 10);
assert.equal(payload.events[0].dataComDisplay, '01/07/2026');
assert.equal(payload.events[0].paymentDateDisplay, '08/07/2026');
assert.equal(payload.events[0].valueDisplay, '0,10000000');
assert.equal(payload.dividendSeriesByFrequency.monthly.length, 10);
assert.equal(payload.dividendSeriesByFrequency.yearly.length, 2);
assert.equal(payload.yieldSeriesByFrequency.monthly.length, 10);
assert.ok(payload.yieldSeriesByFrequency.monthly.at(-1).yieldDisplay.includes('1,03'));
assert.ok(payload.summary.includes('GGRC11 pagou o total de R$ 1,21'));

const direct = _test.extractFiiDividendChartsFromHtml(html, 'GGRC11', { referencePrice: 9.73 });
assert.equal(direct.events.length, 10);
assert.equal(direct.diagnostics.sourcePolicy, 'parsed_from_investidor10_visible_html_dividend_sections');

console.log('fii-modal-dividend-html-fallback-v209 ok');
