import { fetchJson } from './fetch.js';
import { normalizeTicker, classifyTicker, uniqueTickers } from '../core/tickers.js';
import { numberValue, round } from '../core/numbers.js';
import { enrichEquilibriumPosition } from '../portfolio/equilibrium-metadata.js';
import { getFundamentusSnapshotForTickers } from '../market/fundamentus-snapshot.js';

export const DEFAULT_MARKET_TICKERS = Object.freeze([
  'PETR4','VALE3','ITUB4','BBDC4','BBAS3','ABEV3','WEGE3','B3SA3','PRIO3','RENT3','SUZB3','ELET3',
  'MXRF11','HGLG11','KNRI11','XPML11'
]);

const LAST_KNOWN_DIRECT_INDEX_QUOTES = Object.freeze({
  IFIX: { price: 3814.03, changePercent: 0.30, marketTime: '2026-06-12T17:17:00-03:00' },
  IDIV: { price: 12117.78, changePercent: -0.29, marketTime: '2026-06-12T17:17:00-03:00' },
  SMLL: { price: 2214.89, changePercent: -0.40, marketTime: '2026-06-12T17:20:00-03:00' }

});

const QUOTE_SAFE_TTL_MS = Number(process.env.VALORAE_QUOTE_SAFE_TTL_MS || 30_000);
const QUOTE_SAFE_STALE_MS = Number(process.env.VALORAE_QUOTE_SAFE_STALE_MS || 10 * 60 * 1000);
const QUOTE_BACKOFF_MS = Number(process.env.VALORAE_QUOTE_BACKOFF_MS || 2 * 60 * 1000);
const liveQuoteMemory = new Map();
const quoteBackoffUntil = new Map();

function rememberLiveQuote(clean, quote) {
  if (clean && quote && Number(quote.price || quote.currentPrice || 0) > 0) {
    liveQuoteMemory.set(clean, { ...quote, rememberedAt: new Date().toISOString() });
  }
}

function quoteFromBackoff(clean, symbol) {
  const until = Number(quoteBackoffUntil.get(symbol) || quoteBackoffUntil.get(clean) || 0);
  if (!until || Date.now() >= until) return null;
  const cached = liveQuoteMemory.get(clean);
  if (!cached) return null;
  return {
    ...cached,
    status: 'STALE',
    cacheStatus: 'BACKOFF_STALE',
    stale: true,
    retryAfterMs: Math.max(0, until - Date.now()),
    source: `${cached.source || 'Yahoo Finance'} cache seguro`,
    warning: 'Yahoo Finance em backoff; exibindo última cotação válida para evitar bloqueio.'
  };
}

function applyQuoteBackoff(clean, symbol, reason = 'remote-throttle') {
  const until = Date.now() + QUOTE_BACKOFF_MS;
  quoteBackoffUntil.set(symbol, until);
  quoteBackoffUntil.set(clean, until);
  return reason;
}

function directIndexFallbackQuote(clean, parsed = {}, error = '') {
  const fallback = LAST_KNOWN_DIRECT_INDEX_QUOTES[clean];
  if (!fallback) return null;
  return {
    ...parsed,
    ticker: clean,
    symbol: clean,
    assetClass: 'INDICE',
    price: round(fallback.price, 4),
    currentPrice: round(fallback.price, 4),
    lastPrice: round(fallback.price, 4),
    cotacao: round(fallback.price, 4),
    precoAtual: round(fallback.price, 4),
    previousClose: 0,
    change: 0,
    changePercent: round(fallback.changePercent, 4),
    variationPercent: round(fallback.changePercent, 4),
    variacao: round(fallback.changePercent, 4),
    currency: 'BRL',
    marketTime: fallback.marketTime,
    source: `Yahoo Finance Chart API índice direto ${yahooSymbol(clean)} - último snapshot conhecido`,
    cacheStatus: 'LAST_KNOWN_IF_ERROR',
    staleFallback: true,
    status: 'OK',
    warning: `${clean} sem resposta ao vivo; exibindo último snapshot conhecido informado pelo Yahoo Finance.`,
    error
  };
}


