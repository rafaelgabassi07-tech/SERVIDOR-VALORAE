import { decorateHistoryWithB3Calendar, normalizeB3Range } from './b3-calendar.js';
import { getCachedMarketValue, setCachedMarketValue, withMarketInflight } from './cache.js';

export const VALORAE_YAHOO_MARKET_VERSION = '21.12.0';

const HISTORY_TTL_MS = Number(process.env.VALORAE_YAHOO_HISTORY_TTL_MS || 60 * 1000);
const HISTORY_STALE_MS = Number(process.env.VALORAE_YAHOO_HISTORY_STALE_MS || 10 * 60 * 1000);
const QUOTE_TTL_MS = Number(process.env.VALORAE_YAHOO_QUOTE_TTL_MS || 20 * 1000);
const QUOTE_STALE_MS = Number(process.env.VALORAE_YAHOO_QUOTE_STALE_MS || 2 * 60 * 1000);
const LOGO_TTL_MS = Number(process.env.VALORAE_YAHOO_LOGO_TTL_MS || 24 * 60 * 60 * 1000);
const LOGO_STALE_MS = Number(process.env.VALORAE_YAHOO_LOGO_STALE_MS || 7 * 24 * 60 * 60 * 1000);
const LOGO_MISS_TTL_MS = Number(process.env.VALORAE_YAHOO_LOGO_MISS_TTL_MS || 30 * 60 * 1000);

export function canonicalTicker(raw = '') {
  let ticker = String(raw || '').trim().toUpperCase();
  if (!ticker) return '';
  if (/^\^/.test(ticker) || /^[A-Z]{1,6}=X$/.test(ticker)) return ticker;
  ticker = ticker
    .replace(/^BVMF:/, '')
    .replace(/^BMFBOVESPA:/, '')
    .replace(/^B3:/, '')
    .replace(/\.SA$/, '')
    .replace(/-SA$/, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16);
  if (/^(?:[A-Z]{4}[0-9]{1,2}|[A-Z0-9]{3,6}[0-9]{1,2})SA$/.test(ticker)) ticker = ticker.slice(0, -2);
  if (/^[A-Z]{4}[0-9]{1,2}F$/.test(ticker)) ticker = ticker.slice(0, -1);
  return ticker.slice(0, 12);
}
const DIRECT_YAHOO_INDEX_SYMBOLS = {
  IFIX: 'IFIX.SA',
  IDIV: 'IDIV.SA',
  SMLL: 'SMLL.SA'
};


function yahooExternalDisabled() {
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(process.env.VALORAE_DISABLE_EXTERNAL || '').trim().toLowerCase());
}

function yahooDisabledPayload(kind, ticker, symbol, extra = {}) {
  return {
    ok: false,
    ticker: canonicalTicker(ticker),
    symbol,
    source: 'YahooChart',
    sourceVersion: VALORAE_YAHOO_MARKET_VERSION,
    cache: 'DISABLED',
    error: 'external-disabled',
    ...extra
  };
}

function explicitYahooSymbol(raw = '') {
  const value = String(raw || '').trim().toUpperCase();
  if (!value) return '';
  if (/^\^/.test(value) || /^[A-Z]{1,6}=X$/.test(value)) return value;
  if (/^(BVMF|BMFBOVESPA|B3):/.test(value)) return '';
  if (/^[A-Z0-9^:-]+\.[A-Z]{2,4}$/.test(value)) return value;
  return '';
}

export function yahooSymbol(ticker = '') {
  const explicit = explicitYahooSymbol(ticker);
  if (explicit) return explicit;
  const t = canonicalTicker(ticker);
  if (['IBOV', 'IBOVESPA'].includes(t)) return '^BVSP';
  if (DIRECT_YAHOO_INDEX_SYMBOLS[t]) return DIRECT_YAHOO_INDEX_SYMBOLS[t];
  if (/^\^/.test(t) || /^[A-Z]{1,6}=X$/.test(t)) return t;
  if (/^[A-Z]{1,5}$/.test(t)) return t;
  return `${t}.SA`;
}


function safeYahooLogoUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw || !/^https:\/\//i.test(raw)) return '';
  let parsed;
  try { parsed = new URL(raw); } catch { return ''; }
  const host = parsed.hostname.toLowerCase();
  if (host !== 's.yimg.com' && !host.endsWith('.s.yimg.com') && host !== 's.yimg.com.br') return '';
  if (!/\.(?:png|jpg|jpeg|webp|svg)(?:$|[?#])/i.test(parsed.pathname) && !/\/finance\/logo\//i.test(parsed.pathname)) return '';
  return raw;
}

function yahooLogoFromQuoteRow(row = {}) {
  if (!row || typeof row !== 'object') return '';
  return safeYahooLogoUrl(row.companyLogoUrl || row.logoUrl || row.logo_url || row.company_logo_url || '');
}

async function fetchYahooLogoNetwork(ticker, { timeoutMs = 4500 } = {}) {
  const symbol = yahooSymbol(ticker);
  const canonical = canonicalTicker(ticker);
  if (!symbol || !canonical) return { ok: false, ticker: canonical, symbol, source: 'Yahoo Finance Quote API', error: 'Ticker inválido', logoUrl: '' };
  const params = new URLSearchParams({
    symbols: symbol,
    fields: 'logoUrl,companyLogoUrl,shortName,longName,symbol',
    formatted: 'false',
    lang: 'pt-BR',
    region: 'BR',
    corsDomain: 'finance.yahoo.com'
  });
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  let lastError = null;
  for (const host of hosts) {
    const url = `https://${host}/v6/finance/quote?${params.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(Number(timeoutMs) || 4500, 9000)));
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0', Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Yahoo logo HTTP ${res.status}`);
      const json = await res.json();
      const rows = Array.isArray(json?.quoteResponse?.result) ? json.quoteResponse.result : [];
      const row = rows.find(item => String(item?.symbol || '').toUpperCase() === symbol.toUpperCase()) || rows[0] || {};
      const logoUrl = yahooLogoFromQuoteRow(row);
      if (!logoUrl) throw new Error('Yahoo logo ausente');
      return {
        ok: true,
        ticker: canonical,
        symbol,
        logoUrl,
        name: row.longName || row.shortName || '',
        source: 'Yahoo Finance Quote API',
        sourceVersion: VALORAE_YAHOO_MARKET_VERSION,
        cache: 'MISS'
      };
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, ticker: canonical, symbol, source: 'Yahoo Finance Quote API', sourceVersion: VALORAE_YAHOO_MARKET_VERSION, error: lastError?.message || 'Yahoo logo indisponível', logoUrl: '', cache: 'MISS' };
}

export async function fetchYahooLogo(ticker, opts = {}) {
  const symbol = yahooSymbol(ticker);
  const cacheKey = JSON.stringify({ symbol, logo: true });
  if (opts.bypassCache !== true && opts.cache !== false) {
    const hit = getCachedMarketValue('yahoo-logo', cacheKey, { allowStale: false });
    if (hit) return { ...hit.data, cache: hit.cache };
  }
  if (yahooExternalDisabled()) {
    if (opts.bypassCache !== true && opts.cache !== false) {
      const stale = getCachedMarketValue('yahoo-logo', cacheKey, { allowStale: true });
      if (stale) return { ...stale.data, ok: true, cache: 'STALE_EXTERNAL_DISABLED', warning: 'external-disabled' };
    }
    return yahooDisabledPayload('logo', ticker, symbol, { logoUrl: '', source: 'Yahoo Finance Quote API' });
  }
  return withMarketInflight('yahoo-logo', cacheKey, async () => {
    const data = await fetchYahooLogoNetwork(ticker, opts);
    if (data.ok) {
      setCachedMarketValue('yahoo-logo', cacheKey, data, { ttlMs: LOGO_TTL_MS, staleMs: LOGO_STALE_MS, maxEntries: 600, maxBytes: 512 * 1024 });
      return data;
    }
    const stale = getCachedMarketValue('yahoo-logo', cacheKey, { allowStale: true });
    if (stale?.data?.logoUrl) return { ...stale.data, ok: true, cache: 'STALE_IF_ERROR', warning: data.error };
    const negative = { ...data, ok: false, logoUrl: '', cache: 'MISS_NEGATIVE_CACHE' };
    setCachedMarketValue('yahoo-logo', cacheKey, negative, { ttlMs: LOGO_MISS_TTL_MS, staleMs: LOGO_MISS_TTL_MS, maxEntries: 600, maxBytes: 512 * 1024 });
    return negative;
  });
}

export const RANGE_MAP = {
  '1D': { range: '1d', interval: '5m' },
  '5D': { range: '5d', interval: '15m' },
  '1M': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  'YTD': { range: 'ytd', interval: '1d' },
  '1Y': { range: '1y', interval: '1d' },
  '2Y': { range: '2y', interval: '1d' },
  '5Y': { range: '5y', interval: '1wk' },
  '10Y': { range: '10y', interval: '1mo' },
  'MAX': { range: 'max', interval: '1mo' },
};

function limitPoints(points = [], limit) {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0 || points.length <= n) return points;
  return points.slice(-Math.floor(n));
}

