import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

assert.equal(_test.FII_MODAL_VERSION, '26.asset-modal.fii.v23');

const html = `
<section>
  <h2>COMUNICADOS DO GGRC11</h2>
  <div class="row"><span>Aviso aos Acionistas - Distribuições</span><span>01/07/2026</span><a href="/documentos/ggrc11-distribuicoes-2026-07-01.pdf">ABRIR</a></div>
  <div class="row"><span>Fatos Relevantes</span><span>30/06/2026</span><a href="https://example.com/fato-relevante">ABRIR</a></div>
  <div class="row"><span>Fatos Relevantes</span><span>29/06/2026</span><a href="/comunicados/ggrc11-29-06-2026">ABRIR</a></div>
</section>
<h2>NOTÍCIAS SOBRE GGRC11</h2>
`;

const payload = _test.extractInvestidor10FiiAnnouncements(html, 'GGRC11');
assert.equal(payload.status, 'OK');
assert.equal(payload.title, 'Comunicados do GGRC11');
assert.equal(payload.items.length, 3);
assert.equal(payload.items[0].title, 'Aviso aos Acionistas - Distribuições');
assert.equal(payload.items[0].dateDisplay, '01/07/2026');
assert.equal(payload.items[0].type, 'Distribuições');
assert.ok(payload.items[0].url.startsWith('https://investidor10.com.br/documentos/'));
assert.ok(payload.items[0].pdfUrl.endsWith('.pdf'));
assert.equal(payload.items[0].buttonLabel, 'Abrir PDF');
assert.equal(payload.items[1].documentKind, 'external');
assert.equal(payload.items[1].buttonLabel, 'Abrir');
assert.equal(payload.pagination.hasNext, false);

const fallbackHtml = `<h2>COMUNICADOS DO GGRC11</h2> Fatos Relevantes 30/06/2026 ABRIR Aviso aos Acionistas - Distribuições 01/07/2026 ABRIR <h2>DÚVIDAS COMUNS</h2>`;
const fallback = _test.extractInvestidor10FiiAnnouncements(fallbackHtml, 'GGRC11');
assert.equal(fallback.status, 'OK');
assert.ok(fallback.items.length >= 1);

const empty = _test.extractInvestidor10FiiAnnouncements('<h2>Lista de imóveis</h2>', 'GGRC11');
assert.equal(empty.status, 'EMPTY');

console.log('fii-modal-announcements-v213 ok');
