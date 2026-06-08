export const VALORAE_I10_DIVIDEND_AGENDA_VERSION = '21.12.66-i10-dividend-agenda-end-to-end-parser-fix';

const ACOES_AGENDA_URL = 'https://investidor10.com.br/acoes/dividendos/';
const ACOES_AGENDA_PGTO_URL = 'https://investidor10.com.br/acoes/dividendos/data_pgto/';
const FIIS_AGENDA_URL = 'https://investidor10.com.br/fiis/dividendos/';
const CACHE_TTL_MS = Number(process.env.VALORAE_I10_DIVIDEND_AGENDA_TTL_MS || 5 * 60 * 1000);
const agendaCache = new Map();

const MONTH_SLUGS = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const TICKER_PATTERN = '[A-Z]{3,6}\\d{1,2}[A-Z]?';
const DATE_PATTERN = '\\d{1,2}\\/\\d{1,2}\\/(?:\\d{4}|\\d{2})';
const MONEY_PATTERN = '[-\\d.,]+';
const TYPE_PATTERN = '(?:Rend\\.?\\s*Trib\\.?|Rendimento|Dividendos?|Amortiza(?:ç|c)[aã]o|Red\\.?\\s*Cap\\.?|JSCP|JCP|Juros\\s+sobre\\s+capital(?:\\s+pr[oó]prio)?)';

function currentMonthUrls(kind = 'acoes') {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = MONTH_SLUGS[now.getUTCMonth()];
  if (!month) return [];
  if (kind === 'fiis') return [`https://investidor10.com.br/fiis/dividendos/${year}/${month}/data-de-pagamento/`];
  return [`https://investidor10.com.br/acoes/dividendos/${year}/${month}/data-de-pagamento/`];
}

function agendaUrlsFor(assetClass = '') {
  if (assetClass === 'FII') return [FIIS_AGENDA_URL, ...currentMonthUrls('fiis')];
  if (assetClass === 'ACAO') return [ACOES_AGENDA_PGTO_URL, ACOES_AGENDA_URL, ...currentMonthUrls('acoes')];
  return [];
}

function stripTags(html = '') {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/tr>|<\/h[1-6]>|<\/article>|<\/section>/gi, '\n')
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

function isTicker(value = '') {
  return new RegExp(`^${TICKER_PATTERN}$`).test(canonicalTicker(value));
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
  const raw = String(value || '').trim();
  if (!raw || raw === '-') return 0;
  const s = raw.replace(/R\$/gi, '').replace(/\s/g, '').trim();
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : 0;
}

function cleanType(value = '') {
  const s = String(value || '').replace(/\s+/g, ' ').trim();
  if (/rend\.?\s*trib/i.test(s)) return 'Rend. Trib.';
  if (/jscp|jcp|juros\s+sobre\s+capital/i.test(s)) return 'JSCP';
  if (/amort/i.test(s)) return 'Amortização';
  if (/red\.?\s*cap/i.test(s)) return 'Red. Cap.';
  if (/rend/i.test(s)) return 'Rendimento';
  if (/div/i.test(s)) return 'Dividendos';
  return s || 'Provento';
}

function firstText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return '';
}

function eventKey(e = {}) {
  return [e.ticker, e.assetClass, e.dateCom, e.paymentDate, e.type, Number(e.valuePerShare || 0).toFixed(8)].join('|').toUpperCase();
}

function normalizeEvent(row = {}, assetClass = '') {
  const ticker = canonicalTicker(row.ticker || row.symbol || row.codigo || row.asset || row.ativo);
  const dateCom = normalizeAgendaDate(row.dateCom || row.dataCom || row.comDate || row.recordDate || row.dataBase);
  const paymentDate = normalizeAgendaDate(row.paymentDate || row.dataPagamento || row.payDate || row.date || row.data || row.pgto);
  const type = cleanType(row.type || row.tipo || row.kind || row.provento || row.status);
  const valuePerShare = parseMoney(row.valuePerShare ?? row.valor ?? row.value ?? row.amount ?? row.cashAmount ?? row.valorPorCota ?? row.valorPorAcao);
  return {
    ticker,
    asset: ticker,
    ativo: ticker,
    symbol: ticker,
    codigo: ticker,
    dateCom,
    dataCom: dateCom,
    comDate: dateCom,
    paymentDate,
    payDate: paymentDate,
    dataPagamento: paymentDate,
    pgto: paymentDate,
    valuePerShare,
    value: valuePerShare,
    valor: valuePerShare,
    valorPorCota: valuePerShare,
    valorPorAcao: valuePerShare,
    amount: valuePerShare,
    currency: 'BRL',
    type,
    kind: type,
    tipo: type,
    status: row.status || 'Previsto',
    assetClass,
    source: row.source || 'Investidor10 Agenda de Dividendos',
  };
}

