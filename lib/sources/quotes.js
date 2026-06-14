import { fetchJson } from './fetch.js';
import { normalizeTicker, classifyTicker, uniqueTickers } from '../core/tickers.js';
import { numberValue, round } from '../core/numbers.js';
import { enrichEquilibriumPosition } from '../portfolio/equilibrium-metadata.js';

export const DEFAULT_MARKET_TICKERS = Object.freeze([
  'PETR4','VALE3','ITUB4','BBDC4','BBAS3','ABEV3','WEGE3','B3SA3','PRIO3','RENT3','SUZB3','ELET3',
  'MXRF11','HGLG11','KNRI11','XPML11'
]);


function tickerInput(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(/[;,\s]+/).filter(Boolean);
  if (value && typeof value === 'object') return [value];
  return [];
}

export function yahooSymbol(ticker) {
  const clean = normalizeTicker(ticker);
  if (!clean) return '';
  if (clean === 'IBOV' || clean === 'BVSP' || clean === 'IBOVESPA') return '^BVSP';
  if (clean === 'USD' || clean === 'USDBRL' || clean === 'USDBRLX' || clean === 'BRLX') return 'BRL=X';
  if (clean.startsWith('^') || clean.includes('.')) return clean;
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
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(clean))}?range=1d&interval=5m&includePrePost=false`;
  const { json, status, cacheStatus, error } = await fetchJson(url, { timeoutMs, ttlMs: 45_000, staleMs: 12 * 60 * 60 * 1000 });
  const parsed = parseChartQuote(clean, json, status, cacheStatus);
  if (parsed.price <= 0) return { ...parsed, status: 'EMPTY', error };
  return parsed;
}

export async function getQuotes(tickers = [], { timeoutMs = 3500, max = 24 } = {}) {
  const clean = uniqueTickers(tickers).slice(0, max);
  if (!clean.length) return [];
  const out = [];
  let index = 0;
  const concurrency = 4;
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

export async function buildAssetsPayload(payload = {}) {
  const tickers = uniqueTickers([
    ...tickerInput(payload.tickers),
    ...tickerInput(payload.symbols),
    ...tickerInput(payload.positions),
    ...tickerInput(payload.assets),
    ...tickerInput(payload.ticker),
    ...tickerInput(payload.symbol)
  ]);
  const quotes = await getQuotes(tickers, { timeoutMs: Number(payload.timeoutMs || 3500), max: Number(payload.max || 30) });
  const items = tickers.map(ticker => {
    const quote = quotes.find(q => q.ticker === ticker);
    const meta = enrichEquilibriumPosition({
      ticker,
      assetClass: classifyTicker(ticker),
      type: classifyTicker(ticker),
      quantity: 1,
      marketValue: quote?.currentPrice || quote?.price || 0,
      currentValue: quote?.currentPrice || quote?.price || 0,
      currentPrice: quote?.currentPrice || quote?.price || 0
    });
    return {
      status: quote?.status || 'EMPTY',
      ticker,
      symbol: ticker,
      assetClass: meta.assetClass,
      type: meta.assetClass,
      name: ticker,
      source: 'VALORAE Fonte Oficial',
      quote: quote || { ticker, price: 0, currentPrice: 0, status: 'EMPTY' },
      cotacao: quote || { ticker, price: 0, currentPrice: 0, status: 'EMPTY' },
      price: quote?.price || 0,
      currentPrice: quote?.currentPrice || 0,
      precoAtual: quote?.currentPrice || 0,
      changePercent: quote?.changePercent || 0,
      variacaoDay: quote?.changePercent || 0,
      segment: meta.segment,
      sector: meta.sector,
      exposure: meta.exposure,
      geography: meta.geography,
      stockSegment: meta.stockSegment,
      stockSector: meta.stockSector,
      fiiType: meta.fiiType,
      fiiSegment: meta.fiiSegment,
      equilibriumMetadata: {
        assetClass: meta.assetClass,
        exposure: meta.exposure,
        stockSegment: meta.stockSegment,
        stockSector: meta.stockSector,
        fiiType: meta.fiiType,
        fiiSegment: meta.fiiSegment
      },
      cacheStatus: quote?.cacheStatus || 'MISS',
      partial: !(quote?.price > 0)
    };
  });
  return { status: items.some(i => i.currentPrice > 0) ? 'OK' : 'EMPTY', endpoint: 'assets', source: 'VALORAE Fonte Oficial', assets: items, items, results: items, partial: items.some(i => i.partial) };
}

export async function buildIndicesPayload() {
  const raw = [
    { ticker: '^BVSP', name: 'Ibovespa', code: 'IBOV' },
    { ticker: 'BRL=X', name: 'Dólar', code: 'USD' }
  ];
  const quotes = [];
  for (const row of raw) {
    const q = await getQuote(row.ticker, { timeoutMs: 3000 }).catch(() => null);
    if (q) quotes.push({ ...row, ...q, ticker: row.code, symbol: row.code, name: row.name });
  }
  return { status: quotes.some(q => q.price > 0) ? 'OK' : 'EMPTY', indices: quotes, items: quotes, source: 'VALORAE Fonte Oficial' };
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