function summary(points = []) {
  const prices = points.map(p => p.close).filter(Number.isFinite);
  if (!prices.length) return {};
  const first = prices[0], last = prices[prices.length - 1];
  const min = Math.min(...prices), max = Math.max(...prices);
  const volumes = points.map(p => p.volume).filter(Number.isFinite);
  return {
    firstClose: first,
    lastClose: last,
    min,
    max,
    variationPct: first ? Number((((last-first)/first)*100).toFixed(2)) : undefined,
    points: points.length,
    totalVolume: volumes.length ? volumes.reduce((a, b) => a + b, 0) : undefined,
    averageVolume: volumes.length ? Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length) : undefined,
  };
}

async function fetchYahooHistoryNetwork(ticker, { range = '1Y', interval, timeoutMs = 9000, limit } = {}) {
  const normalizedRange = normalizeB3Range(range);
  const chosen = RANGE_MAP[normalizedRange] || RANGE_MAP['1Y'];
  const symbol = yahooSymbol(ticker);
  const params = new URLSearchParams({ range: chosen.range, interval: interval || chosen.interval, includePrePost: 'false', events: 'div,splits' });
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  let lastError = null;
  for (const host of hosts) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?${params.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0', 'Accept': 'application/json' } });
      if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) throw new Error(json?.chart?.error?.description || 'Yahoo sem result');
      const ts = result.timestamp || [];
      const q = result.indicators?.quote?.[0] || {};
      const adj = result.indicators?.adjclose?.[0]?.adjclose || [];
      const rawPoints = ts.map((t, i) => ({
        date: new Date(t * 1000).toISOString(),
        open: q.open?.[i] ?? null,
        high: q.high?.[i] ?? null,
        low: q.low?.[i] ?? null,
        close: q.close?.[i] ?? null,
        volume: q.volume?.[i] ?? null,
        adjClose: adj[i] ?? null,
      })).filter(p => Number.isFinite(p.close));
      const points = limitPoints(rawPoints, limit);
      const marketCalendar = decorateHistoryWithB3Calendar(points);
      return {
        ok: true,
        ticker: canonicalTicker(ticker),
        symbol,
        requestedRange: String(range || '1Y'),
        range: normalizedRange,
        yahooRange: chosen.range,
        interval: interval || chosen.interval,
        source: 'YahooChart',
        sourceVersion: VALORAE_YAHOO_MARKET_VERSION,
        currency: result.meta?.currency,
        timezone: result.meta?.timezone,
        regularMarketPrice: result.meta?.regularMarketPrice,
        previousClose: result.meta?.chartPreviousClose ?? result.meta?.previousClose,
        summary: { ...summary(points), marketCalendar: marketCalendar.calendar, lastTradingPointDate: marketCalendar.lastPointDate },
        marketCalendar,
        points,
        events: result.events || {},
        rawPointsCount: rawPoints.length,
        cache: 'MISS',
      };
    } catch (err) {
      lastError = err;
    } finally { clearTimeout(timer); }
  }
  return { ok: false, ticker: canonicalTicker(ticker), symbol, requestedRange: String(range || '1Y'), range: normalizedRange, source: 'YahooChart', sourceVersion: VALORAE_YAHOO_MARKET_VERSION, error: lastError?.message || 'Yahoo indisponível', points: [], summary: {}, marketCalendar: decorateHistoryWithB3Calendar([]), cache: 'MISS' };
}

