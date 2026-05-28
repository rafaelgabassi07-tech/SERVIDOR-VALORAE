import { parseFinancialNumber } from '../normalizers/numbers.js';

export const VALORAE_CHART_READINESS_VERSION = '21.11.7-chart-readiness-series-maturity';

function compact(value = '') { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function arr(value) { return Array.isArray(value) ? value : (value === undefined || value === null || value === '' ? [] : [value]); }

export function parsePtBrNumberForChart(value) {
  return parseFinancialNumber(value, { maxAbs: 1e15 });
}


function parseDateLike(value) {
  const s = compact(value).toLowerCase();
  if (!s) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/').map(Number);
    const t = Date.UTC(y, m - 1, d);
    return Number.isFinite(t) ? t : null;
  }
  if (/^\d{2}[/-]\d{4}$/.test(s)) {
    const [m, y] = s.split(/[/-]/).map(Number);
    const t = Date.UTC(y, m - 1, 1);
    return Number.isFinite(t) ? t : null;
  }
  const monthMap = { jan:0, fev:1, mar:2, abr:3, mai:4, jun:5, jul:6, ago:7, set:8, out:9, nov:10, dez:11, feb:1, apr:3, may:4, aug:7, sep:8, oct:9, dec:11 };
  const monthMatch = s.match(/(jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)[a-zç]*[\s/-]*(\d{2,4})/i);
  if (monthMatch) {
    const y = Number(monthMatch[2].length === 2 ? `20${monthMatch[2]}` : monthMatch[2]);
    const t = Date.UTC(y, monthMap[monthMatch[1].slice(0,3)] ?? 0, 1);
    return Number.isFinite(t) ? t : null;
  }
  const quarterMatch = s.match(/([1-4])\s*t\s*(\d{2,4})/i) || s.match(/q([1-4])\s*(\d{2,4})/i);
  if (quarterMatch) {
    const q = Number(quarterMatch[1]);
    const y = Number(quarterMatch[2].length === 2 ? `20${quarterMatch[2]}` : quarterMatch[2]);
    const t = Date.UTC(y, (q - 1) * 3, 1);
    return Number.isFinite(t) ? t : null;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }
  if (/^\d{4}$/.test(s)) return Date.UTC(Number(s), 0, 1);
  return null;
}

function extractPointsFromArray(values = []) {
  const points = [];
  for (const item of values.slice(0, 600)) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const dateRaw = item.data || item.date || item.label || item.x || item.periodo || item.dataCom || item.dataPagamento || '';
      const valueRaw = item.valor ?? item.value ?? item.y ?? item.preco ?? item.cotacao ?? item.rendimento ?? item.total;
      const n = parsePtBrNumberForChart(valueRaw);
      if (n !== null) points.push({ x: parseDateLike(dateRaw), y: n, rawX: dateRaw, rawY: valueRaw });
      continue;
    }
    const n = parsePtBrNumberForChart(item);
    if (n !== null) points.push({ x: null, y: n, rawY: item });
  }
  return points;
}

function estimateTrend(points = []) {
  const clean = points.map(p => p.y).filter(Number.isFinite);
  if (clean.length < 2) return 'flat';
  const first = clean[0];
  const last = clean[clean.length - 1];
  const diff = last - first;
  const base = Math.max(1, Math.abs(first));
  if (Math.abs(diff) / base < 0.015) return 'flat';
  return diff > 0 ? 'up' : 'down';
}

function scoreSeries(points = []) {
  const count = points.length;
  if (!count) return 0;
  const hasDates = points.filter(p => p.x !== null).length;
  const nonZero = points.filter(p => p.y !== 0).length;
  const unique = new Set(points.map(p => String(p.y))).size;
  const dateScore = count ? (hasDates / count) * 24 : 0;
  const densityScore = Math.min(40, count * 4);
  const varianceScore = unique > 1 ? 24 : 6;
  const valueScore = nonZero ? 12 : 0;
  return Math.round(Math.max(0, Math.min(100, densityScore + dateScore + varianceScore + valueScore)));
}

export function buildChartReadinessReport(results = {}) {
  const series = [];
  for (const [key, value] of Object.entries(results || {})) {
    const values = arr(value);
    let points = [];
    if (Array.isArray(value)) points = extractPointsFromArray(value);
    else if (value && typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value)) {
        if (Array.isArray(childValue)) {
          const childPoints = extractPointsFromArray(childValue);
          if (childPoints.length) series.push({ key: `${key}.${childKey}`, points: childPoints.length, score: scoreSeries(childPoints), trend: estimateTrend(childPoints), lastValue: childPoints.at(-1)?.y ?? null });
        }
      }
      continue;
    } else points = values.map(v => ({ y: parsePtBrNumberForChart(v), x: null, rawY: v })).filter(p => p.y !== null);
    if (points.length) series.push({ key, points: points.length, score: scoreSeries(points), trend: estimateTrend(points), lastValue: points.at(-1)?.y ?? null });
  }
  const usable = series.filter(s => s.points >= 2 && s.score >= 35);
  const numericPoints = series.reduce((sum, s) => sum + Number(s.points || 0), 0);
  const score = series.length ? Math.round(Math.min(100, usable.reduce((sum, s) => sum + s.score, 0) / Math.max(1, usable.length) + Math.min(18, usable.length * 3))) : 0;
  return {
    version: VALORAE_CHART_READINESS_VERSION,
    ready: usable.length > 0 || numericPoints >= 4,
    score,
    series: series.length,
    usableSeries: usable.length,
    numericPoints,
    topSeries: series.sort((a, b) => b.score - a.score || b.points - a.points).slice(0, 8),
    recommendations: [
      ...(usable.length ? [] : ['Nenhuma série com pontos suficientes para gráfico confiável.']),
      ...(numericPoints && usable.length === 0 ? ['Há números soltos, mas faltam labels/datas para série temporal.'] : []),
      ...(usable.some(s => s.score < 55) ? ['Algumas séries precisam de mais pontos ou datas para melhorar a leitura dos gráficos.'] : []),
    ],
  };
}
