import assert from 'node:assert/strict';
import { buildMobileScraperAssetContract } from '../lib/compat/mobile-scraper-contract.js';

const stock = buildMobileScraperAssetContract({
  ticker: 'BBAS3',
  type: 'ACAO',
  results: {
    sourceUrl: 'https://investidor10.com.br/acoes/bbas3/',
    chartsFinanceiros: {
      receitasLucros: [{ year: '2025', netRevenue: 'R$ 102,14 Bilhões', netProfit: '15,71 Bilhões' }],
      lucroCotacao: { '2025': { lucroLiquido: '15,71 Bilhões', cotacao: 'R$ 19,40' } },
      evolucaoPatrimonio: [{ year: '2025', patrimonioLiquido: 'R$ 210,45 Bilhões', ativoTotal: '2,30 Trilhões' }],
    },
    comparadorAcoes: [
      { ticker: 'BBAS3', pl: 8.78, pvp: 0.58, roe: 8.37, dy: 12.3, val_mercado: '111,18 Bilhões', margem_liquida: 3.88 },
      { ticker: 'ITUB4', pl: '9,44', pvp: '1,71', roe: '18,10%', dy: '7,90%', val_mercado: '392,00 Bilhões', margem_liquida: '15,0%' },
    ],
  },
});

assert.equal(stock.status, 'OK');
assert.equal(stock.ok, true);
assert.equal(stock._contract, '21.13.15-mobile-investidor10-chart-fidelity-contract');
assert.equal(stock.charts_financeiros.receitas_lucros[0].net_revenue, 102_140_000_000);
assert.equal(stock.charts_financeiros.receitas_lucros[0].net_profit, 15_710_000_000);
assert.equal(stock.charts_financeiros.lucro_cotacao['2025'].net_profit, 15_710_000_000);
assert.equal(stock.charts_financeiros.evolucao_patrimonio[0].net_worth, 210_450_000_000);
assert.equal(stock.charts_financeiros.evolucao_patrimonio[0].total_assets, 2_300_000_000_000);
assert.equal(typeof stock.comparacao[0].pl, 'string');
assert.equal(typeof stock.comparacao[0].roe, 'string');
assert.equal(stock.revenueGeography, stock.revenue_geography);
assert.equal(stock.chartsFinanceiros.receitas_lucros.length, 1);
assert.equal(stock.source_url, 'https://investidor10.com.br/acoes/bbas3/');

const fii = buildMobileScraperAssetContract({
  ticker: 'HGLG11',
  url: 'https://investidor10.com.br/fiis/hglg11/',
  results: {
    assetChartsCanonical: {
      fii: {
        physicalAssets: [
          { nome: 'HGLG CAMPO GRANDE', estado: 'Rio de Janeiro', area_bruta_locavel: '16.532,00 m²' },
        ],
      },
    },
  },
});
assert.equal(fii.tipo_ativo, 'fii');
assert.equal(fii.classe_ativo, 'fii');
assert.equal(fii.imoveis[0].abl, '16.532,00 m²');
assert.equal(fii.imoveis[0].area_bruta_locavel, '16.532,00 m²');

const etf = buildMobileScraperAssetContract({ ticker: 'BOVA11', url: 'https://investidor10.com.br/etfs/bova11/', results: {} });
assert.equal(etf.tipo_ativo, 'acao');
assert.equal(etf.classe_ativo, 'etf');

const bdr = buildMobileScraperAssetContract({ ticker: 'AAPL34', url: 'https://investidor10.com.br/bdrs/aapl34/', results: {} });
assert.equal(bdr.tipo_ativo, 'acao');
assert.equal(bdr.classe_ativo, 'bdr');


const arrayShapes = buildMobileScraperAssetContract({
  ticker: 'WEGE3',
  type: 'ACAO',
  results: {
    assetChartsCanonical: {
      financial: {
        revenueProfit: [['2024', 'R$ 38,61 Bilhões', 'R$ 6,00 Bilhões']],
        profitVsQuote: [['2024', '6,00 Bilhões', '55,20']],
        equityEvolution: [['2024', 'R$ 20,00 Bilhões', 'R$ 38,61 Bilhões', 'R$ 6,00 Bilhões', 'R$ 50,00 Bilhões', 'R$ 30,00 Bilhões']],
        payoutHistory: [['2024', '50,5%', '3,1%']],
      },
      revenueByBusiness: {
        categories: ['2023', '2024'],
        series: [
          { name: 'Motores', data: ['60%', '62,5%'] },
          { name: 'Energia', data: ['40%', '37,5%'] },
        ],
      },
    },
  },
});
assert.equal(arrayShapes.charts_financeiros.receitas_lucros[0].net_revenue, 38_610_000_000);
assert.equal(arrayShapes.charts_financeiros.lucro_cotacao['2024'].quotation, 55.2);
assert.equal(arrayShapes.charts_financeiros.evolucao_patrimonio[0].total_assets, 50_000_000_000);
assert.equal(arrayShapes.charts_financeiros.payout[0].payout, 50.5);
assert.equal(arrayShapes.revenue_segment['2024'].Motores.value, 62.5);
assert.equal(arrayShapes.revenue_segment['2024'].Energia.value, 37.5);

console.log('mobile-deep-hardening-v21-13-14 ok');
