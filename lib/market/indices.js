import { fetchYahooQuote, fetchYahooHistory, fetchB3IndexDailyEvolution, fetchInvestidor10DirectIndexHistory, getIpcaSeries } from '../sources/adapters/index.js';
import { getCdiAccumulatedSeries } from '../sources/cdi.js';
import { fetchBcbSeries } from './bcb.js';
import { fetchB3EtfPublicQuote } from './b3-etf-quote.js';
import { getCachedMarketValue, setCachedMarketValue, withMarketInflight } from './cache.js';

export const VALORAE_INDICES_MARKET_VERSION = '21.12.409-market-ticker-variation-v14';
export const VALORAE_ANALYSIS_TICKER_ORDER = Object.freeze(['USD', 'IFIX', 'IDIV', 'SMLL', 'CDI', 'IPCA', 'IBOV', 'IVVB11']);
const INDICES_TTL_MS = Number(process.env.VALORAE_INDICES_CACHE_TTL_MS || 30 * 1000);
const INDICES_STALE_MS = Number(process.env.VALORAE_INDICES_CACHE_STALE_MS || 24 * 60 * 60 * 1000);

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

// The Analysis tape must not wait for unrelated ETF quotes. Keep a dedicated, minimal symbol map
// for the six market-traded instruments; CDI/IPCA are appended from BCB in the same snapshot.
export const VALORAE_ANALYSIS_TICKER_SYMBOLS = Object.freeze({
  USD: INDEX_SYMBOLS.USD,
  IFIX: INDEX_SYMBOLS.IFIX,
  IDIV: INDEX_SYMBOLS.IDIV,
  SMLL: INDEX_SYMBOLS.SMLL,
  IBOV: INDEX_SYMBOLS.IBOV,
  IVVB11: INDEX_SYMBOLS.IVVB11
});

const DIRECT_YAHOO_INDEXES = new Set(['IFIX', 'IDIV', 'SMLL']);
const COMPARISON_DIRECT_INDEXES = new Set(['IBOV', 'IFIX', 'IDIV', 'SMLL']);
// B3 daily-evolution is the primary official fallback for every B3 index shown
// in the Analysis tape. Yahoo coverage for IFIX/IDIV/SMLL can be intermittent; B3 is
// queried in parallel so those slots do not disappear when a direct Yahoo symbol fails.
const B3_INDEXES = new Set(['IBOV', 'IFIX', 'IDIV', 'SMLL']);
const PARALLEL_DIRECT_FALLBACK_INDEXES = new Set(['IFIX', 'IDIV']);
const ANALYSIS_TICKER_MACRO_CODES = new Set(['CDI', 'IPCA']);

for (const code of VALORAE_ANALYSIS_TICKER_ORDER) {
  if (!ANALYSIS_TICKER_MACRO_CODES.has(code) && !INDEX_SYMBOLS[code]) {
    throw new Error(`Configuração inválida da faixa de mercado: símbolo ausente para ${code}`);
  }
}

