import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

const html = `
<section>
  <h2>INFORMAÇÕES SOBRE GGRC11</h2>
  <div>Razão Social ZAGROS RENDA IMOBILIÁRIA FUNDO DE INVESTIMENTO IMOBILIÁRIO</div>
  <div>CNPJ 26.614.291/0001-00</div>
  <div>PÚBLICO-ALVO GERAL</div>
  <div>MANDATO HÍBRIDOS</div>
  <div>SEGMENTO LOGÍSTICO / INDÚSTRIA / GALPÕES</div>
  <div>TIPO DE FUNDO FUNDO DE TIJOLO</div>
  <div>PRAZO DE DURAÇÃO INDETERMINADO</div>
  <div>TIPO DE GESTÃO ATIVA</div>
  <div>TAXA DE ADMINISTRAÇÃO 1,10% A.A.</div>
  <div>VACÂNCIA 0,19%</div>
  <div>NUMERO DE COTISTAS 356.490</div>
  <div>COTAS EMITIDAS 214.249.653</div>
  <div>VAL. PATRIMONIAL P/ COTA R$ 11,03</div>
  <div>VALOR PATRIMONIAL R$ 2,36 BILHÕES</div>
  <div>ÚLTIMO RENDIMENTO R$ 0,10</div>
</section>`;

const parsed = _test.extractInvestidor10FiiInformation(html, 'GGRC11');
assert.equal(parsed.items.length, 15);
assert.equal(parsed.items.find(item => item.id === 'cnpj')?.value, '26.614.291/0001-00');
assert.equal(parsed.items.find(item => item.id === 'segmento')?.value, 'LOGÍSTICO / INDÚSTRIA / GALPÕES');
assert.ok(parsed.sections.some(section => section.title === 'Patrimônio'));

console.log('FII modal Investidor10 info parser v193 OK.');
