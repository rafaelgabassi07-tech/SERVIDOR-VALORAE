import { parseFinancialNumber } from '../normalizers/numbers.js';

export const VALORAE_CHART_SERIES_VERSION = '21.12.2-chart-series-deep-consumer-normalizer';

const MAX_POINTS_PER_SOURCE = 1000;
const MAX_RECURSION_DEPTH = 4;
const DATE_KEYS = ['data','date','datetime','timestamp','label','x','periodo','competencia','dataPagamento','dataCom','month','ano','year'];
const VALUE_KEYS = ['valor','value','y','preco','cotacao','close','last','rendimento','total','dividendo','amount','v','open','high','low','volume','dy','yield','patrimonio','pvp','pl'];
const META_KEYS = new Set([...DATE_KEYS, 'name', 'label', 'id', 'key', 'source', 'tipo', 'type', 'categoria', 'category']);

function arr(v) { return Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]); }
function text(v) { return String(v ?? '').replace(/\s+/g, ' ').trim(); }
function uniqKey(base = 'series', used = new Set()) {
  let key = text(base).replace(/[^A-Za-z0-9_.:-]+/g, '_').replace(/^_+|_+$/g, '') || 'series';
  const root = key;
  let i = 2;
  while (used.has(key)) key = `${root}_${i++}`;
  used.add(key);
  return key;
}

function parseDate(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 100000000000) return value;
    if (value > 1000000000) return value * 1000;
    if (value >= 1900 && value <= 2200) return Date.UTC(value, 0, 1);
  }
  const s = text(value).toLowerCase();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const t = Date.parse(s); return Number.isFinite(t) ? t : null; }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d, m, y] = s.split('/').map(Number); const t = Date.UTC(y, m - 1, d); return Number.isFinite(t) ? t : null; }
  if (/^\d{2}[/-]\d{4}$/.test(s)) { const [m, y] = s.split(/[/-]/).map(Number); const t = Date.UTC(y, m - 1, 1); return Number.isFinite(t) ? t : null; }
  if (/^\d{4}$/.test(s)) { const t = Date.UTC(Number(s), 0, 1); return Number.isFinite(t) ? t : null; }
  const monthMap = { jan: 0, fev: 1, feb: 1, mar: 2, abr: 3, apr: 3, mai: 4, may: 4, jun: 5, jul: 6, ago: 7, aug: 7, set: 8, sep: 8, out: 9, oct: 9, nov: 10, dez: 11, dec: 11 };
  const month = s.match(/(jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)[a-zç]*[\s/-]*(\d{2,4})/i);
  if (month) { const y = Number(month[2].length === 2 ? `20${month[2]}` : month[2]); const t = Date.UTC(y, monthMap[month[1].slice(0, 3)] ?? 0, 1); return Number.isFinite(t) ? t : null; }
  const q = s.match(/(?:q|)([1-4])\s*t?\s*(\d{2,4})/i);
  if (q) { const y = Number(q[2].length === 2 ? `20${q[2]}` : q[2]); const t = Date.UTC(y, (Number(q[1]) - 1) * 3, 1); return Number.isFinite(t) ? t : null; }
  return null;
}

function numberFrom(value) {
  const n = parseFinancialNumber(value, { maxAbs: 1e15 });
  return n === null ? null : n;
}

function valueFromObject(item = {}) {
  for (const key of VALUE_KEYS) {
    if (item[key] !== undefined) return { key, raw: item[key], y: numberFrom(item[key]) };
  }
  return { key: undefined, raw: item[1], y: numberFrom(item[1]) };
}

function xFromObject(item = {}, fallbackLabel = '') {
  for (const key of DATE_KEYS) {
    if (item[key] !== undefined) {
      const raw = item[key];
      return { raw, x: parseDate(raw), label: text(raw || fallbackLabel), key };
    }
  }
  const raw = item[0] ?? fallbackLabel;
  return { raw, x: parseDate(raw), label: text(raw || fallbackLabel), key: undefined };
}

function pointFrom(item, index = 0, labels = []) {
  const fallbackLabel = labels[index] ?? '';
  if (Array.isArray(item)) {
    if (item.length >= 5 && parseDate(item[0]) !== null) {
      const y = numberFrom(item[4]);
      if (y !== null) return { x: parseDate(item[0] ?? fallbackLabel), y, label: text(item[0] ?? fallbackLabel), raw: item[4], ohlc: { open: numberFrom(item[1]), high: numberFrom(item[2]), low: numberFrom(item[3]), close: y } };
    }
    if (item.length >= 2) {
      const y = numberFrom(item[1]);
      if (y !== null) return { x: parseDate(item[0] ?? fallbackLabel), y, label: text(item[0] ?? fallbackLabel), raw: item[1] };
    }
    const y = numberFrom(item[0]);
    return y === null ? null : { x: parseDate(fallbackLabel), y, label: text(fallbackLabel), raw: item[0] };
  }
  if (item && typeof item === 'object') {
    const { raw, y } = valueFromObject(item);
    if (y === null) return null;
    const x = xFromObject(item, fallbackLabel);
    return { x: x.x, y, label: x.label, raw };
  }
  const y = numberFrom(item);
  return y === null ? null : { x: parseDate(fallbackLabel), y, label: text(fallbackLabel), raw: item };
}

