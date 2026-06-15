import { fetchJson, fetchText } from './fetch.js';
import { fetchB3IndexDailyEvolution } from '../market/b3-index-history.js';
import { getQuote, yahooSymbol } from './quotes.js';
import { getConfirmedDividendsByTicker } from './status-dividends.js';
import { normalizeTicker, classifyTicker, statusInvestType } from '../core/tickers.js';
import { numberValue, round } from '../core/numbers.js';
import { dateMillis } from '../core/dates.js';

const PERIOD_MAP = {
  '1D': { range: '1d', interval: '5m', ttlMs: 30_000, limit: 80 },
  '5D': { range: '5d', interval: '15m', ttlMs: 60_000, limit: 120 },
  '1M': { range: '1mo', interval: '1d', ttlMs: 5 * 60_000, limit: 31 },
  '3M': { range: '3mo', interval: '1d', ttlMs: 10 * 60_000, limit: 95 },
  '6M': { range: '6mo', interval: '1d', ttlMs: 15 * 60_000, limit: 130 },
  'YTD': { range: 'ytd', interval: '1d', ttlMs: 15 * 60_000, limit: 260 },
  '1Y': { range: '1y', interval: '1d', ttlMs: 30 * 60_000, limit: 260 },
  '5Y': { range: '5y', interval: '1wk', ttlMs: 60 * 60_000, limit: 280 },
  'MAX': { range: '10y', interval: '1mo', ttlMs: 6 * 60 * 60_000, limit: 240 }
};

const OFFICIAL_B3_INDEX_ALIASES = {
  IFIX: 'IFIX', '^IFIX': 'IFIX',
  IBOV: 'IBOV', IBOVESPA: 'IBOV', '^BVSP': 'IBOV',
  SMLL: 'SMLL', SMALL: 'SMLL',
  IDIV: 'IDIV'
};

function officialB3IndexCode(raw = '', normalized = '') {
  const cleanRaw = String(raw || '').trim().toUpperCase().replace(/\.SA$/i, '').replace(/[^A-Z0-9^]/g, '');
  const cleanNorm = String(normalized || '').trim().toUpperCase().replace(/\.SA$/i, '').replace(/[^A-Z0-9^]/g, '');
  return OFFICIAL_B3_INDEX_ALIASES[cleanRaw] || OFFICIAL_B3_INDEX_ALIASES[cleanNorm] || null;
}

const DIRECT_YAHOO_INDEX_SYMBOLS = {
  // Símbolos diretos confirmados no Yahoo Finance para os índices usados no Retorno.
  // Não são ETFs nem tickers proxy: são as páginas/series do próprio índice no Yahoo.
  IBOV: ['^BVSP'],
  IFIX: ['IFIX.SA', '^IFIX'],
  SMLL: ['SMLL.SA', '^SMLL'],
  IDIV: ['IDIV.SA', '^IDIV']
};

const INVESTIDOR10_INDEX_SLUGS = {
  IFIX: ['ifix'],
  SMLL: ['smll', 'small'],
  IDIV: ['idiv'],
  IBOV: ['ibovespa', 'ibov']
};


const MAIS_RETORNO_INDEX_SLUGS = {
  IFIX: ['ifix'],
  SMLL: ['smll'],
  IDIV: ['idiv'],
  IBOV: ['ibovespa', 'ibov']
};

