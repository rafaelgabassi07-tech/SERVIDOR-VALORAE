import assert from 'node:assert/strict';
import { parseInvestidor10DividendAgendaHtml, normalizeAgendaDate, fetchInvestidor10DividendAgenda, VALORAE_I10_DIVIDEND_AGENDA_VERSION } from '../lib/market/investidor10-dividend-agenda.js';

assert.match(VALORAE_I10_DIVIDEND_AGENDA_VERSION, /^21\.12\.\d+-.+i10-dividend-agenda$/);
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

const compactAdjacentHtml = `<a>FISC11 Sc 401</a> Data Com 05/06/26 Pgto 15/06/26 Dividendos Dividendos R$ 0,62 <a>FATN11 Athena I</a> Data Com 05/06/26 Pgto 15/06/26 Dividendos Dividendos R$ 0,80`;
const compactAdjacent = parseInvestidor10DividendAgendaHtml(compactAdjacentHtml, { assetClass: 'FII' });
assert.equal(compactAdjacent.filter(e => e.ticker === 'FISC11' && e.valuePerShare === 0.62).length, 1, 'FISC11 deve manter seu próprio valor');
assert.equal(compactAdjacent.filter(e => e.ticker === 'FATN11' && e.valuePerShare === 0.80).length, 1, 'FATN11 deve manter seu próprio valor');
assert.equal(compactAdjacent.filter(e => e.ticker === 'FATN11' && e.valuePerShare === 0.62).length, 0, 'valor de FISC11 não pode vazar para FATN11');

const provisionedHtml = `<article><h3>ABEV3</h3><span>Data Com 22/06/26</span><span>Pgto Provisionado JSCP</span><strong>R$ 0,04</strong></article>`;
const provisioned = parseInvestidor10DividendAgendaHtml(provisionedHtml, { assetClass: 'ACAO' });
assert.ok(provisioned.find(e => e.ticker === 'ABEV3' && e.dateCom === '22/06/2026' && e.type === 'JSCP' && e.valuePerShare === 0.04), 'provento provisionado sem data de pagamento explícita deve ser preservado');


const originalFetch = global.fetch;
const requestedUrls = [];
global.fetch = async (url) => {
  requestedUrls.push(String(url));
  let body = '<section></section>';
  if (String(url).includes('/acoes/dividendos/2026/julho/')) {
    body = `<article><h3>PETR4</h3><span>Data Com 01/07/26</span><span>Pgto 20/08/26</span><span>JSCP</span><strong>R$ 0,35</strong></article>`;
  }
  if (String(url).includes('/fiis/dividendos/2026/maio/')) {
    body = `<article><h3>HGLG11</h3><span>Data Com 29/05/26</span><span>Pgto 15/06/26</span><span>Dividendos</span><strong>R$ 1,10</strong></article>`;
  }
  return { ok: true, text: async () => body };
};
try {
  const ranged = await fetchInvestidor10DividendAgenda(['PETR4', 'HGLG11'], {
    now: '2026-06-08',
    historyMonths: 1,
    futureMonths: 1,
    concurrency: 2,
    timeoutMs: 1000,
  });
  assert.ok(requestedUrls.some(u => u.endsWith('/acoes/dividendos/2026/julho/')), 'deve consultar mês futuro de ações');
  assert.ok(requestedUrls.some(u => u.endsWith('/fiis/dividendos/2026/maio/')), 'deve consultar mês passado de FIIs');
  assert.ok(ranged.events.find(e => e.ticker === 'PETR4' && e.paymentDate === '20/08/2026'), 'deve trazer evento futuro fora do mês atual');
  assert.ok(ranged.events.find(e => e.ticker === 'HGLG11' && e.paymentDate === '15/06/2026'), 'deve trazer evento histórico fora do mês atual');
  assert.ok(ranged.range.pages >= 6, 'varredura deve cobrir ações e FIIs em múltiplos meses');
} finally {
  global.fetch = originalFetch;
}