function tickerInput(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(/[;,\s]+/).filter(Boolean);
  if (value && typeof value === 'object') return [value];
  return [];
}

export function yahooSymbol(ticker) {
  const raw = String(ticker || '').trim().toUpperCase();
  if (/^\^/.test(raw) || /^[A-Z0-9^:-]+\.[A-Z]{2,4}$/.test(raw) || /^[A-Z]{1,6}=X$/.test(raw)) return raw;
  const clean = normalizeTicker(ticker);
  if (!clean) return '';
  if (clean === 'IBOV' || clean === 'BVSP' || clean === 'IBOVESPA') return '^BVSP';
  if (clean === 'IFIX') return 'IFIX.SA';
  if (clean === 'IDIV') return 'IDIV.SA';
  if (clean === 'SMLL') return 'SMLL.SA';
  if (clean === 'USD' || clean === 'USDBRL' || clean === 'USDBRLX' || clean === 'BRLX') return 'BRL=X';
  return `${clean}.SA`;
}

function parseChartQuote(ticker, json, status = 0, cacheStatus = 'MISS') {
  const result = json?.chart?.result?.[0];
  const meta = result?.meta || {};
  const quote = result?.indicators?.quote?.[0] || {};
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const closes = Array.isArray(quote.close) ? quote.close : [];
  const lastClose = [...closes].reverse().find(v => Number.isFinite(Number(v)) && Number(v) > 0);
  const price = numberValue(meta.regularMarketPrice ?? meta.previousClose ?? lastClose, 0);
  const previousClose = numberValue(meta.chartPreviousClose ?? meta.previousClose, 0);
  const change = price > 0 && previousClose > 0 ? price - previousClose : 0;
  const changePercent = price > 0 && previousClose > 0 ? (change / previousClose) * 100 : 0;
  const ts = Number(meta.regularMarketTime || timestamps.at(-1) || 0);
  return {
    ticker: normalizeTicker(ticker),
    symbol: normalizeTicker(ticker),
    assetClass: classifyTicker(ticker),
    price: round(price, 4),
    currentPrice: round(price, 4),
    lastPrice: round(price, 4),
    cotacao: round(price, 4),
    precoAtual: round(price, 4),
    previousClose: round(previousClose, 4),
    change: round(change, 4),
    changePercent: round(changePercent, 4),
    variationPercent: round(changePercent, 4),
    variacao: round(changePercent, 4),
    currency: meta.currency || 'BRL',
    marketTime: ts ? new Date(ts * 1000).toISOString() : '',
    source: 'VALORAE Fonte Oficial',
    statusCode: status,
    cacheStatus,
    status: price > 0 ? 'OK' : 'EMPTY'
  };
}

