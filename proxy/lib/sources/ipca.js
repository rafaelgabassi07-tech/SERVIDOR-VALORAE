import { fetchJson, fetchText } from './fetch.js';
import { normalizeDate } from '../core/dates.js';
import { numberValue, round } from '../core/numbers.js';

function emptyIpcaSeries(months = 12, reason = '') {
  return {
    status: 'EMPTY',
    source: 'VALORAE IPCA fontes reais',
    cacheStatus: 'EMPTY',
    points: [],
    series: [],
    items: [],
    monthlyPercent: 0,
    accumulatedPercent: 0,
    partial: true,
    realOnly: true,
    reason: reason || 'empty-live-series'
  };
}

function envOff(name) {
  return ['0', 'false', 'no', 'off'].includes(String(process.env[name] || '').trim().toLowerCase());
}

const MONTHS = {
  JANEIRO: '01', JAN: '01', FEVEREIRO: '02', FEV: '02', MARCO: '03', MARÇO: '03', MAR: '03', ABRIL: '04', ABR: '04',
  MAIO: '05', MAI: '05', JUNHO: '06', JUN: '06', JULHO: '07', JUL: '07', AGOSTO: '08', AGO: '08', SETEMBRO: '09', SET: '09',
  OUTUBRO: '10', OUT: '10', NOVEMBRO: '11', NOV: '11', DEZEMBRO: '12', DEZ: '12'
};

function cleanText(value = '') {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&atilde;/gi, 'ã')
    .replace(/&otilde;/gi, 'õ')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseInvestidor10Month(label = '') {
  const text = cleanText(label).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const year = (text.match(/\b(20\d{2}|19\d{2})\b/) || [])[1];
  if (!year) return '';
  const monthToken = Object.keys(MONTHS).find(m => text.includes(m.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
  const month = monthToken ? MONTHS[monthToken] : (text.match(/\b(0?[1-9]|1[0-2])\b/) || [])[1]?.padStart(2, '0');
  return month ? `${year}-${month}-01` : '';
}

function parseInvestidor10IpcaRows(html = '', safeMonths = 12) {
  const rows = [...String(html || '').matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(m => m[0]);
  const raw = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => cleanText(m[1]));
    const text = cells.join(' ');
    if (!/IPCA|\d{4}|janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/i.test(text)) continue;
    const date = parseInvestidor10Month(cells[0] || text);
    if (!date) continue;
    const numbers = cells.slice(1).join(' ').match(/-?\d{1,3}(?:\.\d{3})*,\d{1,4}|-?\d+(?:\.\d+)?/g) || [];
    if (!numbers.length) continue;
    const monthlyPercent = numberValue(numbers[0], NaN);
    if (!Number.isFinite(monthlyPercent)) continue;
    raw.push({ date, monthlyPercent });
  }
  const dedup = [...new Map(raw.map(p => [p.date, p])).values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-safeMonths);
  let factor = 1;
  return dedup.map((row) => {
    factor *= (1 + row.monthlyPercent / 100);
    return { date: row.date, month: row.date.slice(0, 7), monthlyPercent: row.monthlyPercent, value: row.monthlyPercent, accumulatedPercent: round((factor - 1) * 100, 4), source: 'VALORAE IPCA Investidor10 tabela real', realOnly: true };
  });
}

async function getIpcaFromInvestidor10(safeMonths = 12, reason = '') {
  if (envOff('VALORAE_IPCA_INVESTIDOR10_ENABLED')) return emptyIpcaSeries(safeMonths, reason || 'investidor10-disabled');
  const { text, status, cacheStatus, error } = await fetchText('https://investidor10.com.br/indices/ipca/', { timeoutMs: 4800, ttlMs: 12 * 60 * 60 * 1000, staleMs: 7 * 24 * 60 * 60 * 1000 });
  const points = parseInvestidor10IpcaRows(text, safeMonths);
  if (!points.length) return emptyIpcaSeries(safeMonths, error || reason || 'investidor10-empty-table');
  return { status: 'OK', source: 'VALORAE IPCA Investidor10 tabela real', statusCode: status, cacheStatus, points, series: points, items: points, monthlyPercent: points.at(-1)?.monthlyPercent || 0, accumulatedPercent: points.at(-1)?.accumulatedPercent || 0, realOnly: true, error };
}

export async function getIpcaSeries(months = 12) {
  const safeMonths = Math.max(1, Math.min(120, Number(months || 12)));
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - safeMonths, 1));
  const fmt = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=${fmt(start)}&dataFinal=${fmt(today)}`;
  const { json, status, cacheStatus, error } = await fetchJson(url, { timeoutMs: 4500, ttlMs: 12 * 60 * 60 * 1000, staleMs: 7 * 24 * 60 * 60 * 1000 });
  const rows = Array.isArray(json) ? json : [];
  let factor = 1;
  const points = rows.map((row) => {
    const date = normalizeDate(row.data);
    const monthlyPercent = numberValue(row.valor, 0);
    factor *= (1 + monthlyPercent / 100);
    return { date, month: date.slice(0, 7), monthlyPercent, value: monthlyPercent, accumulatedPercent: round((factor - 1) * 100, 4), source: 'VALORAE IPCA BCB SGS 433', realOnly: true };
  }).filter(p => p.date).slice(-safeMonths);
  if (!points.length) return getIpcaFromInvestidor10(safeMonths, error || 'bcb-empty-live-series');
  return { status: 'OK', source: 'VALORAE IPCA BCB SGS 433', statusCode: status, cacheStatus, points, series: points, items: points, monthlyPercent: points.at(-1)?.monthlyPercent || 0, accumulatedPercent: points.at(-1)?.accumulatedPercent || 0, realOnly: true, error };
}
