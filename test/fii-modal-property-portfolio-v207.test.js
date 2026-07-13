import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

assert.equal(_test.FII_MODAL_VERSION, '26.asset-modal.fii.v25-modal-source-repair');

const html = `
  <section>
    <h2>LISTA DE IMÓVEIS</h2>
    <div>SP São Paulo 10 PR Paraná 6 RJ Rio de Janeiro 5 MG Minas Gerais 5 GO Goiás 3 BA Bahia 1 PE Pernambuco 1 MT Mato Grosso 1 PB Paraíba 1 RS Rio Grande do Sul 1 SC Santa Catarina 1</div>
    <article>AETHRA Estado: Paraná Área bruta locável: 22.120,00 m²</article>
    <article>COVOLAN Estado: São Paulo Área bruta locável: 38.132,00 m²</article>
    <article>HERING Estado: Goiás Área bruta locável: 27.661,00 m²</article>
    <article>AMBEV ITAJAÍ Estado: Santa Catarina Área bruta locável: 9.433,00 m²</article>
    <article>AMBEV PELOTAS Estado: Rio Grande do Sul Área bruta locável: 9.913,00 m²</article>
    <article>MOINHO IGUAÇU/CASCAVEL Estado: Paraná Área bruta locável: 6.501,00 m²</article>
  </section>
  <section><h2>COMUNICADOS DO GGRC11</h2></section>
`;

const payload = _test.extractInvestidor10FiiPropertyPortfolio(html, 'GGRC11');
assert.equal(payload.status, 'OK');
assert.equal(payload.title, 'Lista de imóveis');
assert.equal(payload.totalProperties, 35);
assert.equal(payload.states.length, 11);
assert.equal(payload.states[0].uf, 'SP');
assert.equal(payload.states[0].count, 10);
assert.equal(payload.properties.length, 6);
assert.equal(payload.properties[0].name, 'AETHRA');
assert.equal(payload.properties[0].uf, 'PR');
assert.equal(payload.properties[0].areaM2, 22120);
assert.equal(payload.properties[1].name, 'COVOLAN');
assert.equal(payload.properties[3].state, 'SANTA CATARINA');

const empty = _test.extractInvestidor10FiiPropertyPortfolio('<h2>Sem lista</h2>', 'GGRC11');
assert.equal(empty.status, 'EMPTY');

console.log('fii-modal-property-portfolio-v207 ok');