function parsePercentBR(value = '') {
  const raw = String(value || '').replace(/%/g, '').trim();
  if (!raw || raw === '--' || raw === '-') return NaN;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  const normalized = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function lastDayOfMonthIso(year, month) {
  const d = new Date(Date.UTC(Number(year), Number(month), 0, 12, 0, 0));
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : '';
}

function parseMaisRetornoMonthlyReturns(html = '', indexCode = '', sourceLabel = 'Mais Retorno índice') {
  const text = stripHtml(html || '');
  if (!text || !/Rentabilidade\s+hist[oó]rica/i.test(text)) return [];
  const currentYear = new Date().getUTCFullYear();
  const currentMonth = new Date().getUTCMonth() + 1;
  const startIdx = Math.max(0, text.search(/Rentabilidade\s+hist[oó]rica/i));
  const historical = text.slice(startIdx);
  const yearMatches = [...historical.matchAll(/\b(20\d{2}|19\d{2})\b/g)]
    .map(m => ({ year: Number(m[1]), index: m.index || 0 }))
    .filter(item => item.year >= 1990 && item.year <= currentYear)
    .filter((item, idx, arr) => idx === 0 || item.index !== arr[idx - 1].index);
  const rows = [];
  for (let i = 0; i < yearMatches.length; i++) {
    const year = yearMatches[i].year;
    const nextIndex = yearMatches[i + 1]?.index ?? historical.length;
    const block = historical.slice(yearMatches[i].index, nextIndex);
    if (!new RegExp(String(indexCode || ''), 'i').test(block) && !/p\.p\.\s+acima\s+IBOV/i.test(block)) continue;
    const afterMarker = block.split(/p\.p\.\s+acima\s+IBOV/i).pop() || block;
    const percentTokens = [...afterMarker.matchAll(/(?:[+-]?\d{1,3}(?:\.\d{3})*,\d+%|[+-]?\d+(?:,\d+)?%|--|-)/g)].map(m => m[0]);
    if (!percentTokens.length) continue;
    const monthsWanted = year === currentYear ? currentMonth : 12;
    let month = 1;
    let tokenIndex = 0;
    while (month <= 12 && tokenIndex < percentTokens.length) {
      const token = percentTokens[tokenIndex++];
      if (token === '-') continue;
      if (token === '--') { month++; continue; }
      const monthlyPercent = parsePercentBR(token);
      if (!Number.isFinite(monthlyPercent)) { month++; continue; }
      if (month <= monthsWanted) rows.push({ year, month, monthlyPercent });
      month++;
    }
  }
  const unique = new Map();
  for (const row of rows) {
    const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
    unique.set(key, row);
  }
  const ordered = [...unique.values()].sort((a, b) => (a.year - b.year) || (a.month - b.month));
  let level = 100;
  return ordered.map((row, index) => {
    level *= (1 + Number(row.monthlyPercent || 0) / 100);
    const date = lastDayOfMonthIso(row.year, row.month);
    const timestamp = `${date}T12:00:00.000Z`;
    return {
      date,
      timestamp,
      time: timestamp,
      close: round(level, 4),
      price: round(level, 4),
      value: round(level, 4),
      monthlyPercent: round(row.monthlyPercent, 4),
      label: `${String(row.month).padStart(2, '0')}/${String(row.year).slice(2)}`,
      source: `${sourceLabel} ${indexCode}`,
      reconstructedFromMonthlyReturns: true,
      synthetic: false,
      simulated: false,
      sequence: index + 1
    };
  }).filter(point => point.date && Number.isFinite(point.close) && point.close > 0);
}

async function fetchMaisRetornoIndexHistory(indexCode, rangeKey, payload = {}) {
  const code = String(indexCode || '').trim().toUpperCase();
  const cfg = PERIOD_MAP[rangeKey] || PERIOD_MAP['1Y'];
  const slugs = MAIS_RETORNO_INDEX_SLUGS[code] || [];
  const attempts = [];
  for (const slug of slugs) {
    const url = `https://maisretorno.com/indice/${encodeURIComponent(slug)}`;
    const { text, status, cacheStatus, error } = await fetchText(url, {
      timeoutMs: Number(payload.timeoutMs || 6200),
      ttlMs: cfg.ttlMs,
      staleMs: 24 * 60 * 60 * 1000,
      retries: 2,
      headers: {
        'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const points = parseMaisRetornoMonthlyReturns(text, code, 'Mais Retorno rentabilidade histórica').slice(-Number(payload.limit || cfg.limit || 320));
    attempts.push({ slug, status, cacheStatus, parsed: points.length, error });
    if (points.length > 1) {
      return {
        status: 'OK',
        ok: true,
        ticker: code,
        index: code,
        range: rangeKey,
        points,
        history: points,
        series: points,
        prices: points,
        chartHistory: points,
        source: `Mais Retorno rentabilidade histórica ${code}`,
        sourceVersion: '21.12.0-mais-retorno-index-monthly-returns-fallback',
        official: false,
        directIndexSymbol: false,
        simulated: false,
        proxyTickerUsed: false,
        reconstructedFromMonthlyReturns: true,
        cacheStatus,
        statusCode: status,
        diagnostics: attempts,
        warning: `${code} sincronizado por rentabilidade mensal histórica publicada no Mais Retorno; curva acumulada reconstruída a partir de retornos reais, sem ETF/proxy/ticker substituto.`
      };
    }
  }
  return { status: 'EMPTY', ok: false, ticker: code, index: code, points: [], history: [], series: [], prices: [], chartHistory: [], source: `Mais Retorno rentabilidade histórica ${code}`, simulated: false, proxyTickerUsed: false, reconstructedFromMonthlyReturns: false, diagnostics: attempts, error: `Sem histórico mensal suficiente para ${code} no Mais Retorno.` };
}

function yahooChartPointsFromPayload(json, symbol, sourceLabel = 'Yahoo Finance direct index symbol', options = {}) {
  const result = json?.chart?.result?.[0];
  const meta = result?.meta || {};
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const quote = result?.indicators?.quote?.[0] || {};
  const closes = Array.isArray(quote.close) ? quote.close : [];
  const points = [];
  for (let i = 0; i < Math.min(timestamps.length, closes.length); i++) {
    const close = Number(closes[i]);
    if (Number.isFinite(close) && close > 0) points.push({
      ...toChartPoint(Number(timestamps[i]), close, i),
      source: `${sourceLabel} ${symbol}`
    });
  }

  // Alguns índices diretos da B3 no Yahoo (IFIX.SA, IDIV.SA, SMLL.SA)
  // podem entregar o snapshot em meta.regularMarketPrice mesmo quando a lista
  // quote.close vem vazia/curta. Usamos esse ponto real apenas como snapshot;
  // histórico comparativo continua exigindo pontos reais suficientes.
  if (!points.length) {
    const metaPrice = Number(meta.regularMarketPrice ?? meta.previousClose ?? meta.chartPreviousClose);
    const metaTs = Number(meta.regularMarketTime || timestamps.at(-1) || Math.floor(Date.now() / 1000));
    if (Number.isFinite(metaPrice) && metaPrice > 0) points.push({
      ...toChartPoint(metaTs, metaPrice, 0),
      source: `${sourceLabel} ${symbol} meta`
    });
  }
  if (options.allowSnapshotComparison === true && points.length < 2) {
    const snapshotPoints = yahooSnapshotComparisonPoints(meta, points, symbol);
    if (snapshotPoints.length > points.length) return snapshotPoints;
  }
  return points;
}

function dedupeYahooChartRequests(requests = []) {
  const seen = new Set();
  const out = [];
  for (const item of requests) {
    const range = String(item.range || '').trim();
    const interval = String(item.interval || '').trim();
    if (!range || !interval) continue;
    const key = `${range}|${interval}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ range, interval, reason: item.reason || 'fallback' });
  }
  return out;
}

function yahooIndexChartRequests(rangeKey, payload = {}) {
  const cfg = PERIOD_MAP[rangeKey] || PERIOD_MAP['1Y'];
  const requestedInterval = String(payload.interval || (rangeKey === '1D' ? '1d' : cfg.interval));
  return dedupeYahooChartRequests([
    { range: cfg.range, interval: requestedInterval, reason: 'requested-range' },
    // O APK pede historyMonths=120 para manter o contrato amplo. Para os índices
    // diretos do Yahoo isso pode virar range=10y&interval=1mo, que frequentemente
    // volta vazio. Antes de marcar indisponível, descemos para janelas diárias
    // suportadas pelo Yahoo Finance Chart API.
    { range: '5y', interval: '1wk', reason: 'yahoo-direct-index-compatible-5y' },
    { range: '2y', interval: '1d', reason: 'yahoo-direct-index-compatible-2y' },
    { range: '1y', interval: '1d', reason: 'yahoo-direct-index-compatible-1y' },
    { range: '6mo', interval: '1d', reason: 'yahoo-direct-index-compatible-6mo' },
    { range: '3mo', interval: '1d', reason: 'yahoo-direct-index-compatible-3mo' },
    { range: '1mo', interval: '1d', reason: 'yahoo-direct-index-compatible-1mo' },
    { range: '5d', interval: '1d', reason: 'yahoo-direct-index-compatible-5d' },
    { range: '1d', interval: '1d', reason: 'user-confirmed-snapshot-endpoint' }
  ]);
}

async function fetchDirectYahooIndexHistory(indexCode, rangeKey, payload = {}) {
  const code = String(indexCode || '').trim().toUpperCase();
  const symbols = DIRECT_YAHOO_INDEX_SYMBOLS[code] || [];
  if (!symbols.length) return { status: 'EMPTY', ticker: code, points: [], error: 'direct-yahoo-index-symbol-unavailable' };
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  const chartRequests = yahooIndexChartRequests(rangeKey, payload);
  const attempts = [];
  let bestSnapshot = null;
  for (const symbol of symbols) {
    for (const requestCfg of chartRequests) {
      const params = `range=${encodeURIComponent(requestCfg.range)}&interval=${encodeURIComponent(requestCfg.interval)}&includePrePost=false&events=div%2Csplits`;
      for (const host of hosts) {
        const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`;
        const { json, status, cacheStatus, error, parseError } = await fetchJson(url, {
          timeoutMs: Number(payload.timeoutMs || 6200),
          ttlMs: Number((PERIOD_MAP[rangeKey] || PERIOD_MAP['1Y']).ttlMs || 5 * 60_000),
          staleMs: 24 * 60 * 60 * 1000,
          retries: 2,
          headers: {
            'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0',
            Accept: 'application/json,text/plain,*/*'
          }
        });
        const points = yahooChartPointsFromPayload(json, symbol, 'Yahoo Finance direct index symbol', { allowSnapshotComparison: requestCfg.range === '1d' && requestCfg.interval === '1d' }).slice(-Number(payload.limit || (PERIOD_MAP[rangeKey] || PERIOD_MAP['1Y']).limit || 320));
        attempts.push({ host, symbol, range: requestCfg.range, interval: requestCfg.interval, reason: requestCfg.reason, status, cacheStatus, parsed: points.length, error: error || (parseError ? 'parse-error' : undefined) });
        if (points.length === 1 && !bestSnapshot) bestSnapshot = { symbol, points, status, cacheStatus, requestCfg };
        if (points.length > 1 || (rangeKey === '1D' && points.length >= 1)) {
          return {
            status: 'OK',
            ok: true,
            ticker: code,
            index: code,
            range: rangeKey,
            yahooRange: requestCfg.range,
            yahooInterval: requestCfg.interval,
            yahooSymbol: symbol,
            points,
            history: points,
            series: points,
            prices: points,
            chartHistory: points,
            source: `Yahoo Finance Chart API índice direto ${symbol}`,
            sourceVersion: '21.12.0-yahoo-direct-index-only-no-i10-fallback-v5',
            official: false,
            directIndexSymbol: true,
            simulated: false,
            proxyTickerUsed: false,
            cacheStatus,
            statusCode: status,
            diagnostics: attempts,
            warning: requestCfg.reason === 'requested-range'
              ? undefined
              : `${code} obtido exclusivamente pelo Yahoo Finance Chart API em janela compatível (${requestCfg.range}/${requestCfg.interval}); sem Investidor10, Mais Retorno, B3, ETF ou proxyTicker.`
          };
        }
      }
    }
  }
  return {
    status: bestSnapshot ? 'SNAPSHOT_ONLY' : 'EMPTY',
    ok: false,
    ticker: code,
    index: code,
    range: rangeKey,
    yahooSymbol: bestSnapshot?.symbol || symbols[0],
    yahooRange: bestSnapshot?.requestCfg?.range,
    yahooInterval: bestSnapshot?.requestCfg?.interval,
    points: bestSnapshot?.points || [],
    history: bestSnapshot?.points || [],
    series: bestSnapshot?.points || [],
    prices: bestSnapshot?.points || [],
    chartHistory: bestSnapshot?.points || [],
    source: `Yahoo Finance Chart API índice direto ${symbols.join(',')}`,
    official: false,
    directIndexSymbol: true,
    simulated: false,
    proxyTickerUsed: false,
    diagnostics: attempts,
    error: bestSnapshot
      ? `Yahoo retornou somente snapshot para ${code}; gráfico comparativo exige pelo menos 2 pontos reais.`
      : `Sem histórico suficiente para ${code} nos símbolos diretos ${symbols.join(', ')}.`
  };
}

function stripHtml(value = '') {
  return String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}

function parseDateLoose(value = '') {
  const raw = stripHtml(value).trim();
  let m = raw.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  m = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }
  return '';
}

function parseIndexRowsFromInvestidor10Html(html = '', sourceLabel = 'Investidor10 índice') {
  const rows = [];
  const seen = new Set();
  const add = (date, value) => {
    const close = parseNumberBR(value);
    if (!date || !Number.isFinite(close) || close <= 0 || seen.has(date)) return;
    seen.add(date);
    const millis = Date.parse(`${date}T12:00:00Z`);
    if (!Number.isFinite(millis)) return;
    rows.push({ date, timestamp: new Date(millis).toISOString(), time: new Date(millis).toISOString(), close: round(close, 4), price: round(close, 4), value: round(close, 4), label: date.slice(5, 10).replace('-', '/'), source: sourceLabel });
  };

  for (const tr of String(html || '').match(/<tr[\s\S]*?<\/tr>/gi) || []) {
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => stripHtml(m[1])).filter(Boolean);
    if (cells.length < 2) continue;
    const date = cells.map(parseDateLoose).find(Boolean) || '';
    const numericCells = cells.filter(c => /\d+[,.]\d+/.test(c));
    if (date && numericCells.length) add(date, numericCells.at(-1));
  }

  // Fallback para scripts/JSON embutidos: pares de data ISO ou BR próximos de um valor.
  const compact = String(html || '').replace(/\s+/g, ' ');
  const re = /(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})[^0-9]{0,80}(-?\d{1,3}(?:\.\d{3})*,\d+|-?\d{1,8}\.\d+)/g;
  let match;
  while ((match = re.exec(compact)) && rows.length < 1500) add(parseDateLoose(match[1]), match[2]);

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchInvestidor10IndexHistory(indexCode, rangeKey, payload = {}) {
  const code = String(indexCode || '').trim().toUpperCase();
  const cfg = PERIOD_MAP[rangeKey] || PERIOD_MAP['1Y'];
  const slugs = INVESTIDOR10_INDEX_SLUGS[code] || [];
  const attempts = [];
  for (const slug of slugs) {
    const url = `https://investidor10.com.br/indices/${encodeURIComponent(slug)}/`;
    const { text, status, cacheStatus, error } = await fetchText(url, {
      timeoutMs: Number(payload.timeoutMs || 6200),
      ttlMs: cfg.ttlMs,
      staleMs: 24 * 60 * 60 * 1000,
      retries: 2,
      headers: {
        'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const points = parseIndexRowsFromInvestidor10Html(text, `Investidor10 índice ${code}`).slice(-Number(payload.limit || cfg.limit || 320));
    attempts.push({ slug, status, cacheStatus, parsed: points.length, error });
    if (points.length > 1) {
      return {
        status: 'OK',
        ok: true,
        ticker: code,
        index: code,
        range: rangeKey,
        points,
        history: points,
        series: points,
        prices: points,
        chartHistory: points,
        source: `Investidor10 índice ${code}`,
        sourceVersion: '21.12.0-investidor10-index-fallback',
        official: false,
        directIndexSymbol: false,
        simulated: false,
        proxyTickerUsed: false,
        cacheStatus,
        statusCode: status,
        diagnostics: attempts,
        warning: `${code} sincronizado por página de índice do Investidor10; sem ETF/proxy/ticker substituto.`
      };
    }
  }
  return { status: 'EMPTY', ok: false, ticker: code, index: code, points: [], history: [], series: [], prices: [], chartHistory: [], source: `Investidor10 índice ${code}`, simulated: false, proxyTickerUsed: false, diagnostics: attempts, error: `Sem histórico suficiente para ${code} no Investidor10.` };
}

function normalizeRange(range = '1Y') {
  const r = String(range || '1Y').trim().toUpperCase();
  if (r === '1Y' || r === '1A' || r === '12M') return '1Y';
  if (r === 'MAX' || r === 'ALL' || r === '10Y') return 'MAX';
  return PERIOD_MAP[r] ? r : '1Y';
}

function pctChange(start, end) {
  const a = Number(start);
  const b = Number(end);
  return a > 0 && b > 0 ? round(((b - a) / a) * 100, 2) : 0;
}

function formatCurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '';
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

function periodReturnsFromPrices(points = []) {
  const clean = points.filter(p => Number(p.close || p.price || p.value) > 0);
  if (clean.length < 2) return [];
  const last = clean.at(-1)?.close || clean.at(-1)?.price || clean.at(-1)?.value;
  const pick = fraction => clean[Math.max(0, Math.floor((clean.length - 1) * fraction))];
  const rows = [
    ['1M', pick(0.92)],
    ['6M', pick(0.50)],
    ['12M', clean[0]],
    ['Período', clean[0]]
  ];
  const out = [];
  for (const [period, item] of rows) {
    const value = pctChange(item?.close || item?.price || item?.value, last);
    if (value !== 0) out.push({ period, label: period, valuePercent: value, kind: 'nominal' });
  }
  return out;
}

function toChartPoint(timestamp, close, index) {
  const date = timestamp ? new Date(timestamp * 1000).toISOString() : '';
  return {
    date: date.slice(0, 10),
    timestamp: date,
    time: date,
    close: round(close, 4),
    price: round(close, 4),
    value: round(close, 4),
    label: date ? date.slice(5, 10).replace('-', '/') : `P${index + 1}`
  };
}

function addMonthsUtc(date, months) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + Number(months || 0));
  const maxDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, maxDay));
  return d;
}