function numericKeysFromObjectArray(values = []) {
  const counts = new Map();
  const sample = values.filter(v => v && typeof v === 'object' && !Array.isArray(v)).slice(0, 80);
  for (const item of sample) {
    for (const [key, val] of Object.entries(item)) {
      if (META_KEYS.has(key) || DATE_KEYS.includes(key)) continue;
      if (numberFrom(val) !== null) counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= Math.max(2, Math.ceil(sample.length * 0.35)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key]) => key);
}

function collectPoints(value, labels = [], valueKey = null) {
  const points = [];
  for (const [i, item] of arr(value).slice(0, MAX_POINTS_PER_SOURCE).entries()) {
    let p;
    if (valueKey && item && typeof item === 'object' && !Array.isArray(item)) {
      const y = numberFrom(item[valueKey]);
      if (y !== null) {
        const x = xFromObject(item, labels[i] ?? '');
        p = { x: x.x, y, label: x.label, raw: item[valueKey] };
      }
    } else {
      p = pointFrom(item, i, labels);
    }
    if (p && Number.isFinite(p.y)) points.push(p);
  }
  return points;
}

function categoriesOf(obj = {}) {
  const xAxis = Array.isArray(obj.xAxis) ? obj.xAxis[0] : obj.xAxis;
  return arr(obj.categories || obj.labels || xAxis?.categories || obj.axisLabels).map(text);
}

function summarize(points) {
  const ys = points.map(p => p.y).filter(Number.isFinite);
  if (!ys.length) return { min: null, max: null, first: null, last: null, changePercent: null };
  const first = ys[0], last = ys[ys.length - 1];
  return { min: Math.min(...ys), max: Math.max(...ys), first, last, changePercent: first ? Math.round(((last - first) / Math.abs(first)) * 10000) / 100 : null };
}

function quality(points = []) {
  const dated = points.filter(p => p.x !== null).length;
  const uniqueValues = new Set(points.map(p => String(p.y))).size;
  return Math.round(Math.min(100, points.length * 8 + (dated / Math.max(1, points.length)) * 24 + (uniqueValues > 1 ? 18 : 0)));
}

function addSeries(out, key, points, meta = {}) {
  const clean = (points || []).filter(p => p && Number.isFinite(p.y));
  if (clean.length < 2) return;
  out.push({
    key,
    name: meta.name || key.split('.').at(-1) || key,
    points: clean.slice(0, 240),
    summary: summarize(clean),
    pointCount: clean.length,
    score: quality(clean),
    sourceFormat: meta.sourceFormat || 'array',
  });
}

function addObjectArraySeries(out, key, values, labels, sourceFormat = 'object-array') {
  const numericKeys = numericKeysFromObjectArray(values);
  if (numericKeys.length >= 2) {
    const used = new Set();
    for (const valueKey of numericKeys) {
      addSeries(out, `${key}.${uniqKey(valueKey, used)}`, collectPoints(values, labels, valueKey), { name: valueKey, sourceFormat: `${sourceFormat}-multi-field` });
    }
    return true;
  }
  return false;
}

function isDateKeyedNumericMap(value = {}) {
  const entries = Object.entries(value || {});
  if (entries.length < 2 || entries.length > MAX_POINTS_PER_SOURCE) return false;
  let usable = 0;
  for (const [key, val] of entries.slice(0, 80)) {
    if (parseDate(key) !== null && numberFrom(val) !== null) usable += 1;
  }
  return usable >= Math.max(2, Math.ceil(Math.min(entries.length, 80) * 0.6));
}

function pointsFromDateKeyedMap(value = {}) {
  return Object.entries(value || {})
    .slice(0, MAX_POINTS_PER_SOURCE)
    .map(([key, val]) => {
      const y = numberFrom(val);
      return y === null ? null : { x: parseDate(key), y, label: text(key), raw: val };
    })
    .filter(Boolean)
    .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
}

