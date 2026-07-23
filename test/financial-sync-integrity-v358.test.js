import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  OperationCode,
  applyOperationToPosition,
  assertCursorMatchesState,
  classifyCorporateOperation,
  decodeRevisionCursor,
  encodeRevisionCursor,
  normalizeClientTxId,
  stableDividendEventKey,
} from '../lib/sync/financial-integrity.js';

const amortization = classifyCorporateOperation('AMORTIZAÇÃO');
assert.equal(amortization.code, OperationCode.AMORTIZATION);
assert.equal(amortization.quantityEffect, 0);
assert.equal(amortization.costEffect, 'REDUCE_GROSS');
assert.equal(amortization.reducesPosition, false);

assert.equal(classifyCorporateOperation('TRANSFERÊNCIA SAÍDA').code, OperationCode.TRANSFER_OUT);
assert.equal(classifyCorporateOperation('TRANSFERÊNCIA ENTRADA').code, OperationCode.TRANSFER_IN);
assert.equal(classifyCorporateOperation('GRUPAMENTO').code, OperationCode.REVERSE_SPLIT);
assert.equal(classifyCorporateOperation('DESDOBRAMENTO').code, OperationCode.SPLIT);
assert.equal(classifyCorporateOperation('BONIFICAÇÃO').code, OperationCode.BONUS);

assert.deepEqual(
  applyOperationToPosition({ quantity: 100, cost: 1000 }, { operation: 'AMORTIZAÇÃO', quantity: 0, grossValue: 125 }),
  { quantity: 100, cost: 875, operation: amortization },
  'amortização devolve capital sem remover cotas',
);
const grouped = applyOperationToPosition({ quantity: 100, cost: 1000 }, { operation: 'GRUPAMENTO', quantity: 90 });
assert.equal(grouped.quantity, 10);
assert.equal(grouped.cost, 1000, 'grupamento preserva custo total');
const transferOut = applyOperationToPosition({ quantity: 100, cost: 1000 }, { operation: 'TRANSFERÊNCIA SAÍDA', quantity: 10 });
assert.equal(transferOut.quantity, 90);
assert.equal(transferOut.cost, 900);

const longId = `LEGACY:${'a'.repeat(220)}:END`;
const normalizedId = normalizeClientTxId(longId);
assert.equal(normalizedId.length, 96);
assert.match(normalizedId, /^[A-Za-z0-9:_-]+$/);
assert.equal(normalizeClientTxId(longId), normalizedId, 'normalização deve ser determinística');
assert.notEqual(normalizeClientTxId(`${longId}2`), normalizedId, 'IDs econômicos diferentes não podem colapsar por simples truncamento');

const baseDividend = {
  ticker: 'B3:MXRF11.SA',
  type: 'Rendimento',
  dateCom: '2026-07-10',
  paymentDate: '2026-07-25',
  sourceId: 'evt-123',
  source: 'B3',
  status: 'previsto',
  valuePerShare: 0.1,
};
const updatedDividend = { ...baseDividend, status: 'pago', valuePerShare: 0.12, estimatedAmount: 12 };
assert.equal(
  stableDividendEventKey('user-1', baseDividend),
  stableDividendEventKey('user-1', updatedDividend),
  'status e valor mutáveis não participam da identidade permanente do provento',
);

const secret = 'test-secret-that-is-not-used-in-production';
const state = { revision: 8, deletionGeneration: 3, tombstone: true };
const token = encodeRevisionCursor({ offset: 500, ...state }, secret);
const cursor = decodeRevisionCursor(token, secret);
assert.equal(cursor.offset, 500);
assert.doesNotThrow(() => assertCursorMatchesState(cursor, state));
assert.throws(() => assertCursorMatchesState(cursor, { ...state, revision: 9 }), /mudou durante a paginação/i);
const [cursorBody, cursorSignature] = token.split('.');
const tamperedBody = `${cursorBody[0] === 'A' ? 'B' : 'A'}${cursorBody.slice(1)}`;
assert.throws(() => decodeRevisionCursor(`${tamperedBody}.${cursorSignature}`, secret), /adulterado|inválido/i);

const syncRoute = fs.readFileSync(path.join(process.cwd(), 'routes/sync.js'), 'utf8');
assert.match(syncRoute, /SYNC_PAYLOAD_TOO_LARGE/);
assert.match(syncRoute, /INVALID_JSON_BODY/);
assert.match(syncRoute, /REGISTER_AUTH_REQUIRED/);
assert.match(syncRoute, /SYNC_USER_MISMATCH/);
assert.match(syncRoute, /decodeRevisionCursor/);
assert.match(syncRoute, /assertCursorMatchesState/);
assert.match(syncRoute, /valorae_sync_replace_transactions/);
assert.match(syncRoute, /valorae_sync_delete_user_data/);
assert.doesNotMatch(syncRoute, /['"]upsert_sync_backup['"]/, 'backup manual não pode contornar revisão/tombstone');
assert.doesNotMatch(syncRoute, /function\s+postTransactionRows\b/, 'fallback REST de transações deve permanecer removido');
assert.doesNotMatch(syncRoute, /function\s+postSnapshotRows\b/, 'fallback REST de snapshots deve permanecer removido');
assert.doesNotMatch(syncRoute, /function\s+mirrorSyncBackup\b/, 'backup deve ser gravado dentro da RPC transacional');

console.log('financial-sync-integrity-v358 ok');
