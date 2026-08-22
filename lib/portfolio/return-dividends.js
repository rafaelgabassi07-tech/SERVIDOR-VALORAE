import { round } from '../core/numbers.js';
import { normalizeTicker } from '../core/tickers.js';
import { returnLedgerAmortizations, returnLedgerQuantityAtDate } from './return-ledger-engine.js';

function millis(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n > 10_000_000_000 ? n : n * 1000;
  }
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function firstPositive(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}

/** Economic attribution date for a distribution used by portfolio performance. */
export function returnDividendPerformanceMillis(event = {}) {
  const eligibility = event.eligibilityDate || event.comDate || event.dateCom || event.dataCom ||
    event.inferredComDate || event.exDate || event.dataEx || '';
  const payment = event.paymentDate || event.dataPagamento || event.payDate || event.datePayment || '';
  return millis(eligibility) || millis(payment);
}

/**
 * Canonical Return-only dividend normalization.
 * Data COM/EX owns economic attribution; payment date owns cash receipt. Zero-valued optional
 * fields never shadow a later valid amount, and quantity is reconstructed from the Return ledger.
 */
export function normalizeReturnDividendEvents(rawEvents = [], positions = [], transactions = []) {
  const list = Array.isArray(rawEvents) ? rawEvents : [];
  const normalized = list.map((event = {}) => {
    if (event.eligible === false) return null;
    const ticker = normalizeTicker(event.ticker || event.symbol || event.codigo || '');
    if (!ticker) return null;
    const performanceMillis = returnDividendPerformanceMillis(event);
    const paymentMillis = millis(event.paymentDate || event.dataPagamento || event.payDate || event.datePayment) || performanceMillis;
    if (!performanceMillis || !paymentMillis) return null;
    const eligibilityDate = event.eligibilityDate || event.comDate || event.dateCom || event.dataCom ||
      event.inferredComDate || event.exDate || event.dataEx || event.paymentDate || event.datePayment || '';
    const explicitQuantity = firstPositive(event.quantityAtDate, event.eligibilityQuantity, event.quantity, event.quantidade);
    const quantity = explicitQuantity || returnLedgerQuantityAtDate(ticker, eligibilityDate, positions, transactions);
    const perShare = firstPositive(
      event.netValuePerShare, event.valuePerShare, event.valorLiquidoPorAcao,
      event.valorPorAcao, event.grossValuePerShare, event.value
    );
    const amount = firstPositive(
      event.netAmount, event.estimatedAmount, event.grossAmount,
      event.amountTotal, event.valorLiquidoTotal, event.valorBrutoTotal, event.total,
      quantity > 0 && perShare > 0 ? quantity * perShare : 0
    );
    if (!(amount > 0)) return null;
    const kind = String(event.kind || event.dividendType || event.type || 'PROVENTO').trim().toUpperCase();
    return {
      ticker,
      paymentMillis,
      performanceMillis,
      eligibilityMillis: millis(eligibilityDate),
      amount: round(amount, 2),
      kind,
      source: event.source || event.rawProvider || ''
    };
  }).filter(Boolean).sort((a, b) => a.paymentMillis - b.paymentMillis || a.ticker.localeCompare(b.ticker));

  const unique = new Map();
  for (const event of normalized) {
    const key = `${event.ticker}|${event.performanceMillis}|${event.paymentMillis}|${event.kind}|${event.amount}`;
    if (!unique.has(key)) unique.set(key, event);
  }
  const agendaEvents = [...unique.values()];

  // Amortization can exist both in B3 transaction history (payment date) and Agenda
  // (COM/EX + payment). Prefer the richer Agenda event and only materialize ledger cash
  // when there is no economically matching event.
  const ledgerAmortizations = returnLedgerAmortizations(transactions).filter(ledger => {
    return !agendaEvents.some(event => {
      if (event.ticker !== ledger.ticker) return false;
      if (!/AMORTIZ/.test(event.kind)) return false;
      if (Math.abs(Number(event.amount) - Number(ledger.amount)) > 0.02) return false;
      return event.paymentMillis === ledger.paymentMillis ||
        event.performanceMillis === ledger.paymentMillis ||
        Math.abs(event.paymentMillis - ledger.paymentMillis) <= 45 * 24 * 60 * 60 * 1000;
    });
  });
  return [...agendaEvents, ...ledgerAmortizations]
    .sort((a, b) => a.paymentMillis - b.paymentMillis || a.ticker.localeCompare(b.ticker));
}

export function dividendsEarnedBetween(events = [], start = 0, end = 0) {
  if (!start || !end) return 0;
  return round((Array.isArray(events) ? events : []).reduce((sum, event) => {
    const performanceMillis = Number(event?.performanceMillis || returnDividendPerformanceMillis(event) || 0);
    return performanceMillis >= start && performanceMillis <= end ? sum + Number(event?.amount || 0) : sum;
  }, 0), 2);
}