function extractTableSeries(key, value, out) {
  const rows = value?.rows || value?.data;
  const columns = value?.columns || value?.cols || value?.headers;
  if (!Array.isArray(rows) || !Array.isArray(columns) || rows.length < 2) return false;
  const labels = columns.map(c => text(c?.key || c?.field || c?.name || c));
  const dateIndex = labels.findIndex(label => DATE_KEYS.includes(label));
  const used = new Set();
  for (let col = 0; col < labels.length; col++) {
    if (col === dateIndex) continue;
    const points = [];
    for (const row of rows.slice(0, MAX_POINTS_PER_SOURCE)) {
      const rawY = Array.isArray(row) ? row[col] : row?.[labels[col]];
      const rawX = Array.isArray(row) ? row[dateIndex] : row?.[labels[dateIndex]];
      const y = numberFrom(rawY);
      if (y !== null) points.push({ x: parseDate(rawX), y, label: text(rawX), raw: rawY });
    }
    addSeries(out, `${key}.${uniqKey(labels[col] || `col_${col + 1}`, used)}`, points, { name: labels[col] || `Coluna ${col + 1}`, sourceFormat: 'table-rows-columns' });
  }
  return true;
}

function extractSeriesFromValue(key, value, out, depth = 0) {
  if (depth > MAX_RECURSION_DEPTH || value == null) return;
  const labels = value && typeof value === 'object' && !Array.isArray(value) ? categoriesOf(value) : [];

  if (Array.isArray(value)) {
    if (value.some(v => v && typeof v === 'object' && !Array.isArray(v)) && addObjectArraySeries(out, key, value, labels)) return;
    addSeries(out, key, collectPoints(value, labels), { sourceFormat: 'array' });
    return;
  }

  if (value && typeof value === 'object') {
    if (isDateKeyedNumericMap(value)) {
      addSeries(out, key, pointsFromDateKeyedMap(value), { sourceFormat: 'date-keyed-map' });
      return;
    }
    extractTableSeries(key, value, out);

    if (Array.isArray(value.datasets)) {
      for (const [i, ds] of value.datasets.entries()) addSeries(out, `${key}.${uniqKey(ds?.label || ds?.name || `dataset_${i + 1}`, new Set())}`, collectPoints(ds?.data || ds?.values || [], labels), { name: text(ds?.label || ds?.name || `Dataset ${i + 1}`), sourceFormat: 'chartjs-dataset' });
    }
    if (Array.isArray(value.series)) {
      for (const [i, s] of value.series.entries()) {
        const seriesKey = `${key}.${text(s?.id || s?.name || `series_${i + 1}`).replace(/[^A-Za-z0-9_.:-]+/g, '_')}`;
        const data = s?.data ?? s?.values ?? s;
        const sLabels = arr(s?.categories || s?.labels || labels).map(text);
        if (Array.isArray(data) && data.some(v => v && typeof v === 'object' && !Array.isArray(v)) && addObjectArraySeries(out, seriesKey, data, sLabels, 'highcharts-series')) continue;
        addSeries(out, seriesKey, collectPoints(data, sLabels), { name: text(s?.name || s?.label || `Série ${i + 1}`), sourceFormat: 'highcharts-series' });
      }
    }
    if (Array.isArray(value.data) || Array.isArray(value.values)) {
      const data = value.data || value.values;
      if (!(Array.isArray(data) && data.some(v => v && typeof v === 'object' && !Array.isArray(v)) && addObjectArraySeries(out, key, data, labels, 'object-data'))) {
        addSeries(out, key, collectPoints(data, labels), { sourceFormat: 'object-data' });
      }
    }

    const skip = new Set(['series', 'datasets', 'data', 'values', 'labels', 'categories', 'xAxis', 'yAxis', 'options', 'columns', 'cols', 'headers', 'rows']);
    for (const [childKey, childValue] of Object.entries(value)) {
      if (skip.has(childKey)) continue;
      if (Array.isArray(childValue) || (childValue && typeof childValue === 'object')) extractSeriesFromValue(`${key}.${childKey}`, childValue, out, depth + 1);
    }
  }
}

export function buildNormalizedChartSeries(results = {}, options = {}) {
  const out = [];
  const used = new Set();
  const maxSeries = Math.max(1, Math.min(Number(options.maxSeries || 8), 30));
  for (const [key, value] of Object.entries(results || {})) extractSeriesFromValue(uniqKey(key, used), value, out, 0);
  out.sort((a, b) => (b.score - a.score) || (b.pointCount - a.pointCount));
  return { version: VALORAE_CHART_SERIES_VERSION, count: out.length, series: out.slice(0, maxSeries), totalSeriesDetected: out.length };
}

export const _test = { parseDate, collectPoints, categoriesOf, extractSeriesFromValue, numericKeysFromObjectArray, isDateKeyedNumericMap, pointsFromDateKeyedMap };
