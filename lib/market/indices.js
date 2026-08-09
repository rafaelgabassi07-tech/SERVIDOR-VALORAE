import { fetchYahooQuote, fetchYahooHistory, fetchB3IndexDailyEvolution, fetchInvestidor10DirectIndexHistory, getIpcaSeries } from '../sources/adapters/index.js';
import { getCdiAccumulatedSeries } from '../sources/cdi.js';
import { getCachedMarketValue, setCachedMarketValue, withMarketInflight } from './cache.js';

export const VALORAE_INDICES_MARKET_VERSION = '21.12.0-market-ticker-source-parity-v8';
export const VALORAE_ANALYSIS_TICKER_ORDER = Object.freeze(['USD', 'IFIX', 'IDIV', 'SMLL', 'CDI', 'IPCA', 'IBOV', 'IVVB11']);
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
  DIVO11: 'DIVO11.SA',
  USD: 'BRL=X'
};

const DIRECT_YAHOO_INDEXES = new Set(['IFIX', 'IDIV', 'SMLL']);
const COMPARISON_DIRECT_INDEXES = new Set(['IBOV', 'IFIX', 'IDIV', 'SMLL']);
const B3_INDEXES = new Set(['IBOV']);
const ANALYSIS_TICKER_MACRO_CODES = new Set(['CDI', 'IPCA']);

for (const code of VALORAE_ANALYSIS_TICKER_ORDER) {
  if (!ANALYSIS_TICKER_MACRO_CODES.has(code) && !INDEX_SYMBOLS[code]) {
    throw new Error(`Configuração inválida da faixa de mercado: símbolo ausente para ${code}`);
  }
}

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


function usableMarketQuote(q = {}) {
  return q?.ok === true && Number.isFinite(Number(q?.price)) && Number(q.price) > 0;
}

function percentVariation(current, previous) {
  const now = Number(current);
  const before = Number(previous);
  if (!Number.isFinite(now) || !Number.isFinite(before) || before <= 0) return null;
  return Number((((now - before) / before) * 100).toFixed(2));
}

async function fetchYahooHistoryQuote(name, symbol) {
  const history = await fetchYahooHistory(symbol, {
    range: '1mo',
    interval: '1d',
    timeoutMs: 5200,
    limit: 40,
    cache: true
  }).catch(error => ({ ok: false, points: [], error: error?.message || String(error) }));
  const points = Array.isArray(history?.points) ? history.points : [];
  const last = points.at(-1);
  const previous = points.at(-2);
  const price = Number(last?.close ?? last?.price ?? last?.value);
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: history?.error || `${name} sem histórico Yahoo suficiente` };
  }
  const previousClose = Number(previous?.close ?? previous?.price ?? previous?.value);
  return {
    ok: true,
    price,
    previousClose: Number.isFinite(previousClose) ? previousClose : undefined,
    variationPct: percentVariation(price, previousClose),
    source: `${history.source || 'Yahoo Finance Chart API'} · histórico real de contingência`,
    time: last?.date || last?.time || history?.updatedAt,
    cache: history?.cache || history?.cacheStatus,
    official: false,
    directIndexSymbol: COMPARISON_DIRECT_INDEXES.has(name) || symbol === '^BVSP',
    simulated: false,
    proxyTickerUsed: false,
    historyFallback: true
  };
}

