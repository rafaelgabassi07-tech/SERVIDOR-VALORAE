import { round } from '../core/numbers.js';
import { fetchJson } from '../sources/fetch.js';

export const VALORAE_INVESTIDOR10_INDEX_HISTORY_VERSION = '21.12.362-investidor10-direct-index-history-v1';

const INDEX_IDS = Object.freeze({
  IBOV: 1,
  SMLL: 6,
  IDIV: 8,
  IFIX: 22
});

function normalizeIndexCode(value = '') {
  const clean = String(value || '').trim().toUpperCase().replace(/\.SA$/i, '');
  if (clean === '^BVSP' || clean === 'IBOVESPA') return 'IBOV';
  return clean.replace(/[^A-Z0-9]/g, '');
}

function parseInvestidor10Date(value = '') {
  const raw = String(value || '').trim();
  let match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
  match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
  return '';
}

function numericIndexPoint(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value ?? '').replace(/\s+/g, '').trim();
  if (!raw) return null;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  const normalized = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function cutoffForMonths(lastDate = '', months = 120) {
  const last = new Date(`${lastDate}T12:00:00.000Z`);
  if (!Number.isFinite(last.getTime())) return 0;
  last.setUTCMonth(last.getUTCMonth() - Math.max(1, Number(months) || 120));
  return last.getTime();
}

function monthEndPoints(points = []) {
  const byMonth = new Map();
  for (const point of points) byMonth.set(String(point.date).slice(0, 7), point);
  return [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function normalizeInvestidor10IndexHistory(raw, {
  indexCode = '',
  months = 120,
  limit = 240
} = {}) {
  const code = normalizeIndexCode(indexCode);
  const source = `Investidor10 API de cotações do índice ${code}`;
  const rows = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
  const byDate = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const date = parseInvestidor10Date(row.last_update ?? row.date ?? row.data ?? row.reference_date);
    const close = numericIndexPoint(row.points ?? row.value ?? row.valor ?? row.close ?? row.price);
    if (!date || close === null) continue;
    const timestampMs = Date.parse(`${date}T12:00:00.000Z`);
    if (!Number.isFinite(timestampMs)) continue;
    byDate.set(date, {
      date,
      timestamp: Math.floor(timestampMs / 1000),
      time: new Date(timestampMs).toISOString(),
      close: round(close, 4),
      price: round(close, 4),
      value: round(close, 4),
      label: `${date.slice(5, 7)}/${date.slice(2, 4)}`,
      source,
      officialIndexCode: code,
      simulated: false,
      synthetic: false,
      proxyTickerUsed: false
    });
  }
  let points = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (points.length) {
    const cutoff = cutoffForMonths(points.at(-1).date, months);
    const sliced = points.filter(point => point.timestamp * 1000 >= cutoff);
    if (sliced.length >= 2) points = sliced;
  }
  // O comparativo é mensal. Consolidar o último valor real de cada mês reduz o
  // payload móvel sem reconstruir, interpolar ou alterar a série publicada.
  points = monthEndPoints(points);
  const safeLimit = Math.max(2, Number(limit) || 240);
  return points.slice(-safeLimit);
}

export async function fetchInvestidor10DirectIndexHistory(indexCode = '', {
  months = 120,
  timeoutMs = 9000,
  limit = 240
} = {}) {
  const code = normalizeIndexCode(indexCode);
  const indexId = INDEX_IDS[code];
  if (!indexId) {
    return {
      ok: false,
      status: 'UNSUPPORTED',
      ticker: code,
      points: [],
      error: `Índice ${code || 'vazio'} não possui ID público mapeado no Investidor10.`
    };
  }
  const url = `https://investidor10.com.br/api/indices/cotacoes/${indexId}/3650`;
  const response = await fetchJson(url, {
    timeoutMs: Math.min(18000, Math.max(3500, Number(timeoutMs) || 9000)),
    ttlMs: 30 * 60 * 1000,
    staleMs: 24 * 60 * 60 * 1000,
    retries: 0,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `https://investidor10.com.br/indices/${code.toLowerCase()}/`
    }
  }).catch(error => ({ json: null, status: 0, cacheStatus: 'ERROR', error: error?.message || String(error) }));
  const points = normalizeInvestidor10IndexHistory(response?.json, { indexCode: code, months, limit });
  const source = `Investidor10 API de cotações do índice ${code}`;
  return {
    ok: points.length >= 2,
    status: points.length >= 2 ? 'OK' : 'EMPTY',
    ticker: code,
    index: code,
    indexId,
    range: `${Math.max(1, Number(months) || 120)}M`,
    source,
    sourceUrl: `https://investidor10.com.br/indices/${code.toLowerCase()}/`,
    endpoint: url,
    sourceVersion: VALORAE_INVESTIDOR10_INDEX_HISTORY_VERSION,
    official: false,
    directIndexSymbol: true,
    simulated: false,
    synthetic: false,
    proxyTickerUsed: false,
    points,
    history: points,
    series: points,
    prices: points,
    chartHistory: points,
    cacheStatus: response?.cacheStatus,
    statusCode: response?.status || 0,
    error: points.length >= 2
      ? undefined
      : ((response?.error || response?.parseError)
          ? 'Investidor10 não entregou uma série de índice parseável.'
          : `Série ${code} sem pontos suficientes.`),
    diagnostics: {
      provider: 'Investidor10',
      indexId,
      rawRows: Array.isArray(response?.json) ? response.json.length : 0,
      normalizedPoints: points.length,
      policy: 'direct_index_series_no_etf_no_proxy_no_interpolation'
    }
  };
}

export const _test = {
  INDEX_IDS,
  normalizeIndexCode,
  parseInvestidor10Date,
  normalizeInvestidor10IndexHistory
};
