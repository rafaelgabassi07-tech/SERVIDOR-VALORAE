import { fetchText } from '../sources/fetch.js';
import { getCachedMarketValue, setCachedMarketValue, withMarketInflight } from './cache.js';

export const VALORAE_B3_INDEX_HISTORY_VERSION = '21.12.0-b3-index-official';
const TTL_MS = Number(process.env.VALORAE_B3_INDEX_HISTORY_TTL_MS || 15 * 60 * 1000);
const STALE_MS = Number(process.env.VALORAE_B3_INDEX_HISTORY_STALE_MS || 24 * 60 * 60 * 1000);

const MONTHS_BR = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MONTHS_EN = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_INDEX = new Map([
  ...MONTHS_BR.map((m, i) => [m, i + 1]),
  ...MONTHS_EN.map((m, i) => [m, i + 1]),
  ['january', 1], ['february', 2], ['march', 3], ['april', 4], ['june', 6], ['july', 7], ['september', 9], ['october', 10], ['november', 11], ['december', 12],
  ['jan.', 1], ['fev.', 2], ['feb.', 2], ['mar.', 3], ['abr.', 4], ['apr.', 4], ['mai.', 5], ['may', 5], ['jun.', 6], ['jul.', 7], ['ago.', 8], ['aug.', 8], ['set.', 9], ['sep.', 9], ['out.', 10], ['oct.', 10], ['nov.', 11], ['dez.', 12], ['dec.', 12]
]);

function decodeHtml(value = '') {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value = '') {
  return decodeHtml(String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

function parseNumberBR(value) {
  const raw = decodeHtml(value).replace(/[^0-9,.-]/g, '');
  if (!raw) return NaN;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  const normalized = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}


function normalizeJsonDate(value, fallbackYear = new Date().getUTCFullYear()) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  m = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  m = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const dt = new Date(raw);
  if (Number.isFinite(dt.getTime())) return dt.toISOString().slice(0, 10);
  const day = Number(raw.match(/^\d{1,2}$/)?.[0] || NaN);
  if (Number.isFinite(day) && day >= 1 && day <= 31) return `${fallbackYear}-01-${String(day).padStart(2, '0')}`;
  return '';
}

function parseRowsFromJsonPayload(text = '', year = new Date().getUTCFullYear()) {
  const rows = [];
  const dateKeys = ['date','data','dt','dayDate','refDate','referenceDate','dataReferencia','pregao','tradingDate','Data','DataPregao'];
  const valueKeys = ['close','closing','fechamento','valor','value','price','cotacao','indice','index','indexValue','lastValue','vlIndice','number','Valor','Indice'];
  const visit = (node) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (typeof node !== 'object') return;
    const obj = node;
    let date = '';
    for (const key of dateKeys) {
      if (obj[key] != null) { date = normalizeJsonDate(obj[key], year); if (date) break; }
    }
    if (!date && obj.year && obj.month && obj.day) {
      date = `${String(obj.year).padStart(4, '0')}-${String(obj.month).padStart(2, '0')}-${String(obj.day).padStart(2, '0')}`;
    }
    let close = NaN;
    for (const key of valueKeys) {
      if (obj[key] != null) { close = parseNumberBR(obj[key]); if (Number.isFinite(close) && close > 0) break; }
    }
    if (date && Number.isFinite(close) && close > 0) {
      const dt = new Date(`${date}T12:00:00Z`);
      if (Number.isFinite(dt.getTime())) rows.push({ date, close, price: close, value: close, source: 'B3 indexStatisticsPage daily-evolution json' });
    }
    for (const value of Object.values(obj)) if (value && typeof value === 'object') visit(value);
  };
  try { visit(JSON.parse(text)); } catch (_) {}
  return rows;
}

function normalizeIndexCode(code = '') {
  const c = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c === 'IBOVESPA') return 'IBOV';
  return c || 'IFIX';
}

function candidateUrls(indexCode, year) {
  const code = normalizeIndexCode(indexCode);
  const y = Number(year || new Date().getUTCFullYear());
  const base = `https://sistemaswebb3-listados.b3.com.br/indexStatisticsPage/daily-evolution/${encodeURIComponent(code)}`;
  return [
    `${base}?language=pt-br&year=${y}`,
    `${base}?language=pt-br&ano=${y}`,
    `${base}?language=pt-br`
  ];
}

