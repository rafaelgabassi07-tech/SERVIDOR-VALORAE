import assert from 'node:assert/strict';
import { parseInvestidor10DividendAgendaHtml, normalizeAgendaDate, VALORAE_I10_DIVIDEND_AGENDA_VERSION } from '../lib/market/investidor10-dividend-agenda.js';

assert.equal(VALORAE_I10_DIVIDEND_AGENDA_VERSION, '21.12.63-i10-dividend-agenda-sync');
assert.equal(normalizeAgendaDate('01/06/26'), '01/06/2026');
assert.equal(normalizeAgendaDate('29/05/2026'), '29/05/2026');

const html = `
  <section>
    <article><h3>PETR4</h3><div>Petrobras</div><span>Data Com 01/06/26</span><span>Pgto 20/08/26</span><span>JSCP</span><strong>R$ 0,35</strong></article>
    <article><h3>HGLG11</h3><div>CSHG Logística</div><span>Data Com 29/05/2026</span><span>Pgto 15/06/2026</span><span>Dividendos</span><strong>R$ 1,10</strong></article>
    <article><h3>HGIC11</h3><div>FII</div><span>Data Com 05/06/26</span><span>Pgto 12/06/26</span><span>Dividendos</span><strong>R$ 0,60</strong></article>
  </section>
`;
const events = parseInvestidor10DividendAgendaHtml(html, { assetClass: 'MISTA' });
const petr4 = events.find(e => e.ticker === 'PETR4');
const hglg11 = events.find(e => e.ticker === 'HGLG11');
const hgic11 = events.find(e => e.ticker === 'HGIC11');
assert.ok(petr4, 'parser deve capturar PETR4 da agenda de ações');
assert.equal(petr4.dateCom, '01/06/2026');
assert.equal(petr4.paymentDate, '20/08/2026');
assert.equal(petr4.type, 'JSCP');
assert.equal(petr4.valuePerShare, 0.35);
assert.ok(hglg11, 'parser deve capturar HGLG11 da agenda/histórico FII');
assert.equal(hglg11.paymentDate, '15/06/2026');
assert.equal(hglg11.valuePerShare, 1.10);
assert.ok(hgic11, 'parser deve capturar FII da agenda geral');
assert.equal(hgic11.dateCom, '05/06/2026');
assert.equal(hgic11.paymentDate, '12/06/2026');

console.log('investidor10-dividend-agenda-v21-12-63 OK');