function addEvent(out, seen, row, assetClass) {
  const event = normalizeEvent(row, assetClass);
  if (!event.ticker || !isTicker(event.ticker)) return false;
  if (!event.dateCom && !event.paymentDate) return false;
  // Valor zerado é mantido só quando o Investidor10 publicou o card com datas; isso preserva
  // casos raros de valor provisionado/indisponível sem inventar número.
  const key = eventKey(event);
  if (seen.has(key)) return false;
  seen.add(key);
  out.push(event);
  return true;
}

function findClosestTypeBefore(text, moneyIndex) {
  const before = text.slice(Math.max(0, moneyIndex - 90), moneyIndex);
  const re = new RegExp(TYPE_PATTERN, 'gi');
  let match;
  let last = '';
  while ((match = re.exec(before))) last = match[0];
  return cleanType(last);
}

function parseValueBeforeTickerLayout(compact, assetClass, out, seen) {
  // Layout dominante do Investidor10 em cartões: "... JSCP JSCP R$ 0,31 PETR4 ... Data Com 22/04/26 Pgto 22/06/26".
  // A unidade mínima de segmentação é "R$ valor + ticker"; assim um valor não pode escorregar para o próximo card.
  const moneyTickerRe = new RegExp(`R\\$\\s*(${MONEY_PATTERN})\\s+(${TICKER_PATTERN})\\b`, 'gi');
  const matches = [];
  let match;
  while ((match = moneyTickerRe.exec(compact)) && matches.length < 1500) {
    matches.push({ index: match.index, end: moneyTickerRe.lastIndex, value: match[1], ticker: match[2] });
  }
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextIndex = matches[i + 1]?.index ?? compact.length;
    const segment = compact.slice(current.end, nextIndex);
    const dateCom = segment.match(new RegExp(`Data\\s*Com\\s*(${DATE_PATTERN})`, 'i'))?.[1] || '';
    const paymentDate = segment.match(new RegExp(`Pgto\\s*(${DATE_PATTERN})`, 'i'))?.[1] || '';
    if (!dateCom && !paymentDate) continue;
    addEvent(out, seen, {
      ticker: current.ticker,
      dateCom,
      paymentDate,
      type: findClosestTypeBefore(compact, current.index),
      valuePerShare: current.value,
    }, assetClass);
  }
}

function parseTickerFirstLogoLayout(compact, assetClass, out, seen) {
  // Layout alternativo visto nos resultados indexados: "Logo PETR4 Data Com 22/04/26 Pgto 22/06/26 JSCP R$ 0,31".
  // Exige marcador Logo para não confundir o valor do próximo card compacto com o ticker anterior.
  const tickerFirstRe = new RegExp(`(?:Image:\\s*)?Logo\\s+(${TICKER_PATTERN})\\b(?:(?!\\b${TICKER_PATTERN}\\b).){0,180}?Data\\s*Com\\s*(${DATE_PATTERN})\\s*Pgto\\s*(${DATE_PATTERN})\\s*((?:${TYPE_PATTERN})(?:\\s+(?:${TYPE_PATTERN}))?)\\s*R\\$\\s*(${MONEY_PATTERN})`, 'gi');
  let match;
  while ((match = tickerFirstRe.exec(compact)) && out.length < 1200) {
    addEvent(out, seen, {
      ticker: match[1],
      dateCom: match[2],
      paymentDate: match[3],
      type: match[4],
      valuePerShare: match[5],
    }, assetClass);
  }
}


function parseProvisionedTickerFirstLayout(compact, assetClass, out, seen) {
  // Eventos provisionados podem vir sem data de pagamento: "ABEV3 Data Com 22/06/26 Pgto Provisionado JSCP R$ 0,04".
  const re = new RegExp(`\\b(${TICKER_PATTERN})\\b(?:(?!\\b${TICKER_PATTERN}\\b).){0,180}?Data\\s*Com\\s*(${DATE_PATTERN})\\s*Pgto\\s*Provisionad[oa]?\\s*((?:${TYPE_PATTERN})(?:\\s+(?:${TYPE_PATTERN}))?)\\s*R\\$\\s*(${MONEY_PATTERN})`, 'gi');
  let match;
  while ((match = re.exec(compact)) && out.length < 1200) {
    addEvent(out, seen, {
      ticker: match[1],
      dateCom: match[2],
      paymentDate: '',
      type: match[3] || 'Provisionado',
      status: 'Provisionado',
      valuePerShare: match[4],
    }, assetClass);
  }
}

