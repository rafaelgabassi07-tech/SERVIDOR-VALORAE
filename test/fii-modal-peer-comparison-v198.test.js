import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

const sampleHtml = `
  <section>
    <h2>COMPARANDO COM OUTROS FIIS</h2>
    <span>Mesmo tipo e segmento</span>
    <p>ARRASTE O QUADRO PARA VER MAIS DADOS</p>
    <table>
      <tr><th>DIVIDEND YIELD</th><th>P/VP</th><th>VALOR PATRIMONIAL</th><th>TIPO</th><th>SEGMENTO</th></tr>
      <tr><td>GGRC11</td><td>12.33%</td><td>0.88</td><td>2,36 BILHÕES</td><td>FUNDO DE TIJOLO</td><td>LOGÍSTICO / INDÚSTRIA / GALPÕES</td></tr>
      <tr><td>HGLG11</td><td>8.82%</td><td>0.9</td><td>7,57 BILHÕES</td><td>FUNDO DE TIJOLO</td><td>LOGÍSTICO / INDÚSTRIA / GALPÕES</td></tr>
      <tr><td>RBRL11</td><td>12.5%</td><td>0.76</td><td>655,78 MILHÕES</td><td>FUNDO DE TIJOLO</td><td>LOGÍSTICO / INDÚSTRIA / GALPÕES</td></tr>
      <tr><td>FIIB11</td><td>8.75%</td><td>0.74</td><td>405,58 MILHÕES</td><td>FUNDO DE TIJOLO</td><td>LOGÍSTICO / INDÚSTRIA / GALPÕES</td></tr>
    </table>
  </section>
`;

const parsed = _test.extractInvestidor10FiiPeerComparison(sampleHtml, 'GGRC11');

assert.equal(_test.FII_MODAL_VERSION, '26.asset-modal.fii.v6');
assert.equal(parsed.status, 'OK');
assert.equal(parsed.title, 'Comparando com outros FIIs');
assert.equal(parsed.filterLabel, 'Mesmo tipo e segmento');
assert.equal(parsed.rows.length, 4);
assert.deepEqual(parsed.columns.map(column => column.key), ['ticker', 'dividendYield', 'pvp', 'patrimonialValue', 'fundType', 'segment']);

const reference = parsed.rows.find(row => row.ticker === 'GGRC11');
assert.equal(reference.isReference, true);
assert.equal(reference.dividendYieldDisplay, '12.33%');
assert.equal(reference.pvp, 0.88);
assert.equal(reference.patrimonialValue, 2360000000);
assert.equal(reference.fundType, 'FUNDO DE TIJOLO');
assert.match(reference.segment, /LOGÍSTICO/);

assert.ok(parsed.rows.find(row => row.ticker === 'RBRL11').highlights.includes('dividendYield'));
assert.ok(parsed.rows.find(row => row.ticker === 'FIIB11').highlights.includes('pvp'));
assert.ok(parsed.rows.find(row => row.ticker === 'HGLG11').highlights.includes('patrimonialValue'));

console.log('fii-modal-peer-comparison-v198 ok');