async function fetchComparisonDirectIndexQuote(name) {
  if (!COMPARISON_DIRECT_INDEXES.has(name)) return { ok: false, error: `${name} sem fallback direto de comparador` };
  const history = await fetchInvestidor10DirectIndexHistory(name, {
    months: 3,
    timeoutMs: 5200,
    limit: 6
  }).catch(error => ({ ok: false, status: 'ERROR', points: [], error: error?.message || String(error) }));
  const points = Array.isArray(history?.points) ? history.points : [];
  const last = points.at(-1);
  const previous = points.at(-2);
  const price = Number(last?.close ?? last?.price ?? last?.value);
  if (!history?.ok || !Number.isFinite(price) || price <= 0) {
    return { ok: false, error: history?.error || `${name} sem pontos válidos no mesmo provedor do comparador` };
  }
  const variationPct = percentVariation(price, previous?.close ?? previous?.price ?? previous?.value);
  return {
    ok: true,
    price,
    previousClose: Number(previous?.close ?? previous?.price ?? previous?.value) || undefined,
    variationPct,
    variationDisplay: variationPct == null ? null : `${percentDisplay(variationPct)} ref. anterior`,
    source: `${history.source || `Investidor10 API de cotações do índice ${name}`} · mesma fonte do comparador`,
    time: last?.date || last?.time,
    cache: history?.cacheStatus,
    official: false,
    directIndexSymbol: true,
    simulated: false,
    proxyTickerUsed: false,
    comparisonSourceParity: true
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

function percentDisplay(value, suffix = '') {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const body = number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${body}%${suffix}`;
}

function macroRow(name, label, payload = {}, { accumulatedField = 'accumulatedPercent', monthlyField = 'monthlyPercent' } = {}) {
  const points = payload.points || payload.series || payload.items || [];
  const latest = Array.isArray(points) ? points.at(-1) : null;
  const explicitAccumulated = payload.accumulated12mPct ?? payload.accumulatedPercent;
  const accumulated12m = points.length >= 12
    ? Number(explicitAccumulated ?? latest?.[accumulatedField])
    : Number.NaN;
  const monthlyRaw = latest?.[monthlyField] ?? latest?.value;
  const monthly = monthlyRaw == null ? Number.NaN : Number(monthlyRaw);
  const value = Number.isFinite(accumulated12m) ? accumulated12m : (Number.isFinite(monthly) ? monthly : null);
  return {
    name: label,
    ticker: name,
    symbol: name,
    code: name,
    ok: value != null,
    price: value,
    value,
    variationPct: null,
    valueDisplay: value == null ? null : percentDisplay(value, Number.isFinite(accumulated12m) ? ' 12m' : ''),
    secondaryDisplay: Number.isFinite(monthly) ? `${percentDisplay(monthly)} no mês` : null,
    source: payload.source || 'Banco Central do Brasil',
    time: latest?.date || latest?.month || null,
    cache: payload.cache || payload.cacheStatus,
    official: true,
    macro: true,
    unit: 'percent'
  };
}

export async function fetchIndicesSnapshot({ symbols = INDEX_SYMBOLS, bypassCache = false, cache = true } = {}) {
  const key = JSON.stringify(symbols);
  if (!bypassCache && cache !== false) {
    const hit = getCachedMarketValue('indices', key, { allowStale: false });
    if (hit) return { ...hit.data, cache: hit.cache };
  }
  return withMarketInflight('indices', key, async () => {
    const entries = Object.entries(symbols || INDEX_SYMBOLS);
    const [marketRows, cdi, ipca] = await Promise.all([
      Promise.all(entries.map(async ([name, symbol]) => {
        let q = await fetchYahooQuote(symbol, { interval: DIRECT_YAHOO_INDEXES.has(name) ? '1d' : undefined });
        if (!usableMarketQuote(q) && COMPARISON_DIRECT_INDEXES.has(name)) {
          q = await fetchComparisonDirectIndexQuote(name);
        }
        if (!usableMarketQuote(q)) {
          q = await fetchYahooHistoryQuote(name, symbol);
        }
        if (!usableMarketQuote(q) && B3_INDEXES.has(name)) q = await fetchB3FallbackQuote(name);
        const row = quoteRow(name, symbol, q);
        return {
          ...row,
          ticker: name,
          code: name,
          value: row.price,
          valueDisplay: null,
          variationDisplay: q?.variationDisplay || null,
          secondaryDisplay: q?.comparisonSourceParity ? 'fonte do comparador' : null,
          unit: name === 'USD' ? 'brl_per_usd' : (name === 'IVVB11' || /11$/.test(name) ? 'brl' : 'points')
        };
      })),
      getCdiAccumulatedSeries(12, 5200).catch(error => ({ status: 'ERROR', points: [], error: error?.message })),
      getIpcaSeries(12).catch(error => ({ status: 'ERROR', points: [], error: error?.message }))
    ]);
    const macroRows = [
      macroRow('CDI', 'CDI', cdi),
      macroRow('IPCA', 'IPCA+', ipca)
    ];
    const rows = [...marketRows, ...macroRows];
    const tickerItems = VALORAE_ANALYSIS_TICKER_ORDER.map(code => rows.find(row => row.ticker === code)).filter(Boolean);
    const data = {
      ok: tickerItems.some(r => r.ok),
      status: tickerItems.some(r => r.ok) ? (tickerItems.every(r => r.ok) ? 'OK' : 'PARTIAL') : 'EMPTY',
      source: 'Yahoo Finance + mesma fonte dos comparadores (Investidor10/B3) + Banco Central do Brasil',
      sourceVersion: VALORAE_INDICES_MARKET_VERSION,
      generatedAt: new Date().toISOString(),
      indices: rows,
      tickerItems,
      items: tickerItems,
      partial: tickerItems.length !== VALORAE_ANALYSIS_TICKER_ORDER.length || tickerItems.some(row => !row.ok),
      cache: 'MISS',
      policy: 'Ticker de mercado: IFIX/IDIV/SMLL/IBOV reutilizam a mesma cadeia de fontes reais dos gráficos de comparação quando a cotação direta falha; USD/IVVB11 usam cotação real e CDI/IPCA+ usam séries oficiais. Sem valores sintéticos.'
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
