import { fetchJson } from './fetch.js';
import { normalizeDate } from '../core/dates.js';
import { numberValue, round } from '../core/numbers.js';

export async function getIpcaSeries(months = 12) {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - Number(months || 12), 1));
  const fmt = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=${fmt(start)}&dataFinal=${fmt(today)}`;
  const { json, status, cacheStatus, error } = await fetchJson(url, { timeoutMs: 4500, ttlMs: 12 * 60 * 60 * 1000, staleMs: 7 * 24 * 60 * 60 * 1000 });
  const rows = Array.isArray(json) ? json : [];
  let factor = 1;
  const points = rows.map((row) => {
    const date = normalizeDate(row.data);
    const monthlyPercent = numberValue(row.valor, 0);
    factor *= (1 + monthlyPercent / 100);
    return { date, month: date.slice(0, 7), monthlyPercent, value: monthlyPercent, accumulatedPercent: round((factor - 1) * 100, 4) };
  }).filter(p => p.date).slice(-Number(months || 12));
  return { status: points.length ? 'OK' : 'EMPTY', source: 'Banco Central SGS 433', statusCode: status, cacheStatus, points, series: points, items: points, monthlyPercent: points.at(-1)?.monthlyPercent || 0, accumulatedPercent: points.at(-1)?.accumulatedPercent || 0, error };
}
