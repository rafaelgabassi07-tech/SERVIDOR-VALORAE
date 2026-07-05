import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const html = `
<html><body>
  <h2>INFORMAÇÕES SOBRE A EMPRESA</h2>
  <div>Valores simples Valores detalhados</div>
  <div>Valor de mercado</div><div>R$ 523,80 Bilhões</div><div>R$ 523.804.866.000</div>
  <div>Valor de firma</div><div>R$ 847,90 Bilhões</div><div>R$ 847.895.866.000</div>
  <div>Patrimônio Líquido</div><div>R$ 445,19 Bilhões</div><div>R$ 445.189.000.000</div>
  <div>Nº total de papeis</div><div>12,89 Bilhões</div><div>12.888.732.000</div>
  <div>Ativos</div><div>R$ 1,25 Trilhão</div><div>R$ 1.246.068.000.000</div>
  <div>Ativo Circulante</div><div>R$ 140,53 Bilhões</div><div>R$ 140.533.000.000</div>
  <div>Dívida Bruta</div><div>R$ 371,69 Bilhões</div><div>R$ 371.691.000.000</div>
  <div>Dívida Líquida</div><div>R$ 324,09 Bilhões</div><div>R$ 324.091.000.000</div>
  <div>Disponibilidade</div><div>R$ 47,60 Bilhões</div><div>R$ 47.600.000.000</div>
  <div>Segmento de Listagem Nível 2</div>
  <div>Free Float 60,70%</div>
  <div>Tag Along 100,00%</div>
  <div>Liquidez Média Diária</div><div>R$ 1,42 Bilhão</div><div>R$ 1.418.920.000</div>
  <a>Setor Petróleo, Gás e Biocombustíveis</a>
  <a>Segmento Exploração, Refino e Distribuição</a>
  <h2>Regiões onde Petrobras gera receita</h2>
</body></html>`;

const info = _test.extractStockCompanyInformation(html, 'PETR4');
assert.equal(info.status, 'OK');
assert.equal(info.title, 'Informações sobre a empresa');
assert.equal(info.facts.length, 15);
assert.equal(info.facts.find(item => item.id === 'market_value').value, 'R$ 523,80 Bilhões');
assert.equal(info.facts.find(item => item.id === 'market_value').detailedValue, 'R$ 523.804.866.000');
assert.equal(info.facts.find(item => item.id === 'enterprise_value').numericValue, 847900000000);
assert.equal(info.facts.find(item => item.id === 'assets').numericValue, 1250000000000);
assert.equal(info.facts.find(item => item.id === 'shares_total').value, '12,89 Bilhões');
assert.equal(info.facts.find(item => item.id === 'shares_total').detailedValue, '12.888.732.000');
assert.equal(info.facts.find(item => item.id === 'listing_segment').value, 'Nível 2');
assert.equal(info.facts.find(item => item.id === 'free_float').value, '60,70%');
assert.equal(info.facts.find(item => item.id === 'tag_along').numericValue, 100);
assert.equal(info.facts.find(item => item.id === 'sector').value, 'Petróleo, Gás e Biocombustíveis');
assert.equal(info.facts.find(item => item.id === 'segment').value, 'Exploração, Refino e Distribuição');
assert.equal(info.groups.length, 5);
assert.equal(info.groups.find(item => item.id === 'debt').facts.length, 3);

const empty = _test.extractStockCompanyInformation('<html><body>Sem dados</body></html>', 'VALE3');
assert.equal(empty.status, 'EMPTY');
assert.equal(empty.facts.length, 0);

const parsed = _test.stockCompanyInformationValuesFromSlice('R$ 1,25 Trilhão R$ 1.246.068.000.000', 'money');
assert.equal(parsed.value, 'R$ 1,25 Trilhão');
assert.equal(parsed.numericValue, 1250000000000);
assert.equal(parsed.detailedValue, 'R$ 1.246.068.000.000');

console.log('stock-modal-company-information-i10-v253 ok');
