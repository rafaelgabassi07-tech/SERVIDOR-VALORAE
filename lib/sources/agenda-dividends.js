import { fetchText } from './fetch.js';
import { normalizeDate, eligibilityDateFromEvent, dateMillis } from '../core/dates.js';
import { numberValue } from '../core/numbers.js';
import { normalizeTicker, classifyTicker } from '../core/tickers.js';

function stripHtml(html = '') {
  return String(html).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function findNearbyDate(text, startIndex, radius = 260) {
  const chunk = text.slice(Math.max(0, startIndex - radius), Math.min(text.length, startIndex + radius));
  const matches = [...chunk.matchAll(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}\b/g)].map(m => normalizeDate(m[0])).filter(Boolean);
  return matches;
}

function findNearbyValue(text, startIndex, radius = 220) {
  const chunk = text.slice(startIndex, Math.min(text.length, startIndex + radius));
  const match = chunk.match(/R\$\s*[0-9.]+,[0-9]{2,6}|\b[0-9]+,[0-9]{2,6}\b/);
  return match ? numberValue(match[0]) : 0;
}

export function parseAgendaHtml(html = '', tickers = []) {
  const text = stripHtml(html).toUpperCase();
  const wanted = new Set((tickers || []).map(normalizeTicker).filter(Boolean));
  const tickerPattern = /\b[A-Z]{4}\d{1,2}B?\b/g;
  const out = [];
  for (const match of text.matchAll(tickerPattern)) {
    const ticker = normalizeTicker(match[0]);
    if (wanted.size && !wanted.has(ticker)) continue;
    const dates = findNearbyDate(text, match.index || 0);
    const value = findNearbyValue(text, match.index || 0);
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
      rawProvider: 'investidor10'
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
  const pages = ['https://investidor10.com.br/acoes/dividendos/', 'https://investidor10.com.br/fiis/dividendos/'];
  const diagnostics = [];
  const events = [];
  for (const url of pages) {
    const res = await fetchText(url, { timeoutMs: options.timeoutMs || 5000, ttlMs: 45 * 60 * 1000, staleMs: 12 * 60 * 60 * 1000 });
    diagnostics.push({ provider: 'investidor10', url, status: res.status, cacheStatus: res.cacheStatus, error: res.error });
    if (res.text) events.push(...parseAgendaHtml(res.text, tickers));
  }
  return { events, diagnostics };
}
