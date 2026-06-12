import assert from 'node:assert/strict';
import { buildMobileScraperAssetContract } from '../lib/compat/mobile-scraper-contract.js';

const etf = buildMobileScraperAssetContract({ ticker: 'BOVA11', type: 'ETF', results: {} });
assert.equal(etf.tipo_ativo, 'acao');
assert.equal(etf.classe_ativo, 'etf');

const acaoUrl = buildMobileScraperAssetContract({ ticker: 'KLBN11', url: 'https://investidor10.com.br/acoes/klbn11/', results: {} });
assert.equal(acaoUrl.tipo_ativo, 'acao');
assert.equal(acaoUrl.classe_ativo, 'acao');

const fiiUrl = buildMobileScraperAssetContract({ ticker: 'HGLG11', url: 'https://investidor10.com.br/fiis/hglg11/', results: {} });
assert.equal(fiiUrl.tipo_ativo, 'fii');
assert.equal(fiiUrl.classe_ativo, 'fii');

const normalizedSeries = buildMobileScraperAssetContract({
  ticker: 'HGLG11',
  type: 'FII',
  results: {
    assetChartsCanonical: {
      indexComparison: {
        HGLG11: [['jan/24', '0,5%'], ['fev/24', '1,2%']],
        IFIX: [{ label: 'jan/24', value: '0,2%' }, { label: 'fev/24', value: '0,8%' }],
      },
      fii: {
        peerComparison: [
          { name: 'HGLG11', points: [{ label: 'DY', value: '8,41%' }, { label: 'P/VP', value: '0,95' }, { label: 'Patrimônio', value: '7,03 B' }] },
          { name: 'KNCR11', points: [{ label: 'DY', value: '13,72%' }, { label: 'P/VP', value: '1,04' }] },
        ],
        distribution12m: { data: [{ periodo: '12 MESES', yield: '8,41%', valor: '13,20' }] },
        dividendYieldHistory: [['2024', '8,41%'], ['2025', '8,88%']],
        dividendHistory: [
          { dataCom: '30/05/2025', dataPagamento: '13/06/2025', valor: 'R$ 1,10', tipo: 'Rendimento' },
          ['31/03/2025', '14/04/2025', '0,98', 'Rendimento'],
        ],
      },
    },
  },
});

assert.equal(normalizedSeries.comparacao_indices.length, 2);
assert.equal(normalizedSeries.comparacao_indices[0].points[1].profitability, 1.2);
assert.equal(normalizedSeries.rentabilidade_chart.profitabilities.length, 2);
assert.equal(normalizedSeries.comparacao.length, 2);
assert.equal(normalizedSeries.comparacao[0].ticker, 'HGLG11');
assert.equal(normalizedSeries.comparacao[0].dy, '8,41%');
assert.equal(normalizedSeries.distribuicoes_12m[0].yieldPercent, 8.41);
assert.equal(normalizedSeries.dividend_yield_history[1].dy, 8.88);
assert.equal(normalizedSeries.dividend_history[0].dataCom, '2025-05-30');
assert.equal(normalizedSeries.dividend_history[1].paymentDate, '2025-04-14');
assert.equal(normalizedSeries._coverage.chartBlocks.dividend_history, 2);
assert.equal(normalizedSeries._coverage.chartBlocks.dividend_yield_history, 2);
assert.equal(normalizedSeries._source_integrity.normalizedForAndroidApk, true);

console.log('mobile-resilient-contract-v21-13-13 ok');
