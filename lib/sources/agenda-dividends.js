import { fetchText } from './fetch.js';
import { normalizeDate, eligibilityDateFromEvent, dateMillis } from '../core/dates.js';
import { numberValue } from '../core/numbers.js';
import { normalizeTicker, classifyTicker } from '../core/tickers.js';
import { applyDividendTax, dividendType } from './status-dividends.js';

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
  const cards = [...text.matchAll(/<(?:article|li|section|div|p)\b[\s\S]*?<\/(?:article|li|section|div|p)>/gi)].map(m => m[0]);
  if (cards.length) return cards;
  if (/<(?:br|li|article|div|section|p)\b/i.test(text)) {
    return text.split(/(?:<br\s*\/?\s*>|<\/li>|<\/article>|<\/section>|<\/p>|<\/div>)/i).filter(Boolean);
  }
  return [];
}

function labelledDate(segment = '', labels = []) {
  const normalized = String(segment).replace(/\s+/g, ' ');
  for (const label of labels) {
    const re = new RegExp(`${label}[^0-9]{0,64}(\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})`, 'i');
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
  const dateCom = labelledDate(segment, ['data\\s*com', 'dt\\.?\\s*com', 'data\\s*base', 'base', 'record']) || (dates.length >= 2 ? dates[0] : '');
  const exDate = labelledDate(segment, ['data\\s*ex', 'dt\\.?\\s*ex', 'ex[-\\s]*dividend', 'ex']);
  const paymentDate = labelledDate(segment, ['data\\s*de\\s*pagamento', 'pagamento', 'pagto', 'pgto', 'payment', 'pay']) || (dates.length >= 2 ? dates[1] : (dates[0] || ''));
  const detectedType = dividendType({ dividendType: segment });
  const base = {
    ticker: clean,
    assetClass: classifyTicker(clean),
    dateCom,
    exDate,
    paymentDate,
    valuePerShare: value,
    dividendType: detectedType === 'PROVENTO' ? (classifyTicker(clean) === 'FII' ? 'RENDIMENTO' : 'PROVENTO') : detectedType,
    source: 'VALORAE Agenda Oficial',
    sourceKind: 'calendar-complement',
    status: paymentDate ? (dateMillis(paymentDate) <= Date.now() ? 'Recebido' : 'Previsto') : 'Anunciado/Provisionado',
    rawProvider: 'investidor10-agenda'
  };
  const taxed = applyDividendTax(base, { dividendType: base.dividendType, valuePerShare: value });
  const eligibility = eligibilityDateFromEvent(taxed);
  taxed.eligibilityDate = eligibility.date;
  taxed.eligibilityDateSource = eligibility.source;
  taxed.eventKey = [clean, taxed.eligibilityDate || taxed.dateCom || taxed.exDate || '', paymentDate || '', taxed.dividendType, Number(taxed.grossValuePerShare || taxed.valuePerShare || 0).toFixed(8)].join('|');
  return (clean && (value > 0 || paymentDate || dateCom || exDate)) ? taxed : null;
}

function boundedTickerSegments(text = '') {
  const tickerPattern = /\b[A-Z]{4}\d{1,2}B?\b/g;
  const matches = [...String(text).matchAll(tickerPattern)];
  return matches.map((match, index) => {
    const start = match.index || 0;
    const next = matches[index + 1]?.index ?? text.length;
    const end = Math.min(next, start + 560);
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
    const key = event.eventKey || [event.ticker, event.dateCom || event.exDate || '', event.paymentDate || '', event.dividendType || '', Number(event.grossValuePerShare || event.valuePerShare || 0).toFixed(8)].join('|');
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

const MONTH_SLUGS = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function agendaFutureMonths(options = {}) {
  const value = Number(options.futureMonths ?? process.env.VALORAE_AGENDA_MONTHS_AHEAD ?? 18);
  return Number.isFinite(value) ? Math.max(0, Math.min(36, Math.floor(value))) : 18;
}

function monthUrls(base, monthsAhead = 18) {
  const now = new Date();
  const urls = [];
  for (let i = 0; i <= monthsAhead; i++) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() + i, 1));
    const year = d.getUTCFullYear();
    const slug = MONTH_SLUGS[d.getUTCMonth()];
    urls.push(`https://investidor10.com.br/${base}/dividendos/${year}/${slug}/`);
    urls.push(`https://investidor10.com.br/${base}/dividendos/${year}/${slug}/data-de-pagamento/`);
  }
  return urls;
}

function agendaUrls(options = {}) {
  if (envOff('VALORAE_AGENDA_MONTH_PAGES_ENABLED')) {
    return ['https://investidor10.com.br/acoes/dividendos/', 'https://investidor10.com.br/fiis/dividendos/'];
  }
  const months = agendaFutureMonths(options);
  return [...new Set([
    'https://investidor10.com.br/acoes/dividendos/',
    'https://investidor10.com.br/fiis/dividendos/',
    ...monthUrls('acoes', months),
    ...monthUrls('fiis', months)
  ])];
}

async function fetchAgendaPage(url, options = {}) {
  const res = await fetchText(url, { timeoutMs: options.timeoutMs || 5000, ttlMs: 45 * 60 * 1000, staleMs: 12 * 60 * 60 * 1000 });
  return { url, ...res };
}

export async function getAgendaDividends(tickers = [], options = {}) {
  const cleanTickers = (Array.isArray(tickers) ? tickers : String(tickers || '').split(/[,;\s]+/)).map(normalizeTicker).filter(Boolean);
  if (envOff('VALORAE_INVESTIDOR10_AGENDA_ENABLED') || envOff('VALORAE_AGENDA_ENABLED')) {
    return { events: [], diagnostics: [{ provider: 'investidor10-agenda', status: 'SKIPPED', reason: 'agenda-disabled-by-env' }] };
  }
  if (cleanTickers.length === 0 && !options.includeAll) {
    return { events: [], diagnostics: [{ provider: 'investidor10-agenda', status: 'SKIPPED', reason: 'emptyTickers' }] };
  }
  const urls = agendaUrls(options);
  const diagnostics = [];
  const events = [];
  const concurrency = Math.max(1, Math.min(Number(process.env.VALORAE_AGENDA_CONCURRENCY || 5), 8));
  let index = 0;
  async function worker() {
    while (index < urls.length) {
      const url = urls[index++];
      const res = await fetchAgendaPage(url, options).catch(error => ({ url, status: 0, cacheStatus: 'ERROR', error: error?.message || String(error), text: '' }));
      diagnostics.push({ provider: 'investidor10-agenda', url: res.url, status: res.status, cacheStatus: res.cacheStatus, error: res.error });
      if (res.text) events.push(...parseAgendaHtml(res.text, cleanTickers));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));
  return { events, diagnostics };
}
