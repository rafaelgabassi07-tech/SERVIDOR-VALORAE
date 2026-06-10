import { fetchText } from './fetch.js';
import { normalizeDate, eligibilityDateFromEvent, dateMillis } from '../core/dates.js';
import { numberValue } from '../core/numbers.js';
import { normalizeTicker, classifyTicker } from '../core/tickers.js';

function stripHtml(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function findDatesInSegment(segment = '') {
  return [...String(segment).matchAll(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}\b/g)]
    .map(m => normalizeDate(m[0]))
    .filter(Boolean);
}

function findValueInSegment(segment = '') {
  const match = String(segment).match(/R\$\s*[0-9.]+,[0-9]{2,6}|\b[0-9]+,[0-9]{2,6}\b/);
  return match ? numberValue(match[0]) : 0;
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
  const wanted = new Set((tickers || []).map(normalizeTicker).filter(Boolean));
  const out = [];
  if (!text || wanted.size === 0) return out;
  for (const item of boundedTickerSegments(text)) {
    const ticker = item.ticker;
    if (!wanted.has(ticker)) continue;
    const dates = findDatesInSegment(item.segment);
    const value = findValueInSegment(item.segment);
    const paymentDate = dates[0] || '';
    const dateCom = dates.length > 1 ? dates[1] : '';
    const event = {
      ticker,
      assetClass: classifyTicker(ticker),
      dateCom,
      exDate: '',
      paymentDate,
      valuePerShare: value,
      dividendType: 'PROVENTO',
      source: 'VALORAE Agenda Oficial',
      sourceKind: 'calendar-complement',
      status: paymentDate ? (dateMillis(paymentDate) <= Date.now() ? 'Recebido' : 'Previsto') : 'Anunciado/Provisionado',
      rawProvider: 'calendar'
    };
    const eligibility = eligibilityDateFromEvent(event);
    event.eligibilityDate = eligibility.date;
    event.eligibilityDateSource = eligibility.source;
    event.eventKey = [ticker, event.eligibilityDate || '', paymentDate || '', event.valuePerShare.toFixed(8)].join('|');
    if (value > 0 || paymentDate || dateCom) out.push(event);
  }
  return out;
}

export async function getAgendaDividends(tickers = [], options = {}) {
  const cleanTickers = (tickers || []).map(normalizeTicker).filter(Boolean);
  if (cleanTickers.length === 0 && !options.includeAll) {
    return { events: [], diagnostics: [{ provider: 'agenda', status: 'SKIPPED', reason: 'emptyTickers' }] };
  }
  const pages = ['https://investidor10.com.br/acoes/dividendos/', 'https://investidor10.com.br/fiis/dividendos/'];
  const diagnostics = [];
  const events = [];
  for (const url of pages) {
    const res = await fetchText(url, { timeoutMs: options.timeoutMs || 5000, ttlMs: 45 * 60 * 1000, staleMs: 12 * 60 * 60 * 1000 });
    diagnostics.push({ provider: 'agenda', url, status: res.status, cacheStatus: res.cacheStatus, error: res.error });
    if (res.text) events.push(...parseAgendaHtml(res.text, cleanTickers));
  }
  return { events, diagnostics };
}