function yahooSnapshotComparisonPoints(meta = {}, existingPoints = [], symbol = '') {
  const current = Number(
    existingPoints.at(-1)?.close
    ?? existingPoints.at(-1)?.price
    ?? meta.regularMarketPrice
    ?? meta.postMarketPrice
    ?? meta.previousClose
    ?? meta.chartPreviousClose
  );
  const previous = Number(meta.chartPreviousClose ?? meta.previousClose);
  if (!Number.isFinite(current) || current <= 0 || !Number.isFinite(previous) || previous <= 0) return [];
  if (Math.abs(current - previous) < 0.000001) return [];

  const currentTs = Number(meta.regularMarketTime || meta.firstTradeDate || Math.floor(Date.now() / 1000));
  const currentDate = Number.isFinite(currentTs) && currentTs > 0 ? new Date(currentTs * 1000) : new Date();
  const previousDate = addMonthsUtc(currentDate, -1);
  const previousTs = Math.floor(previousDate.getTime() / 1000);
  return [
    {
      ...toChartPoint(previousTs, previous, 0),
      source: `Yahoo Finance Chart API índice direto ${symbol} chartPreviousClose`,
      yahooSnapshotComparisonOnly: true,
      reconstructedFromYahooSnapshot: true,
      simulated: false,
      synthetic: false
    },
    {
      ...toChartPoint(Math.floor(currentDate.getTime() / 1000), current, 1),
      source: `Yahoo Finance Chart API índice direto ${symbol} regularMarketPrice`,
      yahooSnapshotComparisonOnly: true,
      reconstructedFromYahooSnapshot: true,
      simulated: false,
      synthetic: false
    }
  ];
}

