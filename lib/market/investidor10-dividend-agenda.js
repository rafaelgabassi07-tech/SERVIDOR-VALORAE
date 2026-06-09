export const VALORAE_I10_DIVIDEND_AGENDA_VERSION = '21.12.67-i10-dividend-agenda-range-history-future';

const ACOES_AGENDA_URL = 'https://investidor10.com.br/acoes/dividendos/';
const FIIS_AGENDA_URL = 'https://investidor10.com.br/fiis/dividendos/';
const CACHE_TTL_MS = Number(process.env.VALORAE_I10_DIVIDEND_AGENDA_TTL_MS || 5 * 60 * 1000);
const DEFAULT_FUTURE_MONTHS = Number(process.env.VALORAE_I10_DIVIDEND_AGENDA_FUTURE_MONTHS || 18);
const DEFAULT_HISTORY_MONTHS = Number(process.env.VALORAE_I10_DIVIDEND_AGENDA_HISTORY_MONTHS || 36);
const MAX_RANGE_MONTHS = Number(process.env.VALORAE_I10_DIVIDEND_AGENDA_MAX_RANGE_MONTHS || 72);
const MAX_FETCH_CONCURRENCY = Number(process.env.VALORAE_I10_DIVIDEND_AGENDA_CONCURRENCY || 4);
const agendaCache = new Map();

const PT_MONTH_SLUGS = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function startOfUtcMonth(date = new Date()) {
  const d = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addUtcMonths(date, offset) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

function parseAnyDate(value = '') {
  const s = String(value || '').trim();
  const br = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/);
  if (br) {
    const yyyy = normalizeYear(br[3]);
    const out = new Date(Date.UTC(Number(yyyy), Number(br[2]) - 1, Number(br[1])));
    return Number.isFinite(out.getTime()) ? out : null;
  }
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const out = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return Number.isFinite(out.getTime()) ? out : null;
  }
  const ms = Number(s);
  if (Number.isFinite(ms) && ms > 0) {
    const out = new Date(ms > 10_000_000_000 ? ms : ms * 1000);
    return Number.isFinite(out.getTime()) ? out : null;
  }
  return null;
}

function buildDividendAgendaUrls(baseUrl, options = {}) {
  const now = startOfUtcMonth(parseAnyDate(options.now || options.referenceDate) || new Date());
  const startFrom = parseAnyDate(options.startDate || options.fromDate || options.portfolioCreatedAt || options.createdAt);
  const explicitHistoryWindow = options.historyMonths !== undefined || options.monthsBack !== undefined || options.pastMonths !== undefined || options.backMonths !== undefined;
  let historyMonths = clampInt(
    options.historyMonths ?? options.monthsBack ?? options.pastMonths ?? options.backMonths,
    DEFAULT_HISTORY_MONTHS,
    0,
    MAX_RANGE_MONTHS
  );
  const futureMonths = clampInt(
    options.futureMonths ?? options.monthsForward ?? options.horizonMonths ?? options.forwardMonths,
    DEFAULT_FUTURE_MONTHS,
    0,
    MAX_RANGE_MONTHS
  );
  if (startFrom && !explicitHistoryWindow) {
    const start = startOfUtcMonth(startFrom);
    const diff = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth());
    historyMonths = Math.max(historyMonths, Math.min(MAX_RANGE_MONTHS, diff));
  }
  const urls = new Map();
  urls.set(baseUrl, { url: baseUrl, label: 'mes-atual', offset: 0 });
  for (let offset = -historyMonths; offset <= futureMonths; offset++) {
    const d = addUtcMonths(now, offset);
    const slug = PT_MONTH_SLUGS[d.getUTCMonth()];
    const url = `${baseUrl}${d.getUTCFullYear()}/${slug}/`;
    urls.set(url, { url, label: `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`, offset });
  }
  return Array.from(urls.values()).sort((a, b) => {
    const pa = a.offset === 0 ? -2 : a.offset > 0 ? a.offset : Math.abs(a.offset) + 100;
    const pb = b.offset === 0 ? -2 : b.offset > 0 ? b.offset : Math.abs(b.offset) + 100;
    return pa - pb;
  });
}

async function mapLimit(items, limit, mapper) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

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

