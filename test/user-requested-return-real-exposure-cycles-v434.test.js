import test from 'node:test';
import assert from 'node:assert/strict';
import {
  returnLedgerBucketsAtBoundary,
  returnLedgerEffectiveTransactions,
  returnLedgerExposureIntervals,
  returnLedgerInceptionDate,
  returnLedgerPeriodHasExposure,
  returnLedgerWeightedCashFlows
} from '../lib/portfolio/return-ledger-engine.js';
import { reconcileReturnOpeningTransactions } from '../lib/portfolio/return-valuation.js';
import { modifiedDietzMonthlyReturnPercent } from '../lib/portfolio/return-calculation.js';

const tx = (ticker, date, side, quantity, price) => ({ ticker, date, side, quantity, price, grossValue: quantity * price });
const sample = [
  tx('ORPH3', '2023-03-02', 'SELL', 1, 4.09),
  tx('AAAA3', '2024-08-26', 'BUY', 10, 10),
  tx('AAAA3', '2024-10-02', 'SELL', 10, 11),
  tx('BBBB3', '2025-09-25', 'BUY', 5, 20)
];

function monthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return [Date.UTC(year, monthNumber - 1, 1), Date.UTC(year, monthNumber, 1) - 1];
}

function monthExposure(month) {
  const [start, end] = monthBounds(month);
  return returnLedgerPeriodHasExposure(sample, start, end);
}

test('venda órfã não cria posição, fluxo de retirada nem exposição', () => {
  const orphan = returnLedgerEffectiveTransactions(sample)[0];
  assert.equal(orphan.ticker, 'ORPH3');
  assert.equal(orphan.effectiveQuantity, 0);
  assert.equal(orphan.effectiveExternalCashFlow, 0);
  assert.equal(orphan.unmatchedQuantity, 1);
  assert.equal(orphan.capitalExposedBefore, false);
  assert.equal(orphan.capitalExposedAfter, false);
});


test('evento corporativo órfão também não materializa exposição histórica', () => {
  const [bonus, split] = returnLedgerEffectiveTransactions([
    { ticker: 'ORPH4', date: '2024-01-10', operation: 'BONIFICAÇÃO', quantity: 3 },
    { ticker: 'ORPH5', date: '2024-01-11', operation: 'DESDOBRAMENTO', quantity: 4 }
  ]);
  for (const event of [bonus, split]) {
    assert.equal(event.effectiveQuantity, 0);
    assert.equal(event.capitalExposedBefore, false);
    assert.equal(event.capitalExposedAfter, false);
    assert.ok(event.unmatchedQuantity > 0);
  }
  const boundary = Date.UTC(2024, 0, 31, 23, 59, 59, 999);
  const buckets = returnLedgerBucketsAtBoundary([
    { ticker: 'ORPH4', date: '2024-01-10', operation: 'BONIFICAÇÃO', quantity: 3 },
    { ticker: 'ORPH5', date: '2024-01-11', operation: 'DESDOBRAMENTO', quantity: 4 }
  ], boundary);
  assert.equal(Number(buckets.get('ORPH4')?.quantity || 0), 0);
  assert.equal(Number(buckets.get('ORPH5')?.quantity || 0), 0);
});

test('ciclos reais preservam zeragem 2024->2025 sem preencher meses vazios', () => {
  assert.deepEqual(returnLedgerExposureIntervals(sample).map(interval => ({
    start: interval.startDate,
    end: interval.endDate
  })), [
    { start: '2024-08-26', end: '2024-10-02' },
    { start: '2025-09-25', end: null }
  ]);

  for (const month of ['2024-01', '2024-07', '2024-11', '2024-12', '2025-01', '2025-08']) {
    assert.equal(monthExposure(month), false, `${month} deve permanecer sem exposição`);
  }
  for (const month of ['2024-08', '2024-09', '2024-10', '2025-09', '2025-10']) {
    assert.equal(monthExposure(month), true, `${month} deve reconhecer exposição real`);
  }
});

test('compra e venda no mesmo dia não deixam posição fantasma quando a exportação lista venda primeiro', () => {
  const sameDayReverseOrder = [
    tx('AAAA3', '2024-08-26', 'BUY', 10, 10),
    // Caso real dos Excel auditados: o arquivo pode listar a venda antes da compra no mesmo dia.
    tx('KLBN11F', '2024-08-27', 'SELL', 1, 21.80),
    tx('KLBN11F', '2024-08-27', 'BUY', 1, 21.94),
    tx('AAAA3', '2024-10-02', 'SELL', 10, 11),
    tx('BBBB3', '2025-09-25', 'BUY', 5, 20)
  ];
  const effective = returnLedgerEffectiveTransactions(sameDayReverseOrder);
  const klbn = effective.filter(item => item.ticker === 'KLBN11');
  assert.equal(klbn.length, 2);
  assert.equal(klbn[0].operationCode, 'BUY', 'entrada do mesmo dia deve ser resolvida antes da saída sem horário');
  assert.equal(klbn[1].operationCode, 'SELL');
  assert.equal(klbn[1].unmatchedQuantity, 0);
  assert.equal(klbn[1].tickerQuantityAfter, 0);
  assert.deepEqual(returnLedgerExposureIntervals(sameDayReverseOrder).map(interval => ({
    start: interval.startDate,
    end: interval.endDate
  })), [
    { start: '2024-08-26', end: '2024-10-02' },
    { start: '2025-09-25', end: null }
  ]);
});

test('posição atual divergente é auditada e nunca retropropagada ao passado', () => {
  const audited = reconcileReturnOpeningTransactions(
    [{ ticker: 'BBBB3', quantity: 8, avgPrice: 20, firstPurchaseDate: '2024-01-01' }],
    sample
  );
  assert.equal(audited.transactions.length, sample.length);
  assert.equal(audited.reconciliations.length, 0);
  assert.equal(audited.historicalBackfillDisabled, true);
  assert.deepEqual(audited.inventoryMismatchTickers, ['BBBB3']);
  assert.equal(audited.inventoryMismatches[0].ledgerQuantity, 5);
  assert.equal(audited.inventoryMismatches[0].currentQuantity, 8);
});

test('início do Retorno segue o ledger quando há transações, não firstPurchaseDate da posição atual', () => {
  assert.equal(
    returnLedgerInceptionDate(
      [{ ticker: 'BBBB3', quantity: 8, firstPurchaseDate: '2024-01-01' }],
      [tx('BBBB3', '2025-09-25', 'BUY', 5, 20)]
    ),
    '2025-09-25'
  );
});


test('startDate explícita anterior ao ledger não materializa meses antes do primeiro aporte', () => {
  assert.equal(
    returnLedgerInceptionDate(
      [{ ticker: 'BBBB3', quantity: 5, firstPurchaseDate: '2024-01-01' }],
      [tx('BBBB3', '2025-09-25', 'BUY', 5, 20)],
      '2024-01-01'
    ),
    '2025-09-25'
  );
});

test('Modified Dietz falha fechado quando só existe retirada sem capital inicial', () => {
  const result = modifiedDietzMonthlyReturnPercent({
    beginningMarketValue: 0,
    endingMarketValue: 0,
    contributions: 0,
    withdrawals: 100,
    weightedNetCashFlow: 0,
    fallbackReturnPercent: Number.NaN
  });
  assert.equal(Number.isNaN(result), true);
});
