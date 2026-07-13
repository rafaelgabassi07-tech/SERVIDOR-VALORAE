import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

assert.equal(_test.FII_MODAL_VERSION, '26.asset-modal.fii.v25-modal-source-repair');

const html = `
  <section>
    <h2>HISTÓRICO DA TAXA DE VACÂNCIA GGRC11</h2>
    <button>12m</button><button>2025</button><button>2024</button><button>2023</button><button>2022</button>
    <div class="chart">
      julho/2025 1,40%
      agosto/2025 1,40%
      setembro/2025 1,40%
      outubro/2025 4,92%
      novembro/2025 4,80%
      dezembro/2025 4,80%
      janeiro/2026 4,80%
      fevereiro/2026 0,21%
      março/2026 0,21%
      abril/2026 0,20%
      maio/2026 0,19%
      junho/2026 0,19%
    </div>
  </section>
  <section><h2>COMUNICADOS DO GGRC11</h2></section>
`;

const fromHtml = _test.extractFiiVacancyHistoryFromHtml(html, 'GGRC11');
assert.equal(fromHtml.length, 12);
assert.equal(fromHtml[0].label, 'julho/2025');
assert.equal(fromHtml[0].vacancyPercent, 1.4);
assert.equal(fromHtml[0].occupancyPercent, 98.6);
assert.equal(fromHtml[10].vacancyDisplay, '0,19%');

const payload = _test.buildFiiVacancyHistoryPayload({ html, ticker: 'GGRC11' });
assert.equal(payload.status, 'OK');
assert.equal(payload.title, 'Histórico da taxa de vacância GGRC11');
assert.equal(payload.defaultPeriod, '12m');
assert.ok(payload.periodOptions.some(item => item.key === '12m'));
assert.equal(payload.points.length, 12);
assert.equal(payload.points.at(-1).label, 'junho/2026');

const apiPayload = _test.buildFiiVacancyHistoryPayload({
  ticker: 'GGRC11',
  raw: {
    series: [
      { periodo: 'maio/2026', vacancia: '0,19%' },
      { periodo: 'junho/2026', vacancia: '0,19%', ocupacao: '99,81%' }
    ]
  }
});
assert.equal(apiPayload.status, 'OK');
assert.equal(apiPayload.points.length, 2);
assert.equal(apiPayload.points[1].occupancyPercent, 99.81);

const empty = _test.buildFiiVacancyHistoryPayload({ html: '<h2>Sem gráfico</h2>', ticker: 'GGRC11' });
assert.equal(empty.status, 'EMPTY');

console.log('fii-modal-vacancy-history-v208 ok');
