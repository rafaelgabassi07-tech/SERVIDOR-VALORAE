import assert from 'node:assert/strict';
import { __testBuildDividendResult } from '../lib/portfolio/dividends-contract.js';

const result = __testBuildDividendResult({
  payload: {
    positions: [{ ticker: 'AFLT3', quantity: 100, avgPrice: 8.5, currentPrice: 9.0, assetClass: 'ACAO' }],
    transactions: [{ ticker: 'AFLT3', quantity: 100, price: 8.5, date: '2026-06-10', side: 'BUY', assetClass: 'ACAO' }]
  },
  tickers: ['AFLT3'],
  officialEvents: [{
    ticker: 'AFLT3',
    assetClass: 'ACAO',
    dateCom: '15/07/2026',
    comDate: '15/07/2026',
    paymentDate: '',
    dividendType: 'JSCP',
    valuePerShare: 0.15,
    grossValuePerShare: 0.15,
    source: 'Investidor10 Agenda de Dividendos',
    rawProvider: 'investidor10-agenda',
    sourceKind: 'calendar-complement',
    status: 'Anunciado/Provisionado'
  }]
});

assert.equal(result.status, 'OK');
assert.equal(result.officialAnnouncedEvents.length, 1, 'Data COM futura sem pagamento deve ser classificada como anúncio');
assert.equal(result.officialUpcomingEvents.length, 1, 'Data COM futura deve permanecer em upcoming oficial');
assert.equal(result.portfolioUpcoming.length, 1, 'Data COM futura deve aparecer na agenda da carteira elegível');
assert.equal(result.portfolioUpcoming[0].dateCom, '15/07/2026');
assert.equal(result.portfolioUpcoming[0].paymentDate || '', '');
assert.equal(result.counts.announced, 1);
assert.equal(result.counts.portfolioUpcoming, 1);

console.log('Dividend agenda future Data COM visibility v127 test OK.');
