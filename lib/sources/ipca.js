import { fetchJson } from './fetch.js';
import { normalizeDate } from '../core/dates.js';
import { numberValue, round } from '../core/numbers.js';


function fallbackIpcaSeries(months = 12, reason = '') {
  const safeMonths = Math.max(1, Math.min(120, Number(months || 12)));
  const today = new Date();
  const points = [];
  let factor = 1;
  // Fallback operacional conservador quando a fonte pública está temporariamente indisponível.
  // Ele mantém a página funcional e é marcado como fallback, sem substituir cache/live quando houver.
  const monthlyPercent = 0.35;
  for (let i = safeMonths - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    factor *= (1 + monthlyPercent / 100);
    const date = d.toISOString().slice(0, 10);
    points.push({ date, month: date.slice(0, 7), monthlyPercent, value: monthlyPercent, accumulatedPercent: round((factor - 1) * 100, 4), fallback: true });
  }
  return { status: 'FALLBACK', source: 'VALORAE IPCA fallback', cacheStatus: 'FALLBACK', points, series: points, items: points, monthlyPercent, accumulatedPercent: points.at(-1)?.accumulatedPercent || 0, partial: true, reason };
}

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
  if (!points.length) return fallbackIpcaSeries(months, error || 'empty-live-series');
  return { status: 'OK', source: 'VALORAE IPCA', statusCode: status, cacheStatus, points, series: points, items: points, monthlyPercent: points.at(-1)?.monthlyPercent || 0, accumulatedPercent: points.at(-1)?.accumulatedPercent || 0, error };
}
