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


test('agenda reconcilia representacoes bruta e liquida do mesmo JCP entre fontes', () => {
  const rows = __testDedupeEvents([
    { ticker: 'BBAS3', dateCom: '2026-08-01', paymentDate: '2026-08-20', dividendType: 'JCP', grossValuePerShare: 1.0, netValuePerShare: 0.825, valuePerShare: 0.825, rawProvider: 'statusinvest' },
    { ticker: 'BBAS3', dateCom: '2026-08-01', paymentDate: '2026-08-20', dividendType: 'JCP', valuePerShare: 1.0, rawProvider: 'investidor10' },
  ]);
  assert.equal(rows.length, 1);
});

test('agenda preserva duas parcelas completas da mesma fonte mesmo quando valores sao proximos', () => {
  const rows = __testDedupeEvents([
    { ticker: 'PETR4', dateCom: '2026-08-01', paymentDate: '2026-08-20', dividendType: 'JCP', grossValuePerShare: 0.35, rawProvider: 'statusinvest' },
    { ticker: 'PETR4', dateCom: '2026-08-01', paymentDate: '2026-08-20', dividendType: 'JCP', grossValuePerShare: 0.354, rawProvider: 'statusinvest' },
  ]);
  assert.equal(rows.length, 2);
});

test('agenda não funde previsões incompletas próximas da mesma fonte', () => {
  const rows = __testDedupeEvents([
    { ticker: 'PETR4', dateCom: '2026-08-01', paymentDate: '', dividendType: 'JCP', grossValuePerShare: 0.350, rawProvider: 'statusinvest' },
    { ticker: 'PETR4', dateCom: '2026-08-01', paymentDate: '', dividendType: 'JCP', grossValuePerShare: 0.354, rawProvider: 'statusinvest' },
  ]);
  assert.equal(rows.length, 2);
});

test('agenda reconcilia lifecycle incompleto da mesma fonte quando o valor é idêntico', () => {
  const rows = __testDedupeEvents([
    { ticker: 'PETR4', dateCom: '2026-08-01', paymentDate: '', dividendType: 'JCP', grossValuePerShare: 0.35, rawProvider: 'statusinvest' },
    { ticker: 'PETR4', dateCom: '2026-08-01', paymentDate: '2026-08-20', dividendType: 'JCP', grossValuePerShare: 0.35, rawProvider: 'statusinvest' },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].paymentDate, '2026-08-20');
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
