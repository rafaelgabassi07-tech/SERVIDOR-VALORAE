import { round } from '../core/numbers.js';
import { modifiedDietzMonthlyReturnPercent } from './return-calculation.js';

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function monthKey(point = {}) {
  const raw = String(point?.month || String(point?.date || '').slice(0, 7));
  return /^\d{4}-\d{2}$/.test(raw) ? raw : '';
}

function monthOrdinal(month = '') {
  const match = String(month).match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

function monthFromOrdinal(ordinal) {
  if (!Number.isFinite(ordinal)) return '';
  const year = Math.floor(ordinal / 12);
  const month = ordinal % 12 + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function safeMonthlyReturn(value) {
  const n = finite(value);
  return n !== null && n > -99.9 && n <= 1000 ? n : null;
}

function dedupeHistoryPoints(points = []) {
  const byMonth = new Map();
  for (const raw of Array.isArray(points) ? points : []) {
    const month = monthKey(raw);
    if (!month) continue;
    const point = { ...raw, month };
    const completeness = [
      point.marketValue, point.totalValue, point.monthlyContributions,
      point.monthlyWithdrawals, point.weightedNetCashFlow, point.dividendsInMonth,
      point.valuationCoveragePercent
    ].reduce((score, value) => score + (finite(value) !== null ? 1 : 0), 0);
    const previous = byMonth.get(month);
    if (!previous || completeness >= previous.completeness) byMonth.set(month, { point, completeness });
  }
  return [...byMonth.values()].map(({ point }) => point).sort((a, b) => a.month.localeCompare(b.month));
}

function skippedBetween(skippedMonths, previousMonth, currentMonth) {
  if (!previousMonth) return false;
  return skippedMonths.some(month => month > previousMonth && month < currentMonth);
}

/**
 * Return engine v3.
 *
 * Rules:
 * 1. Performance is calculated only from real monthly market value + real external cash flows.
 * 2. Cost-basis/cumulative-return fallbacks are never accepted as performance.
 * 3. A month with incomplete valuation breaks the return chain instead of becoming 0%.
 * 4. After a broken month, the next valid closing is a baseline only; comparison resumes one
 *    month later, so the chart never bridges an interval whose performance cannot be measured.
 * 5. Liquidation/re-entry remains measurable when the ledger itself provides the cash flows.
 */
export function buildStrictPortfolioReturnSeries(points = [], { skippedMonths = [] } = {}) {
  const clean = dedupeHistoryPoints(points);
  const skipped = [...new Set((Array.isArray(skippedMonths) ? skippedMonths : []).map(String).filter(month => /^\d{4}-\d{2}$/.test(month)))].sort();
  const rows = [];
  const droppedMonths = [];
  const baselineMonths = [];
  let previous = null;
  let factor = 1;
  let chainId = 0;

  for (const point of clean) {
    const marketValue = finite(point.marketValue ?? point.totalValue ?? point.value);
    const partial = point.partialValuation === true || (finite(point.valuationCoveragePercent) ?? 100) < 99.999;
    const gapFromUnavailableValuation = skippedBetween(skipped, previous?.month || '', point.month);

    if (marketValue === null || marketValue < 0 || partial || gapFromUnavailableValuation) {
      droppedMonths.push(point.month);
      factor = 1;
      chainId += 1;

      if (gapFromUnavailableValuation && marketValue !== null && marketValue >= 0 && !partial) {
        // The current close itself is trustworthy; only the interval before it is unknown.
        // Keep it as the new chain baseline, but never emit a return for that interval.
        previous = { ...point, marketValue };
        baselineMonths.push(point.month);
      } else {
        // An incomplete/invalid close can never be the denominator of the following month.
        // The next fully-priced close becomes a baseline first, and performance resumes only
        // after another complete month exists.
        previous = null;
      }
      continue;
    }

    const contributions = Math.max(0, finite(point.monthlyContributions ?? point.contributions) ?? 0);
    const withdrawals = Math.max(0, finite(point.monthlyWithdrawals ?? point.withdrawals) ?? 0);
    const weightedNetCashFlow = finite(point.weightedNetCashFlow ?? point.weightedCashFlow) ?? 0;
    const dividends = Math.max(0, finite(point.dividendsInMonth ?? point.monthDividends) ?? 0);

    if (!previous) {
      // Unknown opening inventory cannot produce a trustworthy inception return. Use the first
      // valid closing as a baseline unless the ledger proves capital entered during this month.
      if (contributions <= 0 && withdrawals <= 0 && Math.abs(weightedNetCashFlow) < 0.01) {
        previous = { ...point, marketValue };
        baselineMonths.push(point.month);
        factor = 1;
        continue;
      }
    }

    const beginningMarketValue = previous ? finite(previous.marketValue ?? previous.totalValue ?? previous.value) ?? 0 : 0;
    const calculated = modifiedDietzMonthlyReturnPercent({
      beginningMarketValue,
      endingMarketValue: marketValue,
      contributions,
      withdrawals,
      weightedNetCashFlow,
      dividends,
      fallbackReturnPercent: Number.NaN
    });
    const monthlyReturnPercent = safeMonthlyReturn(calculated);

    if (monthlyReturnPercent === null) {
      droppedMonths.push(point.month);
      previous = { ...point, marketValue };
      baselineMonths.push(point.month);
      factor = 1;
      chainId += 1;
      continue;
    }

    factor *= 1 + monthlyReturnPercent / 100;
    if (!Number.isFinite(factor) || factor <= 0) {
      droppedMonths.push(point.month);
      previous = { ...point, marketValue };
      baselineMonths.push(point.month);
      factor = 1;
      chainId += 1;
      continue;
    }

    rows.push({
      ...point,
      marketValue,
      label: point.label || point.month,
      monthlyReturnPercent: round(monthlyReturnPercent, 4),
      portfolioReturnPercent: round((factor - 1) * 100, 4),
      returnCalculationStatus: 'VALORAE_V3_MODIFIED_DIETZ',
      returnChainId: chainId
    });
    previous = { ...point, marketValue };
  }

  return {
    rows,
    diagnostics: {
      engine: 'VALORAE_RETURN_V3_STRICT_LEDGER',
      inputMonths: clean.length,
      comparableMonths: rows.length,
      droppedMonths: [...new Set(droppedMonths)].sort(),
      baselineMonths: [...new Set(baselineMonths)].sort(),
      skippedValuationMonths: skipped
    }
  };
}

function rangeStartMonth(rows, range, months, now = new Date()) {
  if (!rows.length) return '';
  const normalized = String(range || 'SINCE_START').trim().toUpperCase();
  if (['SINCE_START', 'MAX', 'MÁX'].includes(normalized)) return rows[0].month;
  if (['YTD', 'ANO_ATUAL'].includes(normalized)) {
    const date = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
    return `${date.getUTCFullYear()}-01`;
  }
  const lastOrdinal = monthOrdinal(rows.at(-1)?.month);
  const safeMonths = Math.max(1, Number(months) || 1);
  return lastOrdinal === null ? rows[0].month : monthFromOrdinal(lastOrdinal - safeMonths + 1);
}

/** Selects a calendar window and rebases accumulated performance without recomputing monthly return. */
export function selectPortfolioReturnWindowV3(rows = [], range = 'SINCE_START', months = 12, now = new Date()) {
  const ordered = [...(Array.isArray(rows) ? rows : [])]
    .filter(row => row && /^\d{4}-\d{2}$/.test(String(row.month || '')) && safeMonthlyReturn(row.monthlyReturnPercent) !== null)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  if (!ordered.length) return { rows: [], comparisonBaseMonth: '', comparisonStartMonth: '', chainId: null };

  // A broken valuation creates a new chain. Never draw/compound across that break.
  const latestChainId = ordered.at(-1)?.returnChainId ?? 0;
  const chain = ordered.filter(row => (row.returnChainId ?? 0) === latestChainId);
  if (!chain.length) return { rows: [], comparisonBaseMonth: '', comparisonStartMonth: '', chainId: latestChainId };

  const startMonth = rangeStartMonth(chain, range, months, now);
  const visible = chain.filter(row => row.month >= startMonth);
  if (!visible.length) return { rows: [], comparisonBaseMonth: '', comparisonStartMonth: startMonth, chainId: latestChainId };

  const firstVisibleMonth = visible[0].month;
  const previous = chain.filter(row => row.month < firstVisibleMonth).at(-1) || null;
  const base = previous ? finite(previous.portfolioReturnPercent) : null;
  const denominator = base !== null ? 1 + base / 100 : 1;
  const rebased = visible.map(row => {
    const accumulated = finite(row.portfolioReturnPercent) ?? 0;
    const value = Number.isFinite(denominator) && Math.abs(denominator) > 0.000001
      ? ((1 + accumulated / 100) / denominator - 1) * 100
      : accumulated;
    return { ...row, portfolioReturnPercent: round(value, 4) };
  });

  return {
    rows: rebased,
    comparisonBaseMonth: previous?.month || '',
    comparisonStartMonth: firstVisibleMonth,
    chainId: latestChainId
  };
}

export function summarizePortfolioReturnV3(series = []) {
  const clean = (Array.isArray(series) ? series : [])
    .filter(row => row && safeMonthlyReturn(row.monthlyReturnPercent) !== null)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  if (!clean.length) {
    return { totalReturnPercent: 0, last12MonthsReturnPercent: 0, lastMonthReturnPercent: 0, averageMonthlyReturnPercent: 0, volatilityMonthlyPercent: 0, bestMonth: null, worstMonth: null };
  }
  const monthly = clean.map(row => Number(row.monthlyReturnPercent));
  const compound = values => {
    let factor = 1;
    for (const value of values) factor *= 1 + value / 100;
    return round((factor - 1) * 100, 4);
  };
  const average = monthly.reduce((sum, value) => sum + value, 0) / monthly.length;
  const variance = monthly.reduce((sum, value) => sum + ((value - average) ** 2), 0) / monthly.length;
  const bestMonth = clean.reduce((best, row) => !best || row.monthlyReturnPercent > best.monthlyReturnPercent ? row : best, null);
  const worstMonth = clean.reduce((worst, row) => !worst || row.monthlyReturnPercent < worst.monthlyReturnPercent ? row : worst, null);
  return {
    totalReturnPercent: round(finite(clean.at(-1)?.portfolioReturnPercent) ?? compound(monthly), 2),
    last12MonthsReturnPercent: round(compound(monthly.slice(-12)), 2),
    lastMonthReturnPercent: round(monthly.at(-1) ?? 0, 2),
    averageMonthlyReturnPercent: round(average, 2),
    volatilityMonthlyPercent: round(Math.sqrt(variance), 2),
    bestMonth,
    worstMonth
  };
}
