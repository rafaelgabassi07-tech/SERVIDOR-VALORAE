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
      point.valuationCoveragePercent, point.capitalExposureStartDate, point.capitalExposureEndDate
    ].reduce((score, value) => score + (value !== null && value !== undefined && value !== '' ? 1 : 0), 0);
    const previous = byMonth.get(month);
    if (!previous || completeness >= previous.completeness) byMonth.set(month, { point, completeness });
  }
  return [...byMonth.values()].map(({ point }) => point).sort((a, b) => a.month.localeCompare(b.month));
}

function skippedBetween(skippedMonths, previousMonth, currentMonth) {
  if (!previousMonth) return false;
  return skippedMonths.some(month => month > previousMonth && month < currentMonth);
}

function pointCashFlows(point = {}) {
  return {
    contributions: Math.max(0, finite(point.monthlyContributions ?? point.contributions) ?? 0),
    withdrawals: Math.max(0, finite(point.monthlyWithdrawals ?? point.withdrawals) ?? 0),
    weightedNetCashFlow: finite(point.weightedNetCashFlow ?? point.weightedCashFlow) ?? 0,
    dividends: Math.max(0, finite(point.dividendsInMonth ?? point.monthDividends) ?? 0)
  };
}

function hasRealExposure(point = {}, marketValue = null, flows = pointCashFlows(point)) {
  // Explicit history metadata is authoritative. In particular, income paid after liquidation does
  // not mean the portfolio had capital at risk in the payment month.
  if (point.capitalExposed === false) return false;
  if (point.capitalExposed === true) return true;
  if (marketValue !== null && marketValue > 0) return true;
  // A contribution can establish exposure from zero. A withdrawal alone cannot: without
  // explicit ledger metadata it may be an orphan exit from an incomplete import and must fail
  // closed instead of materializing a phantom invested month.
  if (flows.contributions > 0) return true;
  return Boolean(point.capitalExposureStartDate || point.capitalExposureEndDate);
}

/**
 * Return engine v5 — exposure-only.
 *
 * Core invariant: a month without capital at risk is not a 0% return and is never emitted as a
 * performance observation. It exists only in diagnostics. Exposure can stop and restart without
 * erasing historical performance; the chart receives an explicit segment id so it can break the
 * line across zero-capital intervals.
 *
 * A missing/partial market valuation while capital WAS exposed is different: that is an unknown
 * return. It breaks the calculation chain and prior performance is not linked across that gap.
 */
