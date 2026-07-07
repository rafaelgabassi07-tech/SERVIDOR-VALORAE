import assert from 'node:assert/strict';
import fs from 'node:fs';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const endpoints = _test.stockHistoricalIndicatorEndpointCandidates({
  ticker: 'PETR4',
  ids: { companyId: '95', tickerId: '456' },
  html: '<script>fetch("/api/balancos/indicadores/table/95/3650/")</script>'
}).map(item => item.url);

assert.ok(endpoints.some(url => url.includes('/api/balancos/indicadores/table/95/456/PETR4/3650/')), 'deve priorizar endpoint histórico por companyId+tickerId');
assert.ok(endpoints.some(url => url.includes('/api/balancos/indicadores/chart/95/456/PETR4/3650/')), 'deve tentar endpoint chart por companyId+tickerId');
assert.ok(endpoints.some(url => url.includes('/api/balancos/indicadores/table/95/3650/')), 'deve manter endpoint companyId usado pelo Investidor10');
assert.ok(endpoints.some(url => url.includes('/api/acoes/historico-indicadores/petr4')), 'deve manter rota dedicada por ticker como fallback real');
assert.ok(endpoints.some(url => url.includes('/api/rest/assets/tickers/PETR4')), 'deve usar REST asset ticker como fonte/resolvedor principal');

const tablePayload = {
  columns: [
    { data: '0', title: 'Indicador' },
    { data: '1', title: 'Atual' },
    { data: '2', title: '2025' },
    { data: '3', title: '2024' },
    { data: '4', title: '2023' },
    { data: '5', title: '2022' },
    { data: '6', title: '2021' }
  ],
  data: [
    { 0: 'P/L', 1: '4,54', 2: '3,61', 3: '12,74', 4: '3,85', 5: '1,68', 6: '3,44' },
    { 0: 'P/Receita (PSR)', 1: '0,98', 2: '0,80', 3: '0,95', 4: '0,94', 5: '0,77', 6: '1,03' },
    { 0: 'P/VP', 1: '1,10', 2: '0,96', 3: '1,27', 4: '1,26', 5: '0,89', 6: '0,93' },
    { 0: 'Dividend Yield', 1: '7,78%', 2: '10,49%', 3: '21,49%', 4: '19,33%', 5: '67,99%', 6: '19,85%' },
    { 0: 'Payout', 1: '38,46%', 2: '43,02%', 3: '278,99%', 4: '79,30%', 5: '103,29%', 6: '68,31%' },
    { 0: 'Margem Líquida', 1: '21,60%', 2: '22,13%', 3: '7,46%', 4: '24,34%', 5: '32,43%', 6: '25,28%' },
    { 0: 'ROE', 1: '24,17%', 2: '26,49%', 3: '10,00%', 4: '32,75%', 5: '51,60%', 6: '27,54%' },
    { 0: 'ROIC', 1: '12,95%', 2: '13,21%', 3: '16,16%', 4: '20,05%', 5: '24,30%', 6: '14,50%' }
  ]
};

const normalized = _test.normalizeStockHistoricalIndicatorsApi(tablePayload, 'PETR4', {});
assert.equal(normalized.status, 'OK');
assert.ok(normalized.periods.includes('5y'));
assert.deepEqual(normalized.tablesByPeriod['5y'].columns, ['Atual', '2025', '2024', '2023', '2022', '2021']);
assert.equal(normalized.rows.find(row => row.label === 'P/L')?.values.Atual, '4,54');
assert.equal(normalized.rows.find(row => row.label === 'P/Receita (PSR)')?.values['2024'], '0,95');
assert.equal(normalized.rows.find(row => row.label === 'Dividend Yield')?.values['2023'], '19,33%');
assert.equal(normalized.rows.find(row => row.label === 'ROE')?.values['2021'], '27,54%');
assert.ok(normalized.rows.length >= 8, 'não pode ficar limitado a P/L e P/Receita');

const sources = _test.buildStockHistoricalIndicatorSources({
  ticker: 'PETR4',
  apiExtras: { rawJson: { stockHistoricalIndicatorsNormalized: normalized } }
});
const rebuilt = _test.buildStockHistoricalIndicators(sources, 'PETR4', {});
assert.equal(rebuilt.status, 'OK');
assert.equal(rebuilt.rows.find(row => row.label === 'Payout')?.values['2022'], '103,29%');

const source = fs.readFileSync('lib/analysis/stock-modal-contract.js', 'utf8');
assert.ok(source.includes('fetchInvestidor10StockHistoricalIndicatorsRaw'), 'deve existir um coletor dedicado para histórico fundamentalista de ações, espelhando o padrão estável usado em FIIs');
assert.ok(source.includes('stockHistoricalIndicatorsDedicatedSources'), 'fontes dedicadas precisam entrar no contrato normalizado antes do fallback genérico');
assert.ok(source.includes('stockHistoricalIndicatorsDedicated'), 'diagnóstico dedicado precisa aparecer para auditar cada endpoint');

console.log('stock-modal-historical-indicators-dedicated-v278 ok');
