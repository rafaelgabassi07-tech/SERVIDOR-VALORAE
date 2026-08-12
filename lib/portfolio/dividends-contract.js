import { getConfirmedDividendsByTicker } from '../sources/adapters/index.js';
import { getAgendaDividends } from '../sources/agenda-dividends.js';
import { coalesce, getCache, setCache, stableKey } from '../core/cache.js';
import { dateMillis, normalizeDate, todayIso } from '../core/dates.js';
import { round } from '../core/numbers.js';
import { normalizeTicker, classifyTicker, isStockUnitTicker } from '../core/tickers.js';
import { dividendTickers, quantityAtDate, normalizePositions, normalizeTransactions, portfolioInceptionDate, tickerInceptionDate } from './positions.js';


function emptyDividendContract(tickers = []) {
  return {
    status: 'EMPTY',
    sourceStatus: 'EMPTY',
    sourcePolicy: 'STATUSINVEST_PRIMARY_PER_TICKER_PLUS_INVESTIDOR10_CALENDAR_COMPLEMENT_NO_DUPLICATES',
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
    portfolioStartDate: '',
    excludedBeforePortfolioStart: 0,
    partial: false
  };
}

function sourcePriority(event = {}) {
  const providerText = [event.rawProvider, event.source, event.sourceKind, ...(Array.isArray(event.providers) ? event.providers : [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (providerText.includes('statusinvest')) return 40;
  if (providerText.includes('investidor10')) return 20;
  if (providerText.includes('cache')) return 10;
  return 0;
}

function eventSpecificity(event = {}) {
  let score = sourcePriority(event);
  if (event.paymentDate) score += 4;
  if (event.dateCom || event.exDate || event.eligibilityDate) score += 3;
  if (event.grossValuePerShare || event.valuePerShare) score += 2;
  if (event.dividendType && !['PROVENTO', ''].includes(String(event.dividendType).toUpperCase())) score += 2;
  if (event.sourceKind && String(event.sourceKind).includes('confirmed')) score += 2;
  return score;
}

function eventPaymentDate(event = {}) {
  return normalizeDate(event.paymentDate || event.payDate || event.dataPagamento || event.datePayment || event.pagamento);
}

function eventEligibilityDate(event = {}) {
  // Elegibilidade real deve vir apenas de data-com/data-ex/data de posição.
  // referenceDate/competence é competência do provento, não prova que o usuário tinha direito.
  return normalizeDate(event.eligibilityDate || event.dateCom || event.comDate || event.dataCom || event.recordDate || event.inferredComDate || event.estimatedComDate || event.exDate || event.dataEx);
}

function eventReferenceDate(event = {}) {
  return normalizeDate(event.referenceDate || event.competence || event.period || event.periodo);
}

function eventDividendFamily(event = {}) {
  const raw = String(event.dividendType || event.rawDividendType || event.type || event.kind || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  if (/JCP|JSCP|JUROS/.test(raw)) return 'JCP';
  if (/REND/.test(raw)) return 'RENDIMENTO';
  if (/AMORT/.test(raw)) return 'AMORTIZACAO';
  if (/DIV/.test(raw)) return 'DIVIDENDO';
  return raw || 'PROVENTO';
}

function isFiiLikeDividendEvent(event = {}) {
  const ticker = normalizeTicker(event.ticker || event.symbol || '');
  const assetClass = String(event.assetClass || event.assetType || event.typeAsset || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const kind = classifyTicker(ticker);
  return assetClass.includes('FII') || assetClass.includes('FUNDO IMOB') || (kind === 'FII' && !isStockUnitTicker(ticker));
}

function eventFamilyForDedupe(event = {}) {
  const payment = eventPaymentDate(event);
  return payment && isFiiLikeDividendEvent(event) ? 'FII_DISTRIBUICAO' : eventDividendFamily(event);
}

function eventValueKey(event = {}) {
  const value = Number(event.grossValuePerShare || event.declaredValuePerShare || event.netValuePerShare || event.valuePerShare || event.amount || event.value || 0);
  return Number.isFinite(value) && value > 0 ? value.toFixed(6) : '';
}

function identityKey(event = {}, includeType = true) {
  const ticker = normalizeTicker(event.ticker || event.symbol || '');
  const type = includeType ? eventDividendFamily(event) : '';
  const eligibilityOrReference = eventEligibilityDate(event) || eventReferenceDate(event);
  return [ticker, eligibilityOrReference, eventPaymentDate(event), type, eventValueKey(event)].join('|');
}

function choosePreferredEvent(a = {}, b = {}) {
  if (!a) return b;
  if (!b) return a;
  const scoreA = eventSpecificity(a);
  const scoreB = eventSpecificity(b);
  if (scoreA !== scoreB) return scoreA > scoreB ? a : b;
  const valueA = Number(a.grossValuePerShare || a.declaredValuePerShare || a.netValuePerShare || a.valuePerShare || 0);
  const valueB = Number(b.grossValuePerShare || b.declaredValuePerShare || b.netValuePerShare || b.valuePerShare || 0);
  return valueA >= valueB ? a : b;
}

function canonicalMergeEvent(current, incoming) {
  const preferred = choosePreferredEvent(current, incoming);
  const fallback = preferred === incoming ? current : incoming;
  const merged = mergeEventFields(preferred, fallback);
  merged.dedupeStrategy = 'ticker-payment-family-or-fii-payment-primary-source';
  const providers = new Set([...(Array.isArray(current?.providers) ? current.providers : []), current?.rawProvider, ...(Array.isArray(incoming?.providers) ? incoming.providers : []), incoming?.rawProvider].filter(Boolean));
  if (providers.size) merged.providers = [...providers];
  return merged;
}

function dividendPerShareCandidates(event = {}) {
  return [...new Set([
    event.grossValuePerShare,
    event.declaredValuePerShare,
    event.netValuePerShare,
    event.valuePerShare,
    event.amount,
    event.value
  ].map(Number).filter(value => Number.isFinite(value) && value > 0))];
}

function dividendValuesExactlyEquivalent(a = {}, b = {}) {
  const leftValues = dividendPerShareCandidates(a);
  const rightValues = dividendPerShareCandidates(b);
  if (!leftValues.length || !rightValues.length) return true;
  const rightTokens = new Set(rightValues.map(value => value.toFixed(8)));
  return leftValues.some(value => rightTokens.has(value.toFixed(8)));
}

function dividendValuesEquivalent(a = {}, b = {}, toleranceRatio = 0.02) {
  const leftValues = dividendPerShareCandidates(a);
  const rightValues = dividendPerShareCandidates(b);
  if (!leftValues.length || !rightValues.length) return true;
  return leftValues.some(left => rightValues.some(right => {
    const tolerance = Math.max(0.000001, Math.max(left, right) * toleranceRatio);
    return Math.abs(left - right) <= tolerance;
  }));
}

function rawProviderName(event = {}) {
  return String(event.rawProvider || event.provider || event.sourceKind || event.source || '').trim().toLowerCase();
}

function sameEconomicAnnouncement(a = {}, b = {}) {
  if (normalizeTicker(a.ticker || a.symbol || '') !== normalizeTicker(b.ticker || b.symbol || '')) return false;
  if (eventFamilyForDedupe(a) !== eventFamilyForDedupe(b)) return false;
  const paymentA = eventPaymentDate(a);
  const paymentB = eventPaymentDate(b);
  if (paymentA && paymentB && paymentA !== paymentB) return false;
  const eligibilityA = eventEligibilityDate(a) || eventReferenceDate(a);
  const eligibilityB = eventEligibilityDate(b) || eventReferenceDate(b);
  if (eligibilityA && eligibilityB && eligibilityA !== eligibilityB) return false;

  // FIIs costumam aparecer no calendário Investidor10 e na confirmação por ticker do
  // StatusInvest com arredondamentos diferentes (ex.: 0,096 vs 0,10). Essa diferença
  // não deve criar duas linhas quando pagamento/Data COM são o mesmo anúncio. O limite
  // ampliado vale apenas entre fontes distintas; duas distribuições vindas da mesma
  // fonte continuam preservadas, evitando esconder parcelas legítimas.
  const providerA = rawProviderName(a);
  const providerB = rawProviderName(b);
  const crossProvider = Boolean(providerA && providerB && providerA !== providerB);
  const incompleteLifecycle = !paymentA || !paymentB || !eligibilityA || !eligibilityB;

  // A etapa exata anterior já elimina cópias completas da mesma origem. Se a mesma fonte
  // ainda deixou duas linhas completas, elas são preservadas como parcelas econômicas distintas.
  // Em lifecycle incompleto, a mesma fonte só pode reconciliar valores exatamente equivalentes;
  // tolerância percentual é exclusiva da comparação entre provedores diferentes.
  if (!crossProvider) {
    if (!incompleteLifecycle) return false;
    return dividendValuesExactlyEquivalent(a, b);
  }

  const crossProviderFii = isFiiLikeDividendEvent(a) && isFiiLikeDividendEvent(b);
  return dividendValuesEquivalent(a, b, crossProviderFii ? 0.15 : 0.02);
}

function dedupeEvents(events = []) {
  const exact = new Map();
  for (const event of events) {
    const ticker = normalizeTicker(event.ticker || event.symbol || '');
    if (!ticker) continue;
    const key = event.eventKey || identityKey(event, true);
    const existing = exact.get(key);
    exact.set(key, existing ? canonicalMergeEvent(existing, event) : event);
  }

  // PROVENTO genérico pode ser a mesma distribuição já classificada por outra fonte.
  // Só fundimos quando datas e valores continuam economicamente compatíveis.
  const merged = [];
  for (const event of exact.values()) {
    const index = merged.findIndex(existing => sameEconomicAnnouncement(existing, event));
    if (index >= 0) merged[index] = canonicalMergeEvent(merged[index], event);
    else merged.push(event);
  }

  // Importante: não reduzir apenas por ticker + pagamento + família. Companhias podem
  // anunciar mais de uma parcela legítima para a mesma data de pagamento, e a Agenda
  // precisa preservar cada valor/Data COM como evento econômico distinto.
  return merged.sort((a, b) => (dateMillis(eventPaymentDate(a) || eventEligibilityDate(a)) || 0) - (dateMillis(eventPaymentDate(b) || eventEligibilityDate(b)) || 0));
}

function eventsWithinRequestedWindow(events = [], payload = {}) {
  const historyMonthsRaw = Number(payload.historyMonths ?? 120);
  const futureMonthsRaw = Number(payload.futureMonths ?? payload.agendaMonthsAhead ?? 18);
  const historyMonths = Number.isFinite(historyMonthsRaw) ? Math.max(0, Math.min(180, Math.floor(historyMonthsRaw))) : 120;
  const futureMonths = Number.isFinite(futureMonthsRaw) ? Math.max(1, Math.min(36, Math.floor(futureMonthsRaw))) : 18;
  const includeAllFutureAnnounced = ['1', 'true', 'yes', 'on'].includes(String(payload.includeAllFutureAnnounced ?? payload.allFutureAnnounced ?? '0').toLowerCase());
  const today = new Date(`${todayIso()}T00:00:00.000Z`);
  const todayMillis = today.getTime();
  const historyCutoff = new Date(todayMillis);
  historyCutoff.setUTCMonth(historyCutoff.getUTCMonth() - historyMonths);
  const futureCutoff = new Date(todayMillis);
  futureCutoff.setUTCMonth(futureCutoff.getUTCMonth() + futureMonths);
  futureCutoff.setUTCDate(futureCutoff.getUTCDate() + 1);
  return events.filter(event => {
    const paymentMillis = dateMillis(eventPaymentDate(event));
    if (!paymentMillis) return true;
    if (paymentMillis < todayMillis) return historyMonths > 0 && paymentMillis >= historyCutoff.getTime();
    if (includeAllFutureAnnounced) return true;
    return paymentMillis <= futureCutoff.getTime();
  });
}

function splitEvents(events = []) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const boundary = todayStart.getTime();
  const paid = [];
  const future = [];
  const announced = [];
  for (const event of events) {
    const pay = dateMillis(eventPaymentDate(event));
    if (pay && pay < boundary) paid.push({ ...event, status: 'Recebido' });
    else if (pay && pay >= boundary) future.push({ ...event, status: 'Previsto' });
    else announced.push({ ...event, status: 'Anunciado/Provisionado' });
  }
  return { paid, future, announced, upcoming: [...future, ...announced] };
}

export function enrichPortfolio(event, payload = {}) {
  const positions = normalizePositions(payload.dividendPositions || payload.positions || []);
  const transactions = normalizeTransactions(payload.transactions || []);
  const portfolioStartDate = portfolioInceptionDate(
    positions,
    transactions,
    payload.portfolioStartDate || payload.firstPortfolioPurchaseDate || payload.portfolioInceptionDate
  );
  const eligibility = eventEligibilityDate(event);
  const eligibilityKnown = Boolean(eligibility);
  const eventTicker = normalizeTicker(event.ticker || event.symbol || '');
  const currentPosition = positions.find(p => p.ticker === eventTicker);
  const tickerStartDate = tickerInceptionDate(eventTicker, positions, transactions);
  const eligibilityMillis = dateMillis(eligibility);
  const portfolioStartMillis = dateMillis(portfolioStartDate);
  const tickerStartMillis = dateMillis(tickerStartDate);
  const beforePortfolioStart = Boolean(eligibilityMillis && portfolioStartMillis && eligibilityMillis < portfolioStartMillis);
  const beforeTickerStart = Boolean(eligibilityMillis && tickerStartMillis && eligibilityMillis < tickerStartMillis);
  // Eventos ainda sem Data COM/Data EX podem exibir uma estimativa baseada na posição
  // atual, mas nunca entram como recebidos/elegíveis sem uma data de corte verificável.
  const qty = eligibilityKnown
    ? (!beforePortfolioStart && !beforeTickerStart
      ? quantityAtDate(event.ticker, eligibility, positions, transactions)
      : 0)
    : Math.max(0, round(currentPosition?.quantity || 0, 8));
  const eligible = eligibilityKnown && qty > 0 && !beforePortfolioStart && !beforeTickerStart;
  const grossPerShare = Number(event.grossValuePerShare || event.declaredValuePerShare || event.valuePerShare || 0);
  const netPerShare = Number(event.netValuePerShare || event.valuePerShare || grossPerShare || 0);
  const grossAmount = round(qty * grossPerShare, 2);
  const netAmount = round(qty * netPerShare, 2);
  const taxWithheldAmount = round(Math.max(0, grossAmount - netAmount), 2);
  const eligibilityReason = !eligibilityKnown
    ? 'ELIGIBILITY_DATE_UNKNOWN'
    : beforePortfolioStart
      ? 'BEFORE_PORTFOLIO_START'
      : beforeTickerStart
        ? 'BEFORE_TICKER_FIRST_POSITION'
        : qty <= 0
          ? 'NO_POSITION_ON_ELIGIBILITY_DATE'
          : 'POSITION_CONFIRMED_ON_ELIGIBILITY_DATE';
  return {
    ...event,
    assetClass: event.assetClass || currentPosition?.assetClass || undefined,
    portfolioStartDate: portfolioStartDate || undefined,
    tickerStartDate: tickerStartDate || undefined,
    withinPortfolioLifetime: !beforePortfolioStart,
    beforePortfolioStart,
    beforeTickerStart,
    eligibilityDate: eligibility || undefined,
    eligibilityKnown,
    comDate: event.comDate || event.dateCom || event.dataCom || undefined,
    exDate: event.exDate || event.dataEx || event.exDividendDate || undefined,
    inferredComDate: event.inferredComDate || event.estimatedComDate || undefined,
    eligibilityQuantity: qty,
    quantityAtDate: qty,
    grossAmount,
    netAmount,
    taxWithheldAmount,
    estimatedAmount: netAmount,
    amountTotal: netAmount,
    valuePerShare: netPerShare,
    eligible,
    eligibilityReason,
    eligibilityRule: eligibilityKnown ? 'DATA_COM_OR_DATA_EX_PREVIOUS_BUSINESS_DAY_AND_PORTFOLIO_LIFETIME' : 'ELIGIBILITY_DATE_UNKNOWN_SHOW_AS_CONFIRMATION'
  };
}


export function dividendCacheSignature(payload = {}, tickers = [], mode = 'mobile') {
  const compactPositions = normalizePositions(payload.dividendPositions || payload.positions || [])
    .map(p => ({
      ticker: p.ticker,
      quantity: round(p.quantity, 8),
      firstPurchaseDate: p.firstPurchaseDate || '',
      assetClass: p.assetClass || ''
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  const compactTransactions = normalizeTransactions(payload.transactions || [])
    .map(t => ({ ticker: t.ticker, quantity: round(t.quantity, 8), date: t.date || '' }))
    .sort((a, b) => `${a.ticker}|${a.date}|${a.quantity}`.localeCompare(`${b.ticker}|${b.date}|${b.quantity}`));
  return {
    tickers,
    mode,
    futureMonths: payload.futureMonths,
    historyMonths: payload.historyMonths,
    agendaMonthsAhead: payload.agendaMonthsAhead,
    includeCalendar: !['0', 'false', 'no', 'off'].includes(String(payload.includeCalendar ?? payload.includeAgenda ?? '1').toLowerCase()),
    includeAllFutureAnnounced: ['1', 'true', 'yes', 'on'].includes(String(payload.includeAllFutureAnnounced ?? payload.allFutureAnnounced ?? '0').toLowerCase()),
    source: String(payload.source || ''),
    preferVisiblePage: payload.preferVisiblePage === true,
    recoveryStrategy: String(payload.recoveryStrategy || ''),
    portfolioStartDate: portfolioInceptionDate(
      payload.dividendPositions || payload.positions || [],
      payload.transactions || [],
      payload.portfolioStartDate || payload.firstPortfolioPurchaseDate || payload.portfolioInceptionDate
    ),
    positions: compactPositions,
    transactions: compactTransactions
  };
}

function statusInvestConcurrency() {
  const value = Number(process.env.VALORAE_STATUSINVEST_CONCURRENCY || 5);
  return Number.isFinite(value) ? Math.max(1, Math.min(10, Math.floor(value))) : 5;
}

export function prioritizeDividendTickers(payload = {}, tickers = []) {
  const activePositions = normalizePositions(payload.dividendPositions || payload.positions || [])
    .filter(position => Number(position.quantity || 0) > 0)
    .map(position => normalizeTicker(position.ticker))
    .filter(Boolean);
  return [...new Set([...activePositions, ...tickers.map(normalizeTicker).filter(Boolean)])];
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

async function mapLimitWithDeadline(items = [], limit = 5, deadlineAt = Date.now() + 11000, mapper) {
  const results = new Array(items.length);
  const skipped = new Set();
  let index = 0;
  let timedOut = false;
  async function worker() {
    while (index < items.length) {
      if (Date.now() >= deadlineAt - 180) {
        timedOut = true;
        return;
      }
      const current = index++;
      const remaining = Math.max(120, deadlineAt - Date.now() - 80);
      const value = await withSoftTimeout(
        Promise.resolve().then(() => mapper(items[current], current, remaining)),
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
  for (const key of ['dateCom', 'comDate', 'dataCom', 'exDate', 'eligibilityDate', 'paymentDate', 'payDate', 'dataPagamento', 'eligibilityDateSource', 'rawDividendType']) {
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
  const ticker = normalizeTicker(event.ticker || event.symbol || '');
  const payment = eventPaymentDate(event);
  const type = eventFamilyForDedupe(event);
  return ticker && payment ? [ticker, payment, type].join('|') : '';
}

function hasEvents(value = {}) {
  return Boolean(Array.isArray(value?.officialEvents) && value.officialEvents.length > 0);
}

function timeoutLike(d = {}) {
  const reason = String(d?.reason || d?.error || '').toLowerCase();
  return d?.status === 0 || reason.includes('timeout') || reason.includes('deadline') || reason.includes('aborted');
}

function buildDividendResult({
  payload = {},
  tickers = [],
  officialEvents = [],
  diagnostics = [],
  cacheStatus = 'LIVE',
  timedOut = false,
  agendaDeferred = false,
  skippedTickers = [],
  staleFallback = false
} = {}) {
  const portfolioStartDate = portfolioInceptionDate(
    payload.dividendPositions || payload.positions || [],
    payload.transactions || [],
    payload.portfolioStartDate || payload.firstPortfolioPurchaseDate || payload.portfolioInceptionDate
  );
  const normalizedPayload = portfolioStartDate ? { ...payload, portfolioStartDate } : payload;
  const enriched = eventsWithinRequestedWindow(officialEvents.map(e => enrichPortfolio(e, normalizedPayload)), normalizedPayload);
  const split = splitEvents(enriched);
  const excludedBeforePortfolioStart = enriched.filter(event => event.beforePortfolioStart).length;
  const portfolioReceived = split.paid.filter(e => e.eligible && e.withinPortfolioLifetime !== false);
  // Os aliases de carteira são estritamente personalizados: somente eventos cuja
  // posição na Data COM/Data EX foi comprovada podem alimentar Agenda e Proventos.
  // Eventos oficiais sem elegibilidade permanecem nos arrays official* para auditoria,
  // mas não entram nas páginas pessoais do usuário.
  const portfolioUpcoming = split.upcoming.filter(e => e.eligible && e.withinPortfolioLifetime !== false);
  const portfolioUpcomingAll = split.upcoming
    .filter(e => e.eligible && e.withinPortfolioLifetime !== false)
    .map(e => ({
      ...e,
      portfolioScope: 'eligible-position'
    }));
  const partial = Boolean(
    staleFallback ||
    timedOut ||
    agendaDeferred ||
    skippedTickers.length ||
    diagnostics.some(timeoutLike)
  );
  const emptyBecauseTimeout = officialEvents.length === 0 && partial;
  const sourceStatus = officialEvents.length
    ? (staleFallback ? 'STALE_DUE_TO_SOURCE_TIMEOUT' : (partial ? 'PARTIAL_LIVE_OR_CACHE' : 'LIVE_OR_CACHE'))
    : (emptyBecauseTimeout ? 'SOURCE_TIMEOUT' : 'EMPTY');
  return {
    status: officialEvents.length ? 'OK' : (emptyBecauseTimeout ? 'PARTIAL' : 'OK'),
    sourceStatus,
    sourcePolicy: 'STATUSINVEST_PRIMARY_PER_TICKER_PLUS_INVESTIDOR10_CALENDAR_COMPLEMENT_NO_DUPLICATES_STALE_IF_ERROR',
    cacheStatus,
    generatedAt: new Date().toISOString(),
    asOf: todayIso(),
    portfolioStartDate: portfolioStartDate || undefined,
    excludedBeforePortfolioStart,
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
      portfolioAgenda: portfolioUpcomingAll.length,
      excludedBeforePortfolioStart
    },
    diagnostics,
    warnings: [
      ...(timedOut || emptyBecauseTimeout ? ['Fonte StatusInvest/Investidor10 não concluiu dentro do deadline; resposta marcada como parcial.'] : []),
      ...(staleFallback ? ['Usando ultimo snapshot valido em cache porque a fonte oficial falhou ou expirou.'] : []),
      ...(agendaDeferred ? ['Agenda Investidor10 incompleta; mantendo eventos oficiais por ticker e cache disponivel.'] : []),
      ...(skippedTickers.length ? [`Tickers nao consultados antes do deadline: ${skippedTickers.slice(0, 12).join(', ')}${skippedTickers.length > 12 ? '...' : ''}`] : []),
      ...(excludedBeforePortfolioStart > 0 ? [`${excludedBeforePortfolioStart} evento(s) anterior(es) ao inicio da carteira foram mantidos apenas para auditoria oficial e removidos dos proventos pessoais.`] : [])
    ],
    partial,
    retryAfterMs: emptyBecauseTimeout ? 30000 : undefined
  };
}

function promoteStaleDividends(stale, reason = 'source-timeout', liveDiagnostics = []) {
  const value = stale?.value;
  if (!hasEvents(value)) return null;
  return {
    ...value,
    status: 'OK',
    sourceStatus: 'STALE_DUE_TO_SOURCE_TIMEOUT',
    cacheStatus: 'STALE',
    generatedAt: new Date().toISOString(),
    diagnostics: [
      ...(Array.isArray(value.diagnostics) ? value.diagnostics : []),
      ...liveDiagnostics,
      { provider: 'valorae-cache', status: 'STALE', reason, ageMs: stale.ageMs }
    ],
    warnings: [
      ...new Set([
        ...(Array.isArray(value.warnings) ? value.warnings : []),
        'Usando ultimo snapshot valido em cache porque StatusInvest/Investidor10 falharam ou excederam o deadline.'
      ])
    ],
    partial: true,
    retryAfterMs: 30000
  };
}

export const __testDedupeEvents = dedupeEvents;
export const __testBuildDividendResult = buildDividendResult;

export async function buildDividendsContract(payload = {}) {
  const tickers = dividendTickers(payload);
  const mode = payload.mode || 'mobile';
  if (tickers.length === 0) return emptyDividendContract(tickers);
  const cacheKey = `dividends-contract:${stableKey(dividendCacheSignature(payload, tickers, mode))}`;
  const cached = getCache(cacheKey, { allowStale: false });
  if (cached) return { ...cached.value, cacheStatus: cached.status };
  const staleCandidate = getCache(cacheKey, { allowStale: true });
  return coalesce(cacheKey, async () => {
    const startedAt = Date.now();
    const diagnostics = [];
    const all = [];
    const sourceName = String(payload.source || '').trim().toLowerCase();
    const recoveryMode = sourceName.startsWith('home-agenda-recovery');
    const visiblePageRecovery = recoveryMode || payload.preferVisiblePage === true;
    const defaultTimeout = recoveryMode ? 12500 : (mode === 'deep-background' || mode === 'deep' || mode === 'complete' ? 18000 : 11000);
    const timeoutMs = Number(payload.timeoutMs || payload.routeDeadlineMs || process.env.VALORAE_DIVIDENDS_TIMEOUT_MS || defaultTimeout);
    const overallDeadlineAt = startedAt + Math.max(4500, timeoutMs);
    const statusTimeout = Math.max(2200, Math.min(recoveryMode ? 10000 : 8500, Math.floor(timeoutMs * (recoveryMode ? 0.82 : 0.62))));
    const agendaTimeout = Math.max(2200, Math.min(Number(payload.agendaTimeoutMs || timeoutMs), Math.floor(timeoutMs * 0.78)));
    const requestedAgendaMonths = Number(payload.agendaMonthsAhead ?? payload.futureMonths ?? payload.monthsForward ?? 18);
    const agendaMonthsAhead = Math.max(0, Math.min(36, Number.isFinite(requestedAgendaMonths) ? Math.floor(requestedAgendaMonths) : 18));

    // Status Invest por ativo e agenda pública rodam em paralelo. A agenda agora recebe
    // deadline próprio para não continuar varrendo dezenas de páginas depois da resposta mobile.
    const includeCalendar = !recoveryMode && !['0', 'false', 'no', 'off'].includes(String(payload.includeCalendar ?? payload.includeAgenda ?? '1').toLowerCase());
    const agendaDeadlineAt = Math.min(overallDeadlineAt - 250, startedAt + agendaTimeout);
    const agendaPromise = includeCalendar ? getAgendaDividends(tickers, {
      timeoutMs: agendaTimeout,
      agendaTimeoutMs: agendaTimeout,
      futureMonths: agendaMonthsAhead,
      agendaMonthsAhead,
      agendaConcurrency: Number(payload.agendaConcurrency || 6),
      deadlineAt: agendaDeadlineAt,
      maxPages: Number(payload.agendaMaxPages || payload.maxAgendaPages || process.env.VALORAE_AGENDA_MAX_PAGES || (mode === 'deep-background' || mode === 'deep' || mode === 'complete' ? 96 : 64))
    }) : Promise.resolve({ events: [], diagnostics: [{ provider: 'investidor10-agenda', status: 'SKIPPED', reason: 'calendar-disabled' }] });

    const statusDeadlineAt = recoveryMode
      ? overallDeadlineAt - 250
      : Math.min(overallDeadlineAt - 350, startedAt + Math.max(3600, Math.floor(timeoutMs * 0.74)));
    const statusTickers = prioritizeDividendTickers(payload, tickers);
    const statusBatch = await mapLimitWithDeadline(
      statusTickers,
      statusInvestConcurrency(),
      statusDeadlineAt,
      (t, _index, remaining) => getConfirmedDividendsByTicker(t, {
        timeoutMs: Math.max(1400, Math.min(statusTimeout, remaining)),
        htmlTimeoutMs: Math.max(1200, Math.min(4200, remaining)),
        preferVisiblePage: visiblePageRecovery,
        completenessMode: true,
      })
    );
    const perTicker = statusBatch.results;
    if (statusBatch.timedOut || statusBatch.skipped.length) {
      diagnostics.push({
        provider: 'statusinvest',
        status: 'PARTIAL',
        reason: 'deadline-exceeded',
        skippedTickers: statusBatch.skipped,
        completed: perTicker.length,
        total: statusTickers.length
      });
    }

    for (const item of perTicker) {
      all.push(...(item.events || []));
      diagnostics.push(...(Array.isArray(item.diagnostics) ? item.diagnostics : [item.diagnostics].filter(Boolean)));
    }
    const remainingForAgenda = overallDeadlineAt - Date.now() - 150;
    let agendaDeferred = false;
    const agenda = remainingForAgenda > 300
      ? await withSoftTimeout(
          agendaPromise,
          remainingForAgenda,
          { __timeout: true, events: [], diagnostics: [{ provider: 'investidor10-agenda', status: 'PARTIAL', reason: 'deadline-exceeded' }] }
        )
      : { __timeout: true, events: [], diagnostics: [{ provider: 'investidor10-agenda', status: 'PARTIAL', reason: 'deadline-exceeded' }] };
    if (agenda?.__timeout || agenda?.partial) agendaDeferred = true;
    all.push(...(agenda.events || []).filter(e => e.paymentDate || e.dateCom || e.exDate));
    diagnostics.push(...(agenda.diagnostics || []));

    const officialEvents = dedupeEvents(all);
    const duplicateSourceEvents = Math.max(0, all.filter(e => e && (e.ticker || e.symbol)).length - officialEvents.length);
    diagnostics.push({
      provider: 'valorae-dedupe',
      status: 'OK',
      sourcePolicy: recoveryMode
        ? 'Recuperacao mobile v4: cobertura completa por lotes no APK; pagina publica e endpoint JSON do StatusInvest unidos por ativo; anuncios futuros sem corte artificial; calendario publico pesado desativado.'
        : 'StatusInvest primario por ativo; Investidor10 apenas complemento de calendario.',
      removedDuplicates: duplicateSourceEvents,
      message: duplicateSourceEvents > 0
        ? 'Eventos repetidos reconciliados por ticker, familia, Data COM/pagamento e valores bruto/liquido antes de responder ao APK.'
        : 'Nenhuma duplicidade detectada apos a reconciliacao semantica das fontes.'
    });
    const isPartial = Boolean(
      statusBatch.timedOut ||
      agendaDeferred ||
      statusBatch.skipped.length ||
      diagnostics.some(timeoutLike)
    );

    if (officialEvents.length === 0 && isPartial) {
      const stale = promoteStaleDividends(staleCandidate, 'live-source-timeout', diagnostics);
      if (stale) return stale;
    }

    const result = buildDividendResult({
      payload,
      tickers,
      officialEvents,
      diagnostics,
      cacheStatus: 'LIVE',
      timedOut: statusBatch.timedOut || isPartial,
      agendaDeferred,
      skippedTickers: statusBatch.skipped
    });

    if (officialEvents.length > 0) {
      setCache(cacheKey, result, mode === 'deep-background' || mode === 'deep' || mode === 'complete' ? 10 * 60 * 1000 : (isPartial ? 2 * 60 * 1000 : 6 * 60 * 1000), 48 * 60 * 60 * 1000);
    } else if (!isPartial) {
      setCache(cacheKey, result, 90 * 1000, 10 * 60 * 1000);
    }
    return result;
  });
}