export async function getQuote(ticker, { timeoutMs = 3500 } = {}) {
  const clean = normalizeTicker(ticker);
  if (!clean) return { status: 'EMPTY', ticker: '', price: 0, source: 'VALORAE Fonte Oficial' };
  const symbol = yahooSymbol(clean);
  const backoffQuote = quoteFromBackoff(clean, symbol);
  if (backoffQuote) return backoffQuote;
  const interval = ['IFIX.SA', 'IDIV.SA', 'SMLL.SA'].includes(symbol) ? '1d' : '5m';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=${interval}&includePrePost=false`;
  const { json, status, cacheStatus, error } = await fetchJson(url, { timeoutMs, ttlMs: QUOTE_SAFE_TTL_MS, staleMs: QUOTE_SAFE_STALE_MS, retries: 0 });
  const parsed = parseChartQuote(clean, json, status, cacheStatus);
  if (status === 429 || /429|too many/i.test(String(error || ''))) {
    applyQuoteBackoff(clean, symbol, 'too-many-requests');
    const stale = quoteFromBackoff(clean, symbol);
    if (stale) return stale;
  }
  if (parsed.price <= 0) {
    if (status === 0 || cacheStatus === 'ERROR' || cacheStatus === 'LIVE_ERROR') {
      applyQuoteBackoff(clean, symbol, error || `status-${status || 0}`);
      const stale = quoteFromBackoff(clean, symbol);
      if (stale) return stale;
    }
    const fallback = directIndexFallbackQuote(clean, parsed, error);
    if (fallback) return fallback;
    return { ...parsed, status: 'EMPTY', error, retryAfterMs: Number(quoteBackoffUntil.get(symbol) || 0) - Date.now() > 0 ? Number(quoteBackoffUntil.get(symbol) || 0) - Date.now() : undefined };
  }
  const live = { ...parsed, cacheTtlMs: QUOTE_SAFE_TTL_MS, refreshAfterMs: QUOTE_SAFE_TTL_MS, recommendedClientPollMs: 30_000, quotePolicy: 'SAFE_YAHOO_PROXY_CACHE_V101' };
  rememberLiveQuote(clean, live);
  return live;
}

export async function getQuotes(tickers = [], { timeoutMs = 3500, max = 60 } = {}) {
  const clean = uniqueTickers(tickers).slice(0, max);
  if (!clean.length) return [];
  const out = [];
  let index = 0;
  const concurrency = Math.max(1, Math.min(3, Number(process.env.VALORAE_QUOTE_CONCURRENCY || 3)));
  async function worker() {
    while (index < clean.length) {
      const ticker = clean[index++];
      const quote = await getQuote(ticker, { timeoutMs }).catch(error => ({ status: 'ERROR', ticker, price: 0, error: error?.message }));
      if (quote && quote.ticker) out.push(quote);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, clean.length) }, worker));
  return out.sort((a, b) => clean.indexOf(a.ticker) - clean.indexOf(b.ticker));
}


function formatMoneyDisplay(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `R$ ${n.toFixed(2).replace('.', ',')}` : '';
}

function formatCompactMoneyDisplay(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1_000_000_000) return `R$ ${(n / 1_000_000_000).toFixed(1).replace('.', ',').replace(',0', '')} bi`;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')} mi`;
  if (n >= 1_000) return `R$ ${Math.round(n / 1_000).toLocaleString('pt-BR')} mil`;
  return `R$ ${Math.round(n).toLocaleString('pt-BR')}`;
}

