import { ValoraeEngine, canonicalizeTicker, validarTicker, inferAssetType, isKnownB3Unit } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { fetchInvestidor10DividendAgenda } from '../../lib/market/investidor10-dividend-agenda.js';
import { beginRoute, boolParam, parseList, clampNumber, resolveSelfScrapeUrl, sendRouteError, withRouteDeadline } from '../../lib/http/route.js';
import { coalesce } from '../../lib/resilience/inflight.js';
import {
  eventKey,
  normalizeDividendEvent,
  dividendHistoryFromAsset,
  normalizeAgendaAssetClass,
  eventDate,
  splitOfficialByPaymentStatus,
  splitByPortfolio,
} from '../../lib/portfolio/dividends-contract.js';

const MAX_TICKERS = Number(process.env.VALORAE_DIVIDENDS_BATCH_MAX_TICKERS || process.env.VALORAE_PORTFOLIO_DIVIDENDS_MAX_TICKERS || 45);
const officialDividendCache = globalThis.__VALORAE_OFFICIAL_DIVIDEND_CACHE__ || new Map();
globalThis.__VALORAE_OFFICIAL_DIVIDEND_CACHE__ = officialDividendCache;
const OFFICIAL_CACHE_TTL_MS = Number(process.env.VALORAE_OFFICIAL_DIVIDEND_TTL_MS || 24 * 60 * 60 * 1000);
const OFFICIAL_CACHE_STALE_MS = Number(process.env.VALORAE_OFFICIAL_DIVIDEND_STALE_MS || 7 * 24 * 60 * 60 * 1000);

function cacheSetEvents(events = []) {
  const now = Date.now();
  for (const event of events) {
    const ticker = canonicalizeTicker(event.ticker);
    if (!ticker) continue;
    const entry = officialDividendCache.get(ticker) || { events: [], expiresAt: 0, staleAt: 0 };
    const byKey = new Map((entry.events || []).map(e => [eventKey(e), e]));
    byKey.set(eventKey(event), event);
    officialDividendCache.set(ticker, { events: [...byKey.values()].slice(-900), expiresAt: now + OFFICIAL_CACHE_TTL_MS, staleAt: now + OFFICIAL_CACHE_STALE_MS });
  }
  if (officialDividendCache.size > 500) officialDividendCache.clear();
}

