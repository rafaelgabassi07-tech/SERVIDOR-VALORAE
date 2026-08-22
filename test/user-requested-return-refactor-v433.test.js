import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeReturnLedgerTransactions,
  returnLedgerBucketsAtBoundary,
  returnLedgerWeightedCashFlows,
  returnLedgerHasUnpricedEconomicTransaction,
  returnLedgerQuantityAtDate,
  returnLedgerInceptionDate,
} from '../lib/portfolio/return-ledger-engine.js';
import { normalizeReturnDividendEvents } from '../lib/portfolio/return-dividends.js';

const end = Date.parse('2026-01-31T23:59:59Z');

test('ledger preserva eventos corporativos sem transformá-los em fluxo externo', () => {
  const rows = normalizeReturnLedgerTransactions([
    { ticker: 'ABCD3', operation: 'Compra', quantity: 10, price: 10, date: '2025-01-10' },
    { ticker: 'ABCD3', operation: 'Desdobramento', quantity: 10, price: 0, date: '2025-03-10' },
    { ticker: 'ABCD3', operation: 'Bonificação', quantity: 2, price: 0, date: '2025-05-10' },
    { ticker: 'ABCD3', operation: 'Grupamento', quantity: 11, price: 0, date: '2025-07-10' },
    { ticker: 'ABCD3', operation: 'Amortização', quantity: 0, grossValue: 20, date: '2025-09-10' },
  ]);
  assert.deepEqual(rows.map(r => r.operationCode), ['BUY','SPLIT','BONUS','REVERSE_SPLIT','AMORTIZATION']);
  const bucket = returnLedgerBucketsAtBoundary(rows, end).get('ABCD3');
  assert.equal(bucket.quantity, 11); // 10 + 10 + 2 - 11
  assert.equal(bucket.costBasis, 80); // compra 100, amortização reduz custo em 20
  const flows = returnLedgerWeightedCashFlows(rows, Date.parse('2025-01-01'), end, {});
  assert.equal(flows.contributions, 100);
  assert.equal(flows.withdrawals, 0);
  assert.equal(returnLedgerHasUnpricedEconomicTransaction(rows, Date.parse('2025-01-01'), end), false);
});

test('compra/venda sem valor econômico falha fechado, evento corporativo sem preço não', () => {
  const rows = normalizeReturnLedgerTransactions([
    { ticker: 'MISS3', operationCode: 'BUY', quantity: 5, price: 0, date: '2026-01-10' },
    { ticker: 'MISS3', operationCode: 'BONUS', quantity: 1, price: 0, date: '2026-01-15' },
  ]);
  assert.equal(returnLedgerHasUnpricedEconomicTransaction(rows, Date.parse('2026-01-01'), end), true);
});

test('ativo encerrado continua no ledger e quantidade histórica respeita a venda', () => {
  const rows = [
    { ticker: 'OLD3', operationCode: 'BUY', quantity: 10, price: 10, date: '2025-01-10' },
    { ticker: 'OLD3', operationCode: 'SELL', quantity: 10, price: 12, date: '2025-06-10' },
  ];
  assert.equal(returnLedgerQuantityAtDate('OLD3', '2025-05-10', [], rows), 10);
  assert.equal(returnLedgerQuantityAtDate('OLD3', '2025-07-10', [], rows), 0);
  assert.equal(returnLedgerInceptionDate([], rows), '2025-01-10');
});

test('provento usa Data COM, não pagamento tardio, e zero opcional não apaga estimativa válida', () => {
  const rows = [{ ticker: 'DIV3', operationCode: 'BUY', quantity: 5, price: 10, date: '2025-01-10' }];
  const events = normalizeReturnDividendEvents([
    {
      ticker: 'DIV3', kind: 'DIVIDENDO', comDate: '2025-03-10', paymentDate: '2025-05-10',
      netAmount: 0, estimatedAmount: 12.5, quantityAtDate: 0,
    }
  ], [], rows);
  assert.equal(events.length, 1);
  assert.equal(events[0].amount, 12.5);
  assert.equal(events[0].performanceMillis, Date.parse('2025-03-10'));
  assert.equal(events[0].paymentMillis, Date.parse('2025-05-10'));
});

test('posição atual sem ledger não cria direito a provento anterior à primeira compra', () => {
  const positions = [{ ticker: 'NEW3', quantity: 10, firstPurchaseDate: '2025-08-01' }];
  assert.equal(returnLedgerQuantityAtDate('NEW3', '2025-07-10', positions, []), 0);
  assert.equal(returnLedgerQuantityAtDate('NEW3', '2025-08-10', positions, []), 10);
});

test('amortização da Agenda prevalece sobre o mesmo caixa do ledger', () => {
  const ledger = [
    { ticker: 'FII11', operationCode: 'BUY', quantity: 10, price: 100, date: '2025-01-10' },
    { ticker: 'FII11', operationCode: 'AMORTIZATION', quantity: 0, grossValue: 50, date: '2025-06-20' },
  ];
  const events = normalizeReturnDividendEvents([
    { ticker: 'FII11', kind: 'AMORTIZAÇÃO', comDate: '2025-05-30', paymentDate: '2025-06-20', netAmount: 50 }
  ], [], ledger);
  assert.equal(events.length, 1);
  assert.equal(events[0].amount, 50);
});
