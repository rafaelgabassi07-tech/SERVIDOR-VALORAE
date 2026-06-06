export const VALORAE_I10_DIVIDEND_AGENDA_VERSION = '21.12.63-i10-dividend-agenda-sync';

const ACOES_AGENDA_URL = 'https://investidor10.com.br/acoes/dividendos/';
const FIIS_AGENDA_URL = 'https://investidor10.com.br/fiis/dividendos/';
const CACHE_TTL_MS = Number(process.env.VALORAE_I10_DIVIDEND_AGENDA_TTL_MS || 5 * 60 * 1000);
const agendaCache = new Map();

function stripTags(html = '') {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/tr>|<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#x2F;|&#47;/gi, '/')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\s+\n/g, '\n')
    .trim();
}

function canonicalTicker(value = '') {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isTickerLine(line = '') {
  return /^[A-Z]{3,6}\d{1,2}[A-Z]?$/.test(canonicalTicker(line));
}

function normalizeYear(yy) {
  const n = Number(yy);
  if (!Number.isFinite(n)) return yy;
  if (String(yy).length === 2) return String(n >= 80 ? 1900 + n : 2000 + n);
  return String(n).padStart(4, '0');
}

export function normalizeAgendaDate(value = '') {
  const s = String(value || '').trim();
  const br = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})/);
  if (!br) return '';
  const dd = br[1].padStart(2, '0');
  const mm = br[2].padStart(2, '0');
  const yyyy = normalizeYear(br[3]);
  return `${dd}/${mm}/${yyyy}`;
}

export function dateToIso(value = '') {
  const d = normalizeAgendaDate(value);
  const m = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseAgendaDate(value = '') {
  const d = normalizeAgendaDate(value);
  const m = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const out = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
  return Number.isFinite(out.getTime()) ? out : null;
}

function parseMoney(value = '') {
  const s = String(value || '').replace(/R\$/gi, '').replace(/-/g, '0').trim();
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : 0;
}

function cleanType(value = '') {
  const s = String(value || '').replace(/\s+/g, ' ').trim();
  if (/jscp|jcp/i.test(s)) return 'JSCP';
  if (/amort/i.test(s)) return 'Amortização';
  if (/red\.?\s*cap/i.test(s)) return 'Red. Cap.';
  if (/rend/i.test(s)) return 'Rendimento';
  if (/div/i.test(s)) return 'Dividendos';
  return s || 'Provento';
}

function eventKey(e = {}) {
  return [e.ticker, e.dateCom, e.paymentDate, e.type, Number(e.valuePerShare || 0).toFixed(8)].join('|').toUpperCase();
}

function normalizeEvent(row = {}, assetClass = '', sourceUrl = '') {
  const ticker = canonicalTicker(row.ticker || row.symbol || row.codigo);
  const dateCom = normalizeAgendaDate(row.dateCom || row.dataCom || row.comDate || row.recordDate);
  const paymentDate = normalizeAgendaDate(row.paymentDate || row.dataPagamento || row.payDate || row.date || row.data);
  const type = cleanType(row.type || row.tipo || row.kind || row.provento);
  const valuePerShare = parseMoney(row.valuePerShare ?? row.valor ?? row.value ?? row.amount ?? row.cashAmount);
  return {
    ticker,
    symbol: ticker,
    codigo: ticker,
    assetType: assetClass || 'ACAO',
    dateCom,
    dataCom: dateCom,
    dataComIso: dateToIso(dateCom),
    paymentDate,
    dataPagamento: paymentDate,
    paymentDateIso: dateToIso(paymentDate),
    valuePerShare,
    valor: valuePerShare,
    value: valuePerShare,
    valueFormatted: `R$ ${valuePerShare.toFixed(2).replace('.', ',')}`,
    currency: 'BRL',
    type,
    tipo: type,
    eventType: type,
    status: row.status || 'previsto',
    assetClass,
    source: row.source || 'investidor10',
    sourceUrl: sourceUrl || 'https://investidor10.com.br/',
  };
}

export function parseInvestidor10DividendAgendaHtml(html = '', { assetClass = '', url = '' } = {}) {
  const text = stripTags(html);
  const lines = text.split(/\n+/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const events = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const ticker = canonicalTicker(lines[i]);
    if (!isTickerLine(ticker)) continue;
    const windowLines = lines.slice(i + 1, i + 18);
    const joined = windowLines.join(' ');
    if (!/Data\s*Com/i.test(joined) || !/Pgto/i.test(joined) || !/R\$/.test(joined)) continue;
    const dateCom = normalizeAgendaDate(joined.match(/Data\s*Com\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{1,2}\/\d{2})/i)?.[1] || '');
    const afterPgto = joined.match(/Pgto\s+(.{0,80}?)(?:R\$\s*[-\d.,]+)/i)?.[1] || '';
    const paymentDate = normalizeAgendaDate(afterPgto);
    const typeCandidate = afterPgto.replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, ' ').replace(/Provisionado/gi, ' ').trim();
    const type = cleanType(typeCandidate || joined.match(/\b(JSCP|JCP|Dividendos|Amortização|Red\. Cap\.|Rendimento|Rend\. Trib\.)\b/i)?.[1]);
    const value = parseMoney(joined.match(/R\$\s*([-\d.,]+)/i)?.[1] || '');
    const event = normalizeEvent({ ticker, dateCom, paymentDate, type, valuePerShare: value }, assetClass, url);
    const key = eventKey(event);
    if ((event.dateCom || event.paymentDate) && !seen.has(key)) { seen.add(key); events.push(event); }
  }

  // Fallback para o trecho textual compacto que alguns renderizadores retornam numa única linha.
  const compact = text.replace(/\s+/g, ' ');
  const cardRe = /\b([A-Z]{3,6}\d{1,2}[A-Z]?)\b\s+.{0,140}?Data\s*Com\s+(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{1,2}\/\d{2})\s+Pgto\s+(?:(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{1,2}\/\d{2})\s+)?([A-Za-zÀ-ÿ.\s]{0,30}?)(?:\s+\4)?\s+R\$\s*([-\d.,]+)/gi;
  let m;
  while ((m = cardRe.exec(compact)) && events.length < 500) {
    const event = normalizeEvent({ ticker: m[1], dateCom: m[2], paymentDate: m[3] || '', type: m[4], valuePerShare: m[5] }, assetClass, url);
    const key = eventKey(event);
    if ((event.dateCom || event.paymentDate) && !seen.has(key)) { seen.add(key); events.push(event); }
  }

  return events.sort((a, b) => {
    const da = parseAgendaDate(a.paymentDate || a.dateCom)?.getTime() || Number.MAX_SAFE_INTEGER;
    const db = parseAgendaDate(b.paymentDate || b.dateCom)?.getTime() || Number.MAX_SAFE_INTEGER;
    return da - db || a.ticker.localeCompare(b.ticker);
  });
}

