import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

assert.equal(_test.FII_MODAL_VERSION, '26.asset-modal.fii.v22');

const routeHtml = `
<div class="communication-card">
  <a href="/fiis/link_comunicado/GGRC11/23741/">Abrir</a>
  <h3>Aviso aos Acionistas - Distribuições</h3>
  <span>Data de Divulgação: 24/06/2026</span>
</div>
<div class="communication-card">
  <a href="/fiis/link_comunicado/GGRC11/23817/">Abrir</a>
  <h3>Fatos Relevantes</h3>
  <span>Data de Divulgação: 01/07/2026</span>
</div>
`;

const payload = _test.extractInvestidor10FiiAnnouncements(routeHtml, 'GGRC11');
assert.equal(payload.status, 'OK');
assert.equal(payload.items.length, 2);
assert.equal(payload.items[0].dateDisplay, '24/06/2026');
assert.equal(payload.items[0].title, 'Aviso aos Acionistas - Distribuições');
assert.equal(payload.items[0].documentKind, 'pdf');
assert.equal(payload.items[0].buttonLabel, 'Abrir PDF');
assert.ok(payload.items[0].pdfUrl.includes('/fiis/link_comunicado/GGRC11/23741/'));
assert.ok(!payload.items[0].title.includes('Data de Divulgação'));

const merged = _test.mergeFiiAnnouncementsPayloads(payload, {
  ticker: 'GGRC11',
  items: [payload.items[0], { ...payload.items[1], url: 'https://investidor10.com.br/fiis/link_comunicado/GGRC11/23817/' }]
});
assert.equal(merged.items.length, 2);
assert.equal(merged.pagination.hasNext, false);

console.log('fii-modal-announcements-routes-v214 ok');
