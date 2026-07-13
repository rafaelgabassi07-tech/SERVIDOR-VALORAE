import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

assert.equal(_test.FII_MODAL_VERSION, '26.asset-modal.fii.v25-modal-source-repair');

const html = `
  <section>
    <h2>SOBRE A GGRC11</h2>
    <h3>Sobre a ZAGROS RENDA IMOBILIÁRIA</h3>
    <p>O Zagros Renda Imobiliária (GGRC11) é um fundo de investimento imobiliário com foco em imóveis comerciais, industriais e logísticos para geração de renda por meio de contratos de locação e, quando oportuno, venda de ativos.</p>
    <p>O fundo, considerado do tipo tijolo, foi constituído em 2016 e é gerido pela Zagros Capital com atuação ativa.</p>
    <h3>Estratégia e composição</h3>
    <p>O GGRC11 direciona seus investimentos a imóveis industriais e logísticos locados para empresas de médio e grande porte.</p>
    <p>Alguns dos ativos imobiliários que compõem ou já compuseram a exposição do fundo incluem:</p>
    <ul><li>Ambev – Itajaí (SC).</li><li>Air Liquide – São José dos Campos (SP).</li></ul>
    <p>O objetivo é gerar renda recorrente e previsível por meio de contratos de locação firmados com locatários corporativos.</p>
    <h3>Diversificação e exposição</h3>
    <p>O GGRC11 possui carteira diversificada em termos de locatários.</p>
    <h3>Estrutura do fundo e taxas</h3>
    <p>O GGRC11 distribui rendimentos mensais aos cotistas.</p>
    <h2>Informações Adicionais</h2>
    <p>O fundo ZAGROS RENDA IMOBILIÁRIA, de CNPJ 26.614.291/0001-00, é um fundo imobiliário do tipo Fundo de Tijolo.</p>
    <p>Os fundos de tijolo, também conhecidos como fundo de renda, são chamados assim por representarem imóveis físicos.</p>
  </section>
  <h2>Lista de Imóveis</h2>
`;

const payload = _test.extractInvestidor10FiiAbout(html, 'GGRC11', [
  { id: 'segmento', value: 'Logístico / Indústria / Galpões' },
  { id: 'tipo_fundo', value: 'Fundo de Tijolo' }
], { pvp: 0.88 });

assert.equal(payload.status, 'OK');
assert.equal(payload.title, 'Sobre a GGRC11');
assert.equal(payload.fundName, 'ZAGROS RENDA IMOBILIÁRIA');
assert.ok(payload.summary.includes('fundo de investimento imobiliário'));
assert.ok(payload.sections.some(section => section.id === 'strategy_composition'));
assert.ok(payload.sections.find(section => section.id === 'strategy_composition').bullets.some(item => item.includes('Ambev')));
assert.ok(payload.sections.some(section => section.id === 'additional_information'));
assert.equal(payload.highlights.find(item => item.label === 'Segmento').value, 'Logístico / Indústria / Galpões');

const empty = _test.extractInvestidor10FiiAbout('<h2>Sem bloco</h2>', 'GGRC11');
assert.equal(empty.status, 'EMPTY');

console.log('fii-modal-about-fund-v206 ok');
