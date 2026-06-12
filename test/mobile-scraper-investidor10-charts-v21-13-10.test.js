import assert from 'node:assert/strict';
import { buildMobileScraperAssetContract } from '../lib/compat/mobile-scraper-contract.js';
import { routeManifest, _test } from '../routes/_router.js';

const acaoPayload = {
  ticker: 'BBAS3',
  type: 'ACAO',
  results: {
    nome: 'Banco do Brasil',
    indicadores: { dividendYield: '8,7%', pvp: '0,82', pl: '4,5', roe: '18,2%', payout: '42%' },
    assetChartsCanonical: {
      profitability: {
        periods: ['1 mês', '3 meses', '1 ano'],
        nominal: [{ period: '1 mês', valuePercent: -10.35 }, { period: '3 meses', valuePercent: -20.10 }, { period: '1 ano', valuePercent: -8.86 }],
        real: [{ period: '1 mês', valuePercent: -10.35 }, { period: '3 meses', valuePercent: -20.63 }, { period: '1 ano', valuePercent: -12.26 }],
      },
      financial: {
        revenueProfit: [{ label: '2024', year: '2024', netRevenue: 102000000000, netProfit: 37000000000 }],
        profitVsQuote: [{ label: '2024', year: '2024', quote: 27.4, profit: 37000000000 }],
        equityEvolution: [{ label: '2024', year: '2024', netWorth: 210000000000, totalAssets: 2300000000000, totalLiabilities: 2090000000000 }],
        payoutHistory: [{ label: '2024', year: '2024', value: 42.1 }],
      },
      revenueGeography: { '2024': { Brasil: { value: 96.5 } } },
      revenueSegment: { '2024': { Banco: { value: 100 } } },
    },
  },
};
const acao = buildMobileScraperAssetContract(acaoPayload);
assert.equal(acao.tipo_ativo, 'acao');
assert.equal(acao.dy, '8,7%');
assert.equal(acao.rentabilidade_chart.profitabilities.length, 2);
assert.equal(acao.rentabilidade_chart.profitabilities[0][0].date, '1 mês');
assert.equal(acao.charts_financeiros.receitas_lucros[0].net_revenue, 102000000000);
assert.equal(acao.charts_financeiros.lucro_cotacao['2024'].quotation, 27.4);
assert.equal(acao.charts_financeiros.evolucao_patrimonio[0].net_worth, 210000000000);
assert.equal(acao.charts_financeiros.payout[0].payout_company, 42.1);
assert.equal(acao.revenue_geography['2024'].Brasil.value, 96.5);
assert.equal(acao._coverage.chartBlocks.charts_financeiros.receitas_lucros, 1);

const fiiPayload = {
  ticker: 'KNCR11',
  type: 'FII',
  results: {
    indicadores: { dividendYield: '12,1%', pvp: '1,02' },
    assetChartsCanonical: {
      fii: {
        info: {
          'TIPO DE FUNDO': 'Fundo de Papel',
          SEGMENTO: 'Títulos e Valores Mobiliários',
          MANDATO: 'Títulos e valores mobiliários',
          'TIPO DE GESTÃO': 'Ativa',
          VACÂNCIA: '0,00%',
          'NUMERO DE COTISTAS': '549.967',
          'ÚLTIMO RENDIMENTO': 'R$ 1,10',
        },
        distribution12m: [{ period: '12 MESES', yieldPercent: 8.74, amount: 13.2 }],
        fundamentalIndicatorHistory: { colunas: ['Ano', 'P/VP'], linhas: [['2024', '1,02']] },
        physicalAssets: [{ nome: 'Carteira de CRI', tipo: 'Papel' }],
      },
    },
  },
};
const fii = buildMobileScraperAssetContract(fiiPayload);
assert.equal(fii.tipo_ativo, 'fii');
assert.equal(fii.tipo_fundo, 'Fundo de Papel');
assert.equal(fii.segmento, 'Títulos e Valores Mobiliários');
assert.equal(fii.historico_indicadores.colunas[0], '2024');
assert.equal(fii.historico_indicadores.linhas[0].indicador, 'P/VP');
assert.equal(fii.historico_indicadores.linhas[0].valores['2024'], '1,02');
assert.equal(fii.imoveis[0].nome, 'Carteira de CRI');
assert.equal(fii._coverage.chartBlocks.imoveis, 1);


const fiiPapelHibridoPayload = {
  ticker: 'MXRF11',
  type: 'FII',
  results: {
    indicadores: { dividendYield: '12,4%', pvp: '1,03' },
    assetChartsCanonical: {
      fii: {
        info: {
          'TIPO DE FUNDO': 'Fundo de Papel',
          SEGMENTO: 'Híbrido',
        },
        assetDistribution: [
          { name: 'CRI', value: 78.5, type: 'Crédito imobiliário' },
          { name: 'Caixa', value: 21.5, type: 'Liquidez' },
        ],
      },
    },
  },
};
const fiiPapelHibrido = buildMobileScraperAssetContract(fiiPapelHibridoPayload);
assert.equal(fiiPapelHibrido.tipo_fundo, 'Fundo de Papel');
assert.equal(fiiPapelHibrido.segmento, 'Híbrido');
assert.equal(fiiPapelHibrido.distribuicao_ativos_fundo.length, 2);
assert.equal(fiiPapelHibrido.imoveis[0].nome, 'CRI');
assert.equal(fiiPapelHibrido._coverage.chartBlocks.distribuicao_ativos_fundo, 2);

const revenueShapePayload = {
  ticker: 'WEGE3',
  type: 'ACAO',
  results: {
    assetChartsCanonical: {
      revenueGeography: { '2024': [{ name: 'Brasil', value: '42,5%' }, { name: 'Exterior', value: 57.5 }] },
      revenueSegment: { labels: ['Motores', 'Energia'], series: ['60%', '40%'], year: '2024' },
    },
  },
};
const revenueShape = buildMobileScraperAssetContract(revenueShapePayload);
assert.equal(revenueShape.revenue_geography['2024'].Brasil.value, 42.5);
assert.equal(revenueShape.revenue_segment['2024'].Energia.value, 40);

const manifest = routeManifest();
assert.ok(manifest.routes.includes('/scraper'));
assert.ok(manifest.routes.includes('/scraper4'));
assert.ok(manifest.routes.includes('/compat/scraper4'));
assert.equal(_test.stripApi('/api/scraper'), '/scraper');

console.log('mobile-scraper-investidor10-charts-v21-13-10 ok');
