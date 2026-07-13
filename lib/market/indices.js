import { fetchYahooQuote } from './yahoo.js';
import { fetchB3IndexDailyEvolution } from './b3-index-history.js';
import { getCachedMarketValue, setCachedMarketValue, withMarketInflight } from './cache.js';

export const VALORAE_INDICES_MARKET_VERSION = '21.12.0-real-index-no-static-fallback-v5';
const INDICES_TTL_MS = Number(process.env.VALORAE_INDICES_CACHE_TTL_MS || 30 * 1000);
const INDICES_STALE_MS = Number(process.env.VALORAE_INDICES_CACHE_STALE_MS || 5 * 60 * 1000);

const INDEX_SYMBOLS = {
  IBOV: '^BVSP',
  IFIX: 'IFIX.SA',
  IDIV: 'IDIV.SA',
  SMLL: 'SMLL.SA',
  BOVA11: 'BOVA11.SA',
  SMAL11: 'SMAL11.SA',
  IVVB11: 'IVVB11.SA',
  DIVO11: 'DIVO11.SA'
};

const DIRECT_YAHOO_INDEXES = new Set(['IFIX', 'IDIV', 'SMLL']);
const B3_INDEXES = new Set(['IBOV']);

function quoteRow(name, symbol, q = {}) {
  const directIndex = DIRECT_YAHOO_INDEXES.has(name);
  const isB3Index = B3_INDEXES.has(name);
  return {
    name,
    symbol,
    ok: q.ok === true,
    price: q.price ?? null,
    previousClose: q.previousClose ?? null,
    variationPct: q.variationPct ?? null,
    source: q.source || (directIndex ? `Yahoo Finance Chart API índice direto ${symbol}` : 'YahooChart'),
    error: q.error,
    time: q.time,
    cache: q.cache,
    official: q.official === true ? true : (isB3Index ? false : undefined),
    directIndexSymbol: q.directIndexSymbol === false ? false : (q.directIndexSymbol === true || directIndex || symbol === '^BVSP'),
    simulated: false,
    proxyTickerUsed: false,
    staleFallback: q.staleFallback === true,
    warning: q.warning
  };
}

async function fetchB3FallbackQuote(name) {
  const b3 = await fetchB3IndexDailyEvolution(name, { years: 1, limit: 80 }).catch(error => ({ ok: false, error: error?.message, points: [] }));
  if (b3.ok && b3.points?.length) {
    const last = b3.points.at(-1);
    const prev = b3.points.at(-2);
    return {
      ok: true,
      price: last.close,
      previousClose: prev?.close,
      variationPct: prev?.close ? Number((((last.close - prev.close) / prev.close) * 100).toFixed(2)) : undefined,
      source: `B3 Oficial - ${name}`,
      time: last.date,
      cache: b3.cache,
      official: true,
      directIndexSymbol: false,
      simulated: false,
      proxyTickerUsed: false
    };
  }
  return { ok: false, error: b3.error || `${name} indisponível nas fontes atuais` };
}

export async function fetchIndicesSnapshot({ symbols = INDEX_SYMBOLS, bypassCache = false, cache = true } = {}) {
  const key = JSON.stringify(symbols);
  if (!bypassCache && cache !== false) {
    const hit = getCachedMarketValue('indices', key, { allowStale: false });
    if (hit) return { ...hit.data, cache: hit.cache };
  }
  return withMarketInflight('indices', key, async () => {
    const entries = Object.entries(symbols || INDEX_SYMBOLS);
    const rows = await Promise.all(entries.map(async ([name, symbol]) => {
      let q = await fetchYahooQuote(symbol, { interval: DIRECT_YAHOO_INDEXES.has(name) ? '1d' : undefined });
      if (!q.ok && B3_INDEXES.has(name) && !DIRECT_YAHOO_INDEXES.has(name)) q = await fetchB3FallbackQuote(name);
      return quoteRow(name, symbol, q);
    }));
    const data = {
      ok: rows.some(r => r.ok),
      source: 'Yahoo Finance Chart API direto para IFIX/IDIV/SMLL; B3 apenas para IBOV quando necessário',
      sourceVersion: VALORAE_INDICES_MARKET_VERSION,
      generatedAt: new Date().toISOString(),
      indices: rows,
      cache: 'MISS',
      policy: 'IFIX, IDIV e SMLL usam exclusivamente Yahoo Finance Chart API nos símbolos IFIX.SA, IDIV.SA e SMLL.SA; sem valor estático, último snapshot conhecido, Investidor10, Mais Retorno, B3, ETF/proxy ou ticker substituto. Cache stale somente de resposta ao vivo previamente confirmada.'
    };
    if (data.ok) {
      setCachedMarketValue('indices', key, data, { ttlMs: INDICES_TTL_MS, staleMs: INDICES_STALE_MS, maxEntries: 50, maxBytes: 1024 * 1024 });
      return data;
    }
    const stale = getCachedMarketValue('indices', key, { allowStale: true });
    if (stale) return { ...stale.data, ok: true, cache: 'STALE_IF_ERROR', warning: 'Índices atuais indisponíveis; retornando snapshot stale.' };
    return data;
  });
}