function quoteRow(name, symbol, q = {}) {
  const directIndex = DIRECT_YAHOO_INDEXES.has(name);
  const isB3Index = B3_INDEXES.has(name);
  const derivedVariationPct = Number.isFinite(Number(q.variationPct))
    ? Number(q.variationPct)
    : percentVariation(q.price, q.previousClose);
  return {
    name,
    symbol,
    ok: q.ok === true,
    price: q.price ?? null,
    previousClose: q.previousClose ?? null,
    variationPct: derivedVariationPct,
    variationPercent: derivedVariationPct,
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

const TICKER_DAILY_MAX_AGE_MS = 10 * 24 * 60 * 60 * 1000;

function tickerPointIsRecent(value, nowMs = Date.now()) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  const timestamp = Date.parse(raw.length <= 10 ? `${raw}T23:59:59.999Z` : raw);
  if (!Number.isFinite(timestamp)) return false;
  const age = nowMs - timestamp;
  return age >= -24 * 60 * 60 * 1000 && age <= TICKER_DAILY_MAX_AGE_MS;
}

function tickerQuoteDay(q = {}) {
  const raw = String(q?.time || '').trim();
  if (!raw) return '';
  const direct = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : '';
}

function tickerQuoteProviderPriority(q = {}) {
  const source = String(q?.source || '').toLowerCase();
  // For the same trading date, prefer the direct Yahoo chart (intraday when available), then the
  // official B3 daily close, and only then the independent direct-index contingency.
  if (source.includes('yahoo')) return 3;
  if (q?.official === true || source.includes('b3 oficial')) return 2;
  return 1;
}

function tickerQuoteHasVariation(q = {}) {
  return Number.isFinite(Number(q?.variationPct ?? q?.variationPercent));
}

function chooseFreshestTickerQuote(candidates = []) {
  const usable = candidates.filter(q => usableMarketQuote(q) && tickerPointIsRecent(q?.time));
  if (!usable.length) return null;
  usable.sort((a, b) => {
    const dayOrder = tickerQuoteDay(b).localeCompare(tickerQuoteDay(a));
    if (dayOrder !== 0) return dayOrder;
    const variationOrder = Number(tickerQuoteHasVariation(b)) - Number(tickerQuoteHasVariation(a));
    if (variationOrder !== 0) return variationOrder;
    return tickerQuoteProviderPriority(b) - tickerQuoteProviderPriority(a);
  });
  return usable[0];
}

function chooseUsableTickerQuoteByQuality(candidates = []) {
  const usable = candidates.filter(usableMarketQuote);
  if (!usable.length) return null;
  usable.sort((a, b) => {
    const variationOrder = Number(tickerQuoteHasVariation(b)) - Number(tickerQuoteHasVariation(a));
    if (variationOrder !== 0) return variationOrder;
    return tickerQuoteProviderPriority(b) - tickerQuoteProviderPriority(a);
  });
  return usable[0];
}

function enrichTickerQuoteVariation(primary = {}, references = []) {
  if (!usableMarketQuote(primary) || tickerQuoteHasVariation(primary)) return primary;
  const primaryDay = tickerQuoteDay(primary);
  const candidates = references
    .filter(candidate => usableMarketQuote(candidate) && (!candidate?.time || tickerPointIsRecent(candidate.time)))
    .sort((a, b) => tickerQuoteDay(b).localeCompare(tickerQuoteDay(a)));
  for (const candidate of candidates) {
    const candidateDay = tickerQuoteDay(candidate);
    const sameTradingDay = primaryDay && candidateDay && primaryDay === candidateDay;
    const candidateIsOlderDay = primaryDay && candidateDay && candidateDay < primaryDay;
    const referenceClose = sameTradingDay
      ? Number(candidate.previousClose)
      : candidateIsOlderDay
        ? Number(candidate.price)
        : Number(candidate.previousClose);
    const variationPct = percentVariation(primary.price, referenceClose);
    if (variationPct == null) continue;
    return {
      ...primary,
      previousClose: referenceClose,
      variationPct,
      variationDisplay: `${percentDisplay(variationPct)} ref. fechamento anterior`,
      variationReferenceSource: candidate.source,
      variationEnriched: true
    };
  }
  return primary;
}

async function fetchComparisonDirectIndexQuote(name) {
  if (!COMPARISON_DIRECT_INDEXES.has(name)) return { ok: false, error: `${name} sem fallback direto de comparador` };
  const history = await fetchInvestidor10DirectIndexHistory(name, {
    months: 1,
    timeoutMs: 4600,
    limit: 12,
    granularity: 'daily'
  }).catch(error => ({ ok: false, status: 'ERROR', points: [], error: error?.message || String(error) }));
  const points = Array.isArray(history?.points) ? history.points : [];
  const last = points.at(-1);
  const previous = points.at(-2);
  const price = Number(last?.close ?? last?.price ?? last?.value);
  if (!history?.ok || !Number.isFinite(price) || price <= 0) {
    return { ok: false, error: history?.error || `${name} sem pontos válidos no provedor direto de contingência` };
  }
  if (!tickerPointIsRecent(last?.date || last?.time)) {
    return { ok: false, staleFallback: true, error: `${name} com último ponto alternativo antigo (${last?.date || 'data desconhecida'})` };
  }
  const variationPct = percentVariation(price, previous?.close ?? previous?.price ?? previous?.value);
  return {
    ok: true,
    price,
    previousClose: Number(previous?.close ?? previous?.price ?? previous?.value) || undefined,
    variationPct,
    variationDisplay: variationPct == null ? null : `${percentDisplay(variationPct)} ref. anterior`,
    source: `${history.source || `Investidor10 API de cotações do índice ${name}`} · contingência diária direta`,
    time: last?.date || last?.time,
    cache: history?.cacheStatus,
    official: false,
    directIndexSymbol: true,
    simulated: false,
    proxyTickerUsed: false,
    comparisonSourceParity: true,
    dailyFallback: true
  };
}

async function fetchBcbUsdFallbackQuote() {
  const payload = await fetchBcbSeries(1, { last: 3, timeoutMs: 4200 }).catch(error => ({ ok: false, points: [], error: error?.message || String(error) }));
  const points = Array.isArray(payload?.points) ? payload.points.filter(point => Number(point?.value) > 0) : [];
  const last = points.at(-1);
  const previous = points.at(-2);
  const price = Number(last?.value);
  const previousClose = Number(previous?.value);
  if (!payload?.ok || !Number.isFinite(price) || price <= 0) {
    return { ok: false, error: payload?.error || 'USD sem valor oficial no BCB SGS 1' };
  }
  return {
    ok: true,
    price,
    previousClose: Number.isFinite(previousClose) && previousClose > 0 ? previousClose : undefined,
    variationPct: percentVariation(price, previousClose),
    source: 'Banco Central do Brasil - SGS 1 dólar venda diário',
    time: last?.date,
    cache: payload?.cache,
    official: true,
    simulated: false,
    proxyTickerUsed: false
  };
}

async function fetchB3FallbackQuote(name) {
  const b3 = await fetchB3IndexDailyEvolution(name, { years: 1, limit: 80 }).catch(error => ({ ok: false, error: error?.message, points: [] }));
  if (b3.ok && b3.points?.length) {
    const last = b3.points.at(-1);
    const prev = b3.points.at(-2);
    if (!tickerPointIsRecent(last?.date)) {
      return {
        ok: false,
        staleOfficial: true,
        lastKnownPrice: Number(last?.close) || undefined,
        lastKnownDate: last?.date,
        error: `${name} oficial B3 está antigo para uso no ticker (${last?.date || 'sem data'})`
      };
    }
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
    variationPercent: null,
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

function tickerRowUsable(row = {}) {
  const value = Number(row?.value ?? row?.price);
  return row?.ok === true && Number.isFinite(value) && value > 0;
}

function mergePartialTickerWithStale(current, staleData) {
  const staleItems = Array.isArray(staleData?.tickerItems) ? staleData.tickerItems : [];
  if (!staleItems.length) return current;
  const freshByCode = new Map((current.tickerItems || []).map(row => [row.code || row.ticker || row.name, row]));
  const staleByCode = new Map(staleItems.map(row => [row.code || row.ticker || row.name, row]));
  const tickerItems = VALORAE_ANALYSIS_TICKER_ORDER.map(code => {
    const fresh = freshByCode.get(code);
    const stale = staleByCode.get(code);
    if (tickerRowUsable(fresh)) {
      // A nova cotação pode chegar antes do campo de variação no provedor. Se o último snapshot
      // completo é do mesmo pregão, preserve apenas a variação; nunca transporte percentual de
      // outro dia para um preço atual.
      if (!tickerQuoteHasVariation(fresh) && tickerRowUsable(stale) && tickerQuoteHasVariation(stale) && tickerQuoteDay(fresh) && tickerQuoteDay(fresh) === tickerQuoteDay(stale)) {
        return {
          ...fresh,
          variationPct: stale.variationPct ?? stale.variationPercent,
          variationPercent: stale.variationPercent ?? stale.variationPct,
          variationDisplay: stale.variationDisplay,
          variationRecoveredFromSameDayCache: true
        };
      }
      return fresh;
    }
    if (tickerRowUsable(stale)) return { ...stale, staleFallback: true, warning: fresh?.error || stale?.warning };
    return fresh || stale;
  }).filter(Boolean);
  const usableCount = tickerItems.filter(tickerRowUsable).length;
  const byCode = new Map(tickerItems.map(row => [row.code || row.ticker || row.name, row]));
  const legacyIndices = (current.indices || []).map(row => byCode.get(row.code || row.ticker || row.name) || row);
  for (const row of tickerItems) {
    const code = row.code || row.ticker || row.name;
    if (!legacyIndices.some(item => (item.code || item.ticker || item.name) === code)) legacyIndices.push(row);
  }
  return {
    ...current,
    ok: usableCount > 0,
    status: usableCount === VALORAE_ANALYSIS_TICKER_ORDER.length ? 'OK' : (usableCount > 0 ? 'PARTIAL' : current.status),
    partial: usableCount < VALORAE_ANALYSIS_TICKER_ORDER.length,
    tickerItems,
    items: tickerItems,
    indices: legacyIndices,
    warning: usableCount === VALORAE_ANALYSIS_TICKER_ORDER.length
      ? 'Alguns índices usam o último valor válido enquanto a atualização corrente se recupera.'
      : current.warning
  };
}

async function fetchMarketTickerQuote(name, symbol) {
  // Para os índices B3 exibidos na Análise, a cadeia prioriza dados reais com semânticas claras:
  // 1) Yahoo pode trazer a cotação intradiária mais recente quando o símbolo direto está disponível;
  // 2) a evolução diária oficial da B3 garante um fechamento real e verificável mesmo quando Yahoo
  //    não cobre IFIX/IDIV/SMLL;
  // 3) a série direta independente cobre lacunas de IFIX/IDIV. A seleção usa primeiro a data
  //    de pregão mais recente e, em empate, prefere Yahoo intradiário -> B3 oficial -> contingência.
  //
  // Yahoo + B3 são consultados em paralelo para não transformar uma falha de provedor em uma cadeia
  // serial de timeouts. O fallback terciário só é acionado se ambos realmente falharem.
  if (B3_INDEXES.has(name)) {
    // IFIX/IDIV do not have consistently usable direct Yahoo symbols. Run all independent
    // providers concurrently, then choose by data quality: live Yahoo -> recent official B3 close
    // -> recent direct-index series. This avoids a serial timeout chain and, critically, prevents
    // a stale first-semester B3 page from freezing the tape for weeks.
    const [yahoo, b3, parallelDirect] = await Promise.all([
      fetchYahooQuote(symbol, { interval: DIRECT_YAHOO_INDEXES.has(name) ? '1d' : undefined })
        .catch(error => ({ ok: false, error: error?.message || String(error) })),
      fetchB3FallbackQuote(name)
        .catch(error => ({ ok: false, error: error?.message || String(error) })),
      PARALLEL_DIRECT_FALLBACK_INDEXES.has(name)
        ? fetchComparisonDirectIndexQuote(name).catch(error => ({ ok: false, error: error?.message || String(error) }))
        : Promise.resolve(null)
    ]);
    const yahooWithVariation = enrichTickerQuoteVariation(yahoo, [b3, parallelDirect].filter(Boolean));
    const freshest = chooseFreshestTickerQuote([yahooWithVariation, b3, parallelDirect].filter(Boolean));
    if (freshest) return freshest;

    const direct = parallelDirect || await fetchComparisonDirectIndexQuote(name)
      .catch(error => ({ ok: false, error: error?.message || String(error) }));
    if (usableMarketQuote(direct) && tickerPointIsRecent(direct?.time)) return direct;

    const yahooHistory = await fetchYahooHistoryQuote(name, symbol);
    if (usableMarketQuote(yahooHistory) && tickerPointIsRecent(yahooHistory?.time)) return yahooHistory;
    return {
      ok: false,
      error: [yahoo?.error, b3?.error, direct?.error, yahooHistory?.error].filter(Boolean).join(' | ') || `${name} indisponível`
    };
  }

  if (name === 'USD') {
    const [yahoo, bcb] = await Promise.all([
      fetchYahooQuote(symbol).catch(error => ({ ok: false, error: error?.message || String(error) })),
      fetchBcbUsdFallbackQuote().catch(error => ({ ok: false, error: error?.message || String(error) }))
    ]);
    const yahooWithVariation = enrichTickerQuoteVariation(yahoo, [bcb]);
    const freshest = chooseFreshestTickerQuote([yahooWithVariation, bcb]) || chooseUsableTickerQuoteByQuality([yahooWithVariation, bcb]);
    if (freshest) return freshest;
    const history = await fetchYahooHistoryQuote(name, symbol);
    if (usableMarketQuote(history)) return history;
    return { ok: false, error: [yahoo?.error, bcb?.error, history?.error].filter(Boolean).join(' | ') || 'USD indisponível' };
  }

  if (name === 'IVVB11') {
    const [yahoo, b3] = await Promise.all([
      fetchYahooQuote(symbol).catch(error => ({ ok: false, error: error?.message || String(error) })),
      fetchB3EtfPublicQuote('IVVB11').catch(error => ({ ok: false, error: error?.message || String(error) }))
    ]);
    const yahooWithVariation = enrichTickerQuoteVariation(yahoo, [b3]);
    const freshest = chooseFreshestTickerQuote([yahooWithVariation, b3]) || chooseUsableTickerQuoteByQuality([yahooWithVariation, b3]);
    if (freshest) return freshest;
    const history = await fetchYahooHistoryQuote(name, symbol);
    if (usableMarketQuote(history)) return history;
    return { ok: false, error: [yahoo?.error, b3?.error, history?.error].filter(Boolean).join(' | ') || 'IVVB11 indisponível' };
  }

  let q = await fetchYahooQuote(symbol, { interval: DIRECT_YAHOO_INDEXES.has(name) ? '1d' : undefined })
    .catch(error => ({ ok: false, error: error?.message || String(error) }));
  if (!usableMarketQuote(q)) q = await fetchYahooHistoryQuote(name, symbol);
  return q;
}

export async function fetchAnalysisTickerSnapshot({ bypassCache = false, cache = true } = {}) {
  return fetchIndicesSnapshot({
    symbols: VALORAE_ANALYSIS_TICKER_SYMBOLS,
    bypassCache,
    cache
  });
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
        const q = await fetchMarketTickerQuote(name, symbol);
        const row = quoteRow(name, symbol, q);
        return {
          ...row,
          ticker: name,
          code: name,
          value: row.price,
          valueDisplay: null,
          variationPercent: row.variationPct,
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
      source: 'Yahoo Finance + B3 Oficial + Banco Central do Brasil',
      sourceVersion: VALORAE_INDICES_MARKET_VERSION,
      generatedAt: new Date().toISOString(),
      indices: rows,
      tickerItems,
      items: tickerItems,
      partial: tickerItems.length !== VALORAE_ANALYSIS_TICKER_ORDER.length || tickerItems.some(row => !row.ok),
      cache: 'MISS',
      policy: 'Ticker de mercado: IBOV/IFIX/IDIV/SMLL consultam Yahoo, B3 oficial e série direta de contingência em paralelo; a data de pregão mais recente vence e, em empate, Yahoo intradiário/B3 oficial têm prioridade. Somente pontos recentes podem alimentar o ticker, evitando IFIX/IDIV congelados por uma página B3 antiga. USD usa Yahoo com PTAX/SGS 1 do BCB como contingência; IVVB11 usa Yahoo com cotação pública oficial da B3 como contingência; CDI/IPCA+ usam séries oficiais do BCB. Sem valores sintéticos.'
    };
    if (data.ok && !data.partial) {
      setCachedMarketValue('indices', key, data, { ttlMs: INDICES_TTL_MS, staleMs: INDICES_STALE_MS, maxEntries: 50, maxBytes: 1024 * 1024 });
      return data;
    }
    const stale = getCachedMarketValue('indices', key, { allowStale: true });
    if (data.ok && data.partial && stale?.data) {
      return { ...mergePartialTickerWithStale(data, stale.data), cache: 'STALE_MERGED' };
    }
    if (stale) return { ...stale.data, ok: true, cache: 'STALE_IF_ERROR', warning: 'Índices atuais indisponíveis; retornando snapshot stale.' };
    // Do not persist a partial snapshot as the canonical cache entry. A transient source outage
    // must not evict the last complete eight-instrument tape.
    return data;
  });
}