export function parseAgendaDate(value = '') {
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

function normalizeEvent(row = {}, assetClass = '') {
  const ticker = canonicalTicker(row.ticker || row.symbol || row.codigo);
  const dateCom = normalizeAgendaDate(row.dateCom || row.dataCom || row.comDate || row.recordDate);
  const paymentDate = normalizeAgendaDate(row.paymentDate || row.dataPagamento || row.payDate || row.date || row.data);
  const type = cleanType(row.type || row.tipo || row.kind || row.provento);
  const valuePerShare = parseMoney(row.valuePerShare ?? row.valor ?? row.value ?? row.amount ?? row.cashAmount);
  const provisioned = /provisionad|a confirmar|sem data/i.test(String(row.paymentStatus || row.pgtoText || row.status || row.raw || '')) || (!paymentDate && /jscp|jcp|div|rend|amort|red/i.test(type));
  const confirmed = Boolean(paymentDate);
  const status = row.status || (confirmed ? 'Confirmado' : provisioned ? 'Anunciado/Provisionado' : 'Anunciado');
  return {
    ticker,
    asset: ticker,
    symbol: ticker,
    codigo: ticker,
    dateCom,
    dataCom: dateCom,
    comDate: dateCom,
    recordDate: dateCom,
    paymentDate,
    payDate: paymentDate,
    dataPagamento: paymentDate,
    valuePerShare,
    value: valuePerShare,
    amount: valuePerShare,
    valor: valuePerShare,
    type,
    kind: type,
    tipo: type,
    dividendType: type,
    status,
    paymentStatus: confirmed ? 'CONFIRMED' : provisioned ? 'PROVISIONED' : 'ANNOUNCED',
    announcementStatus: 'ANNOUNCED',
    announced: Boolean(dateCom || valuePerShare > 0),
    confirmed,
    provisioned,
    assetClass,
    source: row.source || 'Investidor10 Agenda de Dividendos',
  };
}

export function parseInvestidor10DividendAgendaHtml(html = '', { assetClass = '' } = {}) {
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
    const event = normalizeEvent({ ticker, dateCom, paymentDate, type, valuePerShare: value }, assetClass);
    const key = eventKey(event);
    if ((event.dateCom || event.paymentDate) && !seen.has(key)) { seen.add(key); events.push(event); }
  }

  // Fallback para o trecho textual compacto que alguns renderizadores retornam numa única linha.
  // Em vez de usar um regex solto com .{0,140}, segmenta por ticker para impedir
  // que o valor de um card seja atribuído ao próximo ativo quando os links ficam colados.
  const compact = text.replace(/\s+/g, ' ');
  const tickerMatches = [];
  const tickerRe = /\b([A-Z]{3,6}\d{1,2}[A-Z]?)\b/g;
  let m;
  while ((m = tickerRe.exec(compact)) && tickerMatches.length < 1000) {
    tickerMatches.push({ ticker: m[1], index: m.index });
  }
  for (let idx = 0; idx < tickerMatches.length && events.length < 800; idx++) {
    const current = tickerMatches[idx];
    const nextIndex = tickerMatches[idx + 1]?.index ?? compact.length;
    const segment = compact.slice(current.index, nextIndex);
    if (!/Data\s*Com/i.test(segment) || !/Pgto/i.test(segment) || !/R\$/.test(segment)) continue;
    const dateCom = normalizeAgendaDate(segment.match(/Data\s*Com\s*(\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2}))/i)?.[1] || '');
    const pgtoChunk = segment.match(/Pgto\s+(.{0,90}?)(?:R\$\s*[-\d.,]+)/i)?.[1] || '';
    const paymentDate = normalizeAgendaDate(pgtoChunk);
    const typeCandidate = pgtoChunk
      .replace(/\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4})/g, ' ')
      .replace(/Provisionado/gi, ' ')
      .trim();
    const type = cleanType(typeCandidate || segment.match(/\b(JSCP|JCP|Dividendos|Amortização|Red\.? Cap\.?|Rendimento|Rend\. Trib\.)\b/i)?.[1]);
    const value = parseMoney(segment.match(/R\$\s*([-\d.,]+)/i)?.[1] || '');
    const event = normalizeEvent({ ticker: current.ticker, dateCom, paymentDate, type, valuePerShare: value, pgtoText: pgtoChunk, raw: segment }, assetClass);
    const key = eventKey(event);
    if ((event.dateCom || event.paymentDate) && !seen.has(key)) { seen.add(key); events.push(event); }
  }

  // Layout atual observado no Investidor10 também pode renderizar cards como:
  // "15/06/26 Dividendos Dividendos R$ 0,62 FATN11 ... Data Com 05/06/26 Pgto 15/06/26".
  // O parser anterior esperava o ticker antes do valor e deixava a agenda vazia.
  const valueBeforeTickerRe = /(\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}))\s+([A-Za-zÀ-ÿ.\s]{0,44}?)\s+(?:\2\s+)?R\$\s*([-\d.,]+)\s+([A-Z]{3,6}\d{1,2}[A-Z]?)(?:(?!\b[A-Z]{3,6}\d{1,2}[A-Z]?\b).){0,140}?\s+Data\s*Com\s+(\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}))\s+Pgto\s+(\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}))/gi;
  while ((m = valueBeforeTickerRe.exec(compact)) && events.length < 800) {
    // Se antes da data inicial já havia Data Com/Pgto, estamos dentro do layout normal
    // ticker -> Data Com -> Pgto -> valor; não é um card value-before-ticker.
    const previousWindow = compact.slice(Math.max(0, m.index - 90), m.index);
    if (/Data\s*Com|Pgto/i.test(previousWindow)) continue;
    const leadingPayment = normalizeAgendaDate(m[1]);
    const explicitPayment = normalizeAgendaDate(m[6] || '');
    if (leadingPayment && explicitPayment && leadingPayment !== explicitPayment) continue;
    const event = normalizeEvent({
      ticker: m[4],
      dateCom: m[5],
      paymentDate: explicitPayment || leadingPayment,
      type: m[2],
      valuePerShare: m[3],
      pgtoText: m[6] || m[1],
    }, assetClass);
    const key = eventKey(event);
    if ((event.dateCom || event.paymentDate) && !seen.has(key)) { seen.add(key); events.push(event); }
  }

  // O padrão ticker->valor->DataCom foi removido porque no HTML móvel o próximo card pode
  // gerar falso positivo cruzado. A captura principal acima cobre o layout atual com valor antes do ticker.


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
  // Sem assetClass explícito, consulta ações e FIIs em conjunto para não errar units/ativos terminados em 11.
  const needStocks = options.assetClass === 'ACAO' || options.assetClass === 'STOCK' || !options.assetClass;
  const needFiis = options.assetClass === 'FII' || !options.assetClass;
  const sourceDefs = [];
  if (needStocks) sourceDefs.push(['ACAO', ACOES_AGENDA_URL]);
  if (needFiis) sourceDefs.push(['FII', FIIS_AGENDA_URL]);

  const sourcePages = sourceDefs.map(([assetClass, baseUrl]) => ({
    assetClass,
    pages: buildDividendAgendaUrls(baseUrl, options),
  }));

  // Intercala ações e FIIs por mês. Antes a fila varria todo o histórico de ações
  // antigo antes de chegar em meses atuais/futuros e, sob deadline mobile, podia
  // devolver uma agenda parcial enviesada. Agora prioriza mês atual, próximos meses
  // e só depois histórico recente, preservando ambos os tipos de ativo.
  const tasks = [];
  const maxPages = Math.max(0, ...sourcePages.map(s => s.pages.length));
  for (let i = 0; i < maxPages; i++) {
    for (const source of sourcePages) {
      const info = source.pages[i];
      if (info) tasks.push({ assetClass: source.assetClass, ...info });
    }
  }

  const diagnostics = [];
  const pages = await mapLimit(tasks, clampInt(options.concurrency || MAX_FETCH_CONCURRENCY, MAX_FETCH_CONCURRENCY, 1, 8), async (task) => {
    const cacheKey = `${task.assetClass}:${task.url}`;
    let events = cacheGet(cacheKey);
    try {
      if (!events) {
        const html = await fetchHtml(task.url, { timeoutMs: options.timeoutMs || 9000 });
        events = parseInvestidor10DividendAgendaHtml(html, { assetClass: task.assetClass });
        cacheSet(cacheKey, events);
      }
      diagnostics.push({ assetClass: task.assetClass, url: task.url, month: task.label, count: events.length, ok: true });
      return events;
    } catch (err) {
      diagnostics.push({ assetClass: task.assetClass, url: task.url, month: task.label, count: 0, ok: false, error: err?.message || String(err) });
      return [];
    }
  });

  const out = pages.flat();
  const filtered = wanted.size ? out.filter(e => wanted.has(e.ticker)) : out;
  const seen = new Set();
  const events = filtered
    .filter(e => e?.ticker && (e.dateCom || e.paymentDate || e.valuePerShare > 0))
    .filter(e => {
      const key = eventKey(e);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const da = parseAgendaDate(a.paymentDate || a.dateCom)?.getTime() || Number.MAX_SAFE_INTEGER;
      const db = parseAgendaDate(b.paymentDate || b.dateCom)?.getTime() || Number.MAX_SAFE_INTEGER;
      return da - db || a.ticker.localeCompare(b.ticker);
    });
  return {
    events,
    diagnostics: diagnostics.sort((a, b) => String(a.url).localeCompare(String(b.url))),
    range: {
      historyMonths: clampInt(options.historyMonths ?? options.monthsBack ?? options.pastMonths ?? options.backMonths, DEFAULT_HISTORY_MONTHS, 0, MAX_RANGE_MONTHS),
      futureMonths: clampInt(options.futureMonths ?? options.monthsForward ?? options.horizonMonths ?? options.forwardMonths, DEFAULT_FUTURE_MONTHS, 0, MAX_RANGE_MONTHS),
      pages: tasks.length,
      wantedTickers: Array.from(wanted),
    },
  };
}