export async function fetchYahooHistory(ticker, opts = {}) {
  const { range = '1Y', interval, limit } = opts;
  const normalizedRange = normalizeB3Range(range);
  const symbol = yahooSymbol(ticker);
  const key = JSON.stringify({ symbol, range: normalizedRange, interval: interval || '', limit: Number(limit || 0) });
  if (opts.bypassCache !== true && opts.cache !== false) {
    const hit = getCachedMarketValue('yahoo-history', key, { allowStale: false });
    if (hit) return { ...hit.data, cache: hit.cache };
  }
  if (yahooExternalDisabled()) {
    if (opts.bypassCache !== true && opts.cache !== false) {
      const stale = getCachedMarketValue('yahoo-history', key, { allowStale: true });
      if (stale) return { ...stale.data, ok: true, cache: 'STALE_EXTERNAL_DISABLED', warning: 'external-disabled' };
    }
    return yahooDisabledPayload('history', ticker, symbol, {
      requestedRange: String(range || '1Y'),
      range: normalizedRange,
      points: [],
      summary: {},
      marketCalendar: decorateHistoryWithB3Calendar([])
    });
  }
  return withMarketInflight('yahoo-history', key, async () => {
    const data = await fetchYahooHistoryNetwork(ticker, opts);
    if (data.ok) {
      setCachedMarketValue('yahoo-history', key, data, { ttlMs: HISTORY_TTL_MS, staleMs: HISTORY_STALE_MS, maxEntries: 350, maxBytes: 12 * 1024 * 1024 });
      return data;
    }
    const stale = getCachedMarketValue('yahoo-history', key, { allowStale: true });
    if (stale) return { ...stale.data, ok: true, cache: 'STALE_IF_ERROR', warning: data.error };
    return data;
  });
}

export { yahooExternalDisabled, yahooDisabledPayload };

export async function fetchYahooQuote(symbol, opts = {}) {
  const resolvedSymbol = yahooSymbol(symbol);
  const cacheKey = JSON.stringify({ symbol: resolvedSymbol, quote: true });
  if (opts.bypassCache !== true && opts.cache !== false) {
    const hit = getCachedMarketValue('yahoo-quote', cacheKey, { allowStale: false });
    if (hit) return { ...hit.data, cache: hit.cache };
  }
  if (yahooExternalDisabled()) {
    if (opts.bypassCache !== true && opts.cache !== false) {
      const stale = getCachedMarketValue('yahoo-quote', cacheKey, { allowStale: true });
      if (stale) return { ...stale.data, ok: true, cache: 'STALE_EXTERNAL_DISABLED', warning: 'external-disabled' };
    }
    return yahooDisabledPayload('quote', symbol, resolvedSymbol, { price: undefined, previousClose: undefined });
  }
  return withMarketInflight('yahoo-quote', cacheKey, async () => {
    const isDirectIndex = ['IFIX.SA', 'IDIV.SA', 'SMLL.SA'].includes(resolvedSymbol);
    const data = await fetchYahooHistory(symbol, { ...opts, range: '1D', interval: opts.interval || (isDirectIndex ? '1d' : '5m') });
    if (!data.ok) {
      const stale = getCachedMarketValue('yahoo-quote', cacheKey, { allowStale: true });
      if (stale) return { ...stale.data, ok: true, cache: 'STALE_IF_ERROR', warning: data.error };
      return data;
    }
    const last = data.points[data.points.length - 1];
    const prev = data.previousClose;
    const quote = { ok: true, symbol: data.symbol, price: last?.close ?? data.regularMarketPrice, previousClose: prev, variationPct: prev && last?.close ? Number((((last.close - prev) / prev) * 100).toFixed(2)) : undefined, source: 'YahooChart', time: last?.date, marketCalendar: data.marketCalendar, cache: data.cache };
    setCachedMarketValue('yahoo-quote', cacheKey, quote, { ttlMs: QUOTE_TTL_MS, staleMs: QUOTE_STALE_MS, maxEntries: 250, maxBytes: 2 * 1024 * 1024 });
    return quote;
  });
}