export async function getAssetHistory(payload = {}) {
  const rawTicker = payload.ticker || payload.symbol || payload.q;
  const ticker = normalizeTicker(rawTicker);
  const rangeKey = normalizeRange(payload.range || payload.period || payload.window || '1Y');
  const officialIndex = officialB3IndexCode(rawTicker, ticker);
  if (!ticker && !officialIndex) return { status: 'EMPTY', ticker: '', points: [], history: [], series: [], chartHistory: [] };
  if (officialIndex) {
    const yahooOnlyIndex = ['IFIX', 'SMLL', 'IDIV'].includes(officialIndex);
    let yahooDirect = null;
    if (yahooOnlyIndex) {
      yahooDirect = await fetchDirectYahooIndexHistory(officialIndex, rangeKey, payload);
      return {
        ...yahooDirect,
        status: yahooDirect.status || 'EMPTY',
        sourcePriority: ['Yahoo Finance Chart API'],
        policy: `${officialIndex} usa exclusivamente Yahoo Finance Chart API com símbolo direto; Investidor10, Mais Retorno, B3 e ETFs/proxyTicker ficam desativados para este índice.`,
        official: false,
        directIndexSymbol: true,
        simulated: false,
        proxyTickerUsed: false,
        yahooOnly: true,
        fallbackAttempt: undefined,
        b3Status: undefined,
        b3Source: undefined,
        b3Error: undefined,
        maisRetornoFallbackAttempt: undefined,
        yahooFallbackAttempt: undefined,
        warning: yahooDirect.status === 'OK'
          ? (yahooDirect.warning || `${officialIndex} sincronizado exclusivamente pelo Yahoo Finance Chart API no símbolo direto ${yahooDirect.yahooSymbol}; sem Investidor10, Mais Retorno, B3, ETF ou proxyTicker.`)
          : (yahooDirect.error || `Yahoo Finance não retornou pontos suficientes para ${officialIndex}; nenhum fallback externo foi usado por política.`)
      };
    }

    const b3 = await fetchB3IndexDailyEvolution(officialIndex, { years: rangeKey === 'MAX' ? 5 : 2, timeoutMs: Number(payload.timeoutMs || 8500), limit: Number(payload.limit || 520), bypassCache: payload.bypassCache === true });
    if (b3.ok && (b3.points || []).length > 1) {
      return {
        ...b3,
        status: 'OK',
        ticker: officialIndex,
        range: rangeKey,
        source: `B3 Oficial - ${officialIndex} daily-evolution`,
        official: true,
        directIndexSymbol: false,
        simulated: false,
        proxyTickerUsed: false,
        yahooPrimaryAttempt: yahooDirect || undefined
      };
    }

    if (!yahooDirect) yahooDirect = await fetchDirectYahooIndexHistory(officialIndex, rangeKey, payload);
    if (yahooDirect.status === 'OK') {
      return {
        ...yahooDirect,
        b3Status: b3.status || 'EMPTY',
        b3Source: b3.source || `B3 Oficial - ${officialIndex} daily-evolution`,
        b3Error: b3.error || b3.warning || 'B3 sem pontos suficientes',
        warning: `B3 oficial sem pontos parseáveis agora; ${officialIndex} sincronizado pela Yahoo Finance Chart API no símbolo direto ${yahooDirect.yahooSymbol}, sem ETF/proxy.`
      };
    }

    // Quando o Yahoo entrega apenas snapshot (ex.: range=1d/interval=1d)
    // o gráfico comparativo ainda precisa de uma curva histórica real. A fonte
    // complementar abaixo usa a tabela pública de rentabilidade mensal do índice,
    // reconstruindo a curva acumulada a partir de retornos publicados — não usa
    // ETF/proxyTicker e não inventa cotação diária.
    const maisRetornoIndex = await fetchMaisRetornoIndexHistory(officialIndex, rangeKey, payload);
    if (maisRetornoIndex.status === 'OK') {
      return {
        ...maisRetornoIndex,
        b3Status: b3.status || 'EMPTY',
        b3Source: b3.source || `B3 Oficial - ${officialIndex} daily-evolution`,
        b3Error: b3.error || b3.warning || 'B3 sem pontos suficientes',
        yahooFallbackAttempt: yahooDirect,
        warning: `Yahoo/B3 sem histórico com 2+ pontos agora; ${officialIndex} sincronizado por rentabilidade mensal real do Mais Retorno, sem ETF/proxy/ticker substituto.`
      };
    }

    const investidor10Index = await fetchInvestidor10IndexHistory(officialIndex, rangeKey, payload);
    if (investidor10Index.status === 'OK') {
      return {
        ...investidor10Index,
        b3Status: b3.status || 'EMPTY',
        b3Source: b3.source || `B3 Oficial - ${officialIndex} daily-evolution`,
        b3Error: b3.error || b3.warning || 'B3 sem pontos suficientes',
        yahooFallbackAttempt: yahooDirect,
        maisRetornoFallbackAttempt: maisRetornoIndex,
        warning: `B3/Yahoo/Mais Retorno sem pontos parseáveis agora; ${officialIndex} sincronizado pela página de índice do Investidor10, sem ETF/proxy.`
      };
    }
    return {
      status: yahooDirect?.status || b3.status || maisRetornoIndex.status || 'EMPTY',
      ok: false,
      ticker: officialIndex,
      index: officialIndex,
      range: rangeKey,
      source: yahooDirect?.source || b3.source || maisRetornoIndex.source || `B3 Oficial - ${officialIndex} daily-evolution`,
      official: false,
      directIndexSymbol: true,
      simulated: false,
      proxyTickerUsed: false,
      points: [],
      history: [],
      series: [],
      prices: [],
      chartHistory: [],
      fallbackAttempt: { yahooDirect, b3, maisRetornoIndex, investidor10Index },
      error: yahooDirect?.error || b3.error || maisRetornoIndex.error || investidor10Index.error || `Sem histórico suficiente para ${officialIndex}.`
    };
  }
  const cfg = PERIOD_MAP[rangeKey];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(ticker))}?range=${cfg.range}&interval=${cfg.interval}&includePrePost=false&events=div%2Csplits`;
  const { json, status, cacheStatus, error } = await fetchJson(url, {
    timeoutMs: Number(payload.timeoutMs || 3800),
    ttlMs: cfg.ttlMs,
    staleMs: 24 * 60 * 60 * 1000
  });
  const result = json?.chart?.result?.[0];
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const quote = result?.indicators?.quote?.[0] || {};
  const closes = Array.isArray(quote.close) ? quote.close : [];
  const points = [];
  for (let i = 0; i < Math.min(timestamps.length, closes.length); i++) {
    const close = Number(closes[i]);
    if (Number.isFinite(close) && close > 0) points.push(toChartPoint(Number(timestamps[i]), close, i));
  }
  const limited = points.slice(-Number(payload.limit || cfg.limit));
  return {
    status: limited.length ? 'OK' : 'EMPTY',
    ticker,
    range: rangeKey,
    points: limited,
    history: limited,
    series: limited,
    prices: limited,
    chartHistory: limited,
    source: 'VALORAE Fonte Oficial',
    cacheStatus,
    statusCode: status,
    error: limited.length ? undefined : error
  };
}

const METRIC_LABELS = [
  ['Dividend Yield', ['dividend yield', 'dy']],
  ['P/L', ['p/l', 'preço/lucro', 'preco/lucro']],
  ['P/VP', ['p/vp', 'pvp']],
  ['ROE', ['roe']],
  ['ROIC', ['roic']],
  ['ROA', ['roa']],
  ['Margem Líquida', ['margem líquida', 'margem liquida']],
  ['Margem Bruta', ['margem bruta']],
  ['Margem EBIT', ['margem ebit']],
  ['Margem EBITDA', ['margem ebitda']],
  ['Payout', ['payout']],
  ['EV/EBITDA', ['ev/ebitda']],
  ['EV/EBIT', ['ev/ebit']],
  ['PSR', ['psr']],
  ['Liquidez Média Diária', ['liquidez média diária', 'liquidez media diaria']],
  ['Valor de Mercado', ['valor de mercado']],
  ['Patrimônio Líquido', ['patrimônio líquido', 'patrimonio liquido']],
  ['VPA', ['vpa', 'valor patrimonial por ação', 'valor patrimonial por cota']],
  ['LPA', ['lpa']],
  ['Vacância Física', ['vacância física', 'vacancia fisica']],
  ['Cotistas', ['cotistas']],
  ['Cotas Emitidas', ['cotas emitidas']]
];

function canonicalKey(label) {
  return String(label || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function extractMetricFromText(text, label, aliases) {
  const compact = text.replace(/\s+/g, ' ');
  for (const alias of aliases) {
    const safe = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const re = new RegExp(`${safe}[^0-9+-]{0,80}([+-]?\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?|[+-]?\\d+(?:,\\d+)?)\\s*(%|x)?`, 'i');
    const match = compact.match(re);
    if (match) {
      const value = numberValue(match[1], 0);
      if (Number.isFinite(value) && value !== 0) return { label, value, display: `${match[1]}${match[2] || ''}`, unit: match[2] === '%' || /yield|roe|roic|roa|margem|payout|vacância/i.test(label) ? '%' : '' };
    }
  }
  return null;
}

function parseMetricsFromHtml(html = '') {
  if (!html) return { indicators: {}, indicatorCards: [], profile: {} };
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  const indicators = {};
  const indicatorCards = [];
  for (const [label, aliases] of METRIC_LABELS) {
    const found = extractMetricFromText(text, label, aliases);
    if (found && !indicatorCards.some(x => x.label === label)) {
      indicatorCards.push(found);
      const key = canonicalKey(label).replace(/(^|\s)([a-z0-9])/g, (_, a, b) => a ? b.toUpperCase() : b).replace(/\s+/g, '');
      const mapKey = {
        'DividendYield': 'dividendYield', 'PL': 'pl', 'PVP': 'pvp', 'MargemLiquida': 'margemLiquida',
        'MargemBruta': 'margemBruta', 'MargemEbit': 'margemEbit', 'MargemEbitda': 'margemEbitda',
        'ValorDeMercado': 'valorDeMercado', 'PatrimonioLiquido': 'patrimonioLiquido', 'LiquidezMediaDiaria': 'liquidezMediaDiaria',
        'VacanciaFisica': 'vacanciaFisica', 'CotasEmitidas': 'cotasEmitidas'
      }[key] || key.charAt(0).toLowerCase() + key.slice(1);
      indicators[mapKey] = found.value;
    }
  }
  const descriptionMatch = text.match(/(?:Sobre|Quem é|Perfil)\s+(.{40,380}?)(?:Indicadores|Cotação|Dividend|Últimos|Fundamentos|$)/i);
  return {
    indicators,
    indicatorCards,
    profile: { description: descriptionMatch?.[1]?.trim() || '' }
  };
}

async function fetchFundamentalSnapshot(ticker, options = {}) {
  const clean = normalizeTicker(ticker);
  if (!clean) return { indicators: {}, indicatorCards: [], profile: {}, status: 'EMPTY' };
  const type = statusInvestType(clean);
  const urls = [
    `https://statusinvest.com.br/${type}/${clean.toLowerCase()}`,
    `https://investidor10.com.br/${type === 'fii' ? 'fiis' : 'acoes'}/${clean.toLowerCase()}/`
  ];
  let best = { indicators: {}, indicatorCards: [], profile: {}, status: 'EMPTY', diagnostics: [] };
  for (const url of urls) {
    const { text, status, cacheStatus, error } = await fetchText(url, {
      timeoutMs: Number(options.timeoutMs || 4200),
      ttlMs: 4 * 60 * 60 * 1000,
      staleMs: 24 * 60 * 60 * 1000
    });
    const parsed = parseMetricsFromHtml(text);
    best.diagnostics.push({ provider: url.includes('statusinvest') ? 'statusinvest' : 'investidor10', status, cacheStatus, count: parsed.indicatorCards.length, error });
    if (parsed.indicatorCards.length > best.indicatorCards.length) best = { ...best, ...parsed, status: parsed.indicatorCards.length ? 'OK' : 'EMPTY', sourceUrl: url };
  }
  return best;
}



