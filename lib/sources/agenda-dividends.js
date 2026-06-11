import { fetchText } from './fetch.js';
import { normalizeDate, eligibilityDateFromEvent, dateMillis } from '../core/dates.js';
import { numberValue } from '../core/numbers.js';
import { normalizeTicker, classifyTicker } from '../core/tickers.js';
import { applyDividendTax, dividendType } from './status-dividends.js';

function envOff(name) {
  return ['0', 'false', 'no', 'off'].includes(String(process.env[name] || '').trim().toLowerCase());
}

function decodeHtmlEntities(value = '') {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&atilde;/gi, 'ã')
    .replace(/&otilde;/gi, 'õ')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&#x2F;/gi, '/');
}

function stripHtml(html = '') {
  return decodeHtmlEntities(String(html))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value = '') {
  return stripHtml(value).replace(/\s+/g, ' ').trim();
}

function normalizeHeader(value = '') {
  return cleanText(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim().toUpperCase();
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

function cellsFromRow(row = '') {
  return [...String(row).matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => cleanText(m[1]));
}

function tickerFromAny(value = '') {
  const match = String(value || '').toUpperCase().match(/\b[A-Z]{4}\d{1,2}B?\b/);
  return normalizeTicker(match?.[0] || value || '');
}

function firstNonBlank(...values) {
  for (const value of values) {
    const text = cleanText(value || '');
    if (text) return text;
  }
  return '';
}

function buildAgendaEvent(ticker, segment = '', overrides = {}) {
  const clean = normalizeTicker(ticker);
  const fullSegment = [segment, overrides.rowText, overrides.type, overrides.rawText].filter(Boolean).join(' ');
  const dates = findDatesInSegment(fullSegment);
  const value = numberValue(overrides.valuePerShare ?? overrides.value ?? findValueInSegment(fullSegment), 0);
  const dateCom = normalizeDate(overrides.dateCom) || labelledDate(fullSegment, ['data\\s*com', 'dt\\.?\\s*com', 'data\\s*base', 'base', 'record', 'com']) || (dates.length >= 2 ? dates[0] : '');
  const exDate = normalizeDate(overrides.exDate) || labelledDate(fullSegment, ['data\\s*ex', 'dt\\.?\\s*ex', 'ex[-\\s]*dividend', 'ex']);
  const paymentDate = normalizeDate(overrides.paymentDate) || labelledDate(fullSegment, ['data\\s*de\\s*pagamento', 'data\\s*pagamento', 'pagamento', 'pagto', 'pgto', 'payment', 'pay']) || (dates.length >= 2 ? dates[1] : (dates[0] || ''));
  const detectedType = dividendType({ dividendType: firstNonBlank(overrides.type, overrides.dividendType, fullSegment) });
  const base = {
    ticker: clean,
    assetClass: classifyTicker(clean),
    dateCom,
    exDate,
    paymentDate,
    valuePerShare: value,
    grossValuePerShare: value,
    dividendType: detectedType === 'PROVENTO' ? (classifyTicker(clean) === 'FII' ? 'RENDIMENTO' : 'PROVENTO') : detectedType,
    source: 'VALORAE Agenda Oficial',
    sourceKind: overrides.sourceKind || 'calendar-complement',
    status: paymentDate ? (dateMillis(paymentDate) <= Date.now() ? 'Recebido' : 'Previsto') : 'Anunciado/Provisionado',
    rawProvider: 'investidor10-agenda',
    rawDividendType: firstNonBlank(overrides.type, overrides.dividendType),
    rawText: fullSegment.slice(0, 500)
  };
  const taxed = applyDividendTax(base, { dividendType: base.dividendType, type: overrides.type, valuePerShare: value, grossValuePerShare: value });
  const eligibility = eligibilityDateFromEvent(taxed);
  taxed.eligibilityDate = eligibility.date;
  taxed.eligibilityDateSource = eligibility.source;
  taxed.eventKey = [clean, taxed.eligibilityDate || taxed.dateCom || taxed.exDate || '', paymentDate || '', taxed.dividendType, Number(taxed.grossValuePerShare || taxed.valuePerShare || 0).toFixed(8)].join('|');
  return (clean && (value > 0 || paymentDate || dateCom || exDate)) ? taxed : null;
}

function headerIndex(headers, patterns) {
  return headers.findIndex(header => patterns.some(pattern => pattern.test(header)));
}

function structuredEventsFromTable(html = '', wanted = new Set()) {
  const out = [];
  const tables = [...String(html || '').matchAll(/<table[\s\S]*?<\/table>/gi)].map(m => m[0]);
  for (const table of tables) {
    let headers = [];
    for (const row of [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(m => m[0])) {
      const cells = cellsFromRow(row);
      if (cells.length < 2) continue;
      const isHeader = /<th\b/i.test(row) || cells.some(c => /ativo|ticker|codigo|valor|pagamento|tipo|provento/i.test(c));
      if (isHeader && cells.some(c => /ativo|ticker|codigo|valor|pagamento|tipo|provento|data/i.test(c))) {
        headers = cells.map(normalizeHeader);
        continue;
      }
      const rowText = cells.join(' ');
      const genericTicker = tickerFromAny(rowText);
      const tickerIndex = headerIndex(headers, [/\b(TICKER|ATIVO|CODIGO|COD)\b/]);
      const typeIndex = headerIndex(headers, [/\b(TIPO|PROVENTO|EVENTO|DESCRICAO)\b/]);
      const valueIndex = headerIndex(headers, [/\b(VALOR|VL|PRECO|COTA|ACAO)\b/]);
      const comIndex = headerIndex(headers, [/DATA.*COM/, /DATA.*BASE/, /COM$/]);
      const exIndex = headerIndex(headers, [/DATA.*EX/, /\bEX\b/]);
      const payIndex = headerIndex(headers, [/PAGAMENTO/, /PAGTO/, /PGTO/, /PAYMENT/]);
      const ticker = tickerFromAny(tickerIndex >= 0 ? cells[tickerIndex] : genericTicker);
      if (!ticker || !wanted.has(ticker)) continue;
      out.push(buildAgendaEvent(ticker, rowText, {
        type: typeIndex >= 0 ? cells[typeIndex] : '',
        valuePerShare: valueIndex >= 0 ? cells[valueIndex] : undefined,
        dateCom: comIndex >= 0 ? cells[comIndex] : '',
        exDate: exIndex >= 0 ? cells[exIndex] : '',
        paymentDate: payIndex >= 0 ? cells[payIndex] : '',
        rowText,
        sourceKind: 'calendar-table'
      }));
    }
  }
  return out.filter(Boolean);
}

function objectValue(obj = {}, aliases = []) {
  const entries = Object.entries(obj || {});
  for (const alias of aliases) {
    const found = entries.find(([key]) => normalizeHeader(key) === normalizeHeader(alias));
    if (found) return found[1];
  }
  for (const alias of aliases) {
    const needle = normalizeHeader(alias);
    const found = entries.find(([key]) => normalizeHeader(key).includes(needle) || needle.includes(normalizeHeader(key)));
    if (found) return found[1];
  }
  return undefined;
}

function eventFromObject(obj = {}, wanted = new Set()) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const ticker = tickerFromAny(objectValue(obj, ['ticker', 'symbol', 'codigo', 'code', 'ativo', 'asset']));
  if (!ticker || !wanted.has(ticker)) return null;
  return buildAgendaEvent(ticker, JSON.stringify(obj).slice(0, 800), {
    type: objectValue(obj, ['dividendType', 'tipo', 'type', 'eventType', 'tipoEvento', 'proventoTipo', 'descricao', 'description']),
    valuePerShare: objectValue(obj, ['valuePerShare', 'valorPorAcao', 'valorPorCota', 'valor', 'value', 'amount', 'v', 'cashAmount', 'rendimento', 'provento']),
    dateCom: objectValue(obj, ['dateCom', 'dataCom', 'dataBase', 'recordDate', 'ed', 'dataCorte']),
    exDate: objectValue(obj, ['exDate', 'dataEx', 'exDividendDate']),
    paymentDate: objectValue(obj, ['paymentDate', 'dataPagamento', 'payDate', 'dataPagto', 'pd', 'pagamento']),
    sourceKind: 'calendar-json'
  });
}

function extractJsonLikeEvents(html = '', wanted = new Set()) {
  const out = [];
  const seenObjects = new Set();
  const scripts = [...String(html || '').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => decodeHtmlEntities(m[1] || ''));
  function visit(value, depth = 0) {
    if (depth > 10 || value == null) return;
    if (Array.isArray(value)) return value.forEach(v => visit(v, depth + 1));
    if (typeof value === 'string') {
      if (!/(provento|divid|jscp|jcp|rendimento|pagamento|ticker|ativo)/i.test(value)) return;
      const decoded = decodeHtmlEntities(value)
        .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\"/g, '"')
        .replace(/\\\//g, '/');
      const trimmed = decoded.trim();
      if (/^[\[{]/.test(trimmed)) {
        try { visit(JSON.parse(trimmed), depth + 1); } catch {}
      }
      for (const item of boundedTickerSegments(decoded.toUpperCase())) {
        if (wanted.has(item.ticker)) out.push(buildAgendaEvent(item.ticker, item.segment, { sourceKind: 'calendar-script-string' }));
      }
      return;
    }
    if (typeof value === 'object') {
      const key = JSON.stringify(value).slice(0, 800);
      if (!seenObjects.has(key)) {
        seenObjects.add(key);
        const event = eventFromObject(value, wanted);
        if (event) out.push(event);
      }
      Object.values(value).forEach(v => visit(v, depth + 1));
    }
  }
  for (const script of scripts) {
    if (!/(provento|divid|jscp|jcp|rendimento|pagamento|ticker|ativo)/i.test(script)) continue;
    const candidates = [];
    const trimmed = script.trim();
    if (/^[\[{]/.test(trimmed)) candidates.push(trimmed);
    for (const m of script.matchAll(/(?:window\.__NEXT_DATA__|__NEXT_DATA__|data|props|calendar|agenda)\s*=\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*;?/gi)) {
      candidates.push(m[1]);
    }
    for (const m of script.matchAll(/self\.__next_f\.push\(\s*(\[[\s\S]*?\])\s*\)/gi)) {
      candidates.push(m[1]);
    }
    for (const candidate of candidates) {
      try { visit(JSON.parse(candidate)); } catch {}
    }
  }
  return out;
}

function boundedTickerSegments(text = '') {
  const tickerPattern = /\b[A-Z]{4}\d{1,2}B?\b/g;
  const matches = [...String(text).matchAll(tickerPattern)];
  return matches.map((match, index) => {
    const start = match.index || 0;
    const next = matches[index + 1]?.index ?? text.length;
    const end = Math.min(next, start + 720);
    return { ticker: normalizeTicker(match[0]), start, end, segment: text.slice(start, end) };
  });
}

export function parseAgendaHtml(html = '', tickers = []) {
  const text = stripHtml(html).toUpperCase();
  const wanted = new Set((Array.isArray(tickers) ? tickers : String(tickers || '').split(/[,;\s]+/)).map(normalizeTicker).filter(Boolean));
  const out = [];
  if (!String(html || '').trim() || wanted.size === 0) return out;

  const seen = new Set();
  function add(event) {
    if (!event || !wanted.has(event.ticker)) return;
    const key = event.eventKey || [event.ticker, event.dateCom || event.exDate || '', event.paymentDate || '', event.dividendType || '', Number(event.grossValuePerShare || event.valuePerShare || 0).toFixed(8)].join('|');
    if (!seen.has(key)) { seen.add(key); out.push(event); }
  }

  structuredEventsFromTable(html, wanted).forEach(add);
  extractJsonLikeEvents(html, wanted).forEach(add);

  for (const row of htmlRows(html)) {
    const rowText = stripHtml(row).toUpperCase();
    if (!rowText) continue;
    for (const ticker of wanted) {
      if (rowText.includes(ticker)) add(buildAgendaEvent(ticker, rowText, { sourceKind: 'calendar-row' }));
    }
  }

  for (const item of boundedTickerSegments(text)) add(buildAgendaEvent(item.ticker, item.segment, { sourceKind: 'calendar-bounded-segment' }));
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
  const res = await fetchText(url, { timeoutMs: options.timeoutMs || options.agendaTimeoutMs || 5000, ttlMs: 45 * 60 * 1000, staleMs: 12 * 60 * 60 * 1000 });
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
  const concurrency = Math.max(1, Math.min(Number(process.env.VALORAE_AGENDA_CONCURRENCY || options.agendaConcurrency || 5), 8));
  let index = 0;
  async function worker() {
    while (index < urls.length) {
      const url = urls[index++];
      const res = await fetchAgendaPage(url, options).catch(error => ({ url, status: 0, cacheStatus: 'ERROR', error: error?.message || String(error), text: '' }));
      diagnostics.push({ provider: 'investidor10-agenda', url: res.url, status: res.status, cacheStatus: res.cacheStatus, error: res.error, attempts: res.attempts });
      if (res.text) events.push(...parseAgendaHtml(res.text, cleanTickers));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));
  return { events, diagnostics };
}
