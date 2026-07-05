import assert from 'node:assert/strict';
import { buildInvestidor10CanonicalCharts } from '../lib/market/investidor10-chart-extractor.js';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const html = `
  <h2>BALANÇO PATRIMONIAL Petrobras</h2>
  <p>Valores simples Valores detalhados Valores AV% AH% Anual Trimestre</p>
`;

const apiExtras = {
  chartsFinanceiros: {
    balanceSheetTable: {
      columns: ['#', '2025', 'AV %', 'AH %', '2024', 'AV %', 'AH %', '2023', 'AV %', 'AH %'],
      data: [
        ['ATIVO TOTAL - (R$)', '1,22 Trilhão', '100,00 %', '8,93 %', '1,12 Trilhão', '100,00 %', '6,67 %', '1,05 Trilhão', '100,00 %', '7,50 %'],
        ['Ativo Circulante - (R$)', '140,03 Bilhões', '11,48 %', '3,65 %', '135,10 Bilhões', '12,06 %', '-13,99 %', '157,08 Bilhões', '14,97 %', '-3,66 %'],
        ['Ativo Não Circulante - (R$)', '607,43 Bilhões', '49,79 %', '-38,62 %', '989,59 Bilhões', '88,35 %', '10,72 %', '893,81 Bilhões', '85,19 %', '9,86 %'],
        ['PASSIVO TOTAL - (R$)', '1,22 Trilhão', '100,00 %', '8,93 %', '1,12 Trilhão', '100,00 %', '6,67 %', '1,05 Trilhão', '100,00 %', '7,50 %'],
        ['Passivo Circulante - (R$)', '198,37 Bilhões', '16,26 %', '2,20 %', '194,10 Bilhões', '17,33 %', '18,40 %', '163,93 Bilhões', '15,62 %', '0,12 %'],
        ['Passivo Não Circulante - (R$)', '1,08 Trilhão', '88,52 %', '92,01 %', '562,48 Bilhões', '50,22 %', '11,46 %', '504,62 Bilhões', '48,09 %', '12,49 %'],
        ['Patrimônio Líquido Consolidado - (R$)', '417,59 Bilhões', '34,23 %', '13,62 %', '367,51 Bilhões', '32,82 %', '-3,88 %', '382,34 Bilhões', '36,44 %', '4,93 %']
      ]
    }
  },
  rawJson: {},
  apiStatus: [{ key: 'balanceSheetTable', ok: true, status: 200 }]
};

const canonical = buildInvestidor10CanonicalCharts({ ticker: 'PETR4', type: 'ACAO', html, apiExtras });
assert.equal(canonical.available.balanceSheet, true, 'Balanço patrimonial table-like precisa alimentar canonical.financial.balanceSheet');
assert.ok(canonical.financial.balanceSheet.length >= 3, 'Balanço deve preservar os períodos do Investidor10');
const p2025 = canonical.financial.balanceSheet.find(point => String(point.year) === '2025');
assert.equal(p2025.totalAssets, 1_220_000_000_000);
assert.equal(p2025.currentAssets, 140_030_000_000);
assert.equal(p2025.nonCurrentAssets, 607_430_000_000);
assert.equal(p2025.totalLiabilities, 1_220_000_000_000);
assert.equal(p2025.currentLiabilities, 198_370_000_000);
assert.equal(Math.round(p2025.nonCurrentLiabilities), 1_080_000_000_000);
assert.equal(p2025.netWorth, 417_590_000_000);

const payload = _test.buildStockBalanceSheetStatementPayload({ ticker: 'PETR4', canonical });
assert.equal(payload.status, 'OK');
assert.equal(payload.columns[0], '2025');
assert.equal(payload.rows.length, 7, 'Modal deve receber as 7 linhas principais do Balanço Patrimonial');
assert.equal(payload.rows.find(row => row.id === 'total_assets')?.values['2025'], '1.220,00B');
assert.equal(payload.rows.find(row => row.id === 'current_assets')?.values['2025'], '140,03B');
assert.equal(payload.rows.find(row => row.id === 'non_current_assets')?.values['2024'], '989,59B');
assert.equal(payload.rows.find(row => row.id === 'current_liabilities')?.values['2023'], '163,93B');
assert.equal(payload.rows.find(row => row.id === 'equity')?.values['2025'], '417,59B');

console.log('stock-modal-balance-sheet-i10-v249 ok');