function parseLineCardLayout(lines, assetClass, out, seen) {
  // Layout com linhas preservadas: ticker em uma linha e Data Com/Pgto/valor nas linhas seguintes.
  for (let i = 0; i < lines.length && out.length < 1200; i++) {
    const ticker = canonicalTicker(lines[i]);
    if (!isTicker(ticker)) continue;
    const windowLines = lines.slice(i + 1, i + 16);
    const joined = windowLines.join(' ');
    if (!/Data\s*Com/i.test(joined) || !/Pgto/i.test(joined) || !/R\$/.test(joined)) continue;
    const dateCom = joined.match(new RegExp(`Data\\s*Com\\s*(${DATE_PATTERN})`, 'i'))?.[1] || '';
    const pgtoAndRest = joined.match(new RegExp(`Pgto\\s*(${DATE_PATTERN})\\s+(.{0,90}?R\\$\\s*${MONEY_PATTERN})`, 'i'));
    if (!dateCom || !pgtoAndRest) continue;
    const afterPgto = pgtoAndRest[2] || '';
    // Se depois de Pgto veio outra data antes do tipo/valor, estamos atravessando para o próximo card compacto.
    if (new RegExp(`^${DATE_PATTERN}\\b`).test(afterPgto.trim())) continue;
    const type = afterPgto.match(new RegExp(TYPE_PATTERN, 'i'))?.[0] || '';
    const value = afterPgto.match(new RegExp(`R\\$\\s*(${MONEY_PATTERN})`, 'i'))?.[1] || '';
    addEvent(out, seen, { ticker, dateCom, paymentDate: pgtoAndRest[1], type, valuePerShare: value }, assetClass);
  }
}

export function parseInvestidor10DividendAgendaHtml(html = '', { assetClass = '' } = {}) {
  const text = stripTags(html);
  const lines = text.split(/\n+/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const compact = text.replace(/\s+/g, ' ');
  const events = [];
  const seen = new Set();

  parseValueBeforeTickerLayout(compact, assetClass, events, seen);
  parseTickerFirstLogoLayout(compact, assetClass, events, seen);
  parseProvisionedTickerFirstLayout(compact, assetClass, events, seen);
  parseLineCardLayout(lines, assetClass, events, seen);

  return events.sort((a, b) => {
    const da = parseAgendaDate(a.paymentDate || a.dateCom)?.getTime() || Number.MAX_SAFE_INTEGER;
    const db = parseAgendaDate(b.paymentDate || b.dateCom)?.getTime() || Number.MAX_SAFE_INTEGER;
    return da - db || a.ticker.localeCompare(b.ticker) || a.type.localeCompare(b.type) || a.valuePerShare - b.valuePerShare;
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
  if (agendaCache.size > 40) agendaCache.clear();
  agendaCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function fetchInvestidor10DividendAgenda(tickers = [], options = {}) {
  const wanted = new Set((tickers || []).map(canonicalTicker).filter(Boolean));
  const needStocks = options.assetClass === 'ACAO' || !options.assetClass;
  const needFiis = options.assetClass === 'FII' || !options.assetClass;
  const tasks = [];
  if (needStocks) for (const url of agendaUrlsFor('ACAO')) tasks.push(['ACAO', url]);
  if (needFiis) for (const url of agendaUrlsFor('FII')) tasks.push(['FII', url]);
  const out = [];
  const diagnostics = [];
  for (const [assetClass, url] of tasks) {
    const cacheKey = `${assetClass}:${url}`;
    let events = cacheGet(cacheKey);
    try {
      if (!events) {
        const html = await fetchHtml(url, { timeoutMs: options.timeoutMs || 9000 });
        events = parseInvestidor10DividendAgendaHtml(html, { assetClass });
        cacheSet(cacheKey, events);
      }
      diagnostics.push({ assetClass, url, count: events.length, ok: true, parserVersion: VALORAE_I10_DIVIDEND_AGENDA_VERSION });
      out.push(...events);
    } catch (err) {
      diagnostics.push({ assetClass, url, count: 0, ok: false, error: err?.message || String(err), parserVersion: VALORAE_I10_DIVIDEND_AGENDA_VERSION });
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
