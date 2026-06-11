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
    sourcePolicy: 'STATUSINVEST_PER_TICKER_PLUS_INVESTIDOR10_CALENDAR_COMPLEMENT_TAX_AWARE',
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
    agendaEvents: [],
    upcomingEvents: [],
    historyEvents: [],
    allOfficialEvents: [],
    portfolioUpcomingAll: [],
    portfolioAgenda: [],
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

function eventSpecificity(event = {}) {
  let score = 0;
  if (event.paymentDate) score += 4;
  if (event.dateCom || event.exDate || event.eligibilityDate) score += 3;
  if (event.grossValuePerShare || event.valuePerShare) score += 2;
  if (event.dividendType && !['PROVENTO', ''].includes(String(event.dividendType).toUpperCase())) score += 2;
  if (event.rawProvider === 'statusinvest') score += 1;
  return score;
}

function identityKey(event = {}, includeType = true) {
  const ticker = String(event.ticker || '').toUpperCase();
  const type = includeType ? String(event.dividendType || '').toUpperCase() : '';
  return [ticker, event.eligibilityDate || event.dateCom || event.exDate || '', event.paymentDate || '', type, Number(event.grossValuePerShare || event.declaredValuePerShare || event.valuePerShare || 0).toFixed(8)].join('|');
}

function dedupeEvents(events = []) {
  const exact = new Map();
  for (const event of events) {
    const ticker = String(event.ticker || '').toUpperCase();
    if (!ticker) continue;
    const key = event.eventKey || identityKey(event, true);
    const existing = exact.get(key);
    if (!existing || eventSpecificity(event) >= eventSpecificity(existing)) exact.set(key, event);
  }
  // Merge generic PROVENTO duplicates when another provider identified the same date/value as DIVIDENDO/JCP/RENDIMENTO.
  const byGeneric = new Map();
  for (const event of exact.values()) {
    const genericKey = identityKey(event, false);
    const existing = byGeneric.get(genericKey);
    const existingType = String(existing?.dividendType || '').toUpperCase();
    const eventType = String(event.dividendType || '').toUpperCase();
    const shouldReplace = !existing ||
      (existingType === 'PROVENTO' && eventType !== 'PROVENTO') ||
      eventSpecificity(event) > eventSpecificity(existing);
    if (shouldReplace) byGeneric.set(genericKey, event);
  }
  const byPayment = new Map();
  for (const event of byGeneric.values()) {
    const key = paymentMergeKey(event);
    if (!key) {
      byPayment.set(`raw:${byPayment.size}`, event);
      continue;
    }
    const existing = byPayment.get(key);
    if (!existing) {
      byPayment.set(key, event);
      continue;
    }
    const preferred = eventSpecificity(event) >= eventSpecificity(existing) ? event : existing;
    const fallback = preferred === event ? existing : event;
    byPayment.set(key, mergeEventFields(preferred, fallback));
  }
  const fuzzy = new Map();
  for (const event of byPayment.values()) {
    const ticker = String(event.ticker || '').toUpperCase();
    const type = String(event.dividendType || '').toUpperCase();
    const payment = event.paymentDate || '';
    const eligibility = event.eligibilityDate || event.dateCom || event.exDate || '';
    const value = Number(event.grossValuePerShare || event.declaredValuePerShare || event.valuePerShare || 0);
    const key = ticker && (payment || eligibility) ? [ticker, eligibility, payment, type].join('|') : '';
    if (!key) {
      fuzzy.set(`raw:${fuzzy.size}`, event);
      continue;
    }
    const existing = fuzzy.get(key);
    if (!existing) {
      fuzzy.set(key, event);
      continue;
    }
    const existingValue = Number(existing.grossValuePerShare || existing.declaredValuePerShare || existing.valuePerShare || 0);
    const closeEnough = Math.abs(value - existingValue) <= Math.max(0.01, Math.max(value, existingValue) * 0.015);
    if (closeEnough) {
      const preferred = eventSpecificity(event) >= eventSpecificity(existing) ? event : existing;
      const fallback = preferred === event ? existing : event;
      fuzzy.set(key, mergeEventFields(preferred, fallback));
    } else {
      fuzzy.set(`${key}|${value.toFixed(8)}|${fuzzy.size}`, event);
    }
  }
  return [...fuzzy.values()].sort((a, b) => (dateMillis(a.paymentDate || a.eligibilityDate) || 0) - (dateMillis(b.paymentDate || b.eligibilityDate) || 0));
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
  const grossPerShare = Number(event.grossValuePerShare || event.declaredValuePerShare || event.valuePerShare || 0);
  const netPerShare = Number(event.netValuePerShare || event.valuePerShare || grossPerShare || 0);
  const grossAmount = round(qty * grossPerShare, 2);
  const netAmount = round(qty * netPerShare, 2);
  const taxWithheldAmount = round(Math.max(0, grossAmount - netAmount), 2);
  return {
    ...event,
    eligibilityQuantity: qty,
    quantityAtDate: qty,
    grossAmount,
    netAmount,
    taxWithheldAmount,
    estimatedAmount: netAmount,
    amountTotal: netAmount,
    valuePerShare: netPerShare,
    eligible: qty > 0,
    eligibilityRule: 'DATA_COM_OR_DATA_EX_PREVIOUS_BUSINESS_DAY'
  };
}


