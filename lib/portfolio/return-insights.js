import { round } from '../core/numbers.js';
import { summarizeExposureReturnV5 } from './return-engine-v5.js';

const BENCHMARK_FIELDS = Object.freeze({
  CDI: 'cdiReturnPercent',
  IPCA: 'ipcaReturnPercent',
  IBOV: 'ibovReturnPercent',
  SMLL: 'smal11ReturnPercent',
  IFIX: 'ifixReturnPercent',
  IDIV: 'idivReturnPercent',
  IVVB11: 'ivvb11ReturnPercent'
});

const MONTH_KEYS = Object.freeze(['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']);

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function monthOrdinal(month) {
  const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) return null;
  return year * 12 + monthNumber - 1;
}

function compound(values = []) {
  let factor = 1;
  for (const raw of values) {
    const value = finite(raw);
    if (value === null || value <= -100) return null;
    factor *= 1 + value / 100;
    if (!Number.isFinite(factor) || factor <= 0) return null;
  }
  return round((factor - 1) * 100, 4);
}

function comparisonToCdi(portfolioPct, cdiPct) {
  const portfolio = finite(portfolioPct);
  const cdi = finite(cdiPct);
  if (portfolio === null || cdi === null || Math.abs(cdi) < 0.000001) {
    return { percent: 0, label: 'CDI indisponível' };
  }
  const delta = round(((portfolio - cdi) / Math.abs(cdi)) * 100, 2);
  return {
    percent: delta,
    label: `${Math.abs(delta).toFixed(2).replace('.', ',')}% ${delta >= 0 ? 'acima' : 'abaixo'} do CDI`
  };
}

function accumulatedPeriodReturn(series, field, months) {
  const rows = (Array.isArray(series) ? series : [])
    .filter(row => row && monthOrdinal(row.month) !== null)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  if (!rows.length) return null;
  const lastOrdinal = monthOrdinal(rows.at(-1)?.month);
  if (lastOrdinal === null) return null;
  const startOrdinal = lastOrdinal - Math.max(1, Number(months) || 1) + 1;
  const firstIndex = rows.findIndex(row => (monthOrdinal(row.month) ?? Number.MIN_SAFE_INTEGER) >= startOrdinal);
  if (firstIndex < 0) return null;
  const lastValue = finite(rows.at(-1)?.[field]);
  if (lastValue === null) return null;
  if (firstIndex === 0) return round(lastValue, 4);
  const baseValue = finite(rows[firstIndex - 1]?.[field]);
  if (baseValue === null) return null;
  const denominator = 1 + baseValue / 100;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 0.000001) return null;
  return round(((1 + lastValue / 100) / denominator - 1) * 100, 4);
}

function summaryFromSeries(series = []) {
  const metrics = summarizeExposureReturnV5(series);
  const cdiField = BENCHMARK_FIELDS.CDI;
  const cdiCoverageComplete = series.length > 0 && series.every(point => finite(point?.[cdiField]) !== null);
  const cdiTotalPercent = cdiCoverageComplete ? finite(series.at(-1)?.[cdiField]) : null;
  const cdiLastMonthPercent = accumulatedPeriodReturn(series, cdiField, 1);
  const cdiLast12MonthsPercent = accumulatedPeriodReturn(series, cdiField, 12);
  const totalVsCdi = comparisonToCdi(metrics.totalReturnPercent, cdiTotalPercent);
  const last12VsCdi = comparisonToCdi(metrics.last12MonthsReturnPercent, cdiLast12MonthsPercent);
  const lastMonthVsCdi = comparisonToCdi(metrics.lastMonthReturnPercent, cdiLastMonthPercent);
  return {
    totalReturnPercent: round(Number(metrics.totalReturnPercent || 0), 2),
    last12MonthsReturnPercent: round(Number(metrics.last12MonthsReturnPercent || 0), 2),
    lastMonthReturnPercent: round(Number(metrics.lastMonthReturnPercent || 0), 2),
    cdiTotalPercent: round(Number(cdiTotalPercent || 0), 2),
    cdiLast12MonthsPercent: round(Number(cdiLast12MonthsPercent || 0), 2),
    cdiLastMonthPercent: round(Number(cdiLastMonthPercent || 0), 2),
    totalVsCdiPercent: totalVsCdi.percent,
    totalVsCdiLabel: cdiTotalPercent === null ? 'CDI indisponível' : totalVsCdi.label,
    last12MonthsVsCdiPercent: last12VsCdi.percent,
    last12MonthsVsCdiLabel: cdiLast12MonthsPercent === null ? 'CDI indisponível' : last12VsCdi.label,
    lastMonthVsCdiPercent: lastMonthVsCdi.percent,
    lastMonthVsCdiLabel: cdiLastMonthPercent === null ? 'CDI indisponível' : lastMonthVsCdi.label,
    averageMonthlyReturnPercent: round(Number(metrics.averageMonthlyReturnPercent || 0), 2),
    volatilityMonthlyPercent: round(Number(metrics.volatilityMonthlyPercent || 0), 2),
    bestMonthLabel: metrics.bestMonth?.label || '',
    bestMonthReturnPercent: metrics.bestMonth ? round(Number(metrics.bestMonth.monthlyReturnPercent || 0), 2) : 0,
    worstMonthLabel: metrics.worstMonth?.label || '',
    worstMonthReturnPercent: metrics.worstMonth ? round(Number(metrics.worstMonth.monthlyReturnPercent || 0), 2) : 0
  };
}

