import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const canonical = {
  financial: {
    balanceSheet: [
      { year: 2025, totalAssets: 1220000000000, currentAssets: 140030000000, nonCurrentAssets: 607430000000, totalLiabilities: 1220000000000, currentLiabilities: 198370000000, nonCurrentLiabilities: 1080000000000, netWorth: 417590000000 },
      { year: 2024, totalAssets: 1120000000000, currentAssets: 135100000000, nonCurrentAssets: 989590000000, totalLiabilities: 1120000000000, currentLiabilities: 194100000000, nonCurrentLiabilities: 562480000000, netWorth: 367510000000 }
    ],
    incomeStatement: []
  },
  revenueBreakdowns: {
    geography: {
      labels: ['Brasil', 'Exterior'],
      series: [{ name: '2025', data: [85, 15] }],
      formattedValues: ['R$ 108,26 Bilhões', 'R$ 19,11 Bilhões'],
      totalValueDisplay: 'R$ 127,37 Bilhões'
    },
    byBusiness: {
      labels: ['Diesel', 'Petróleo', 'Gasolina'],
      series: [{ name: '2025', data: [30, 27, 14] }],
      formattedValues: ['R$ 38,36 Bilhões', 'R$ 34,52 Bilhões', 'R$ 17,62 Bilhões'],
      totalValueDisplay: 'R$ 127,37 Bilhões'
    }
  }
};

const companyDataHtml = `
<h2>DADOS SOBRE A EMPRESA</h2>
Nome da Empresa Petróleo Brasileiro S.A. Petrobras
CNPJ 33.000.167/0001-01
Ano de estreia na bolsa 1968
Número de funcionários 46500
Ano de fundação 1953
Papéis da empresa PETR3 PETR4
Papéis Fracionados PETR3F PETR4F
<h2>INFORMAÇÕES SOBRE A EMPRESA</h2>
Valor de mercado R$ 485,95 Bilhões
Valor de firma R$ 759,60 Bilhões
Patrimônio Líquido R$ 417,59 Bilhões
Nº total de papéis 13,04 Bilhões
Ativos R$ 1,22 Trilhão
Ativo Circulante R$ 140,03 Bilhões
Dívida Bruta R$ 370,10 Bilhões
Dívida Líquida R$ 273,65 Bilhões
Disponibilidade R$ 96,45 Bilhões
Segmento de Listagem Nível 2
Free Float 64,16%
Tag Along 100%
Liquidez Média Diária R$ 1,25 Bilhão
Setor Petróleo, Gás e Biocombustíveis
Segmento Exploração, Refino e Distribuição
<h2>Regiões onde Petrobras gera receita</h2>
`;

const shareholdingHtml = `<section><h2>POSIÇÃO ACIONÁRIA DA PETR4</h2>
Acionista % ON % PN % Total OUTROS, 40.77, 67.21, 52.03; UNIÃO FEDERAL, 50.26, 0.00, 29.02;
</section>`;

const investidor10 = {
  balanceSheetStatement: _test.buildStockBalanceSheetStatementPayload({ ticker: 'PETR4', canonical }),
  revenueByRegion: _test.buildStockRevenueBreakdownPayload({ canonical, ticker: 'PETR4', name: 'Petrobras' }, 'region'),
  revenueByBusiness: _test.buildStockRevenueBreakdownPayload({ canonical, ticker: 'PETR4', name: 'Petrobras' }, 'business'),
  companyData: _test.extractStockCompanyData(companyDataHtml, 'PETR4', 'Petrobras'),
  companyInformation: _test.extractStockCompanyInformation(companyDataHtml, 'PETR4'),
  shareholdingPosition: _test.buildStockShareholdingPayload({ html: shareholdingHtml, ticker: 'PETR4' })
};

assert.equal(investidor10.balanceSheetStatement.rows.length, 7);
assert.equal(investidor10.revenueByRegion.items.length, 2);
assert.equal(investidor10.revenueByBusiness.items.length, 3);
assert.ok(investidor10.companyData.facts.length >= 5);
assert.ok(investidor10.companyInformation.facts.length >= 10);
assert.equal(investidor10.shareholdingPosition.rows.length, 2);

const readiness = _test.buildStockModalSectionReadiness({ investidor10 });
assert.equal(readiness.status, 'OK');
assert.equal(readiness.readyCount, 6);
assert.equal(readiness.totalCount, 6);
assert.deepEqual(readiness.missing, []);
assert.ok(readiness.sections.every(section => section.source === 'Investidor10'));

const emptyReadiness = _test.buildStockModalSectionReadiness({ investidor10: {} });
assert.equal(emptyReadiness.status, 'PARTIAL');
assert.equal(emptyReadiness.readyCount, 0);
assert.equal(emptyReadiness.missing.length, 6);
assert.ok(emptyReadiness.sections.every(section => section.message.includes('sem fallback simulado')));

console.log('stock-modal-integrated-sections-i10-v255 ok');