function dividendCacheSignature(payload = {}, tickers = [], mode = 'mobile') {
  const compactPositions = normalizePositions(payload.dividendPositions || payload.positions || [])
    .map(p => ({
      ticker: p.ticker,
      quantity: round(p.quantity, 8),
      avgPrice: round(p.avgPrice || 0, 6),
      currentPrice: round(p.currentPrice || 0, 6),
      firstPurchaseDate: p.firstPurchaseDate || '',
      assetClass: p.assetClass || '',
      sector: p.sector || ''
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  const compactTransactions = normalizeTransactions(payload.transactions || [])
    .map(t => ({ ticker: t.ticker, quantity: round(t.quantity, 8), price: round(t.price || 0, 6), date: t.date || '' }))
    .sort((a, b) => `${a.ticker}|${a.date}|${a.quantity}`.localeCompare(`${b.ticker}|${b.date}|${b.quantity}`));
  return {
    tickers,
    mode,
    futureMonths: payload.futureMonths,
    historyMonths: payload.historyMonths,
    agendaMonthsAhead: payload.agendaMonthsAhead,
    positions: compactPositions,
    transactions: compactTransactions
  };
}

function statusInvestConcurrency() {
  const value = Number(process.env.VALORAE_STATUSINVEST_CONCURRENCY || 5);
  return Number.isFinite(value) ? Math.max(1, Math.min(10, Math.floor(value))) : 5;
}

async function mapLimit(items = [], limit = 5, mapper) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function timeoutValue(ms, value) {
  return new Promise(resolve => setTimeout(() => resolve(value), Math.max(1, Number(ms) || 1)));
}

async function withSoftTimeout(promise, timeoutMs, fallback) {
  const limit = Number(timeoutMs || 0);
  if (!Number.isFinite(limit) || limit <= 0) return promise;
  return Promise.race([promise, timeoutValue(limit, fallback)]);
}

async function mapLimitWithDeadline(items = [], limit = 5, deadlineAt = Date.now() + 4800, mapper) {
  const results = new Array(items.length);
  const skipped = new Set();
  let index = 0;
  let timedOut = false;
  async function worker() {
    while (index < items.length) {
      if (Date.now() >= deadlineAt - 120) {
        timedOut = true;
        return;
      }
      const current = index++;
      const remaining = Math.max(80, deadlineAt - Date.now());
      const value = await withSoftTimeout(
        Promise.resolve().then(() => mapper(items[current], current)),
        remaining,
        { __timeout: true, ticker: items[current] }
      );
      if (value?.__timeout) {
        timedOut = true;
        skipped.add(String(items[current] || '').toUpperCase());
        return;
      }
      results[current] = value;
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  const notStarted = items.slice(Math.min(index, items.length));
  for (const ticker of notStarted) skipped.add(String(ticker || '').toUpperCase());
  return { results: results.filter(Boolean), timedOut, skipped: [...skipped].filter(Boolean) };
}

function mergeEventFields(preferred = {}, fallback = {}) {
  const merged = { ...fallback, ...preferred };
  for (const key of ['dateCom', 'exDate', 'eligibilityDate', 'paymentDate', 'eligibilityDateSource', 'rawDividendType']) {
    if (!merged[key] && fallback[key]) merged[key] = fallback[key];
  }
  for (const key of ['grossValuePerShare', 'declaredValuePerShare', 'netValuePerShare', 'valuePerShare', 'taxRate', 'taxWithheldPerShare']) {
    if (!(Number(merged[key]) > 0) && Number(fallback[key]) > 0) merged[key] = fallback[key];
  }
  const providers = new Set([...(Array.isArray(fallback.providers) ? fallback.providers : []), fallback.rawProvider, ...(Array.isArray(preferred.providers) ? preferred.providers : []), preferred.rawProvider].filter(Boolean));
  if (providers.size) merged.providers = [...providers];
  if (fallback.sourceKind && preferred.sourceKind && fallback.sourceKind !== preferred.sourceKind) merged.sourceKind = `${preferred.sourceKind}+${fallback.sourceKind}`;
  return merged;
}

function paymentMergeKey(event = {}) {
  const ticker = String(event.ticker || '').toUpperCase();
  const payment = event.paymentDate || '';
  const type = String(event.dividendType || '').toUpperCase();
  const value = Number(event.grossValuePerShare || event.declaredValuePerShare || event.valuePerShare || 0).toFixed(8);
  return ticker && payment ? [ticker, payment, type, value].join('|') : '';
}

function buildDividendResult({
  payload = {},
  tickers = [],
  officialEvents = [],
  diagnostics = [],
  cacheStatus = 'LIVE',
  timedOut = false,
  agendaDeferred = false,
  skippedTickers = []
} = {}) {
  const enriched = officialEvents.map(e => enrichPortfolio(e, payload));
  const split = splitEvents(enriched);
  const portfolioReceived = split.paid.filter(e => e.eligible);
  const portfolioUpcoming = split.upcoming.filter(e => e.eligible || !e.eligibilityDate);
  const portfolioUpcomingAll = split.upcoming.map(e => ({
    ...e,
    portfolioScope: e.eligible ? 'eligible-position' : 'official-event-not-eligible-or-unknown'
  }));
  const partial = Boolean(
    timedOut ||
    agendaDeferred ||
    skippedTickers.length ||
    diagnostics.some(d => d?.status === 0 || d?.error || d?.reason === 'deadline-exceeded')
  );
  return {
    status: officialEvents.length ? 'OK' : 'EMPTY',
    sourceStatus: officialEvents.length ? (partial ? 'PARTIAL_LIVE_OR_CACHE' : 'LIVE_OR_CACHE') : 'EMPTY',
    sourcePolicy: 'STATUSINVEST_PER_TICKER_FIRST_PLUS_INVESTIDOR10_CALENDAR_COMPLEMENT_TAX_AWARE',
    cacheStatus,
    generatedAt: new Date().toISOString(),
    asOf: todayIso(),
    tickers,
    officialEvents: enriched,
    officialPaidEvents: split.paid,
    officialFutureEvents: split.future,
    officialAnnouncedEvents: split.announced,
    officialUpcomingEvents: split.upcoming,
    allOfficialFuturePayments: split.upcoming,
    agendaEvents: split.upcoming,
    upcomingEvents: split.upcoming,
    historyEvents: split.paid,
    allOfficialEvents: enriched,
    officialEventsByTicker: enriched.reduce((acc, event) => { (acc[event.ticker] ||= []).push(event); return acc; }, {}),
    nextByTicker: split.upcoming.reduce((acc, event) => { if (!acc[event.ticker]) acc[event.ticker] = event; return acc; }, {}),
    portfolioUpcomingAll,
    portfolioAgenda: portfolioUpcomingAll,
    assetHistory: split.paid,
    portfolioReceived,
    portfolioUpcoming,
    received: portfolioReceived,
    upcoming: portfolioUpcoming,
    events: enriched,
    dividends: enriched,
    counts: {
      official: enriched.length,
      paid: split.paid.length,
      future: split.future.length,
      announced: split.announced.length,
      portfolioReceived: portfolioReceived.length,
      portfolioUpcoming: portfolioUpcoming.length,
      portfolioAgenda: portfolioUpcomingAll.length
    },
    diagnostics,
    warnings: [
      ...(timedOut ? ['Dividendos retornados parcialmente antes do deadline mobile.'] : []),
      ...(agendaDeferred ? ['Agenda Investidor10 adiada; usando eventos oficiais por ticker e cache disponivel.'] : []),
      ...(skippedTickers.length ? [`Tickers nao consultados antes do deadline: ${skippedTickers.slice(0, 12).join(', ')}${skippedTickers.length > 12 ? '...' : ''}`] : [])
    ],
    partial
  };
}

export async function buildDividendsContract(payload = {}) {
  const tickers = dividendTickers(payload);
  const mode = payload.mode || 'mobile';
  if (tickers.length === 0) return emptyDividendContract(tickers);
  const cacheKey = `dividends-contract:${stableKey(dividendCacheSignature(payload, tickers, mode))}`;
  const cached = getCache(cacheKey);
  if (cached) return { ...cached.value, cacheStatus: cached.status };
  return coalesce(cacheKey, async () => {
    const startedAt = Date.now();
    const diagnostics = [];
    const all = [];
    const timeoutMs = Number(payload.timeoutMs || (mode === 'deep-background' ? 8500 : 4800));
    const overallDeadlineAt = startedAt + Math.max(2200, timeoutMs);
    const statusTimeout = Math.max(1800, Math.min(5200, Math.floor(timeoutMs * 0.70)));
    const agendaTimeout = Math.max(1400, Math.min(Number(payload.agendaTimeoutMs || timeoutMs), Math.floor(timeoutMs * 0.55)));
    const requestedAgendaMonths = Number(payload.agendaMonthsAhead ?? payload.futureMonths ?? payload.monthsForward ?? 3);
    const agendaMonthsAhead = mode === 'deep-background'
      ? Math.max(0, Math.min(36, Number.isFinite(requestedAgendaMonths) ? Math.floor(requestedAgendaMonths) : 18))
      : Math.max(0, Math.min(3, Number.isFinite(requestedAgendaMonths) ? Math.floor(requestedAgendaMonths) : 3));

    // Status Invest por ativo e agenda pública são independentes. Em carteiras grandes,
    // executar em série atrasava a agenda e fazia o mobile receber só poucos eventos.
    // Em paralelo, os futuros/anunciados entram sem esperar toda a varredura histórica.
    const includeCalendar = !['0', 'false', 'no', 'off'].includes(String(payload.includeCalendar ?? payload.includeAgenda ?? '1').toLowerCase());
    const agendaPromise = includeCalendar ? getAgendaDividends(tickers, {
      timeoutMs: agendaTimeout,
      agendaTimeoutMs: agendaTimeout,
      futureMonths: agendaMonthsAhead,
      agendaConcurrency: Number(payload.agendaConcurrency || 6)
    }) : Promise.resolve({ events: [], diagnostics: [{ provider: 'investidor10-agenda', status: 'SKIPPED', reason: 'calendar-disabled' }] });

    const statusDeadlineAt = Math.min(overallDeadlineAt - 300, startedAt + Math.max(2000, Math.floor(timeoutMs * 0.72)));
    const statusBatch = await mapLimitWithDeadline(
      tickers,
      statusInvestConcurrency(),
      statusDeadlineAt,
      t => getConfirmedDividendsByTicker(t, { timeoutMs: statusTimeout })
    );
    const perTicker = statusBatch.results;
    if (statusBatch.timedOut || statusBatch.skipped.length) {
      diagnostics.push({
        provider: 'statusinvest',
        status: 'PARTIAL',
        reason: 'deadline-exceeded',
        skippedTickers: statusBatch.skipped,
        completed: perTicker.length,
        total: tickers.length
      });
    }

    for (const item of perTicker) {
      all.push(...item.events);
      diagnostics.push(...(Array.isArray(item.diagnostics) ? item.diagnostics : [item.diagnostics].filter(Boolean)));
    }
    const remainingForAgenda = overallDeadlineAt - Date.now() - 120;
    let agendaDeferred = false;
    const agenda = remainingForAgenda > 250
      ? await withSoftTimeout(
          agendaPromise,
          remainingForAgenda,
          { __timeout: true, events: [], diagnostics: [{ provider: 'investidor10-agenda', status: 'PARTIAL', reason: 'deadline-exceeded' }] }
        )
      : { __timeout: true, events: [], diagnostics: [{ provider: 'investidor10-agenda', status: 'PARTIAL', reason: 'deadline-exceeded' }] };
    if (agenda?.__timeout) agendaDeferred = true;
    all.push(...(agenda.events || []).filter(e => e.paymentDate || e.dateCom || e.exDate));
    diagnostics.push(...(agenda.diagnostics || []));

    const officialEvents = dedupeEvents(all);
    const enriched = officialEvents.map(e => enrichPortfolio(e, payload));
    const split = splitEvents(enriched);
    const portfolioReceived = split.paid.filter(e => e.eligible);
    const portfolioUpcoming = split.upcoming.filter(e => e.eligible || !e.eligibilityDate);
    const portfolioUpcomingAll = split.upcoming.map(e => ({ ...e, portfolioScope: e.eligible ? 'eligible-position' : 'official-event-not-eligible-or-unknown' }));
    const isPartial = Boolean(
      statusBatch.timedOut ||
      agendaDeferred ||
      statusBatch.skipped.length ||
      diagnostics.some(d => d?.status === 0 || d?.error || d?.reason === 'deadline-exceeded')
    );
    const result = {
      status: 'OK',
      sourceStatus: officialEvents.length ? (isPartial ? 'PARTIAL_LIVE_OR_CACHE' : 'LIVE_OR_CACHE') : 'EMPTY',
      sourcePolicy: 'STATUSINVEST_PER_TICKER_FIRST_PLUS_INVESTIDOR10_CALENDAR_COMPLEMENT_TAX_AWARE',
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
      agendaEvents: split.upcoming,
      upcomingEvents: split.upcoming,
      historyEvents: split.paid,
      allOfficialEvents: enriched,
      officialEventsByTicker: enriched.reduce((acc, event) => { (acc[event.ticker] ||= []).push(event); return acc; }, {}),
      nextByTicker: split.upcoming.reduce((acc, event) => { if (!acc[event.ticker]) acc[event.ticker] = event; return acc; }, {}),
      portfolioUpcomingAll,
      portfolioAgenda: portfolioUpcomingAll,
      assetHistory: split.paid,
      portfolioReceived,
      portfolioUpcoming,
      received: portfolioReceived,
      upcoming: portfolioUpcoming,
      events: enriched,
      dividends: enriched,
      counts: { official: enriched.length, paid: split.paid.length, future: split.future.length, announced: split.announced.length, portfolioReceived: portfolioReceived.length, portfolioUpcoming: portfolioUpcoming.length, portfolioAgenda: portfolioUpcomingAll.length },
      diagnostics,
      warnings: [
        ...(statusBatch.timedOut ? ['Dividendos retornados parcialmente antes do deadline mobile.'] : []),
        ...(agendaDeferred ? ['Agenda Investidor10 adiada; usando eventos oficiais por ticker e cache disponivel.'] : []),
        ...(statusBatch.skipped.length ? [`Tickers nao consultados antes do deadline: ${statusBatch.skipped.slice(0, 12).join(', ')}${statusBatch.skipped.length > 12 ? '...' : ''}`] : [])
      ],
      partial: isPartial
    };
    setCache(cacheKey, result, mode === 'deep-background' ? 10 * 60 * 1000 : (isPartial ? 90 * 1000 : 4 * 60 * 1000), 24 * 60 * 60 * 1000);
    return result;
  });
}
