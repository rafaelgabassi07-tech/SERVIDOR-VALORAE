import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

assert.equal(_test.FII_MODAL_VERSION, '26.asset-modal.fii.v22');

const html = `
  <section>
    <h2>CHECKLIST DO INVESTIDOR BUY AND HOLD SOBRE GGRC11</h2>
    <div><span class="material-icons">check</span> FII com mais de 5 anos listado em Bolsa <button>?</button></div>
    <div><span class="material-icons">check</span> Dividend Yield médio dos últimos 5 anos acima de 8% <button>?</button></div>
    <div><span class="material-icons">check</span> Liquidez média diária acima de R$ 700 mil <button>?</button></div>
    <div><span class="material-icons">check</span> Número de cotistas acima de 20 mil <button>?</button></div>
    <div><span class="material-icons">check</span> Patrimônio líquido acima de R$ 1 bilhão <button>?</button></div>
    <div><span class="material-icons">check</span> 5 ou mais imóveis no portfólio <button>?</button></div>
    <div><span class="material-icons">check</span> Vacância física média dos últimos 12 meses abaixo de 10% <button>?</button></div>
    <div><span class="material-icons">check</span> Vacância financeira média dos últimos 12 meses abaixo de 10% <button>?</button></div>
    <p>Esta ferramenta de checklist é fornecida apenas para fins informativos e não constitui recomendação de investimento. A pontuação baseia-se em parâmetros de mercado, mas não garante resultados futuros.</p>
  </section>
  <h2>COMPARANDO COM OUTROS FIIS</h2>
`;

const checklist = _test.extractInvestidor10FiiBuyHoldChecklist(html, 'GGRC11');
assert.equal(checklist.status, 'OK');
assert.equal(checklist.title, 'Checklist do Investidor Buy and Hold sobre GGRC11');
assert.equal(checklist.items.length, 8);
assert.equal(checklist.passed, 8);
assert.equal(checklist.failed, 0);
assert.equal(checklist.items[0].id, 'listed_5y');
assert.equal(checklist.items.at(-1).id, 'financial_vacancy_below_10');
assert.ok(checklist.disclaimer.includes('não constitui recomendação de investimento'));

const empty = _test.extractInvestidor10FiiBuyHoldChecklist('<main>Sem checklist</main>', 'GGRC11');
assert.equal(empty.status, 'EMPTY');
assert.equal(empty.items.length, 0);

console.log('fii-modal-buy-hold-checklist-v202 ok');
