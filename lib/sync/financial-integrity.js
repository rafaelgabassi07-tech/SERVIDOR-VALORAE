import crypto from 'node:crypto';
import { normalizeTicker } from '../core/tickers.js';

export const CLIENT_TX_ID_MAX = 96;
export const TRANSACTION_PAGE_LIMIT_MAX = 500;

function text(value) {
  return String(value ?? '').trim();
}

export function foldOperation(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export const OperationCode = Object.freeze({
  BUY: 'BUY',
  SELL: 'SELL',
  BONUS: 'BONUS',
  SPLIT: 'SPLIT',
  REVERSE_SPLIT: 'REVERSE_SPLIT',
  AMORTIZATION: 'AMORTIZATION',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT',
  OTHER: 'OTHER',
});

export function classifyCorporateOperation(value, { isSell = false, quantity = 0 } = {}) {
  const raw = foldOperation(value);
  let code = OperationCode.OTHER;
  if (/^(VENDA|SELL|SALE|V)$/.test(raw) || raw.includes('ALIENACAO')) code = OperationCode.SELL;
  else if (raw.includes('TRANSFERENCIA') && /(SAIDA|OUT)/.test(raw)) code = OperationCode.TRANSFER_OUT;
  else if (raw.includes('TRANSFERENCIA') && /(ENTRADA|IN)/.test(raw)) code = OperationCode.TRANSFER_IN;
  else if (raw.includes('AMORTIZ')) code = OperationCode.AMORTIZATION;
  else if (raw.includes('GRUPAMENTO') || raw.includes('INPLIT') || raw.includes('REVERSE SPLIT')) code = OperationCode.REVERSE_SPLIT;
  else if (raw.includes('DESDOBRAMENTO') || raw.includes('SPLIT')) code = OperationCode.SPLIT;
  else if (raw.includes('BONIFIC')) code = OperationCode.BONUS;
  else if (/^(COMPRA|BUY|C|APORTE)$/.test(raw) || raw.includes('SUBSCRI')) code = OperationCode.BUY;
  else if (/^(SAIDA|RESGATE)$/.test(raw)) code = OperationCode.TRANSFER_OUT;
  else if (/^(ENTRADA)$/.test(raw)) code = OperationCode.TRANSFER_IN;
  else if (isSell || Number(quantity) < 0) code = OperationCode.SELL;

  const quantityEffect = code === OperationCode.BUY || code === OperationCode.BONUS || code === OperationCode.SPLIT || code === OperationCode.TRANSFER_IN
    ? 1
    : code === OperationCode.SELL || code === OperationCode.REVERSE_SPLIT || code === OperationCode.TRANSFER_OUT
      ? -1
      : 0;
  const costEffect = code === OperationCode.BUY || code === OperationCode.TRANSFER_IN
    ? 'ADD_GROSS'
    : code === OperationCode.SELL || code === OperationCode.TRANSFER_OUT
      ? 'REMOVE_PROPORTIONAL'
      : code === OperationCode.AMORTIZATION
        ? 'REDUCE_GROSS'
        : code === OperationCode.REVERSE_SPLIT || code === OperationCode.BONUS || code === OperationCode.SPLIT
          ? 'PRESERVE_TOTAL'
          : 'NONE';
  return {
    code,
    raw,
    quantityEffect,
    costEffect,
    reducesPosition: quantityEffect < 0,
    increasesPosition: quantityEffect > 0,
  };
}

export function applyOperationToPosition(position = {}, transaction = {}) {
  let quantity = Math.max(0, Number(position.quantity) || 0);
  let cost = Math.max(0, Number(position.cost) || 0);
  const rawQuantity = Math.abs(Number(transaction.quantity) || 0);
  const gross = Math.max(0, Number(transaction.grossValue ?? transaction.gross_value) || 0);
  const price = Math.max(0, Number(transaction.price ?? transaction.purchasePrice ?? transaction.purchase_price) || 0);
  const amount = gross > 0 ? gross : rawQuantity * price;
  const operation = classifyCorporateOperation(
    transaction.operation ?? transaction.side ?? transaction.type ?? transaction.tipo,
    { isSell: Boolean(transaction.isSell ?? transaction.is_sell), quantity: Number(transaction.quantity) || 0 },
  );

  if (operation.quantityEffect > 0) {
    quantity += rawQuantity;
    if (operation.costEffect === 'ADD_GROSS') cost += amount;
  } else if (operation.quantityEffect < 0) {
    const removable = Math.min(quantity, rawQuantity);
    if (operation.costEffect === 'REMOVE_PROPORTIONAL' && quantity > 0) {
      cost = Math.max(0, cost - (cost / quantity) * removable);
    }
    quantity = Math.max(0, quantity - removable);
    if (quantity <= 1e-8) {
      quantity = 0;
      cost = 0;
    }
  } else if (operation.costEffect === 'REDUCE_GROSS') {
    cost = Math.max(0, cost - amount);
  }

  return {
    quantity: Number(quantity.toFixed(8)),
    cost: Number(cost.toFixed(8)),
    operation,
  };
}

export function normalizeClientTxId(value, fallbackSeed = '') {
  const raw = (text(value).replace(/[^A-Za-z0-9:_-]/g, '') || `valorae-${crypto.createHash('sha256').update(text(fallbackSeed)).digest('hex')}`);
  if (raw.length <= CLIENT_TX_ID_MAX) return raw;
  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
  const prefixLength = CLIENT_TX_ID_MAX - hash.length - 1;
  return `${raw.slice(0, prefixLength)}-${hash}`;
}

export function stableDividendEventKey(userId, event = {}) {
  const ticker = normalizeTicker(text(event.ticker || event.symbol));
  const type = foldOperation(event.type || event.eventType || event.event_type || event.kind || event.category || 'DIVIDEND');
  const sourceId = text(event.sourceId || event.source_id || event.externalId || event.external_id || event.id);
  const dateBase = text(event.dateCom || event.date_com || event.exDate || event.ex_date || event.dateEx);
  const paymentDate = text(event.paymentDate || event.payment_date);
  const source = foldOperation(event.source || event.provider || 'VALORAE');
  const raw = [text(userId), ticker, type, dateBase, paymentDate, sourceId || source].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function cursorSecret(secret = '') {
  const resolved = text(secret);
  if (!resolved) throw Object.assign(new Error('Segredo de cursor de sincronização não configurado.'), { code: 'SYNC_CURSOR_SECRET_MISSING', status: 503 });
  return resolved;
}

export function encodeRevisionCursor(payload, secret) {
  const normalized = {
    v: 1,
    offset: Math.max(0, Number(payload.offset) || 0),
    revision: Math.max(0, Number(payload.revision) || 0),
    deletionGeneration: Math.max(0, Number(payload.deletionGeneration) || 0),
    tombstone: Boolean(payload.tombstone),
    issuedAt: Number(payload.issuedAt) || Date.now(),
  };
  const body = Buffer.from(JSON.stringify(normalized)).toString('base64url');
  const signature = crypto.createHmac('sha256', cursorSecret(secret)).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function decodeRevisionCursor(token, secret) {
  const [body, signature, extra] = text(token).split('.');
  if (!body || !signature || extra) throw Object.assign(new Error('Cursor de sincronização inválido.'), { code: 'SYNC_CURSOR_INVALID', status: 400 });
  const expected = crypto.createHmac('sha256', cursorSecret(secret)).update(body).digest();
  let actual;
  try { actual = Buffer.from(signature, 'base64url'); } catch { actual = Buffer.alloc(0); }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw Object.assign(new Error('Cursor de sincronização adulterado ou expirado.'), { code: 'SYNC_CURSOR_INVALID', status: 400 });
  }
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { payload = null; }
  if (!payload || payload.v !== 1 || !Number.isInteger(payload.offset) || payload.offset < 0) {
    throw Object.assign(new Error('Cursor de sincronização incompatível.'), { code: 'SYNC_CURSOR_INVALID', status: 400 });
  }
  return payload;
}

export function assertCursorMatchesState(cursor, state) {
  if (!cursor) return;
  const revision = Math.max(0, Number(state.revision) || 0);
  const deletionGeneration = Math.max(0, Number(state.deletion_generation ?? state.deletionGeneration) || 0);
  const tombstone = Boolean(state.tombstone);
  if (cursor.revision !== revision || cursor.deletionGeneration !== deletionGeneration || cursor.tombstone !== tombstone) {
    throw Object.assign(new Error('A carteira mudou durante a paginação. Reinicie a sincronização pela primeira página.'), {
      code: 'SYNC_CURSOR_STALE',
      status: 409,
      details: { expected: { revision, deletionGeneration, tombstone }, cursor },
    });
  }
}
