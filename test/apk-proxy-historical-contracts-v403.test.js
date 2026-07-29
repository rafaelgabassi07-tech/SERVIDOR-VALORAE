import test from 'node:test';
import assert from 'node:assert/strict';

import { filterPayloadByAssetClass, mobileAlertDividendSymbols } from '../lib/portfolio/mobile-history-contracts.js';

test('filtro de retorno preserva transação de FII sem posição atual', () => {
  const payload = {
    positions: [{ ticker: 'PETR4', quantity: 10, assetClass: 'ACAO' }],
    transactions: [
      { ticker: 'PETR4', quantity: 10, date: '2025-01-02', side: 'BUY', assetClass: 'ACAO' },
      { ticker: 'HGLG11.SA', quantity: 4, date: '2024-01-02', side: 'BUY', assetClass: 'FII' },
      { ticker: 'HGLG11.SA', quantity: 4, date: '2025-02-03', side: 'SELL', assetClass: 'FII' },
    ],
    dividendEvents: [
      { ticker: 'hglg11.sa', paymentDate: '2025-02-14', assetClass: 'FII', estimatedAmount: 5.2 },
    ],
  };

  const filtered = filterPayloadByAssetClass(payload, 'FIIS');
  assert.deepEqual(filtered.positions, []);
  assert.equal(filtered.transactions.length, 2);
  assert.ok(filtered.transactions.every(row => String(row.ticker).toUpperCase().startsWith('HGLG11')));
  assert.equal(filtered.dividendEvents.length, 1);
});

test('filtro de retorno preserva ação encerrada quando não existe posição atual', () => {
  const payload = {
    positions: [],
    transactions: [
      { ticker: 'VALE3', quantity: 8, date: '2024-01-02', side: 'BUY', assetClass: 'ACAO' },
      { ticker: 'VALE3', quantity: 8, date: '2025-03-10', side: 'SELL', assetClass: 'ACAO' },
    ],
  };

  const filtered = filterPayloadByAssetClass(payload, 'ACOES');
  assert.equal(filtered.transactions.length, 2);
  assert.deepEqual(filtered.positions, []);
});

test('mobile alerts habilita dividendos por ticker histórico sem ampliar símbolos de notícias', () => {
  const dividendSymbols = mobileAlertDividendSymbols(
    [],
    [{ ticker: 'MXRF11.SA', quantity: 100, date: '2025-01-02', side: 'BUY' }],
    []
  );
  assert.deepEqual(dividendSymbols, ['MXRF11']);
});