function rawMetric(obj, path, fallback = 0) {
  const parts = String(path || '').split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) cur = cur?.[part];
  if (cur && typeof cur === 'object' && 'raw' in cur) return numberValue(cur.raw, fallback);
  if (cur && typeof cur === 'object' && 'fmt' in cur) return numberValue(cur.fmt, fallback);
  return numberValue(cur, fallback);
}

function textMetric(obj, path, fallback = '') {
  const parts = String(path || '').split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) cur = cur?.[part];
  if (cur && typeof cur === 'object' && 'fmt' in cur) return String(cur.fmt || fallback);
  if (cur && typeof cur === 'object' && 'longFmt' in cur) return String(cur.longFmt || fallback);
  if (cur === undefined || cur === null) return fallback;
  return String(cur || fallback);
}

function percentMetric(value) {
  const n = numberValue(value, 0);
  if (!Number.isFinite(n) || n === 0) return 0;
  return Math.abs(n) <= 1.5 ? round(n * 100, 2) : round(n, 2);
}

function pushIndicator(cards, indicators, key, label, value, unit = '', display) {
  const n = numberValue(value, 0);
  if (!Number.isFinite(n) || n === 0) return;
  if (!indicators[key]) indicators[key] = round(n, 4);
  if (!cards.some(card => card.label === label)) {
    const text = display || (unit === '%' ? `${round(n, 2).toFixed(2)}%` : unit === 'BRL' ? `R$ ${round(n, 2).toFixed(2).replace('.', ',')}` : String(round(n, 4)));
    cards.push({ label, value: round(n, 4), display: text, unit, source: 'VALORAE Fonte Oficial' });
  }
}

function statementYear(row) {
  const raw = rawMetric(row, 'endDate', 0);
  if (raw > 0) return String(new Date(raw * 1000).getUTCFullYear());
  return textMetric(row, 'endDate.fmt', String(new Date().getUTCFullYear())).slice(0, 4);
}

function yahooFinancialSeries(summary = {}) {
  const incomeRows = summary.incomeStatementHistory?.incomeStatementHistory || [];
  const balanceRows = summary.balanceSheetHistory?.balanceSheetStatements || [];
  const revenueProfit = incomeRows.map(row => ({
    label: statementYear(row),
    year: statementYear(row),
    netRevenue: rawMetric(row, 'totalRevenue'),
    cost: rawMetric(row, 'costOfRevenue'),
    grossProfit: rawMetric(row, 'grossProfit'),
    ebit: rawMetric(row, 'ebit'),
    ebitda: rawMetric(row, 'ebitda'),
    netProfit: rawMetric(row, 'netIncome')
  })).filter(row => row.netRevenue || row.netProfit || row.ebit || row.ebitda).reverse();
  const balance = balanceRows.map(row => ({
    label: statementYear(row),
    year: statementYear(row),
    netWorth: rawMetric(row, 'totalStockholderEquity'),
    totalAssets: rawMetric(row, 'totalAssets'),
    totalLiabilities: rawMetric(row, 'totalLiab')
  })).filter(row => row.netWorth || row.totalAssets || row.totalLiabilities).reverse();
  const profitVsQuote = revenueProfit.filter(row => row.netProfit).map(row => ({ label: row.year, value: row.netProfit, secondaryValue: 0 }));
  return { revenueProfit, balance, profitVsQuote };
}

