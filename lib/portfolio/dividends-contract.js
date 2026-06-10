import { getConfirmedDividendsByTicker } from '../sources/status-dividends.js';
import { getAgendaDividends } from '../sources/agenda-dividends.js';
import { coalesce, getCache, setCache, stableKey } from '../core/cache.js';
import { dateMillis, todayIso } from '../core/dates.js';
import { round } from '../core/numbers.js';
import { dividendTickers, quantityAtDate, normalizePositions, normalizeTransactions } from './positions.js';


function emptyDividendContract(tickers = []) {
  return {
    status: 'EMPTY',
    sourceStatus: 'EMPTY',
    sourcePolicy: 'STATUSINVEST_PER_TICKER_PLUS_INVESTIDOR10_CALENDAR_COMPLEMENT',
    cacheStatus: 'BYPASS',
    generatedAt: new Date().toISOString(),
    asOf: todayIso(),
    tickers,
    officialEvents: [],
    officialPaidEvents: [],
    officialFutureEvents: [],
    officialAnnouncedEvents: [],
    officialUpcomingEvents: [],
    allOfficialFuturePayments: [],
    assetHistory: [],
    portfolioReceived: [],
    portfolioUpcoming: [],
    received: [],
    upcoming: [],
    events: [],
    dividends: [],
    counts: { official: 0, paid: 0, future: 0, announced: 0, portfolioReceived: 0, portfolioUpcoming: 0 },
    diagnostics: [{ provider: 'valorae', status: 'SKIPPED', reason: 'emptyTickers' }],
    partial: false
  };
}

function dedupeEvents(events = []) {
  const map = new Map();
  for (const event of events) {
    const ticker = String(event.ticker || '').toUpperCase();
    if (!ticker) continue;
    const key = event.eventKey || [ticker, event.eligibilityDate || event.dateCom || event.exDate || '', event.paymentDate || '', event.dividendType || '', Number(event.valuePerShare || 0).toFixed(8)].join('|');
    const existing = map.get(key);
    if (!existing || (event.paymentDate && !existing.paymentDate) || (event.valuePerShare && !existing.valuePerShare)) map.set(key, event);
  }
  return [...map.values()].sort((a, b) => (dateMillis(a.paymentDate || a.eligibilityDate) || 0) - (dateMillis(b.paymentDate || b.eligibilityDate) || 0));
}

function splitEvents(events = []) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const boundary = todayStart.getTime();
  const paid = [];
  const future = [];
  const announced = [];
  for (const event of events) {
    const pay = dateMillis(event.paymentDate);
    if (pay && pay < boundary) paid.push({ ...event, status: 'Recebido' });
    else if (pay && pay >= boundary) future.push({ ...event, status: 'Previsto' });
    else announced.push({ ...event, status: 'Anunciado/Provisionado' });
  }
  return { paid, future, announced, upcoming: [...future, ...announced] };
}

function enrichPortfolio(event, payload = {}) {
  const positions = normalizePositions(payload.dividendPositions || payload.positions || []);
  const transactions = normalizeTransactions(payload.transactions || []);
  const eligibility = event.eligibilityDate || event.dateCom || '';
  const qty = quantityAtDate(event.ticker, eligibility, positions, transactions);
  const amount = round(qty * Number(event.valuePerShare || 0), 2);
  return { ...event, eligibilityQuantity: qty, quantityAtDate: qty, grossAmount: amount, estimatedAmount: amount, eligible: qty > 0, eligibilityRule: 'DATA_COM_OR_DATA_EX_PREVIOUS_BUSINESS_DAY' };
}

export async function buildDividendsContract(payload = {}) {
  const tickers = dividendTickers(payload);
  const mode = payload.mode || 'mobile';
  if (tickers.length === 0) return emptyDividendContract(tickers);
  const cacheKey = `dividends-contract:${stableKey({ tickers, mode, futureMonths: payload.futureMonths, historyMonths: payload.historyMonths })}`;
  const cached = getCache(cacheKey);
  if (cached) return { ...cached.value, cacheStatus: cached.status };
  return coalesce(cacheKey, async () => {
    const diagnostics = [];
    const all = [];
    const timeoutMs = Number(payload.timeoutMs || (mode === 'deep-background' ? 8500 : 4800));
    const perTicker = await Promise.all(tickers.map(t => getConfirmedDividendsByTicker(t, { timeoutMs: Math.max(2800, Math.floor(timeoutMs / 2)) })));
    for (const item of perTicker) {
      all.push(...item.events);
      diagnostics.push(...(Array.isArray(item.diagnostics) ? item.diagnostics : [item.diagnostics].filter(Boolean)));
    }
    const agenda = await getAgendaDividends(tickers, { timeoutMs: Math.max(2800, Math.floor(timeoutMs / 2)) });
    all.push(...agenda.events);
    diagnostics.push(...agenda.diagnostics);

    const officialEvents = dedupeEvents(all);
    const enriched = officialEvents.map(e => enrichPortfolio(e, payload));
    const split = splitEvents(enriched);
    const portfolioReceived = split.paid.filter(e => e.eligible);
    const portfolioUpcoming = split.upcoming.filter(e => e.eligible || !e.eligibilityDate);
    const result = {
      status: 'OK',
      sourceStatus: officialEvents.length ? 'LIVE_OR_CACHE' : 'EMPTY',
      sourcePolicy: 'STATUSINVEST_PER_TICKER_PLUS_INVESTIDOR10_CALENDAR_COMPLEMENT',
      cacheStatus: 'LIVE',
      generatedAt: new Date().toISOString(),
      asOf: todayIso(),
      tickers,
      officialEvents: enriched,
      officialPaidEvents: split.paid,
      officialFutureEvents: split.future,
      officialAnnouncedEvents: split.announced,
      officialUpcomingEvents: split.upcoming,
      allOfficialFuturePayments: split.upcoming,
      assetHistory: split.paid,
      portfolioReceived,
      portfolioUpcoming,
      received: portfolioReceived,
      upcoming: portfolioUpcoming,
      events: enriched,
      dividends: enriched,
      counts: { official: enriched.length, paid: split.paid.length, future: split.future.length, announced: split.announced.length, portfolioReceived: portfolioReceived.length, portfolioUpcoming: portfolioUpcoming.length },
      diagnostics,
      partial: diagnostics.some(d => d.status === 0 || d.error) && officialEvents.length === 0
    };
    setCache(cacheKey, result, mode === 'deep-background' ? 10 * 60 * 1000 : 4 * 60 * 1000, 24 * 60 * 60 * 1000);
    return result;
  });
}
