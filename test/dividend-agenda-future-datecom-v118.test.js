import assert from 'node:assert/strict';
import { parseInvestidor10DividendAgendaHtml } from '../lib/market/investidor10-dividend-agenda.js';

const html = `
  <html><body>
    <section>
      <div>MXRF11</div>
      <div>Data Com 15/07/26</div>
      <div>Pgto A confirmar R$ 0,10</div>
    </section>
  </body></html>
`;

const events = parseInvestidor10DividendAgendaHtml(html, { assetClass: 'FII' });
const event = events.find(e => e.ticker === 'MXRF11');

assert.ok(event, 'parser deve capturar evento anunciado com Data COM futura mesmo sem data de pagamento');
assert.equal(event.dateCom, '15/07/2026');
assert.equal(event.paymentDate, '');
assert.equal(event.announced, true);
assert.equal(event.assetClass, 'FII');

console.log('Dividend agenda future Data COM v118 test OK.');
