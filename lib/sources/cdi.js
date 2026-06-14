import { fetchJson } from './fetch.js';
import { fetchBcbSeries } from '../market/bcb.js';
import { round } from '../core/numbers.js';

export const VALORAE_CDI_SOURCE_VERSION = '21.12.0-cdi-official-bcb';
const CDI_DAILY_SERIES_ID = 12;
const CDI_MONTHLY_SERIES_ID = 4391;

function normalizeBcbDate(value = '') {
  const text = String(value || '').trim();
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${String(br[2]).padStart(2, '0')}-${String(br[1]).padStart(2, '0')}`;
  }
  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  return '';
}

function bcbParamDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

function startDateForMonths(months = 12) {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - Math.max(1, Number(months || 12)) - 2, 1));
}

function parseBcbRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map(row => ({
      date: normalizeBcbDate(row.data || row.date),
      value: Number(String(row.valor ?? row.value ?? '').replace(',', '.'))
    }))
    .filter(row => row.date && Number.isFinite(row.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function accumulatedFromMonthlyRows(monthly = []) {
  let factor = 1;
  return monthly.map(row => {
    factor *= (1 + Number(row.monthlyPercent || row.value || 0) / 100);
    return {
      month: row.month,
      label: row.label || `${row.month.slice(5, 7)}/${row.month.slice(2, 4)}`,
      monthlyPercent: round(Number(row.monthlyPercent ?? row.value ?? 0), 4),
      value: round(Number(row.monthlyPercent ?? row.value ?? 0), 4),
      accumulatedPercent: round((factor - 1) * 100, 4),
      source: row.source,
      realOnly: true,
      official: true
    };
  });
}

export function monthlyCdiFromDailyRows(rows = [], months = 12, source = 'BancoCentralSGS CDI diário série 12') {
  const byMonth = new Map();
  for (const row of parseBcbRows(rows)) {
    const month = row.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const values = byMonth.get(month) || [];
    values.push(row.value);
    byMonth.set(month, values);
  }
  const monthly = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, values]) => {
      const factor = values.reduce((acc, value) => acc * (1 + Number(value || 0) / 100), 1);
      const pct = round((factor - 1) * 100, 4);
      return { month, label: `${month.slice(5, 7)}/${month.slice(2, 4)}`, monthlyPercent: pct, value: pct, source };
    })
    .slice(-Math.max(1, Number(months || 12)));
  return accumulatedFromMonthlyRows(monthly);
}

export function monthlyCdiFromMonthlyRows(rows = [], months = 12, source = 'BancoCentralSGS CDI acumulado no mês série 4391') {
  const monthly = parseBcbRows(rows)
    .map(row => ({
      month: row.date.slice(0, 7),
      label: `${row.date.slice(5, 7)}/${row.date.slice(2, 4)}`,
      monthlyPercent: row.value,
      value: row.value,
      source
    }))
    .filter(row => /^\d{4}-\d{2}$/.test(row.month))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-Math.max(1, Number(months || 12)));
  return accumulatedFromMonthlyRows(monthly);
}

async function fetchBcbByDateRange(seriesId, months, timeoutMs) {
  const start = startDateForMonths(months);
  const end = new Date();
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${encodeURIComponent(seriesId)}/dados?formato=json&dataInicial=${encodeURIComponent(bcbParamDate(start))}&dataFinal=${encodeURIComponent(bcbParamDate(end))}`;
  const { json, status, cacheStatus, error, parseError } = await fetchJson(url, {
    timeoutMs,
    ttlMs: 6 * 60 * 60 * 1000,
    staleMs: 7 * 24 * 60 * 60 * 1000,
    retries: 2
  });
  return { rows: Array.isArray(json) ? json : [], status, cacheStatus, error: error || (parseError ? 'bcb-json-parse-error' : '') };
}

export async function getCdiAccumulatedSeries(months = 12, timeoutMs = 5200) {
  const safeMonths = Math.max(1, Math.min(240, Number(months || 12)));
  const diagnostics = [];

  const dailyByDate = await fetchBcbByDateRange(CDI_DAILY_SERIES_ID, safeMonths, timeoutMs).catch(error => ({ rows: [], error: error?.message }));
  let points = monthlyCdiFromDailyRows(dailyByDate.rows || [], safeMonths);
  diagnostics.push({ provider: 'BCB_SGS_12_DATE_RANGE', status: points.length ? 'OK' : 'EMPTY', rows: dailyByDate.rows?.length || 0, cacheStatus: dailyByDate.cacheStatus, error: dailyByDate.error });
  if (points.length) {
    return {
      status: 'OK',
      source: 'BancoCentralSGS CDI diário série 12',
      sourceId: 'BCB_SGS_12',
      sourceVersion: VALORAE_CDI_SOURCE_VERSION,
      points,
      series: points,
      items: points,
      official: true,
      realOnly: true,
      diagnostics
    };
  }

  const monthlyByDate = await fetchBcbByDateRange(CDI_MONTHLY_SERIES_ID, safeMonths, timeoutMs).catch(error => ({ rows: [], error: error?.message }));
  points = monthlyCdiFromMonthlyRows(monthlyByDate.rows || [], safeMonths);
  diagnostics.push({ provider: 'BCB_SGS_4391_DATE_RANGE', status: points.length ? 'OK' : 'EMPTY', rows: monthlyByDate.rows?.length || 0, cacheStatus: monthlyByDate.cacheStatus, error: monthlyByDate.error });
  if (points.length) {
    return {
      status: 'OK',
      source: 'BancoCentralSGS CDI acumulado no mês série 4391',
      sourceId: 'BCB_SGS_4391',
      sourceVersion: VALORAE_CDI_SOURCE_VERSION,
      points,
      series: points,
      items: points,
      official: true,
      realOnly: true,
      diagnostics
    };
  }

  const lastDaily = Math.min(5200, Math.max(80, Math.ceil(safeMonths * 24) + 120));
  const fallbackDaily = await fetchBcbSeries(CDI_DAILY_SERIES_ID, { last: lastDaily, timeoutMs, bypassCache: false, cache: true }).catch(error => ({ ok: false, points: [], error: error?.message }));
  points = monthlyCdiFromDailyRows((fallbackDaily.points || []).map(p => ({ data: p.date, valor: p.value })), safeMonths, 'BancoCentralSGS CDI diário série 12 / últimos valores');
  diagnostics.push({ provider: 'BCB_SGS_12_LAST_VALUES', status: points.length ? 'OK' : 'EMPTY', rows: fallbackDaily.points?.length || 0, cacheStatus: fallbackDaily.cache, error: fallbackDaily.error });
  if (points.length) {
    return {
      status: 'OK',
      source: 'BancoCentralSGS CDI diário série 12 / últimos valores',
      sourceId: 'BCB_SGS_12',
      sourceVersion: VALORAE_CDI_SOURCE_VERSION,
      points,
      series: points,
      items: points,
      official: true,
      realOnly: true,
      diagnostics
    };
  }

  return {
    status: 'EMPTY',
    source: 'BancoCentralSGS CDI oficial',
    sourceId: 'BCB_SGS_12_OR_4391',
    sourceVersion: VALORAE_CDI_SOURCE_VERSION,
    points: [],
    series: [],
    items: [],
    official: true,
    realOnly: true,
    partial: true,
    error: diagnostics.map(d => d.error).filter(Boolean).join(' | ') || 'cdi-official-empty',
    diagnostics
  };
}
