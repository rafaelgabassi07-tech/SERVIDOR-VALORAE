import { normalizeTicker } from '../core/tickers.js';
import { normalizeDate, dateMillis } from '../core/dates.js';
import { numberValue, round } from '../core/numbers.js';

const RETURN_CODES = new Set([
  'BUY', 'SELL', 'BONUS', 'SPLIT', 'REVERSE_SPLIT', 'AMORTIZATION',
  'TRANSFER_IN', 'TRANSFER_OUT', 'OTHER'
]);

function normalizedText(value = '') {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function explicitCode(value = '') {
  const raw = String(value || '').trim().toUpperCase().replace(/[ -]+/g, '_');
  if (RETURN_CODES.has(raw)) return raw;
  if (raw === 'REVERSESPLIT') return 'REVERSE_SPLIT';
  if (raw === 'TRANSFERIN') return 'TRANSFER_IN';
  if (raw === 'TRANSFEROUT') return 'TRANSFER_OUT';
  return '';
}

export function classifyReturnOperation(item = {}) {
  const explicit = explicitCode(item.operationCode || item.returnOperationCode || item.code);
  const raw = normalizedText(item.operation || item.type || item.tipo || '');
  // OTHER is not authoritative: older clients often sent OTHER while preserving the
  // human-readable B3 operation. Reclassify it from the economic text/side below.
  if (explicit && explicit !== 'OTHER') return explicit;
  if (/AMORTIZ/.test(raw)) return 'AMORTIZATION';
  if (/GRUPAMENTO|AGRUPAMENTO|INPLIT|REVERSE SPLIT/.test(raw)) return 'REVERSE_SPLIT';
  if (/DESDOBRAMENTO|\bSPLIT\b/.test(raw)) return 'SPLIT';
  if (/BONIFIC/.test(raw)) return 'BONUS';
  if (/TRANSFERENCIA/.test(raw) && /SAIDA|OUT/.test(raw)) return 'TRANSFER_OUT';
  if (/TRANSFERENCIA/.test(raw) && /ENTRADA|IN/.test(raw)) return 'TRANSFER_IN';
  if (/VENDA|SELL|SALE|ALIENACAO/.test(raw)) return 'SELL';
  if (/COMPRA|BUY|APORTE|SUBSCRI/.test(raw)) return 'BUY';
  if (/^SAIDA$|RESGATE/.test(raw)) return 'TRANSFER_OUT';
  if (/^ENTRADA$/.test(raw)) return 'TRANSFER_IN';

  const side = normalizedText(item.side || '');
  if (/SELL|VENDA|SAIDA/.test(side) || item.isSell === true || item.sell === true) return 'SELL';
  if (/BUY|COMPRA|ENTRADA/.test(side) || item.isSell === false || item.sell === false) return 'BUY';
  const rawQuantity = Number(item.quantity ?? item.qty ?? item.shares ?? item.quantidade ?? 0);
  if (Number.isFinite(rawQuantity) && rawQuantity < 0) return 'SELL';
  return explicit || 'OTHER';
}

function quantityDirection(code) {
  if (['BUY', 'TRANSFER_IN', 'BONUS', 'SPLIT'].includes(code)) return 1;
  if (['SELL', 'TRANSFER_OUT', 'REVERSE_SPLIT'].includes(code)) return -1;
  return 0;
}

function externalFlowDirection(code) {
  if (['BUY', 'TRANSFER_IN'].includes(code)) return 1;
  if (['SELL', 'TRANSFER_OUT'].includes(code)) return -1;
  return 0;
}

// B3 spreadsheet exports frequently provide only a calendar date, without execution time.
// When BUY and SELL for the same day arrive in reverse display order, preserving source order
// can manufacture an orphan sale followed by a phantom residual position. At day resolution,
// corporate actions are applied to opening inventory, then entries, then exits. Cash flows keep
// their full multiplicity and the same timestamp, so this only makes inventory matching
// deterministic; it does not collapse trades or move them to another economic day.
function sameDayLedgerPriority(code) {
  if (['BONUS', 'SPLIT', 'REVERSE_SPLIT'].includes(code)) return 0;
  if (['BUY', 'TRANSFER_IN'].includes(code)) return 1;
  if (code === 'AMORTIZATION') return 2;
  if (['SELL', 'TRANSFER_OUT'].includes(code)) return 3;
  return 4;
}

export function normalizeReturnLedgerTransactions(input = []) {
  const list = Array.isArray(input) ? input : [];
  return list.map((item = {}, sourceIndex) => {
    const ticker = normalizeTicker(item.ticker || item.symbol || item.codigo || '');
    const code = classifyReturnOperation(item);
    const rawQuantity = numberValue(item.quantity ?? item.qty ?? item.shares ?? item.quantidade, 0);
    const quantity = Math.abs(rawQuantity);
    const price = numberValue(item.price ?? item.unitPrice ?? item.preco ?? item.precoMedio, 0);
    const grossExplicit = numberValue(item.grossValue ?? item.amount ?? item.total ?? item.valorBruto, 0);
    const grossValue = grossExplicit > 0 ? grossExplicit : (quantity > 0 && price > 0 ? quantity * price : 0);
    const rawMillis = Number(item.dateMillis || item.timestampMillis || item.timeMillis || 0);
    const millisFromRaw = Number.isFinite(rawMillis) && rawMillis > 0 ? (rawMillis > 10_000_000_000 ? rawMillis : rawMillis * 1000) : 0;
    const date = normalizeDate(item.date || item.executedAt || item.createdAt || item.data) ||
      (millisFromRaw ? new Date(millisFromRaw).toISOString().slice(0, 10) : '');
    const millis = dateMillis(date) || millisFromRaw;
    const quantityDelta = quantity * quantityDirection(code);
    const flowDirection = externalFlowDirection(code);
    const externalCashFlow = grossValue * flowDirection;
    const requiresEconomicPrice = ['BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT'].includes(code);
    return {
      ...item,
      ticker,
      operationCode: code,
      quantity,
      quantityDelta,
      price: Number.isFinite(price) && price > 0 ? price : 0,
      grossValue: Number.isFinite(grossValue) && grossValue > 0 ? grossValue : 0,
      date,
      millis,
      externalCashFlow,
      requiresEconomicPrice,
      sourceIndex
    };
  }).filter(tx => {
    if (!tx.ticker || !tx.millis) return false;
    if (tx.operationCode === 'AMORTIZATION') return tx.grossValue > 0;
    if (['BONUS', 'SPLIT', 'REVERSE_SPLIT'].includes(tx.operationCode)) return tx.quantity > 0;
    if (['BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT'].includes(tx.operationCode)) return tx.quantity > 0;
    return false;
  }).sort((a, b) =>
    a.millis - b.millis ||
    sameDayLedgerPriority(a.operationCode) - sameDayLedgerPriority(b.operationCode) ||
    a.sourceIndex - b.sourceIndex
  );
}

export function returnLedgerInceptionDate(positions = [], transactions = [], explicitDate = '') {
  const explicit = normalizeDate(explicitDate);
  const ledgerEntries = normalizeReturnLedgerTransactions(transactions)
    .filter(tx => ['BUY', 'TRANSFER_IN'].includes(tx.operationCode) && tx.date)
    .map(tx => tx.date)
    .sort();

  // When an economic ledger exists it is the authoritative clock for Return. A current
  // position's firstPurchaseDate must never pull the historical window backwards across a
  // liquidation/re-entry gap or materialize exposure that is not present in the transactions.
  if (ledgerEntries.length) {
    // A caller-provided startDate is only a requested window hint. Once an economic ledger
    // exists, allowing that hint to predate the first real entry can resurrect empty months
    // before the portfolio actually had capital at risk. The ledger is the sole inception clock.
    return ledgerEntries[0];
  }

  const positionDates = (Array.isArray(positions) ? positions : [])
    .map(position => normalizeDate(position?.firstPurchaseDate || position?.purchaseDate || position?.date))
    .filter(Boolean)
    .sort();
  return explicit || positionDates[0] || '';
}


/**
 * Applies the transaction ledger without allowing inventory to become negative.
 *
 * Only the quantity that was actually available may generate a SELL/TRANSFER_OUT cash flow.
 * This is essential for imported histories that begin with an orphan sale: the unmatched
 * quantity is diagnostic data, not evidence that the portfolio had capital at risk.
 */
export function returnLedgerEffectiveTransactions(transactions = []) {
  const ordered = normalizeReturnLedgerTransactions(transactions);
  const quantities = new Map();
  let portfolioQuantity = 0;

  return ordered.map(tx => {
    const beforeTicker = Math.max(0, Number(quantities.get(tx.ticker) || 0));
    const beforePortfolio = Math.max(0, portfolioQuantity);
    let afterTicker = beforeTicker;
    let effectiveQuantity = 0;
    let unmatchedQuantity = 0;
    let effectiveGrossValue = 0;
    let effectiveExternalCashFlow = 0;

    switch (tx.operationCode) {
      case 'BUY':
      case 'TRANSFER_IN':
        effectiveQuantity = tx.quantity;
        afterTicker = beforeTicker + effectiveQuantity;
        effectiveGrossValue = tx.grossValue;
        effectiveExternalCashFlow = effectiveGrossValue;
        break;
      case 'BONUS':
      case 'SPLIT':
        // Corporate actions require a pre-existing entitlement. If the imported ledger begins
        // with a bonus/split while the ticker inventory is zero, history is incomplete; do not
        // conjure exposure from that event.
        if (beforeTicker > 0.00000001) {
          effectiveQuantity = tx.quantity;
          afterTicker = beforeTicker + effectiveQuantity;
        } else {
          unmatchedQuantity = tx.quantity;
        }
        break;
      case 'SELL':
      case 'TRANSFER_OUT': {
        effectiveQuantity = Math.min(tx.quantity, beforeTicker);
        unmatchedQuantity = Math.max(0, tx.quantity - effectiveQuantity);
        afterTicker = Math.max(0, beforeTicker - effectiveQuantity);
        const matchedRatio = tx.quantity > 0 ? effectiveQuantity / tx.quantity : 0;
        effectiveGrossValue = tx.grossValue > 0 ? tx.grossValue * matchedRatio : 0;
        effectiveExternalCashFlow = -effectiveGrossValue;
        break;
      }
      case 'REVERSE_SPLIT':
        effectiveQuantity = Math.min(tx.quantity, beforeTicker);
        unmatchedQuantity = Math.max(0, tx.quantity - effectiveQuantity);
        afterTicker = Math.max(0, beforeTicker - effectiveQuantity);
        break;
      case 'AMORTIZATION':
      default:
        break;
    }

    quantities.set(tx.ticker, afterTicker);
    portfolioQuantity = Math.max(0, beforePortfolio - beforeTicker + afterTicker);
    const afterPortfolio = portfolioQuantity;
    return {
      ...tx,
      effectiveQuantity: round(effectiveQuantity, 8),
      unmatchedQuantity: round(unmatchedQuantity, 8),
      effectiveGrossValue: round(effectiveGrossValue, 2),
      effectiveExternalCashFlow: Math.abs(effectiveExternalCashFlow) < 0.00000001 ? 0 : round(effectiveExternalCashFlow, 2),
      tickerQuantityBefore: round(beforeTicker, 8),
      tickerQuantityAfter: round(afterTicker, 8),
      portfolioQuantityBefore: round(beforePortfolio, 8),
      portfolioQuantityAfter: round(afterPortfolio, 8),
      capitalExposedBefore: beforePortfolio > 0.00000001,
      capitalExposedAfter: afterPortfolio > 0.00000001
    };
  });
}


export function returnLedgerExposureIntervals(transactions = []) {
  const effective = returnLedgerEffectiveTransactions(transactions);
  const intervals = [];
  let open = null;
  for (const tx of effective) {
    if (!tx.capitalExposedBefore && tx.capitalExposedAfter) {
      open = {
        startMillis: tx.millis,
        startDate: tx.date,
        endMillis: null,
        endDate: null
      };
      continue;
    }
    if (tx.capitalExposedBefore && !tx.capitalExposedAfter && open) {
      intervals.push({
        ...open,
        endMillis: tx.millis,
        endDate: tx.date
      });
      open = null;
    }
  }
  if (open) intervals.push(open);
  return intervals.map((interval, index) => ({
    id: index + 1,
    ...interval
  }));
}

export function returnLedgerPeriodHasExposure(transactions = [], periodStart = 0, periodEnd = 0) {
  const start = Number(periodStart || 0);
  const end = Number(periodEnd || 0);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return false;
  return returnLedgerExposureIntervals(transactions).some(interval => {
    const intervalEnd = Number(interval.endMillis || Number.POSITIVE_INFINITY);
    return Number(interval.startMillis || 0) <= end && intervalEnd >= start;
  });
}

export function returnLedgerBucketsAtBoundary(transactions = [], boundary = 0) {
  const buckets = new Map();
  const ordered = normalizeReturnLedgerTransactions(transactions).filter(tx => tx.millis <= Number(boundary || 0));
  for (const tx of ordered) {
    const bucket = buckets.get(tx.ticker) || { quantity: 0, costBasis: 0 };
    const quantity = Number(tx.quantity || 0);
    const gross = Number(tx.grossValue || 0);
    switch (tx.operationCode) {
      case 'BUY':
      case 'TRANSFER_IN':
        bucket.quantity += quantity;
        if (gross > 0) bucket.costBasis += gross;
        break;
      case 'BONUS':
      case 'SPLIT':
        if (bucket.quantity > 0.00000001) bucket.quantity += quantity;
        break;
      case 'SELL':
      case 'TRANSFER_OUT': {
        const removable = Math.min(quantity, Math.max(0, bucket.quantity));
        if (bucket.quantity > 0) {
          const avg = bucket.costBasis / bucket.quantity;
          bucket.costBasis = Math.max(0, bucket.costBasis - avg * removable);
        }
        bucket.quantity = Math.max(0, bucket.quantity - removable);
        break;
      }
      case 'REVERSE_SPLIT':
        bucket.quantity = Math.max(0, bucket.quantity - Math.min(quantity, Math.max(0, bucket.quantity)));
        break;
      case 'AMORTIZATION':
        bucket.costBasis = Math.max(0, bucket.costBasis - gross);
        break;
      default:
        break;
    }
    if (bucket.quantity <= 0.00000001) {
      bucket.quantity = 0;
      if (['SELL', 'TRANSFER_OUT'].includes(tx.operationCode)) bucket.costBasis = 0;
    }
    buckets.set(tx.ticker, bucket);
  }
  return buckets;
}

export function returnLedgerQuantityAtDate(ticker, targetDate, positions = [], transactions = []) {
  const clean = normalizeTicker(ticker);
  const target = dateMillis(targetDate);
  if (!clean || !target) return 0;
  const ledger = normalizeReturnLedgerTransactions(transactions).filter(tx => tx.ticker === clean);
  if (ledger.length) {
    const buckets = returnLedgerBucketsAtBoundary(ledger, target);
    return Math.max(0, round(Number(buckets.get(clean)?.quantity || 0), 8));
  }
  const position = (Array.isArray(positions) ? positions : []).find(p => normalizeTicker(p?.ticker || p?.symbol) === clean);
  if (!position) return 0;
  const firstPurchase = dateMillis(position.firstPurchaseDate || position.purchaseDate || position.date);
  if (firstPurchase && firstPurchase > target) return 0;
  // A current position without a historical origin is not evidence of past entitlement.
  if (!firstPurchase) return 0;
  return Math.max(0, round(numberValue(position.quantity ?? position.qty, 0), 8));
}

export function returnLedgerWeightedCashFlows(
  transactions = [], periodStart = 0, periodEnd = 0,
  { beginningHasCapital = false, endingHasCapital = false } = {}
) {
  const start = Number(periodStart || 0);
  const end = Number(periodEnd || 0);
  const monthTransactions = returnLedgerEffectiveTransactions(transactions)
    .filter(tx => tx.millis >= start && tx.millis <= end);
  const capitalTransactions = monthTransactions.filter(tx => tx.effectiveExternalCashFlow !== 0);
  const firstExposure = monthTransactions.find(tx => !tx.capitalExposedBefore && tx.capitalExposedAfter)?.millis;
  const lastExposureEnd = [...monthTransactions].reverse()
    .find(tx => tx.capitalExposedBefore && !tx.capitalExposedAfter)?.millis;
  const firstContribution = capitalTransactions.find(tx => tx.effectiveExternalCashFlow > 0)?.millis;
  const lastCapitalTransaction = capitalTransactions.at(-1)?.millis;
  const hadCapitalExposure = Boolean(
    beginningHasCapital ||
    endingHasCapital ||
    monthTransactions.some(tx => tx.capitalExposedBefore || tx.capitalExposedAfter)
  );
  const exposureStart = beginningHasCapital ? start : Number(firstExposure || firstContribution || start);
  const exposureEnd = endingHasCapital ? end : Number(lastExposureEnd || lastCapitalTransaction || end);
  const safeStart = Math.max(start, Math.min(end, exposureStart));
  const safeEnd = Math.max(safeStart, Math.min(end, exposureEnd));
  const duration = Math.max(1, safeEnd - safeStart);
  let contributions = 0;
  let withdrawals = 0;
  let weightedNetCashFlow = 0;

  for (const tx of capitalTransactions) {
    const amount = Math.abs(Number(tx.effectiveExternalCashFlow || 0));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const isContribution = tx.effectiveExternalCashFlow > 0;
    if (isContribution) contributions += amount; else withdrawals += amount;
    const clamped = Math.max(safeStart, Math.min(safeEnd, tx.millis));
    const weight = Math.max(0, Math.min(1, (safeEnd - clamped) / duration));
    weightedNetCashFlow += (isContribution ? amount : -amount) * weight;
  }

  const unmatchedTransactions = monthTransactions.filter(tx => tx.unmatchedQuantity > 0.00000001);
  return {
    contributions: round(contributions, 2),
    withdrawals: round(withdrawals, 2),
    netFlow: round(contributions - withdrawals, 2),
    weightedNetCashFlow: round(weightedNetCashFlow, 2),
    exposureStart: safeStart,
    exposureEnd: safeEnd,
    hadCapitalExposure,
    unmatchedTransactionCount: unmatchedTransactions.length,
    unmatchedQuantity: round(unmatchedTransactions.reduce((sum, tx) => sum + tx.unmatchedQuantity, 0), 8)
  };
}

export function returnLedgerHasUnpricedEconomicTransaction(transactions = [], start = 0, end = 0) {
  return returnLedgerEffectiveTransactions(transactions).some(tx =>
    tx.millis >= Number(start || 0) && tx.millis <= Number(end || 0) &&
    tx.requiresEconomicPrice && tx.effectiveQuantity > 0.00000001 &&
    !(tx.effectiveGrossValue > 0)
  );
}

export function returnLedgerAmortizations(transactions = []) {
  return normalizeReturnLedgerTransactions(transactions)
    .filter(tx => tx.operationCode === 'AMORTIZATION' && tx.grossValue > 0)
    .map(tx => ({ ticker: tx.ticker, paymentMillis: tx.millis, performanceMillis: tx.millis, amount: round(tx.grossValue, 2), kind: 'AMORTIZATION', ledger: true }));
}