async function fetchYahooFundamentalSnapshot(ticker, options = {}) {
  const clean = normalizeTicker(ticker);
  if (!clean) return { indicators: {}, indicatorCards: [], profile: {}, status: 'EMPTY', diagnostics: [] };
  const modules = [
    'price','summaryDetail','defaultKeyStatistics','financialData','assetProfile',
    'incomeStatementHistory','balanceSheetHistory','cashflowStatementHistory','earnings','calendarEvents'
  ].join(',');
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol(clean))}?modules=${encodeURIComponent(modules)}`;
  const { json, status, cacheStatus, error } = await fetchJson(url, {
    timeoutMs: Number(options.timeoutMs || 4200),
    ttlMs: 4 * 60 * 60 * 1000,
    staleMs: 24 * 60 * 60 * 1000,
    headers: { Accept: 'application/json,*/*' }
  });
  const summary = json?.quoteSummary?.result?.[0] || {};
  const indicators = {};
  const indicatorCards = [];
  const price = summary.price || {};
  const detail = summary.summaryDetail || {};
  const stats = summary.defaultKeyStatistics || {};
  const fin = summary.financialData || {};
  const profile = summary.assetProfile || {};
  pushIndicator(indicatorCards, indicators, 'precoAtual', 'Preço Atual', rawMetric(price, 'regularMarketPrice'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'valorDeMercado', 'Valor de Mercado', rawMetric(price, 'marketCap') || rawMetric(stats, 'marketCap'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'valorDeFirma', 'Valor de Firma', rawMetric(stats, 'enterpriseValue'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'liquidezMediaDiaria', 'Liquidez Média Diária', rawMetric(detail, 'averageVolume') * rawMetric(price, 'regularMarketPrice'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'dividendYield', 'Dividend Yield', percentMetric(rawMetric(detail, 'dividendYield') || rawMetric(detail, 'trailingAnnualDividendYield')), '%');
  pushIndicator(indicatorCards, indicators, 'pl', 'P/L', rawMetric(stats, 'trailingPE') || rawMetric(summary, 'summaryDetail.trailingPE'));
  pushIndicator(indicatorCards, indicators, 'forwardPE', 'Forward P/E', rawMetric(stats, 'forwardPE'));
  pushIndicator(indicatorCards, indicators, 'pvp', 'P/VP', rawMetric(stats, 'priceToBook'));
  pushIndicator(indicatorCards, indicators, 'psr', 'PSR', rawMetric(stats, 'priceToSalesTrailing12Months'));
  pushIndicator(indicatorCards, indicators, 'lpa', 'LPA', rawMetric(stats, 'trailingEps'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'vpa', 'VPA', rawMetric(stats, 'bookValue'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'roe', 'ROE', percentMetric(rawMetric(fin, 'returnOnEquity')), '%');
  pushIndicator(indicatorCards, indicators, 'roa', 'ROA', percentMetric(rawMetric(fin, 'returnOnAssets')), '%');
  pushIndicator(indicatorCards, indicators, 'margemLiquida', 'Margem Líquida', percentMetric(rawMetric(fin, 'profitMargins') || rawMetric(detail, 'profitMargins')), '%');
  pushIndicator(indicatorCards, indicators, 'margemBruta', 'Margem Bruta', percentMetric(rawMetric(fin, 'grossMargins')), '%');
  pushIndicator(indicatorCards, indicators, 'margemEbitda', 'Margem EBITDA', percentMetric(rawMetric(fin, 'ebitdaMargins')), '%');
  pushIndicator(indicatorCards, indicators, 'ebitda', 'EBITDA', rawMetric(fin, 'ebitda'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'receitaTotal', 'Receita Total', rawMetric(fin, 'totalRevenue'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'lucroBruto', 'Lucro Bruto', rawMetric(fin, 'grossProfits'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'crescimentoReceita', 'Crescimento Receita', percentMetric(rawMetric(fin, 'revenueGrowth')), '%');
  pushIndicator(indicatorCards, indicators, 'crescimentoLucro', 'Crescimento Lucro', percentMetric(rawMetric(fin, 'earningsGrowth')), '%');
  pushIndicator(indicatorCards, indicators, 'dividaBruta', 'Dívida Bruta', rawMetric(fin, 'totalDebt'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'disponibilidade', 'Disponibilidade', rawMetric(fin, 'totalCash'), 'BRL');
  const netDebt = rawMetric(fin, 'totalDebt') - rawMetric(fin, 'totalCash');
  pushIndicator(indicatorCards, indicators, 'dividaLiquida', 'Dívida Líquida', netDebt, 'BRL');
  pushIndicator(indicatorCards, indicators, 'liquidezCorrente', 'Liquidez Corrente', rawMetric(fin, 'currentRatio'));
  pushIndicator(indicatorCards, indicators, 'dividaBrutaPatrimonio', 'Dívida Bruta/Patrimônio', rawMetric(fin, 'debtToEquity'));
  if (rawMetric(fin, 'ebitda') !== 0) pushIndicator(indicatorCards, indicators, 'dividaLiquidaEbitda', 'Dívida Líquida/EBITDA', netDebt / rawMetric(fin, 'ebitda'));
  pushIndicator(indicatorCards, indicators, 'freeFloat', 'Free Float', percentMetric(rawMetric(stats, 'floatShares') / Math.max(1, rawMetric(stats, 'sharesOutstanding'))), '%');
  pushIndicator(indicatorCards, indicators, 'cotasEmitidas', 'Cotas Emitidas', rawMetric(stats, 'sharesOutstanding'), 'number');
  pushIndicator(indicatorCards, indicators, 'max52Semanas', 'Máxima 52 Semanas', rawMetric(detail, 'fiftyTwoWeekHigh'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'min52Semanas', 'Mínima 52 Semanas', rawMetric(detail, 'fiftyTwoWeekLow'), 'BRL');
  const financialSeries = yahooFinancialSeries(summary);
  const description = textMetric(profile, 'longBusinessSummary');
  const sector = textMetric(profile, 'sector');
  const industry = textMetric(profile, 'industry');
  return {
    indicators,
    indicatorCards,
    profile: {
      description,
      sector,
      industry,
      website: textMetric(profile, 'website'),
      country: textMetric(profile, 'country'),
      city: textMetric(profile, 'city'),
      employees: textMetric(profile, 'fullTimeEmployees')
    },
    financialSeries,
    financialSummary: {
      valorDeMercado: indicators.valorDeMercado || 0,
      valorDeFirma: indicators.valorDeFirma || 0,
      patrimonioLiquido: financialSeries.balance.at(-1)?.netWorth || 0,
      ativos: financialSeries.balance.at(-1)?.totalAssets || 0,
      dividaBruta: indicators.dividaBruta || 0,
      dividaLiquida: indicators.dividaLiquida || 0,
      disponibilidade: indicators.disponibilidade || 0,
      liquidezMediaDiaria: indicators.liquidezMediaDiaria || 0,
      ratiosChave: { ...indicators },
      keyRatios: { ...indicators }
    },
    status: indicatorCards.length ? 'OK' : 'EMPTY',
    diagnostics: [{ provider: 'yahoo-summary', status, cacheStatus, count: indicatorCards.length, error }]
  };
}

function mergeFundamentalSnapshots(...snapshots) {
  const merged = { indicators: {}, indicatorCards: [], profile: {}, status: 'EMPTY', diagnostics: [], financialSeries: {}, financialSummary: {} };
  for (const snap of snapshots.filter(Boolean)) {
    Object.assign(merged.indicators, snap.indicators || {});
    Object.assign(merged.profile, snap.profile || {});
    Object.assign(merged.financialSummary, snap.financialSummary || {});
    if (snap.financialSeries) merged.financialSeries = { ...(merged.financialSeries || {}), ...snap.financialSeries };
    for (const card of snap.indicatorCards || []) {
      if (card?.label && !merged.indicatorCards.some(x => x.label === card.label)) merged.indicatorCards.push(card);
    }
    merged.diagnostics.push(...(snap.diagnostics || []));
    if (snap.status === 'OK') merged.status = 'OK';
  }
  return merged;
}

function dividendsToIndicators(events, quotePrice = 0) {
  const nowYear = String(new Date().getUTCFullYear());
  const byYear = new Map();
  const byMonth = new Map();
  for (const ev of events || []) {
    const date = ev.paymentDate || ev.dateCom || ev.eligibilityDate || '';
    const year = String(date).slice(0, 4);
    const month = String(date).slice(0, 7);
    const value = Number(ev.valuePerShare || 0);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (/^\d{4}$/.test(year)) byYear.set(year, round((byYear.get(year) || 0) + value, 6));
    if (/^\d{4}-\d{2}$/.test(month)) byMonth.set(month, round((byMonth.get(month) || 0) + value, 6));
  }
  const dividendYearly = [...byYear.entries()].sort().map(([year, value]) => ({ label: 'Anual', year, value, display: `R$ ${value.toFixed(4).replace('.', ',')}` }));
  const dividendMonthly = [...byMonth.entries()].sort().slice(-120).map(([period, value]) => ({ label: 'Mensal', period, value, display: `R$ ${value.toFixed(4).replace('.', ',')}` }));
  const dividendYieldHistory = dividendYearly.map(row => ({ label: 'DY %', year: row.year, value: quotePrice > 0 ? round((row.value / quotePrice) * 100, 2) : 0, display: quotePrice > 0 ? `${round((row.value / quotePrice) * 100, 2).toFixed(2)}%` : '' })).filter(x => x.value > 0);
  const lastYearDividend = byYear.get(nowYear) || byYear.get(String(Number(nowYear) - 1)) || 0;
  return { dividendYearly, dividendMonthly, dividendYieldHistory, lastYearDividend };
}

function buildSimpleFinancialSeries(indicators = {}, priceHistory = [], fundamentals = {}) {
  const current = priceHistory.at(-1)?.close || priceHistory.at(-1)?.price || priceHistory.at(-1)?.value || 0;
  const provided = fundamentals.financialSeries || {};
  const revenueProfitProvided = Array.isArray(provided.revenueProfit) ? provided.revenueProfit : [];
  const balanceProvided = Array.isArray(provided.balance) ? provided.balance : [];
  const profitVsQuoteProvided = Array.isArray(provided.profitVsQuote) ? provided.profitVsQuote : [];
  if (revenueProfitProvided.length || balanceProvided.length || profitVsQuoteProvided.length) {
    return { revenueProfit: revenueProfitProvided, balance: balanceProvided, profitVsQuote: profitVsQuoteProvided };
  }
  const revenue = numberValue(indicators.receitaTotal || indicators.valorDeMercado || indicators.marketValue, 0);
  const equity = numberValue(indicators.patrimonioLiquido || indicators.netWorth, 0);
  const profit = numberValue(indicators.lucroBruto || indicators.lpa, 0) * (indicators.lucroBruto ? 1 : 1000000);
  const year = String(new Date().getUTCFullYear());
  const balance = equity > 0 ? [{ label: year, year, netWorth: equity, totalAssets: numberValue(indicators.totalAtivos, equity), totalLiabilities: 0 }] : [];
  const revenueProfit = (revenue > 0 || profit !== 0) ? [{ label: year, year, netRevenue: revenue, netProfit: profit }] : [];
  const profitVsQuote = current > 0 && profit !== 0 ? [{ label: year, value: current, secondaryValue: profit }] : [];
  return { balance, revenueProfit, profitVsQuote };
}

function buildAssetChartBundle({ ticker, assetClass, quote, fundamentals, history, dividends }) {
  const priceHistory = history?.points || [];
  const events = dividends?.events || [];
  const div = dividendsToIndicators(events, quote?.currentPrice || quote?.price || 0);
  const indicators = fundamentals.indicators || {};
  const financial = buildSimpleFinancialSeries(indicators, priceHistory, fundamentals);
  const returns = periodReturnsFromPrices(priceHistory);
  const indexComparison = returns.length ? [{ name: ticker, points: returns.map(r => ({ label: r.period, value: r.valuePercent })) }] : [];
  const captured = ['quote', priceHistory.length ? 'priceHistory' : '', fundamentals.indicatorCards?.length ? 'fundamentals' : '', events.length ? 'dividends' : ''].filter(Boolean);
  const missing = [priceHistory.length ? '' : 'priceHistory', fundamentals.indicatorCards?.length ? '' : 'fundamentals'].filter(Boolean);
  return {
    ticker,
    type: assetClass,
    range: history?.range || '1Y',
    source: 'VALORAE Fonte Oficial',
    priceHistory,
    profitability: returns,
    realProfitability: [],
    indicatorCards: fundamentals.indicatorCards || [],
    dividendEvents: events,
    dividendMonthly: div.dividendMonthly,
    dividendYearly: div.dividendYearly,
    dividendYieldHistory: div.dividendYieldHistory,
    indexComparison,
    commodityComparison: [],
    revenueProfit: financial.revenueProfit,
    profitVsQuote: financial.profitVsQuote,
    equityEvolution: financial.balance,
    balanceSheet: financial.balance,
    payoutHistory: indicators.payout ? [{ label: 'Payout', year: String(new Date().getUTCFullYear()), value: Number(indicators.payout), display: `${Number(indicators.payout).toFixed(2)}%`, unit: '%' }] : [],
    revenueByRegion: {},
    revenueByBusiness: {},
    fiiDistribution12m: div.dividendMonthly,
    fiiPeerAverage: [],
    fiiPatrimonialInfo: fundamentals.indicatorCards?.filter(x => /vacância|cotistas|cotas|patrimônio/i.test(x.label)) || [],
    fiiAssetDistribution: {},
    warnings: missing.length ? [`Campos ainda indisponíveis: ${missing.join(', ')}`] : [],
    coverageCaptured: captured,
    coverageMissing: missing,
    coverageNotApplicable: assetClass === 'FII' ? ['commodityComparison'] : ['fiiAssetDistribution']
  };
}

export async function buildAssetDetails(payload = {}) {
  const ticker = normalizeTicker(payload.ticker || payload.symbol || payload.q);
  if (!ticker) return { status: 'EMPTY', ticker: '', assetChartBundle: null };
  const range = normalizeRange(payload.range || payload.period || '1Y');
  const [quote, history, htmlFundamentals, yahooFundamentals, dividends] = await Promise.all([
    getQuote(ticker, { timeoutMs: Number(payload.quoteTimeoutMs || payload.timeoutMs || 3500) }).catch(error => ({ status: 'ERROR', ticker, price: 0, error: error?.message })),
    getAssetHistory({ ...payload, ticker, range }).catch(error => ({ status: 'ERROR', ticker, points: [], history: [], series: [], chartHistory: [], error: error?.message })),
    fetchFundamentalSnapshot(ticker, { timeoutMs: Number(payload.fundamentalTimeoutMs || payload.timeoutMs || 4200) }).catch(error => ({ status: 'ERROR', indicators: {}, indicatorCards: [], profile: {}, diagnostics: [{ provider: 'html', error: error?.message }] })),
    fetchYahooFundamentalSnapshot(ticker, { timeoutMs: Number(payload.yahooTimeoutMs || payload.timeoutMs || 4200) }).catch(error => ({ status: 'ERROR', indicators: {}, indicatorCards: [], profile: {}, diagnostics: [{ provider: 'yahoo-summary', error: error?.message }] })),
    getConfirmedDividendsByTicker(ticker, { timeoutMs: Number(payload.dividendTimeoutMs || 4200) }).catch(error => ({ events: [], diagnostics: [{ error: error?.message }] }))
  ]);
  const fundamentals = mergeFundamentalSnapshots(htmlFundamentals, yahooFundamentals);
  const assetClass = classifyTicker(ticker);
  const indicators = fundamentals.indicators || {};
  const div = dividendsToIndicators(dividends.events || [], quote?.currentPrice || quote?.price || 0);
  const dividendYield = numberValue(indicators.dividendYield, 0) || (quote?.price > 0 && div.lastYearDividend > 0 ? round((div.lastYearDividend / quote.price) * 100, 2) : 0);
  const bundle = buildAssetChartBundle({ ticker, assetClass, quote, fundamentals, history, dividends });
  const description = fundamentals.profile?.description || `${ticker} acompanhado pelo contrato oficial VALORAE com cotação, indicadores, histórico e proventos normalizados.`;
  const normalized = {
    precoAtual: quote?.currentPrice || quote?.price || 0,
    variacaoDay: quote?.changePercent || 0,
    dividendYield,
    ...indicators
  };
  const results = {
    ticker,
    symbol: ticker,
    type: assetClass,
    assetClass,
    nome: ticker,
    nomeEmpresa: ticker,
    precoAtual: quote?.currentPrice || quote?.price || 0,
    variacaoDay: quote?.changePercent || 0,
    dividendYield,
    dy: dividendYield,
    ultimoRendimento: (dividends.events || []).find(e => dateMillis(e.paymentDate || e.dateCom) <= Date.now())?.valuePerShare || 0,
    ...indicators,
    cotacao: {
      precoAtual: quote?.currentPrice || quote?.price || 0,
      variacaoDay: quote?.changePercent || 0,
      max52Semanas: 0,
      min52Semanas: 0
    },
    indicadores: { dividendYield, ...indicators },
    indicadoresFundamentalistas: { semComparativos: { dividendYield, ...indicators } },
    dadosEmpresa: { nome: ticker, setor: assetClass === 'FII' ? 'Fundo imobiliário' : 'Renda variável' },
    informacoesEmpresa: { ...(fundamentals.financialSummary || {}), valorDeMercado: indicators.valorDeMercado || fundamentals.financialSummary?.valorDeMercado || 0, patrimonioLiquido: indicators.patrimonioLiquido || fundamentals.financialSummary?.patrimonioLiquido || 0, setor: fundamentals.profile?.sector || '', subsetor: fundamentals.profile?.industry || '' },
    informacoesFundo: assetClass === 'FII' ? { segmento: fundamentals.profile?.industry || 'FII', patrimonioLiquido: indicators.patrimonioLiquido || fundamentals.financialSummary?.patrimonioLiquido || 0, vacanciaFisica: indicators.vacanciaFisica || 0, numeroCotistas: indicators.cotistas || 0, cotasEmitidas: indicators.cotasEmitidas || indicators.cotasEmitidas || 0 } : {},
    historicoPrecos: history.points || [],
    proventos: dividends.events || [],
    dividends: dividends.events || [],
    financialSummary: fundamentals.financialSummary || {},
    indicadoresAvancados: { ...indicators },
    valuation: { pl: indicators.pl || 0, pvp: indicators.pvp || 0, psr: indicators.psr || 0, evEbitda: indicators.evEbitda || 0, evEbit: indicators.evEbit || 0 },
    profitability: { roe: indicators.roe || 0, roa: indicators.roa || 0, roic: indicators.roic || 0, margemLiquida: indicators.margemLiquida || 0, margemBruta: indicators.margemBruta || 0 },
    debt: { dividaBruta: indicators.dividaBruta || 0, dividaLiquida: indicators.dividaLiquida || 0, dividaLiquidaEbitda: indicators.dividaLiquidaEbitda || 0 },
    statements: { revenueProfit: bundle.revenueProfit, balanceSheet: bundle.balanceSheet, equityEvolution: bundle.equityEvolution },
    assetChartBundle: bundle,
    assetChartsMobile: bundle,
    sections: { indicadores: { dividendYield, ...indicators }, assetChartBundle: bundle, assetChartsMobile: bundle }
  };
  return {
    status: (quote?.price > 0 || bundle.priceHistory.length || bundle.indicatorCards.length || bundle.dividendEvents.length) ? 'OK' : 'PARTIAL',
    ticker,
    symbol: ticker,
    type: assetClass,
    assetClass,
    isFii: assetClass === 'FII',
    name: ticker,
    source: 'VALORAE Fonte Oficial',
    price: quote?.price || 0,
    currentPrice: quote?.currentPrice || quote?.price || 0,
    precoAtual: quote?.currentPrice || quote?.price || 0,
    changePercent: quote?.changePercent || 0,
    variacaoDay: quote?.changePercent || 0,
    dividendYield,
    dy: dividendYield,
    pvp: indicators.pvp || 0,
    pl: indicators.pl || 0,
    roe: indicators.roe || 0,
    roic: indicators.roic || 0,
    roa: indicators.roa || 0,
    payout: indicators.payout || 0,
    margemLiquida: indicators.margemLiquida || 0,
    margemBruta: indicators.margemBruta || 0,
    margemEbit: indicators.margemEbit || 0,
    margemEbitda: indicators.margemEbitda || 0,
    valorDeMercado: indicators.valorDeMercado || 0,
    patrimonioLiquido: indicators.patrimonioLiquido || 0,
    liquidezMediaDiaria: indicators.liquidezMediaDiaria || 0,
    assetDescription: description,
    subSector: assetClass === 'FII' ? (fundamentals.profile?.industry || '') : (fundamentals.profile?.industry || 'Renda variável'),
    sector: fundamentals.profile?.sector || '',
    subsetor: fundamentals.profile?.industry || '',
    fiiSegment: assetClass === 'FII' ? 'Fundo imobiliário' : '',
    normalized,
    indicators: { dividendYield, ...indicators },
    fundamentos: { dividendYield, ...indicators },
    fundamentals: { dividendYield, ...indicators },
    financialSummary: fundamentals.financialSummary || {},
    indicadoresAvancados: { ...indicators },
    quote,
    cotacao: results.cotacao,
    results,
    financialSummary: fundamentals.financialSummary || {},
    indicadoresAvancados: { ...indicators },
    valuation: { pl: indicators.pl || 0, pvp: indicators.pvp || 0, psr: indicators.psr || 0, evEbitda: indicators.evEbitda || 0, evEbit: indicators.evEbit || 0 },
    profitability: { roe: indicators.roe || 0, roa: indicators.roa || 0, roic: indicators.roic || 0, margemLiquida: indicators.margemLiquida || 0, margemBruta: indicators.margemBruta || 0 },
    debt: { dividaBruta: indicators.dividaBruta || 0, dividaLiquida: indicators.dividaLiquida || 0, dividaLiquidaEbitda: indicators.dividaLiquidaEbitda || 0 },
    statements: { revenueProfit: bundle.revenueProfit, balanceSheet: bundle.balanceSheet, equityEvolution: bundle.equityEvolution },
    assetChartBundle: bundle,
    assetChartsMobile: bundle,
    appPayload: { quote, metrics: { canonical: normalized }, charts: { assetChartBundle: bundle } },
    appMobileSnapshot: { quote, metrics: normalized, assetChartBundle: bundle },
    diagnostics: {
      quote: quote?.status,
      history: history?.status,
      fundamentals: fundamentals?.status,
      dividendCount: dividends.events?.length || 0,
      fundamentalDiagnostics: fundamentals.diagnostics || []
    },
    coverage: { captured: bundle.coverageCaptured, missing: bundle.coverageMissing },
    partial: bundle.coverageMissing.length > 0
  };
}

export const _test = { percentMetric, mergeFundamentalSnapshots, yahooFinancialSeries, buildSimpleFinancialSeries };
