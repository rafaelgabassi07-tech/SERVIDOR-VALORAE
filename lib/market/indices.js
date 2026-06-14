import { fetchYahooQuote } from './yahoo.js';
import { fetchB3IndexDailyEvolution } from './b3-index-history.js';
import { getCachedMarketValue, setCachedMarketValue, withMarketInflight } from './cache.js';

export const VALORAE_INDICES_MARKET_VERSION = '21.12.0';
const INDICES_TTL_MS = Number(process.env.VALORAE_INDICES_CACHE_TTL_MS || 30 * 1000);
const INDICES_STALE_MS = Number(process.env.VALORAE_INDICES_CACHE_STALE_MS || 5 * 60 * 1000);

const INDEX_SYMBOLS = {
  IBOV: '^BVSP',
  BOVA11: 'BOVA11.SA',
  SMAL11: 'SMAL11.SA',
  IVVB11: 'IVVB11.SA',
  DIVO11: 'DIVO11.SA'
};

export async function fetchIndicesSnapshot({ symbols = INDEX_SYMBOLS, bypassCache = false, cache = true } = {}) {
  const key = JSON.stringify(symbols);
  if (!bypassCache && cache !== false) {
    const hit = getCachedMarketValue('indices', key, { allowStale: false });
    if (hit) return { ...hit.data, cache: hit.cache };
  }
  return withMarketInflight('indices', key, async () => {
    const entries = Object.entries(symbols || INDEX_SYMBOLS);
    const rows = await Promise.all(entries.map(async ([key, symbol]) => {
      const q = await fetchYahooQuote(symbol);
      return { name: key, symbol, ok: q.ok, price: q.price, previousClose: q.previousClose, variationPct: q.variationPct, source: q.source, error: q.error, time: q.time, cache: q.cache };
    }));
    const ifix = await fetchB3IndexDailyEvolution('IFIX', { years: 1, limit: 80 }).catch(error => ({ ok: false, error: error?.message, points: [] }));
    if (ifix.ok && ifix.points?.length) {
      const last = ifix.points.at(-1);
      const prev = ifix.points.at(-2);
      rows.push({ name: 'IFIX', symbol: 'B3:IFIX', ok: true, price: last.close, previousClose: prev?.close, variationPct: prev?.close ? Number((((last.close - prev.close) / prev.close) * 100).toFixed(2)) : undefined, source: 'B3 Oficial - IFIX', time: last.date, cache: ifix.cache, official: true, simulated: false, proxyTickerUsed: false });
    } else {
      rows.push({ name: 'IFIX', symbol: 'B3:IFIX', ok: false, price: null, previousClose: null, variationPct: null, source: 'B3 Oficial - IFIX', error: ifix.error || 'IFIX oficial indisponível', official: true, simulated: false, proxyTickerUsed: false });
    }
    const data = { ok: rows.some(r => r.ok), source: 'YahooChart + B3 Oficial IFIX', sourceVersion: VALORAE_INDICES_MARKET_VERSION, generatedAt: new Date().toISOString(), indices: rows, cache: 'MISS' };
    if (data.ok) {
      setCachedMarketValue('indices', key, data, { ttlMs: INDICES_TTL_MS, staleMs: INDICES_STALE_MS, maxEntries: 50, maxBytes: 1024 * 1024 });
      return data;
    }
    const stale = getCachedMarketValue('indices', key, { allowStale: true });
    if (stale) return { ...stale.data, ok: true, cache: 'STALE_IF_ERROR', warning: 'Índices atuais indisponíveis; retornando snapshot stale.' };
    return data;
  });
}
