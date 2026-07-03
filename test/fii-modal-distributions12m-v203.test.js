import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

assert.equal(_test.FII_MODAL_VERSION, '26.asset-modal.fii.v20');

const html = `
  <section>
    <h2>DISTRIBUIÇÕES NOS ÚLTIMOS 12 MESES</h2>
    <div>YIELD 1 MÊS 1,03% R$ 0,10</div>
    <div>YIELD 3 MESES 3,08% R$ 0,30</div>
    <div>YIELD 6 MESES 6,17% R$ 0,60</div>
    <div>YIELD 12 MESES 12,33% R$ 1,20</div>
    <p>Mostra o rendimento FII GGRC11 nos últimos 1, 3, 6 e 12 meses.</p>
  </section>
`;

const raw = _test.extractFiiDistributions12mFromHtml(html);
assert.equal(raw.length, 4);
assert.equal(raw[0].period, '1 MÊS');
assert.equal(raw[3].yieldPercent, 12.33);

const payload = _test.buildFiiDistributions12mPayload({ html, ticker: 'GGRC11' });
assert.equal(payload.status, 'OK');
assert.equal(payload.title, 'Distribuições nos últimos 12 meses');
assert.deepEqual(payload.items.map(item => item.key), ['1m', '3m', '6m', '12m']);
assert.equal(payload.items[0].yieldDisplay, '1,03%');
assert.equal(payload.items[0].amountDisplay, 'R$ 0,10');
assert.equal(payload.items[3].label, 'Yield 12 meses');
assert.ok(payload.description.includes('valor pago por cota'));

const canonicalPayload = _test.buildFiiDistributions12mPayload({
  ticker: 'GGRC11',
  canonical: { fii: { distribution12m: [
    { period: '12 meses', yieldPercent: 12.33, amount: 1.2 },
    { period: '1 mês', yieldPercent: 1.03, amount: 0.1 }
  ] } }
});
assert.deepEqual(canonicalPayload.items.map(item => item.key), ['1m', '12m']);

const empty = _test.buildFiiDistributions12mPayload({ html: '<main>Sem distribuição</main>', ticker: 'GGRC11' });
assert.equal(empty.status, 'EMPTY');
assert.equal(empty.items.length, 0);

console.log('fii-modal-distributions12m-v203 ok');
