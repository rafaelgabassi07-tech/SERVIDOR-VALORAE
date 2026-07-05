import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const html = `
<html><body>
  <h2>DADOS SOBRE A EMPRESA</h2>
  <div>Nome da Empresa: PETROLEO BRASILEIRO S.A. PETROBRAS</div>
  <div>CNPJ: 33.000.167/0001-01</div>
  <div>Ano de estreia na bolsa: 1977</div>
  <div>Número de funcionários: 61.550</div>
  <div>Ano de fundação: 1953</div>
  <h5>Papéis da empresa:</h5>
  <a>PETR3</a><a>PETR4</a>
  <h5>Papéis Fracionados:</h5>
  <a>PETR3F</a><a>PETR4F</a>
  <h2>INFORMAÇÕES SOBRE A EMPRESA</h2>
</body></html>`;

const data = _test.extractStockCompanyData(html, 'PETR4', 'Petrobras');
assert.equal(data.status, 'OK');
assert.equal(data.title, 'Dados sobre a empresa');
assert.equal(data.facts.find(item => item.id === 'company_name').value, 'PETROLEO BRASILEIRO S.A. PETROBRAS');
assert.equal(data.facts.find(item => item.id === 'cnpj').value, '33.000.167/0001-01');
assert.equal(data.facts.find(item => item.id === 'listing_year').value, '1977');
assert.equal(data.facts.find(item => item.id === 'employees').value, '61.550');
assert.equal(data.facts.find(item => item.id === 'foundation_year').value, '1953');
assert.deepEqual(data.companyPapers, ['PETR3', 'PETR4']);
assert.deepEqual(data.fractionalPapers, ['PETR3F', 'PETR4F']);
assert.equal(data.sections.length, 2);

const empty = _test.extractStockCompanyData('<html><body>Sem dados</body></html>', 'VALE3', 'Vale');
assert.equal(empty.status, 'EMPTY');
assert.equal(empty.facts.length, 0);

console.log('stock-modal-company-data-i10-v253 ok');