export function monthlyTableForReturnInsights(series = []) {
  const rows = new Map();
  for (const point of Array.isArray(series) ? series : []) {
    const match = String(point?.month || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) continue;
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const key = MONTH_KEYS[monthIndex];
    if (!key) continue;
    const row = rows.get(year) || { year };
    row[key] = finite(point.monthlyReturnPercent) === null ? null : round(Number(point.monthlyReturnPercent), 2);
    rows.set(year, row);
  }
  return [...rows.values()].sort((a, b) => Number(b.year) - Number(a.year));
}

function annualReturns(series = []) {
  const grouped = new Map();
  for (const point of Array.isArray(series) ? series : []) {
    const match = String(point?.month || '').match(/^(\d{4})-(\d{2})$/);
    if (!match || finite(point.monthlyReturnPercent) === null) continue;
    const year = Number(match[1]);
    const rows = grouped.get(year) || [];
    rows.push(point);
    grouped.set(year, rows);
  }
  return [...grouped.entries()]
    .map(([year, rows]) => {
      const ordered = rows.sort((a, b) => String(a.month).localeCompare(String(b.month)));
      const monthsInvested = ordered.length;
      const firstMonth = ordered[0]?.month || '';
      const lastMonth = ordered.at(-1)?.month || '';
      const fullCalendarYear = monthsInvested === 12 && firstMonth.endsWith('-01') && lastMonth.endsWith('-12');
      return {
        year,
        returnPercent: compound(ordered.map(row => row.monthlyReturnPercent)) ?? 0,
        monthsInvested,
        firstMonth,
        lastMonth,
        fullCalendarYear,
        preview: ordered.some(row => row.currentMonthPartial === true),
        partialExposure: !fullCalendarYear || ordered.some(row => row.partialExposureMonth === true)
      };
    })
    .sort((a, b) => Number(b.year) - Number(a.year));
}

function rolling12Series(series = []) {
  const rows = [...(Array.isArray(series) ? series : [])].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const output = [];
  for (let endIndex = 11; endIndex < rows.length; endIndex += 1) {
    const startIndex = endIndex - 11;
    const window = rows.slice(startIndex, endIndex + 1);
    const first = window[0];
    const last = window.at(-1);
    const firstOrdinal = monthOrdinal(first?.month);
    const lastOrdinal = monthOrdinal(last?.month);
    const sameCycle = window.every(row => Number(row.exposureCycleId || 0) === Number(first.exposureCycleId || 0));
    const sameSegment = window.every(row => Number(row.chartSegmentId || 0) === Number(first.chartSegmentId || 0));
    if (firstOrdinal === null || lastOrdinal === null || lastOrdinal - firstOrdinal !== 11 || !sameCycle || !sameSegment) continue;
    const portfolioReturnPercent = compound(window.map(row => row.monthlyReturnPercent));
    if (portfolioReturnPercent === null) continue;
    const previousOutput = output.at(-1);
    const point = {
      month: last.month,
      label: last.label,
      portfolioReturnPercent,
      monthlyReturnPercent: portfolioReturnPercent,
      exposureCycleId: Number(last.exposureCycleId || 0),
      chartSegmentId: Number(last.chartSegmentId || 0),
      segmentStart: !previousOutput || Number(previousOutput.chartSegmentId || 0) !== Number(last.chartSegmentId || 0),
      currentMonthPartial: last.currentMonthPartial === true,
      partialExposureMonth: last.partialExposureMonth === true
    };
    for (const [code, field] of Object.entries(BENCHMARK_FIELDS)) {
      const lastValue = finite(last?.[field]);
      if (lastValue === null) {
        point[field] = null;
        continue;
      }
      const baseIndex = startIndex - 1;
      let baseValue = 0;
      if (baseIndex >= 0) {
        const base = rows[baseIndex];
        if (Number(base.chartSegmentId || 0) !== Number(first.chartSegmentId || 0)) {
          point[field] = null;
          continue;
        }
        baseValue = finite(base?.[field]);
        if (baseValue === null) {
          point[field] = null;
          continue;
        }
      } else if (first.segmentStart !== true) {
        point[field] = null;
        continue;
      }
      const denominator = 1 + baseValue / 100;
      const rolling = Math.abs(denominator) < 0.000001
        ? null
        : ((1 + lastValue / 100) / denominator - 1) * 100;
      point[field] = Number.isFinite(rolling) ? round(rolling, 4) : null;
      if (code === 'SMLL') point.smal11ReturnPercent = point[field];
    }
    output.push(point);
  }
  return output;
}

