import test from 'node:test';
import assert from 'node:assert/strict';
import { __testDedupeEvents, __testBuildDividendResult } from '../lib/portfolio/dividends-contract.js';

test('agenda preserva parcelas distintas do mesmo ativo na mesma data de pagamento', () => {
  const rows = __testDedupeEvents([
    { ticker: 'PETR4', dateCom: '2026-06-01', paymentDate: '2026-08-20', dividendType: 'JCP', grossValuePerShare: 0.35, rawProvider: 'statusinvest' },
    { ticker: 'PETR4', dateCom: '2026-06-15', paymentDate: '2026-08-20', dividendType: 'JCP', grossValuePerShare: 0.12, rawProvider: 'statusinvest' },
  ]);
  assert.equal(rows.length, 2);
});

test('agenda ainda deduplica a mesma distribuição repetida por fontes próximas', () => {
  const rows = __testDedupeEvents([
    { ticker: 'BTCI11', dateCom: '2026-07-31', paymentDate: '2026-08-14', dividendType: 'RENDIMENTO', grossValuePerShare: 0.10, rawProvider: 'statusinvest' },
    { ticker: 'BTCI11', dateCom: '2026-07-31', paymentDate: '2026-08-14', dividendType: 'RENDIMENTO', grossValuePerShare: 0.101, rawProvider: 'investidor10' },
  ]);
  assert.equal(rows.length, 1);
});

test('includeAllFutureAnnounced remove somente o teto futuro, preservando histórico solicitado', () => {
  const result = __testBuildDividendResult({
    payload: {
      historyMonths: 1,
      futureMonths: 1,
      includeAllFutureAnnounced: true,
      positions: [{ ticker: 'PETR4', quantity: 10, firstPurchaseDate: '2020-01-01' }],
    },
    tickers: ['PETR4'],
    officialEvents: [
      { ticker: 'PETR4', dateCom: '2026-06-01', paymentDate: '2030-08-20', dividendType: 'JCP', grossValuePerShare: 0.35, valuePerShare: 0.35 },
    ],
  });
  assert.equal(result.officialFutureEvents.length, 1);
  assert.equal(result.portfolioUpcoming.length, 1);
});