async function fetchHtml(url, { timeoutMs = 9000 } = {}) {
  if (typeof fetch !== 'function') throw new Error('fetch indisponível no runtime');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function cacheGet(key) {
  const hit = agendaCache.get(key);
  if (!hit || hit.expiresAt < Date.now()) return null;
  return hit.value;
}

function cacheSet(key, value) {
  if (agendaCache.size > 20) agendaCache.clear();
  agendaCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function fetchInvestidor10DividendAgenda(tickers = [], options = {}) {
  const wanted = new Set((tickers || []).map(canonicalTicker).filter(Boolean));
  const needStocks = options.assetClass === 'ACAO' || !options.assetClass || [...wanted].some(t => !t.endsWith('11'));
  const needFiis = options.assetClass === 'FII' || !options.assetClass || [...wanted].some(t => t.endsWith('11'));
  const tasks = [];
  if (needStocks) tasks.push(['ACAO', ACOES_AGENDA_URL]);
  if (needFiis) tasks.push(['FII', FIIS_AGENDA_URL]);
  const out = [];
  const diagnostics = [];
  for (const [assetClass, url] of tasks) {
    const cacheKey = `${assetClass}:${url}`;
    let events = cacheGet(cacheKey);
    try {
      if (!events) {
        const html = await fetchHtml(url, { timeoutMs: options.timeoutMs || 9000 });
        events = parseInvestidor10DividendAgendaHtml(html, { assetClass, url });
        cacheSet(cacheKey, events);
      }
      diagnostics.push({ assetClass, url, count: events.length, ok: true });
      out.push(...events);
    } catch (err) {
      diagnostics.push({ assetClass, url, count: 0, ok: false, error: err?.message || String(err) });
    }
  }
  const filtered = wanted.size ? out.filter(e => wanted.has(e.ticker)) : out;
  const seen = new Set();
  return {
    events: filtered.filter(e => {
      const key = eventKey(e);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
    diagnostics,
  };
}