function monthlyBenchmarkReturn(rows, index, field) {
  const current = finite(rows[index]?.[field]);
  if (current === null) return null;
  for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
    const previous = finite(rows[previousIndex]?.[field]);
    if (previous === null) continue;
    const denominator = 1 + previous / 100;
    if (!Number.isFinite(denominator) || Math.abs(denominator) < 0.000001) return null;
    return ((1 + current / 100) / denominator - 1) * 100;
  }
  return current;
}

function benchmarkStats(series = []) {
  const rows = [...(Array.isArray(series) ? series : [])].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  return Object.entries(BENCHMARK_FIELDS).map(([code, field]) => {
    let comparableMonths = 0;
    let wonMonths = 0;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (row.currentMonthPartial === true) continue;
      const portfolioMonthly = finite(row.monthlyReturnPercent);
      const benchmarkMonthly = monthlyBenchmarkReturn(rows, index, field);
      if (portfolioMonthly === null || benchmarkMonthly === null) continue;
      comparableMonths += 1;
      if (portfolioMonthly > benchmarkMonthly) wonMonths += 1;
    }
    const coverageComplete = rows.length > 0 && rows.every(row => finite(row[field]) !== null);
    const lastBenchmark = coverageComplete ? finite(rows.at(-1)?.[field]) : null;
    const lastPortfolio = finite(rows.at(-1)?.portfolioReturnPercent);
    return {
      code,
      comparableMonths,
      wonMonths,
      winRatePercent: comparableMonths ? round((wonMonths / comparableMonths) * 100, 1) : null,
      accumulatedGapPercentPoints: lastBenchmark !== null && lastPortfolio !== null ? round(lastPortfolio - lastBenchmark, 2) : null,
      coverageComplete
    };
  });
}

function drawdownRecovery(series = []) {
  const rows = [...(Array.isArray(series) ? series : [])].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  if (!rows.length) return null;
  let peakFactor = 1;
  let peakIndex = -1;
  let worstPercent = 0;
  let worstPeakFactor = 1;
  let worstPeakIndex = -1;
  let troughIndex = -1;
  rows.forEach((row, index) => {
    const cumulative = finite(row.portfolioReturnPercent);
    if (cumulative === null) return;
    const factor = 1 + cumulative / 100;
    if (!Number.isFinite(factor) || factor <= 0) return;
    if (factor > peakFactor) {
      peakFactor = factor;
      peakIndex = index;
    }
    const drawdown = (factor / peakFactor - 1) * 100;
    if (drawdown < worstPercent) {
      worstPercent = drawdown;
      worstPeakFactor = peakFactor;
      worstPeakIndex = peakIndex;
      troughIndex = index;
    }
  });
  if (troughIndex < 0) {
    return {
      drawdownPercent: 0,
      peakMonth: rows[0]?.month || '',
      troughMonth: rows[0]?.month || '',
      recoveryMonth: rows[0]?.month || '',
      recovered: true,
      investedMonthsToRecovery: 0,
      remainingToPeakPercent: 0,
      peakAtWindowStart: true
    };
  }
  let recoveryIndex = -1;
  for (let index = troughIndex + 1; index < rows.length; index += 1) {
    const cumulative = finite(rows[index]?.portfolioReturnPercent);
    if (cumulative === null) continue;
    const factor = 1 + cumulative / 100;
    if (factor >= worstPeakFactor - 0.0000001) {
      recoveryIndex = index;
      break;
    }
  }
  const lastFactor = 1 + (finite(rows.at(-1)?.portfolioReturnPercent) ?? 0) / 100;
  const remaining = recoveryIndex >= 0 || !Number.isFinite(lastFactor) || lastFactor <= 0
    ? 0
    : Math.max(0, ((worstPeakFactor / lastFactor) - 1) * 100);
  return {
    drawdownPercent: round(worstPercent, 2),
    peakMonth: worstPeakIndex >= 0 ? rows[worstPeakIndex]?.month || '' : rows[0]?.month || '',
    troughMonth: rows[troughIndex]?.month || '',
    recoveryMonth: recoveryIndex >= 0 ? rows[recoveryIndex]?.month || '' : '',
    recovered: recoveryIndex >= 0,
    investedMonthsToRecovery: recoveryIndex >= 0 ? Math.max(0, recoveryIndex - troughIndex) : null,
    remainingToPeakPercent: round(remaining, 2),
    peakAtWindowStart: worstPeakIndex < 0
  };
}

