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
 * Return engine v4.
 *
 * Rules:
 * 1. Performance is calculated only from real monthly market value + real external cash flows.
 * 2. Cost-basis/cumulative-return fallbacks are never accepted as performance.
 * 3. A month with incomplete valuation breaks the return chain instead of becoming 0%.
 * 4. After a broken month, the next valid closing is a baseline only; comparison resumes one
 *    month later, so the chart never bridges an interval whose performance cannot be measured.
 * 5. Liquidation/re-entry remains measurable when the ledger itself provides the cash flows.
 */
export function buildExactPortfolioReturnSeriesV4(points = [], { skippedMonths = [] } = {}) {
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
    const knownInactive = point.knownInactive === true &&
      marketValue === 0 &&
      contributions === 0 &&
      withdrawals === 0 &&
      dividends === 0;

    if (knownInactive) {
      // A carteira foi liquidada e ainda não recebeu o próximo aporte. Esse mês é conhecido,
      // não um buraco de cotação. Preserve a continuidade da trajetória sem criar performance:
      // retorno mensal neutro e fator acumulado inalterado.
      rows.push({
        ...point,
        marketValue: 0,
        monthlyReturnPercent: 0,
        portfolioReturnPercent: round((factor - 1) * 100, 4),
        returnCalculationStatus: 'VALORAE_V4_KNOWN_INACTIVE',
        returnChainId: chainId,
        knownInactive: true
      });
      previous = { ...point, marketValue: 0 };
      continue;
    }

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
      returnCalculationStatus: 'VALORAE_V4_MODIFIED_DIETZ',
      returnChainId: chainId
    });
    previous = { ...point, marketValue };
  }

  return {
    rows,
    diagnostics: {
      engine: 'VALORAE_RETURN_V4_EXACT_WINDOW',
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

/**
 * Selects the requested calendar window from the most recent measurable chain and rebuilds the
 * accumulated curve exclusively from explicit monthly returns in that window.
 *
 * V3 rebased a previously accumulated curve. V4 deliberately does not trust inherited cumulative
 * percentages for a new window: the visible curve is compounded from the authoritative monthly
 * returns that belong to the selected interval. Missing calendar months terminate the chain.
 */
export function selectPortfolioReturnWindowV4(rows = [], range = 'SINCE_START', months = 12, now = new Date()) {
  const ordered = [...(Array.isArray(rows) ? rows : [])]
    .filter(row => row && /^\d{4}-\d{2}$/.test(String(row.month || '')) && safeMonthlyReturn(row.monthlyReturnPercent) !== null)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  if (!ordered.length) return { rows: [], comparisonBaseMonth: '', comparisonStartMonth: '', chainId: null };

  const latestChainId = ordered.at(-1)?.returnChainId ?? 0;
  const chain = ordered.filter(row => (row.returnChainId ?? 0) === latestChainId);
  if (!chain.length) return { rows: [], comparisonBaseMonth: '', comparisonStartMonth: '', chainId: latestChainId };

  // Defence in depth: even inside the same chain id, never bridge a missing calendar month.
  let contiguousStart = chain.length - 1;
  while (contiguousStart > 0) {
    const currentOrdinal = monthOrdinal(chain[contiguousStart]?.month);
    const previousOrdinal = monthOrdinal(chain[contiguousStart - 1]?.month);
    if (currentOrdinal === null || previousOrdinal === null || currentOrdinal - previousOrdinal !== 1) break;
    contiguousStart -= 1;
  }
  const continuousChain = chain.slice(contiguousStart);
  const startMonth = rangeStartMonth(continuousChain, range, months, now);
  const visible = continuousChain.filter(row => row.month >= startMonth);
  if (!visible.length) return { rows: [], comparisonBaseMonth: '', comparisonStartMonth: startMonth, chainId: latestChainId };

  const firstVisibleMonth = visible[0].month;
  const previous = continuousChain.filter(row => row.month < firstVisibleMonth).at(-1) || null;
  let factor = 1;
  const rebuilt = visible.map(row => {
    const monthly = safeMonthlyReturn(row.monthlyReturnPercent);
    if (monthly === null) return null;
    factor *= 1 + monthly / 100;
    if (!Number.isFinite(factor) || factor <= 0) return null;
    return {
      ...row,
      portfolioReturnPercent: round((factor - 1) * 100, 4),
      returnCalculationStatus: 'VALORAE_V4_WINDOW_COMPOUND'
    };
  }).filter(Boolean);

  return {
    rows: rebuilt,
    comparisonBaseMonth: previous?.month || '',
    comparisonStartMonth: rebuilt[0]?.month || firstVisibleMonth,
    chainId: latestChainId
  };
}

export function summarizePortfolioReturnV4(series = []) {
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
  // O mês corrente é uma prévia viva. Ele participa do retorno acumulado/12M e do
  // "mês atual", mas não deve concorrer com meses fechados em melhor/pior mês nem
  // distorcer média e volatilidade antes do fechamento.
  const closedForStatistics = clean.filter(row => row.currentMonthPartial !== true && row.knownInactive !== true);
  const statisticsRows = closedForStatistics.length ? closedForStatistics : clean;
  const statisticsMonthly = statisticsRows.map(row => Number(row.monthlyReturnPercent));
  const average = statisticsMonthly.reduce((sum, value) => sum + value, 0) / statisticsMonthly.length;
  const variance = statisticsMonthly.reduce((sum, value) => sum + ((value - average) ** 2), 0) / statisticsMonthly.length;
  const bestMonth = statisticsRows.reduce((best, row) => !best || row.monthlyReturnPercent > best.monthlyReturnPercent ? row : best, null);
  const worstMonth = statisticsRows.reduce((worst, row) => !worst || row.monthlyReturnPercent < worst.monthlyReturnPercent ? row : worst, null);
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
