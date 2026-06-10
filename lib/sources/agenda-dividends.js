import { fetchText } from './fetch.js';
import { normalizeDate, eligibilityDateFromEvent, dateMillis } from '../core/dates.js';
import { numberValue } from '../core/numbers.js';
import { normalizeTicker, classifyTicker } from '../core/tickers.js';

function envOff(name) {
  return ['0', 'false', 'no', 'off'].includes(String(process.env[name] || '').trim().toLowerCase());
}

function stripHtml(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function findDatesInSegment(segment = '') {
  return [...String(segment).matchAll(/\b(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g)]
    .map(m => normalizeDate(m[0]))
    .filter(Boolean);
}

function findValueInSegment(segment = '') {
  const match = String(segment).match(/R\$\s*[0-9.]+,[0-9]{2,8}|\b[0-9]+,[0-9]{2,8}\b|\b[0-9]+\.[0-9]{2,8}\b/);
  return match ? numberValue(match[0]) : 0;
}

function htmlRows(html = '') {
  const text = String(html || '');
  const rows = [...text.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(m => m[0]);
  if (rows.length) return rows;
  if (/<(?:br|li|article|div|section|p)\b/i.test(text)) {
    return text.split(/(?:<br\s*\/?\s*>|<\/li>|<\/article>|<\/section>|<\/p>|<\/div>)/i).filter(Boolean);
  }
  return [];
}

function labelledDate(segment = '', labels = []) {
  const normalized = String(segment).replace(/\s+/g, ' ');
  for (const label of labels) {
    const re = new RegExp(`${label}[^0-9]{0,48}(\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})`, 'i');
    const match = normalized.match(re);
    const date = match ? normalizeDate(match[1]) : '';
    if (date) return date;
  }
  return '';
}

function buildAgendaEvent(ticker, segment = '') {
  const clean = normalizeTicker(ticker);
  const dates = findDatesInSegment(segment);
  const value = findValueInSegment(segment);
  const dateCom = labelledDate(segment, ['data\\s*com', 'dt\\.?\\s*com', 'com', 'data\\s*base', 'base', 'record']) || (dates.length >= 2 ? dates[0] : '');
  const exDate = labelledDate(segment, ['data\\s*ex', 'dt\\.?\\s*ex', 'ex[-\\s]*dividend', 'ex']);
  const paymentDate = labelledDate(segment, ['pagamento', 'pagto', 'pgto', 'payment', 'pay']) || (dates.length >= 2 ? dates[1] : (dates[0] || ''));
  const event = {
    ticker: clean,
    assetClass: classifyTicker(clean),
    dateCom,
    exDate,
    paymentDate,
    valuePerShare: value,
    dividendType: /jcp|juros/i.test(segment) ? 'JCP' : (/rendimento/i.test(segment) ? 'RENDIMENTO' : 'PROVENTO'),
    source: 'VALORAE Agenda Oficial',
    sourceKind: 'calendar-complement',
    status: paymentDate ? (dateMillis(paymentDate) <= Date.now() ? 'Recebido' : 'Previsto') : 'Anunciado/Provisionado',
    rawProvider: 'investidor10-agenda'
  };
  const eligibility = eligibilityDateFromEvent(event);
  event.eligibilityDate = eligibility.date;
  event.eligibilityDateSource = eligibility.source;
  event.eventKey = [clean, event.eligibilityDate || event.dateCom || event.exDate || '', paymentDate || '', event.dividendType, Number(event.valuePerShare || 0).toFixed(8)].join('|');
  return (clean && (value > 0 || paymentDate || dateCom || exDate)) ? event : null;
}

function boundedTickerSegments(text = '') {
  const tickerPattern = /\b[A-Z]{4}\d{1,2}B?\b/g;
  const matches = [...String(text).matchAll(tickerPattern)];
  return matches.map((match, index) => {
    const start = match.index || 0;
    const next = matches[index + 1]?.index ?? text.length;
    const end = Math.min(next, start + 420);
    return { ticker: normalizeTicker(match[0]), start, end, segment: text.slice(start, end) };
  });
}

export function parseAgendaHtml(html = '', tickers = []) {
  const text = stripHtml(html).toUpperCase();
  const wanted = new Set((Array.isArray(tickers) ? tickers : String(tickers || '').split(/[,;\s]+/)).map(normalizeTicker).filter(Boolean));
  const out = [];
  if (!text || wanted.size === 0) return out;

  const seen = new Set();
  function add(event) {
    if (!event || !wanted.has(event.ticker)) return;
    const key = event.eventKey || [event.ticker, event.dateCom || event.exDate || '', event.paymentDate || '', event.dividendType || '', Number(event.valuePerShare || 0).toFixed(8)].join('|');
    if (!seen.has(key)) { seen.add(key); out.push(event); }
  }

  for (const row of htmlRows(html)) {
    const rowText = stripHtml(row).toUpperCase();
    if (!rowText) continue;
    for (const ticker of wanted) {
      if (rowText.includes(ticker)) add(buildAgendaEvent(ticker, rowText));
    }
  }

  for (const item of boundedTickerSegments(text)) add(buildAgendaEvent(item.ticker, item.segment));
  return out;
}

export async function getAgendaDividends(tickers = [], options = {}) {
  const cleanTickers = (Array.isArray(tickers) ? tickers : String(tickers || '').split(/[,;\s]+/)).map(normalizeTicker).filter(Boolean);
  if (envOff('VALORAE_INVESTIDOR10_AGENDA_ENABLED') || envOff('VALORAE_AGENDA_ENABLED')) {
    return { events: [], diagnostics: [{ provider: 'investidor10-agenda', status: 'SKIPPED', reason: 'agenda-disabled-by-env' }] };
  }
  if (cleanTickers.length === 0 && !options.includeAll) {
    return { events: [], diagnostics: [{ provider: 'investidor10-agenda', status: 'SKIPPED', reason: 'emptyTickers' }] };
  }
  const pages = ['https://investidor10.com.br/acoes/dividendos/', 'https://investidor10.com.br/fiis/dividendos/'];
  const diagnostics = [];
  const events = [];
  for (const url of pages) {
    const res = await fetchText(url, { timeoutMs: options.timeoutMs || 5000, ttlMs: 45 * 60 * 1000, staleMs: 12 * 60 * 60 * 1000 });
    diagnostics.push({ provider: 'investidor10-agenda', url, status: res.status, cacheStatus: res.cacheStatus, error: res.error });
    if (res.text) events.push(...parseAgendaHtml(res.text, cleanTickers));
  }
  return { events, diagnostics };
}