export function buildExposureOnlyReturnSeriesV5(points = [], { skippedMonths = [] } = {}) {
  const clean = dedupeHistoryPoints(points);
  const skipped = [...new Set((Array.isArray(skippedMonths) ? skippedMonths : [])
    .map(String).filter(month => /^\d{4}-\d{2}$/.test(month)))].sort();

  const rows = [];
  const inactiveMonths = [];
  const droppedMonths = [];
  const baselineMonths = [];
  let previous = null;
  let factor = 1;
  let calculationChainId = 0;
  let exposureCycleId = 0;
  let chartSegmentId = 0;
  let nextExposureCycle = true;
  let nextChartSegment = true;
  let lastObservedMonth = '';

  for (const point of clean) {
    const marketValue = finite(point.marketValue ?? point.totalValue ?? point.value);
    const flows = pointCashFlows(point);
    const exposed = hasRealExposure(point, marketValue, flows);

    if (!exposed) {
      inactiveMonths.push(point.month);
      previous = null;
      nextExposureCycle = true;
      nextChartSegment = true;
      lastObservedMonth = point.month;
      continue;
    }

    const partial = point.partialValuation === true || (finite(point.valuationCoveragePercent) ?? 100) < 99.999;
    const unavailableGap = skippedBetween(skipped, lastObservedMonth || previous?.month || '', point.month);
    if (marketValue === null || marketValue < 0 || partial || unavailableGap) {
      droppedMonths.push(point.month);
      factor = 1;
      calculationChainId += 1;
      nextChartSegment = true;
      lastObservedMonth = point.month;
      if (unavailableGap && marketValue !== null && marketValue >= 0 && !partial) {
        // The current close is real; only the interval leading into it is unknowable. Keep this
        // close solely as the baseline for the next active month, never as a return observation.
        previous = { ...point, marketValue };
        baselineMonths.push(point.month);
      } else {
        previous = null;
      }
      continue;
    }

    if (nextExposureCycle) {
      exposureCycleId += 1;
      nextExposureCycle = false;
    }
    if (nextChartSegment) {
      chartSegmentId += 1;
      nextChartSegment = false;
    }

    // If this is the first measurable close of a chain and there was already capital at the start
    // of the month, the engine has no trustworthy opening market value. Use it only as a baseline.
    // A genuine entry/re-entry month has explicit cash flow and can be measured from zero capital.
    if (!previous && flows.contributions <= 0 && flows.withdrawals <= 0 && Math.abs(flows.weightedNetCashFlow) < 0.01) {
      previous = { ...point, marketValue };
      baselineMonths.push(point.month);
      lastObservedMonth = point.month;
      continue;
    }

    const beginningMarketValue = previous
      ? finite(previous.marketValue ?? previous.totalValue ?? previous.value) ?? 0
      : 0;
    const calculated = modifiedDietzMonthlyReturnPercent({
      beginningMarketValue,
      endingMarketValue: marketValue,
      contributions: flows.contributions,
      withdrawals: flows.withdrawals,
      weightedNetCashFlow: flows.weightedNetCashFlow,
      dividends: flows.dividends,
      fallbackReturnPercent: Number.NaN
    });
    const monthlyReturnPercent = safeMonthlyReturn(calculated);

    if (monthlyReturnPercent === null) {
      droppedMonths.push(point.month);
      previous = null;
      factor = 1;
      calculationChainId += 1;
      nextChartSegment = true;
      lastObservedMonth = point.month;
      continue;
    }

    factor *= 1 + monthlyReturnPercent / 100;
    if (!Number.isFinite(factor) || factor <= 0) {
      droppedMonths.push(point.month);
      previous = null;
      factor = 1;
      calculationChainId += 1;
      nextChartSegment = true;
      lastObservedMonth = point.month;
      continue;
    }

    const segmentStart = !rows.some(row =>
      row.calculationChainId === calculationChainId && row.chartSegmentId === chartSegmentId
    );
    rows.push({
      ...point,
      marketValue,
      monthlyReturnPercent: round(monthlyReturnPercent, 4),
      portfolioReturnPercent: round((factor - 1) * 100, 4),
      returnCalculationStatus: 'VALORAE_V5_EXPOSURE_ONLY_DIETZ',
      calculationChainId,
      exposureCycleId,
      chartSegmentId,
      segmentStart
    });
    previous = { ...point, marketValue };
    lastObservedMonth = point.month;
  }

  return {
    rows,
    diagnostics: {
      engine: 'VALORAE_RETURN_V5_EXPOSURE_ONLY',
      inputMonths: clean.length,
      performanceMonths: rows.length,
      inactiveMonths: [...new Set(inactiveMonths)].sort(),
      droppedMonths: [...new Set(droppedMonths)].sort(),
      baselineMonths: [...new Set(baselineMonths)].sort(),
      skippedValuationMonths: skipped,
      exposureCycles: new Set(rows.map(row => row.exposureCycleId)).size,
      chartSegments: new Set(rows.map(row => `${row.calculationChainId}:${row.chartSegmentId}`)).size
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

/**
 * Selects an exposure-only calendar window.
 *
 * The latest complete calculation chain is authoritative. Zero-capital gaps do not break that
 * chain; they simply create a new exposureSegmentId and therefore a visual break. Missing market
 * valuation DOES break the chain and earlier data is not linked through an unknowable return.
 */
export function selectExposureReturnWindowV5(rows = [], range = 'SINCE_START', months = 12, now = new Date()) {
  const ordered = [...(Array.isArray(rows) ? rows : [])]
    .filter(row => row && /^\d{4}-\d{2}$/.test(String(row.month || '')) && safeMonthlyReturn(row.monthlyReturnPercent) !== null)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  if (!ordered.length) return { rows: [], comparisonBaseMonth: '', comparisonStartMonth: '', calculationChainId: null };

  const latestChainId = ordered.at(-1)?.calculationChainId ?? 0;
  const chain = ordered.filter(row => (row.calculationChainId ?? 0) === latestChainId);
  if (!chain.length) return { rows: [], comparisonBaseMonth: '', comparisonStartMonth: '', calculationChainId: latestChainId };

  const startMonth = rangeStartMonth(chain, range, months, now);
  const visible = chain.filter(row => row.month >= startMonth);
  if (!visible.length) return { rows: [], comparisonBaseMonth: '', comparisonStartMonth: startMonth, calculationChainId: latestChainId };

  const firstVisible = visible[0];
  const previousSameSegment = chain
    .filter(row => row.month < firstVisible.month && row.chartSegmentId === firstVisible.chartSegmentId)
    .at(-1) || null;

  let factor = 1;
  const rebuilt = visible.map(row => {
    const monthly = safeMonthlyReturn(row.monthlyReturnPercent);
    if (monthly === null) return null;
    factor *= 1 + monthly / 100;
    if (!Number.isFinite(factor) || factor <= 0) return null;
    return {
      ...row,
      portfolioReturnPercent: round((factor - 1) * 100, 4),
      returnCalculationStatus: 'VALORAE_V5_WINDOW_EXPOSURE_COMPOUND'
    };
  }).filter(Boolean);

  return {
    rows: rebuilt,
    comparisonBaseMonth: previousSameSegment?.month || '',
    comparisonStartMonth: rebuilt[0]?.month || firstVisible.month,
    calculationChainId: latestChainId,
    exposureCycleCount: new Set(rebuilt.map(row => row.exposureCycleId)).size,
    chartSegmentCount: new Set(rebuilt.map(row => row.chartSegmentId)).size
  };
}

export function summarizeExposureReturnV5(series = []) {
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
  // “12 meses” is a calendar window, not the last 12 exposure observations. Inactive months
  // remain absent (and therefore never become artificial 0% returns), while old active months
  // outside the trailing calendar year cannot leak into the metric after a long liquidation.
  const lastOrdinal = monthOrdinal(clean.at(-1)?.month);
  const trailing12StartOrdinal = lastOrdinal === null ? null : lastOrdinal - 11;
  const trailing12Rows = trailing12StartOrdinal === null
    ? clean
    : clean.filter(row => {
        const ordinal = monthOrdinal(row.month);
        return ordinal !== null && ordinal >= trailing12StartOrdinal && ordinal <= lastOrdinal;
      });
  const statisticsRows = clean.filter(row => row.currentMonthPartial !== true);
  const statisticsMonthly = statisticsRows.map(row => Number(row.monthlyReturnPercent));
  const average = statisticsMonthly.length
    ? statisticsMonthly.reduce((sum, value) => sum + value, 0) / statisticsMonthly.length
    : 0;
  const variance = statisticsMonthly.length
    ? statisticsMonthly.reduce((sum, value) => sum + ((value - average) ** 2), 0) / statisticsMonthly.length
    : 0;
  const bestMonth = statisticsRows.reduce((best, row) => !best || row.monthlyReturnPercent > best.monthlyReturnPercent ? row : best, null);
  const worstMonth = statisticsRows.reduce((worst, row) => !worst || row.monthlyReturnPercent < worst.monthlyReturnPercent ? row : worst, null);
  return {
    totalReturnPercent: round(finite(clean.at(-1)?.portfolioReturnPercent) ?? compound(monthly), 2),
    last12MonthsReturnPercent: round(compound(trailing12Rows.map(row => Number(row.monthlyReturnPercent))), 2),
    lastMonthReturnPercent: round(monthly.at(-1) ?? 0, 2),
    averageMonthlyReturnPercent: round(average, 2),
    volatilityMonthlyPercent: round(Math.sqrt(variance), 2),
    bestMonth,
    worstMonth
  };
}
