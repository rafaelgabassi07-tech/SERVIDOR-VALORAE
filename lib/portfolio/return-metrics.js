import { round } from '../core/numbers.js';

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function compoundMonthlyReturns(values = [], months = null) {
  const clean = (Array.isArray(values) ? values : [])
    .map(value => finiteNumber(typeof value === 'object' ? value?.monthlyReturnPercent ?? value?.monthlyPercent : value))
    .filter(value => value !== null && value >= -100 && value < 10000);
  const selected = months == null ? clean : clean.slice(-Math.max(1, Number(months) || 1));
  if (!selected.length) return 0;
  let factor = 1;
  for (const value of selected) factor *= 1 + value / 100;
  return round((factor - 1) * 100, 4);
}

/**
 * Returns at most `months` visible rows. When a previous closing exists it is used
 * strictly as the baseline and omitted from the result, preventing the first visible
 * month from being zeroed and avoiding the historical 11-month result in a 12M view.
 */
export function buildDisplayPortfolioRows(points = [], months = 12) {
  const clean = [...(Array.isArray(points) ? points : [])]
    .filter(point => point && String(point.month || ''))
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  if (!clean.length) return [];
  const visibleMonths = Math.max(1, Number(months) || 1);
  const window = clean.slice(-Math.min(clean.length, visibleMonths + 1));
  if (window.length > visibleMonths) {
    const baseline = window[0];
    const base = finiteNumber(baseline.portfolioReturnPercent) ?? 0;
    const denominator = 1 + base / 100;
    return window.slice(1).map(point => ({
      ...point,
      portfolioReturnPercent: Math.abs(denominator) < 0.000001
        ? compoundMonthlyReturns(window.slice(1, window.indexOf(point) + 2))
        : round(((1 + (finiteNumber(point.portfolioReturnPercent) ?? 0) / 100) / denominator - 1) * 100, 4)
    }));
  }

  let factor = 1;
  return window.map(point => {
    const monthly = finiteNumber(point.monthlyReturnPercent) ?? 0;
    factor *= 1 + monthly / 100;
    return { ...point, portfolioReturnPercent: round((factor - 1) * 100, 4) };
  });
}

export function benchmarkAccumulatedMonthMap(points = [], valueField = 'accumulatedPercent', baseMonth = '') {
  const ordered = (Array.isArray(points) ? points : [])
    .map(point => ({
      month: String(point?.month || String(point?.date || '').slice(0, 7)),
      value: finiteNumber(point?.[valueField] ?? point?.returnPercent ?? point?.value)
    }))
    .filter(point => /^\d{4}-\d{2}$/.test(point.month) && point.value !== null)
    .sort((a, b) => a.month.localeCompare(b.month));
  const result = new Map();
  if (!ordered.length) return result;
  const startIndex = baseMonth ? ordered.findIndex(point => point.month >= baseMonth) : 0;
  if (startIndex < 0) return result;
  const base = startIndex > 0 ? ordered[startIndex - 1].value : 0;
  const denominator = 1 + base / 100;
  for (let index = startIndex; index < ordered.length; index += 1) {
    const point = ordered[index];
    const accumulated = Math.abs(denominator) < 0.000001
      ? point.value
      : ((1 + point.value / 100) / denominator - 1) * 100;
    result.set(point.month, round(accumulated, 4));
  }
  return result;
}

export function accumulatedReturnForMonths(points = [], months = 12) {
  const clean = (Array.isArray(points) ? points : [])
    .map(point => ({
      month: String(point?.month || String(point?.date || '').slice(0, 7)),
      monthly: finiteNumber(point?.monthlyPercent ?? point?.monthlyReturnPercent),
      accumulated: finiteNumber(point?.accumulatedPercent ?? point?.returnPercent ?? point?.value)
    }))
    .filter(point => /^\d{4}-\d{2}$/.test(point.month))
    .sort((a, b) => a.month.localeCompare(b.month));
  if (!clean.length) return null;
  const safeMonths = Math.max(1, Number(months) || 1);
  const monthlyValues = clean.map(point => point.monthly).filter(value => value !== null);
  if (monthlyValues.length) return round(compoundMonthlyReturns(monthlyValues, safeMonths), 2);
  const selectedLast = clean.at(-1)?.accumulated;
  if (selectedLast === null || selectedLast === undefined) return 0;
  if (clean.length <= safeMonths) return round(selectedLast, 2);
  const base = clean[clean.length - safeMonths - 1]?.accumulated;
  if (base === null || base === undefined) return round(selectedLast, 2);
  const denominator = 1 + base / 100;
  return Math.abs(denominator) < 0.000001
    ? round(selectedLast, 2)
    : round(((1 + selectedLast / 100) / denominator - 1) * 100, 2);
}

export function summarizeReturnSeries(series = []) {
  const clean = (Array.isArray(series) ? series : []).filter(Boolean);
  const monthly = clean
    .map(point => finiteNumber(point.monthlyReturnPercent))
    .filter(value => value !== null && value >= -100 && value < 10000);
  const average = monthly.length ? monthly.reduce((sum, value) => sum + value, 0) / monthly.length : 0;
  const variance = monthly.length
    ? monthly.reduce((sum, value) => sum + ((value - average) ** 2), 0) / monthly.length
    : 0;
  const best = clean.reduce((current, point) => !current || Number(point.monthlyReturnPercent) > Number(current.monthlyReturnPercent) ? point : current, null);
  const worst = clean.reduce((current, point) => !current || Number(point.monthlyReturnPercent) < Number(current.monthlyReturnPercent) ? point : current, null);
  return {
    totalReturnPercent: round(compoundMonthlyReturns(monthly), 2),
    last12MonthsReturnPercent: round(compoundMonthlyReturns(monthly, 12), 2),
    lastMonthReturnPercent: round(monthly.at(-1) || 0, 2),
    averageMonthlyReturnPercent: round(average, 2),
    volatilityMonthlyPercent: round(Math.sqrt(variance), 2),
    bestMonth: best,
    worstMonth: worst
  };
}
