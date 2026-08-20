import { round } from '../core/numbers.js';

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

/**
 * Economic attribution date for a distribution used by portfolio performance.
 * Eligibility/Data COM/EX takes precedence over the later cash-payment date.
 */
export function returnDividendPerformanceMillis(event = {}) {
  const eligibility = event.eligibilityDate || event.dateCom || event.dataCom || event.exDate || event.dataEx || '';
  const payment = event.paymentDate || event.dataPagamento || event.payDate || event.datePayment || '';
  return millis(eligibility) || millis(payment);
}

export function dividendsEarnedBetween(events = [], start = 0, end = 0) {
  if (!start || !end) return 0;
  return round((Array.isArray(events) ? events : []).reduce((sum, event) => {
    const performanceMillis = Number(event?.performanceMillis || returnDividendPerformanceMillis(event) || 0);
    return performanceMillis >= start && performanceMillis <= end ? sum + Number(event?.amount || 0) : sum;
  }, 0), 2);
}
