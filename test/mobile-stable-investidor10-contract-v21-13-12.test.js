import assert from 'node:assert/strict';
import { buildInvestidor10CanonicalCharts } from '../lib/market/investidor10-chart-extractor.js';
import { buildMobileScraperAssetContract } from '../lib/compat/mobile-scraper-contract.js';

const htmlFiiTijolo = `
  <h2>Lista de Imóveis</h2>
  <h3>HGLG CAMPO GRANDE</h3>
  <p>Estado: Rio de Janeiro</p>
  <p>Área bruta locável: 16.532,00 m²</p>
  <h3>HGLG BETIM</h3>
  <p>Estado: Minas Gerais</p>
  <p>Área bruta locável: 62.587,00 m²</p>
  <h2>histórico da taxa de vacância HGLG11</h2>
`;
const canonicalFii = buildInvestidor10CanonicalCharts({ ticker: 'HGLG11', type: 'FII', html: htmlFiiTijolo, apiExtras: {} });
assert.equal(canonicalFii.fii.physicalAssets.length, 2);
assert.equal(canonicalFii.fii.physicalAssets[0].nome, 'HGLG CAMPO GRANDE');
assert.equal(canonicalFii.fii.physicalAssets[0].estado, 'Rio de Janeiro');

const stockContract = buildMobileScraperAssetContract({
  ticker: 'BBAS3',
  type: 'ACAO',
  results: {
    nome: 'Banco do Brasil',
    nomeLongo: 'Banco do Brasil S.A.',
    advancedMetrics: { roe: '8,37%', p_l: '8,21' },
    assetChartsCanonical: {
      indexComparison: [
        { name: 'BBAS3', points: [{ label: '2024', value: 10 }, { label: '2025', value: 20 }] },
        { name: 'IBOV', points: [{ label: '2024', value: 5 }, { label: '2025', value: 8 }] },
      ],
    },
  },
});
assert.equal(stockContract.nome_longo, 'Banco do Brasil S.A.');
assert.equal(stockContract.advanced_metrics.roe, 8.37);
assert.deepEqual(stockContract.comparacao, []);
assert.equal(stockContract.comparacao_indices.length, 2);
assert.equal(stockContract._coverage.chartBlocks.comparacao, 0);
assert.equal(stockContract._coverage.chartBlocks.comparacao_indices, 2);

const fiiContract = buildMobileScraperAssetContract({
  ticker: 'KNCR11',
  type: 'FII',
  results: {
    assetChartsCanonical: {
      fii: {
        peerComparison: {
          rows: [
            { ticker: 'KNCR11', dy: '13,72%', pvp: '1,04', patrimonio: '10,96 Bilhões', tipo: 'Fundo de Papel', segmento: 'Títulos e Valores Mobiliários' },
            { ticker: 'MXRF11', dy: '12,40%', pvp: '1,03', patrimonio: '4,32 Bilhões', tipo: 'Fundo de Papel', segmento: 'Híbrido' },
          ],
        },
      },
    },
  },
});
assert.equal(fiiContract.comparacao.length, 2);
assert.equal(fiiContract.comparacao[0].ticker, 'KNCR11');
assert.equal(fiiContract.comparacao[1].segmento, 'Híbrido');


const unitTickerContract = buildMobileScraperAssetContract({
  ticker: 'KLBN11',
  results: {},
});
assert.equal(unitTickerContract.tipo_ativo, 'acao');

const stockPeerContract = buildMobileScraperAssetContract({
  ticker: 'BBAS3',
  type: 'ACAO',
  results: {
    comparadorAcoes: [
      { ticker: 'BBAS3', pl: '8,78', pvp: '0,58', roe: '8,37%', val_mercado: '111,18 Bilhões' },
      { ticker: 'ITUB4', pl: '9,44', pvp: '1,71', roe: '18,10%', val_mercado: '392,00 Bilhões' },
    ],
  },
});
assert.equal(stockPeerContract.comparacao.length, 2);
assert.equal(stockPeerContract.comparacao[1].ticker, 'ITUB4');

const normalizedProfitQuote = buildMobileScraperAssetContract({
  ticker: 'BBAS3',
  type: 'ACAO',
  results: {
    chartsFinanceiros: {
      lucroCotacao: {
        '2025': { lucroLiquido: '15,71 Bilhões', cotacao: '19,40' },
      },
    },
  },
});
assert.equal(normalizedProfitQuote.charts_financeiros.lucro_cotacao['2025'].quotation, 19.4);

const unstableNumbers = buildMobileScraperAssetContract({
  ticker: 'TEST3',
  type: 'ACAO',
  results: {
    chartsFinanceiros: { receitasLucros: [{ year: '2025', netRevenue: Number.POSITIVE_INFINITY, netProfit: Number.NaN }] },
  },
});
assert.deepEqual(unstableNumbers.charts_financeiros.receitas_lucros, []);
assert.doesNotMatch(JSON.stringify(unstableNumbers), /NaN|Infinity/);

console.log('mobile-stable-investidor10-contract-v21-13-12 ok');