function parseRowsFromHtml(html = '', year = new Date().getUTCFullYear()) {
  const rows = [];
  const trMatches = String(html || '').match(/<tr[\s\S]*?<\/tr>/gi) || [];
  let headerMonths = [];
  for (const tr of trMatches) {
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => stripTags(m[1])).filter(Boolean);
    if (!cells.length) continue;
    const lower = cells.map(c => c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());
    const months = lower.map(c => MONTH_INDEX.get(c)).filter(Boolean);
    if (months.length >= 3) {
      headerMonths = lower.map(c => MONTH_INDEX.get(c) || null);
      continue;
    }
    const day = Number(String(cells[0] || '').match(/^\d{1,2}/)?.[0] || NaN);
    if (!Number.isFinite(day) || day < 1 || day > 31 || !headerMonths.length) continue;
    for (let i = 1; i < cells.length && i < headerMonths.length; i++) {
      const month = headerMonths[i];
      if (!month) continue;
      const close = parseNumberBR(cells[i]);
      if (!Number.isFinite(close) || close <= 0) continue;
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dt = new Date(`${date}T12:00:00Z`);
      if (dt.getUTCFullYear() !== year || dt.getUTCMonth() + 1 !== month || dt.getUTCDate() !== day) continue;
      rows.push({ date, close, price: close, value: close, source: 'B3 indexStatisticsPage daily-evolution' });
    }
  }
  if (rows.length) return rows;

  // Fallback for pages rendered as plain text: "Dia Jan Fev ..." followed by day rows.
  const text = stripTags(String(html || '').replace(/<\/t[dh]>/gi, ' | ').replace(/<\/tr>/gi, '\n'));
  const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  let monthHeader = [];
  for (const line of lines) {
    const cols = line.split('|').map(s => s.trim()).filter(Boolean);
    const lower = cols.map(c => c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());
    const months = lower.map(c => MONTH_INDEX.get(c)).filter(Boolean);
    if (months.length >= 3) { monthHeader = lower.map(c => MONTH_INDEX.get(c) || null); continue; }
    const day = Number(cols[0]);
    if (!Number.isFinite(day) || !monthHeader.length) continue;
    for (let i = 1; i < cols.length && i < monthHeader.length; i++) {
      const month = monthHeader[i];
      const close = parseNumberBR(cols[i]);
      if (!month || !Number.isFinite(close) || close <= 0) continue;
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      rows.push({ date, close, price: close, value: close, source: 'B3 indexStatisticsPage daily-evolution' });
    }
  }
  return rows;
}

function summarize(points = []) {
  if (!points.length) return {};
  const first = points[0].close;
  const last = points.at(-1).close;
  return {
    firstClose: first,
    lastClose: last,
    variationPct: first > 0 ? Math.round(((last / first) - 1) * 10000) / 100 : null,
    points: points.length,
    firstDate: points[0].date,
    lastDate: points.at(-1).date
  };
}

export async function fetchB3IndexDailyEvolution(indexCode = 'IFIX', { years = 2, timeoutMs = 6500, limit = 520, bypassCache = false } = {}) {
  const code = normalizeIndexCode(indexCode);
  const nowYear = new Date().getUTCFullYear();
  const yearList = Array.from({ length: Math.max(1, Math.min(5, Number(years || 2))) }, (_, i) => nowYear - i);
  const cacheKey = JSON.stringify({ code, years: yearList, limit: Number(limit || 0) });
  if (!bypassCache) {
    const hit = getCachedMarketValue('b3-index-history', cacheKey, { allowStale: false });
    if (hit) return { ...hit.data, cache: hit.cache };
  }
  return withMarketInflight('b3-index-history', cacheKey, async () => {
    const diagnostics = [];
    const byDate = new Map();
    for (const year of yearList) {
      let parsed = [];
      for (const url of candidateUrls(code, year)) {
        const { text, status, cacheStatus, error, finalUrl } = await fetchText(url, {
          timeoutMs,
          ttlMs: TTL_MS,
          staleMs: STALE_MS,
          headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', Referer: 'https://www.b3.com.br/' }
        });
        parsed = parseRowsFromJsonPayload(text, year);
        if (!parsed.length) parsed = parseRowsFromHtml(text, year);
        diagnostics.push({ year, url: finalUrl || url, status, cacheStatus, parsed: parsed.length, error });
        if (parsed.length) break;
      }
      for (const point of parsed) byDate.set(point.date, { ...point, index: code });
    }
    const points = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-Number(limit || 520));
    const payload = {
      ok: points.length > 1,
      status: points.length > 1 ? 'OK' : 'EMPTY',
      ticker: code,
      index: code,
      range: 'B3_DAILY_EVOLUTION',
      source: 'B3 Oficial - indexStatisticsPage/daily-evolution',
      sourceVersion: VALORAE_B3_INDEX_HISTORY_VERSION,
      official: true,
      simulated: false,
      proxyTickerUsed: false,
      points,
      history: points,
      series: points,
      prices: points,
      chartHistory: points,
      summary: summarize(points),
      diagnostics,
      error: points.length > 1 ? undefined : 'B3 daily-evolution sem pontos suficientes para o índice.'
    };
    if (payload.ok) {
      setCachedMarketValue('b3-index-history', cacheKey, payload, { ttlMs: TTL_MS, staleMs: STALE_MS, maxEntries: 30, maxBytes: 3 * 1024 * 1024 });
      return payload;
    }
    const stale = getCachedMarketValue('b3-index-history', cacheKey, { allowStale: true });
    if (stale) return { ...stale.data, cache: 'STALE_IF_ERROR', warning: payload.error };
    return payload;
  });
}