export function buildReturnAnalytics(series = []) {
  return {
    annualReturns: annualReturns(series),
    rolling12Series: rolling12Series(series),
    benchmarkStats: benchmarkStats(series),
    drawdown: drawdownRecovery(series)
  };
}

function rebaseCycleSeries(fullSeries, cycleRows) {
  if (!cycleRows.length) return [];
  const orderedFull = [...fullSeries].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const firstMonth = String(cycleRows[0]?.month || '');
  const previousRows = orderedFull.filter(row => String(row.month || '') < firstMonth);
  const benchmarkBases = Object.fromEntries(Object.entries(BENCHMARK_FIELDS).map(([code, field]) => {
    const previous = [...previousRows].reverse().find(row => finite(row?.[field]) !== null);
    return [code, finite(previous?.[field]) ?? 0];
  }));
  let portfolioFactor = 1;
  return cycleRows.map((row, index) => {
    const monthly = finite(row.monthlyReturnPercent);
    if (monthly !== null) portfolioFactor *= 1 + monthly / 100;
    const next = {
      ...row,
      portfolioReturnPercent: round((portfolioFactor - 1) * 100, 4),
      segmentStart: index === 0 ? true : row.segmentStart === true
    };
    for (const [code, field] of Object.entries(BENCHMARK_FIELDS)) {
      const current = finite(row?.[field]);
      if (current === null) {
        next[field] = null;
        continue;
      }
      const base = benchmarkBases[code] ?? 0;
      const denominator = 1 + base / 100;
      next[field] = Math.abs(denominator) < 0.000001
        ? null
        : round(((1 + current / 100) / denominator - 1) * 100, 4);
    }
    return next;
  });
}

export function buildReturnExposureCycles(series = []) {
  const ordered = [...(Array.isArray(series) ? series : [])].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const cycleIds = [...new Set(ordered.map(row => Number(row.exposureCycleId || 0)).filter(id => id > 0))].sort((a, b) => a - b);
  if (cycleIds.length <= 1) return [];
  const latestCycleId = cycleIds.at(-1);
  return cycleIds.map((cycleId, index) => {
    const sourceRows = ordered.filter(row => Number(row.exposureCycleId || 0) === cycleId);
    const rebasedSeries = rebaseCycleSeries(ordered, sourceRows);
    const startMonth = rebasedSeries[0]?.month || '';
    const endMonth = rebasedSeries.at(-1)?.month || '';
    const distanceFromLatest = latestCycleId - cycleId;
    const label = distanceFromLatest === 0
      ? 'Ciclo atual'
      : distanceFromLatest === 1
        ? 'Ciclo anterior'
        : `Ciclo ${index + 1}`;
    return {
      id: cycleId,
      label,
      startMonth,
      endMonth,
      monthsInvested: rebasedSeries.length,
      summary: summaryFromSeries(rebasedSeries),
      series: rebasedSeries,
      monthlyTable: monthlyTableForReturnInsights(rebasedSeries),
      analytics: buildReturnAnalytics(rebasedSeries)
    };
  });
}