function formatPercentDisplay(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2).replace('.', ',')}%` : '';
}

function formatNumberDisplay(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : '';
}

function positiveNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function finiteNumberOrNull(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function mergeQuoteWithFundamentals({ ticker, quote = {}, meta = {}, fundamental = null } = {}) {
  const price = positiveNumber(quote?.currentPrice, quote?.price, quote?.lastPrice, fundamental?.currentPrice, fundamental?.price, fundamental?.precoAtual);
  const changePercent = finiteNumberOrNull(quote?.changePercent, quote?.variationPercent, quote?.variacao) ?? 0;
  const pvp = finiteNumberOrNull(fundamental?.pvp, fundamental?.priceToBook);
  const dividendYield = finiteNumberOrNull(fundamental?.dividendYield, fundamental?.dy, fundamental?.yield12m);
  const dailyLiquidity = finiteNumberOrNull(
    fundamental?.dailyLiquidity, fundamental?.averageDailyLiquidity, fundamental?.liquidezMediaDiaria,
    fundamental?.liquidezDiaria, fundamental?.liquidity, fundamental?.volumeMedio, fundamental?.averageVolume,
    quote?.dailyLiquidity, quote?.averageDailyLiquidity, quote?.liquidezMediaDiaria, quote?.liquidezDiaria, quote?.volume
  );
  const priceDisplay = quote?.priceDisplay || fundamental?.priceDisplay || fundamental?.preco || fundamental?.cotacao || formatMoneyDisplay(price);
  const changeDisplay = quote?.changeDisplay || quote?.variationDisplay || `${changePercent >= 0 ? '+' : ''}${Number(changePercent).toFixed(2).replace('.', ',')}%`;
  const pvpDisplay = fundamental?.pvpDisplay || fundamental?.pVpDisplay || fundamental?.['P/VP'] || (pvp !== null ? formatNumberDisplay(pvp) : '');
  const dividendYieldDisplay = fundamental?.dividendYieldDisplay || fundamental?.dyDisplay || fundamental?.DY || (dividendYield !== null ? formatPercentDisplay(dividendYield) : '');
  const dailyLiquidityDisplay = fundamental?.dailyLiquidityDisplay || fundamental?.averageDailyLiquidityDisplay || fundamental?.liquidezMediaDiariaDisplay || fundamental?.liquidezDiariaDisplay || fundamental?.liquidityDisplay || (dailyLiquidity !== null ? formatCompactMoneyDisplay(dailyLiquidity) : '');
  const assetClass = meta.assetClass || classifyTicker(ticker);
  const sourceParts = [quote?.source, fundamental?.fundamentalSource || fundamental?.source].filter(Boolean);
  return {
    status: quote?.status || (price > 0 || pvp !== null || dividendYield !== null ? 'OK' : 'EMPTY'),
    ticker,
    symbol: ticker,
    assetClass,
    type: assetClass,
    name: fundamental?.name || fundamental?.nome || ticker,
    source: sourceParts.length ? [...new Set(sourceParts)].join(' + ') : 'VALORAE Fonte Oficial',
    quote: { ...(quote || {}), price, currentPrice: price, priceDisplay, changeDisplay },
    cotacao: { ...(quote || {}), precoAtual: price, price, currentPrice: price, priceDisplay, changeDisplay },
    price,
    currentPrice: price,
    lastPrice: price,
    precoAtual: price,
    priceDisplay,
    preco: priceDisplay,
    cotacaoDisplay: priceDisplay,
    changePercent: round(changePercent, 4),
    variationPercent: round(changePercent, 4),
    variacaoDay: round(changePercent, 4),
    changeDisplay,
    variationDisplay: changeDisplay,
    displayValue: changeDisplay,
    ...(pvp !== null ? { pvp: round(pvp, 4), priceToBook: round(pvp, 4), pvpDisplay, pVpDisplay: pvpDisplay, 'P/VP': pvpDisplay } : {}),
    ...(dividendYield !== null ? { dividendYield: round(dividendYield, 4), dy: round(dividendYield, 4), yield12m: round(dividendYield, 4), dividendYieldDisplay, dyDisplay: dividendYieldDisplay, DY: dividendYieldDisplay } : {}),
    ...(dailyLiquidity !== null ? { dailyLiquidity: round(dailyLiquidity, 2), averageDailyLiquidity: round(dailyLiquidity, 2), liquidezMediaDiaria: round(dailyLiquidity, 2), liquidezDiaria: round(dailyLiquidity, 2), dailyLiquidityDisplay, liquidityDisplay: dailyLiquidityDisplay, liquidezMediaDiariaDisplay: dailyLiquidityDisplay } : {}),
    segment: fundamental?.segment || fundamental?.segmento || meta.segment,
    sector: fundamental?.sector || fundamental?.setor || meta.sector,
    exposure: meta.exposure,
    geography: meta.geography,
    stockSegment: meta.stockSegment,
    stockSector: meta.stockSector,
    fiiType: meta.fiiType,
    fiiSegment: fundamental?.segment || meta.fiiSegment,
    fundamentalSource: fundamental?.fundamentalSource || undefined,
    fundamentalsSnapshotVersion: fundamental?.fundamentalsSnapshotVersion || undefined,
    equilibriumMetadata: {
      assetClass,
      exposure: meta.exposure,
      stockSegment: meta.stockSegment,
      stockSector: meta.stockSector,
      fiiType: meta.fiiType,
      fiiSegment: fundamental?.segment || meta.fiiSegment
    },
    cacheStatus: quote?.cacheStatus || 'MISS',
    partial: !(price > 0),
  };
}

export async function buildAssetsPayload(payload = {}) {
  const tickers = uniqueTickers([
    ...tickerInput(payload.tickers),
    ...tickerInput(payload.symbols),
    ...tickerInput(payload.positions),
    ...tickerInput(payload.assets),
    ...tickerInput(payload.ticker),
    ...tickerInput(payload.symbol)
  ]);
  const max = Number(payload.max || 180);
  const clean = tickers.slice(0, max);
  const [quotes, fundamentalsSnapshot] = await Promise.all([
    getQuotes(clean, { timeoutMs: Number(payload.timeoutMs || 3500), max }),
    getFundamentusSnapshotForTickers(clean, { timeoutMs: Number(payload.fundamentusTimeoutMs || payload.fundamentalTimeoutMs || 5200) })
      .catch(error => ({ status: 'ERROR', items: [], byTicker: new Map(), diagnostics: [{ provider: 'fundamentus', error: error?.message || String(error) }] }))
  ]);
  const fundamentalsByTicker = fundamentalsSnapshot?.byTicker instanceof Map ? fundamentalsSnapshot.byTicker : new Map();
  const quoteByTicker = new Map((quotes || []).map(q => [q.ticker, q]));
  const items = clean.map(ticker => {
    const quote = quoteByTicker.get(ticker);
    const fundamental = fundamentalsByTicker.get(ticker);
    const meta = enrichEquilibriumPosition({
      ticker,
      assetClass: classifyTicker(ticker),
      type: classifyTicker(ticker),
      quantity: 1,
      marketValue: positiveNumber(quote?.currentPrice, quote?.price, fundamental?.currentPrice, fundamental?.price),
      currentValue: positiveNumber(quote?.currentPrice, quote?.price, fundamental?.currentPrice, fundamental?.price),
      currentPrice: positiveNumber(quote?.currentPrice, quote?.price, fundamental?.currentPrice, fundamental?.price)
    });
    return mergeQuoteWithFundamentals({ ticker, quote, meta, fundamental });
  });
  const hasAny = items.some(i => i.currentPrice > 0 || i.pvp !== undefined || i.dividendYield !== undefined);
  return {
    status: hasAny ? 'OK' : 'EMPTY',
    endpoint: 'assets',
    source: fundamentalsSnapshot?.items?.length ? 'VALORAE Fonte Oficial + Fundamentus' : 'VALORAE Fonte Oficial',
    assets: items,
    quotes: items,
    items,
    results: items,
    partial: items.some(i => i.partial),
    fundamentalsSnapshot: {
      status: fundamentalsSnapshot?.status || 'EMPTY',
      source: fundamentalsSnapshot?.source || 'Fundamentus',
      version: fundamentalsSnapshot?.version,
      count: fundamentalsSnapshot?.items?.length || 0,
      diagnostics: fundamentalsSnapshot?.diagnostics || []
    },
    quotePolicy: {
      provider: 'Yahoo Finance via Proxy',
      fundamentalsProvider: 'Fundamentus batch snapshot',
      includes: ['cotacao', 'variacaoDia', 'pvp', 'dy', 'liquidezMediaDiaria'],
      cacheTtlMs: QUOTE_SAFE_TTL_MS,
      recommendedClientPollMs: 30_000,
      backoffMs: QUOTE_BACKOFF_MS,
      maxTickersPerRequest: max,
      mode: 'safe-batch-cache-with-fundamentals'
    }
  };
}

export async function buildIndicesPayload() {
  const raw = [
    { ticker: '^BVSP', name: 'Ibovespa', code: 'IBOV' },
    { ticker: 'IFIX', name: 'IFIX', code: 'IFIX' },
    { ticker: 'IDIV', name: 'IDIV', code: 'IDIV' },
    { ticker: 'SMLL', name: 'SMLL', code: 'SMLL' },
    { ticker: 'BRL=X', name: 'Dólar', code: 'USD' }
  ];
  const quotes = [];
  for (const row of raw) {
    const q = await getQuote(row.ticker, { timeoutMs: 3000 }).catch(() => null);
    if (q) quotes.push({ ...row, ...q, ticker: row.code, symbol: row.code, name: row.name });
  }
  return { status: quotes.some(q => q.price > 0) ? 'OK' : 'EMPTY', indices: quotes, items: quotes, source: 'VALORAE Fonte Oficial', policy: 'IFIX, IDIV e SMLL usam símbolos diretos Yahoo Finance Chart API; sem ETF/proxy/ticker substituto.' };
}

export async function buildMarketMovers(payload = {}) {
  const limit = Math.max(3, Math.min(15, Number(payload.limit || 6)));
  const requestedUniverse = uniqueTickers([
    ...tickerInput(payload.tickers),
    ...tickerInput(payload.positions),
    ...tickerInput(payload.assets)
  ]);
  const universe = (requestedUniverse.length ? requestedUniverse : [...DEFAULT_MARKET_TICKERS]).slice(0, 24);
  const quotes = (await getQuotes(universe, { timeoutMs: Number(payload.timeoutMs || 3800), max: 24 })).filter(q => q.price > 0);
  const sortedHigh = [...quotes].sort((a, b) => b.changePercent - a.changePercent).slice(0, limit);
  const sortedLow = [...quotes].sort((a, b) => a.changePercent - b.changePercent).slice(0, limit);
  const toItem = (q, index, direction) => ({
    rank: index + 1,
    ticker: q.ticker,
    symbol: q.ticker,
    name: q.ticker,
    price: q.price,
    currentPrice: q.price,
    priceDisplay: q.price ? `R$ ${q.price.toFixed(2).replace('.', ',')}` : '',
    changePercent: round(q.changePercent, 2),
    changeDisplay: `${q.changePercent >= 0 ? '+' : ''}${round(q.changePercent, 2).toFixed(2).replace('.', ',')}%`,
    value: round(q.changePercent, 2),
    displayValue: `${q.changePercent >= 0 ? '+' : ''}${round(q.changePercent, 2).toFixed(2).replace('.', ',')}%`,
    direction,
    source: 'VALORAE Fonte Oficial'
  });
  let highs = sortedHigh.map((q, i) => toItem(q, i, 'alta'));
  let lows = sortedLow.map((q, i) => toItem(q, i, 'baixa'));
  let fallbackUsed = false;
  if (!highs.length && !lows.length) {
    fallbackUsed = true;
    highs = universe.slice(0, limit).map((ticker, index) => ({
      rank: index + 1,
      ticker,
      symbol: ticker,
      name: ticker,
      price: 0,
      currentPrice: 0,
      priceDisplay: 'Atualizando',
      changePercent: 0,
      changeDisplay: '0,00%',
      value: 0,
      displayValue: 'Cotação indisponível',
      direction: 'alta',
      source: 'VALORAE Fonte Oficial',
      fallbackUsed: true
    }));
    lows = universe.slice(limit, limit * 2).map((ticker, index) => ({
      rank: index + 1,
      ticker,
      symbol: ticker,
      name: ticker,
      price: 0,
      currentPrice: 0,
      priceDisplay: 'Atualizando',
      changePercent: 0,
      changeDisplay: '0,00%',
      value: 0,
      displayValue: 'Cotação indisponível',
      direction: 'baixa',
      source: 'VALORAE Fonte Oficial',
      fallbackUsed: true
    }));
  }
  return {
    status: fallbackUsed ? 'FALLBACK' : 'OK',
    source: 'VALORAE Fonte Oficial',
    type: String(payload.type || 'ACAO').toUpperCase(),
    highs,
    lows,
    altas: highs,
    baixas: lows,
    marketMovers: [...highs, ...lows],
    items: [...highs, ...lows],
    fallbackUsed,
    warnings: fallbackUsed ? ['Fonte de cotação indisponível no prazo; ranking exibido como fallback operacional.'] : [],
    rankings: { highs, lows, altas: highs, baixas: lows }
  };
}