function cacheGetEvents(ticker = '') {
  const entry = officialDividendCache.get(canonicalizeTicker(ticker));
  if (!entry) return { events: [], status: 'MISS' };
  const now = Date.now();
  if (entry.expiresAt >= now) return { events: entry.events || [], status: 'HIT' };
  if (entry.staleAt >= now) return { events: entry.events || [], status: 'STALE' };
  officialDividendCache.delete(canonicalizeTicker(ticker));
  return { events: [], status: 'MISS' };
}

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET', 'POST'], route: 'dividends-batch', rateMax: Number(process.env.VALORAE_RATE_LIMIT_DIVIDENDS_MAX || 90), profile: 'dividends' });
  if (route.done) return;
  try {
    const q = route.input;
    const positionTickers = Array.isArray(q.positions) ? q.positions.map(p => p?.ticker).filter(Boolean) : [];
    let raw = parseList(q.tickers || q.ticker || positionTickers.join(',')).map(String).map(s => s.trim()).filter(Boolean);
    if (!raw.length) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: 'Envie tickers=PETR4,GARE11 ou positions=[...]' }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'dividends' });
    const warnings = [];
    if (raw.length > MAX_TICKERS) {
      warnings.push({ scope: 'dividends-batch', message: `Carteira com ${raw.length} tickers; processando ${MAX_TICKERS} para preservar deadline.` });
      raw = raw.slice(0, MAX_TICKERS);
    }
    const errors = [];
    const tickers = [];
    for (const item of raw) {
      const t = canonicalizeTicker(item);
      const err = validarTicker(t);
      if (err) errors.push({ ticker: item, error: err }); else tickers.push(t);
    }
    const compactMode = ['compact','boot','fast','mobile'].includes(String(q.mode || q.profile || '').toLowerCase());
    const deepMode = boolParam(q.deep || q.deepSync || q.complete, false) || /deep|background|complete/i.test(String(q.mode || ''));
    const routeDeadlineMs = clampNumber(q.routeDeadlineMs || q.deadlineMs, compactMode && !deepMode ? 7200 : 14500, 1200, 22000);
    const historyMonths = clampNumber(q.historyMonths || q.monthsBack || q.pastMonths, deepMode ? 48 : 24, 0, 72);
    const futureMonths = clampNumber(q.futureMonths || q.monthsForward || q.horizonMonths, deepMode ? 24 : 18, 0, 72);
    const agendaOptions = {
      timeoutMs: clampNumber(q.timeoutMs || q.agendaTimeoutMs, compactMode && !deepMode ? 3200 : 9000, 600, 20000),
      historyMonths,
      futureMonths,
      startDate: q.startDate || q.portfolioCreatedAt || q.createdAt,
      concurrency: clampNumber(q.agendaConcurrency || q.concurrency, compactMode ? 5 : 5, 1, 8),
      futureFirst: boolParam(q.futureFirst || q.prioritizeFuture || q.upcomingFirst, true),
      priority: q.priority || q.priorityMode || 'upcoming-first',
      assetClass: normalizeAgendaAssetClass(q.assetClass || q.type || q.classe),
      deadlineMs: Math.max(1200, routeDeadlineMs - 650),
    };

    const cachedOfficial = tickers.flatMap(t => cacheGetEvents(t).events);
    const cacheStates = tickers.map(t => cacheGetEvents(t).status);
    const batchPromise = boolParam(q.includeAssets || q.includeAssetHistory || q.complete, deepMode)
      ? withRouteDeadline(() => ValoraeEngine.fetchAtivosBatch(tickers, { mode: compactMode ? 'turbo' : (q.mode || 'super'), includeNews: false, view: 'compact', maxConcurrency: 4, cache: !boolParam(q.nocache || q.refresh), valoraeScrapeUrl: resolveSelfScrapeUrl(req, q), profile: q.profile || 'dividends', timeoutMs: compactMode ? 1800 : 4500, continueOnError: true }), Math.max(900, Math.min(routeDeadlineMs - 1200, compactMode ? 2200 : 5200)), () => ({ assets: [], stats: { partial: true, timeout: true }, errors: [{ scope: 'fetchAtivosBatch', error: 'deadline' }] }))
      : Promise.resolve({ assets: [], stats: {}, errors: [] });
    const agendaPromise = withRouteDeadline(
      () => coalesce(`dividends:${tickers.slice().sort().join(',')}:${historyMonths}:${futureMonths}:${agendaOptions.assetClass || 'ALL'}:${deepMode ? 'deep' : 'fast'}`, () => fetchInvestidor10DividendAgenda(tickers, agendaOptions)),
      Math.max(900, routeDeadlineMs - 500),
      () => ({ events: cachedOfficial, diagnostics: [{ level: 'warning', message: `Agenda excedeu deadline de ${routeDeadlineMs}ms; usando cache oficial disponível.` }], range: agendaOptions, partial: true, cacheStatus: cachedOfficial.length ? 'STALE' : 'MISS' })
    ).catch(err => ({ events: cachedOfficial, diagnostics: [{ level: 'warning', message: err?.message || String(err) }], range: agendaOptions, partial: true, cacheStatus: cachedOfficial.length ? 'STALE' : 'MISS' }));

    const [batch, agenda] = await Promise.all([batchPromise, agendaPromise]);
    const fromAgenda = (agenda.events || []).map(e => normalizeDividendEvent(e, e.ticker, 'Provento'));
    const agendaEmptyButCacheExists = fromAgenda.length === 0 && cachedOfficial.length > 0;
    const fromAssets = (batch.assets || []).flatMap(asset => dividendHistoryFromAsset(asset).map(row => normalizeDividendEvent(row, asset.ticker, 'Recebido')));
    const officialByKey = new Map();
    [...cachedOfficial, ...fromAgenda, ...fromAssets]
      .filter(e => e?.ticker && (e.dateCom || e.paymentDate || e.valuePerShare > 0))
      .forEach(e => officialByKey.set(eventKey(e), e));
    const officialEvents = [...officialByKey.values()].sort((a, b) => (eventDate(a, 'payment')?.getTime() || 0) - (eventDate(b, 'payment')?.getTime() || 0));
    cacheSetEvents(officialEvents);
    const assetHistory = tickers.map(t => ({ ticker: t, assetType: isKnownB3Unit(t) ? 'ACAO_UNIT' : inferAssetType(t), events: officialEvents.filter(e => canonicalizeTicker(e.ticker) === t), count: officialEvents.filter(e => canonicalizeTicker(e.ticker) === t).length }));
    const officialStatusBlocks = splitOfficialByPaymentStatus(officialEvents);
    const { portfolioReceived, portfolioUpcoming } = splitByPortfolio(officialEvents, Array.isArray(q.positions) ? q.positions : []);
    const cacheStatus = agenda.cacheStatus || (cacheStates.includes('HIT') ? 'HIT' : cacheStates.includes('STALE') ? 'STALE' : officialEvents.length ? 'LIVE' : 'MISS');

    return sendJson(req, res, {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      endpoint: 'dividends-batch',
      officialEvents,
      officialPaidEvents: officialStatusBlocks.officialPaidEvents,
      officialFutureEvents: officialStatusBlocks.officialFutureEvents,
      officialAnnouncedEvents: officialStatusBlocks.officialAnnouncedEvents,
      officialUpcomingEvents: officialStatusBlocks.officialUpcomingEvents,
      allOfficialFuturePayments: officialStatusBlocks.officialUpcomingEvents,
      assetHistory,
      portfolioReceived,
      portfolioUpcoming,
      portfolioReceivedDividends: portfolioReceived,
      portfolioUpcomingDividends: portfolioUpcoming,
      events: officialEvents,
      dividends: officialEvents,
      proventos: officialEvents,
      diagnostics: {
        warnings,
        inputErrors: errors,
        agenda: agenda.diagnostics || [],
        batchErrors: batch.errors || [],
      },
      partial: !!agenda.partial || !!batch.stats?.partial || agendaEmptyButCacheExists,
      cacheStatus,
      sourceStatus: cacheStatus === 'LIVE' ? 'Proxy ao vivo' : cacheStatus === 'HIT' ? 'Cache oficial fresco' : cacheStatus === 'STALE' ? 'Cache oficial stale' : 'Sem cache oficial',
      counts: { officialEvents: officialEvents.length, officialFutureEvents: officialStatusBlocks.officialFutureEvents.length, officialAnnouncedEvents: officialStatusBlocks.officialAnnouncedEvents.length, assetHistory: assetHistory.length, portfolioReceived: portfolioReceived.length, portfolioUpcoming: portfolioUpcoming.length },
      agendaRange: agenda.range || agendaOptions,
      deadlineMs: routeDeadlineMs,
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'dividends', cacheControl: 'private, max-age=30, stale-while-revalidate=600' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'dividends' });
  }
}
