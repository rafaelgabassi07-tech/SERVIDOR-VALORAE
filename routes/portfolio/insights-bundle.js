import { analyzePortfolio } from '../../lib/portfolio/analytics.js';
import { buildPortfolioHistory, normalizePortfolioPositions } from '../../lib/portfolio/history.js';
import { fetchIpca } from '../../lib/market/bcb.js';
import { fetchInvestidor10DividendAgenda, parseAgendaDate } from '../../lib/market/investidor10-dividend-agenda.js';
import { fetchAndCompareTickers } from '../../lib/market/compare.js';
import { ValoraeEngine, canonicalizeTicker, validarTicker, inferAssetType, isKnownB3Unit } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, boolParam, clampNumber, resolveSelfScrapeUrl, sendRouteError, withRouteDeadline } from '../../lib/http/route.js';
import { coalesce } from '../../lib/resilience/inflight.js';

const MAX_POSITIONS = Number(process.env.VALORAE_PORTFOLIO_INSIGHTS_MAX_POSITIONS || 45);
const MAX_RANKING_TICKERS = Number(process.env.VALORAE_PORTFOLIO_INSIGHTS_RANKING_MAX_TICKERS || 15);
const INSIGHTS_BUNDLE_VERSION = '21.12.88';

function firstText(...values) {
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}
function firstNumber(...values) {
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v).replace(/R\$/gi, '').replace(/%/g, '').trim();
    const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
    const n = Number(normalized);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}
function parseBRDate(d) {
  const s = String(d || '').trim();
  const br = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/);
  if (br) {
    const y = String(br[3]).length === 2 ? `20${br[3]}` : br[3];
    const out = new Date(`${y}-${String(br[2]).padStart(2, '0')}-${String(br[1]).padStart(2, '0')}T00:00:00Z`);
    return Number.isFinite(out.getTime()) ? out : null;
  }
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
  return null;
}
function eventKey(e = {}) {
  return [e.ticker, e.dateCom, e.paymentDate, e.type, Number(e.valuePerShare || 0).toFixed(8)].join('|').toUpperCase();
}
function normalizeDividendEvent(row = {}, ticker = '', status = '') {
  const tickerOut = firstText(row.ticker, row.symbol, row.codigo, ticker).toUpperCase();
  const valuePerShare = firstNumber(row.valuePerShare, row.valorPorCota, row.valorPorAcao, row.valor, row.value, row.amount, row.dividend, row.rendimento, row.provento, row.cashAmount);
  const type = firstText(row.type, row.tipo, row.kind, row.eventType, 'Provento');
  const dateCom = firstText(row.dateCom, row.comDate, row.dataCom, row.data_com, row.recordDate, row.exDate, row.dataBase, row.baseDate);
  const paymentDate = firstText(row.paymentDate, row.payDate, row.dataPagamento, row.data_pagamento, row.pagamento, row.pgto, row.date, row.data);
  const confirmed = Boolean(paymentDate && valuePerShare > 0);
  const assetType = isKnownB3Unit(tickerOut) ? 'ACAO_UNIT' : firstText(row.assetType, row.assetClass, inferAssetType(tickerOut));
  return {
    ticker: tickerOut,
    dateCom,
    comDate: dateCom,
    paymentDate,
    payDate: paymentDate,
    valuePerShare,
    value: valuePerShare,
    amount: valuePerShare,
    type,
    kind: type,
    status: firstText(row.status, status, confirmed ? 'Confirmado' : 'Anunciado/Provisionado'),
    paymentStatus: confirmed ? 'CONFIRMED' : 'ANNOUNCED',
    announced: Boolean(dateCom || paymentDate || valuePerShare > 0),
    confirmed,
    provisioned: !confirmed,
    assetType,
    assetClass: assetType === 'FII' ? 'FII' : 'ACAO',
    source: firstText(row.source, 'Investidor10/VALORAE'),
  };
}
function eventDate(e = {}, kind = 'payment') {
  const value = kind === 'eligibility'
    ? firstText(e.dateCom, e.comDate, e.dataCom, e.recordDate, e.dataBase, e.paymentDate, e.payDate, e.dataPagamento)
    : firstText(e.paymentDate, e.payDate, e.dataPagamento, e.date, e.data, e.dateCom, e.comDate, e.dataCom);
  return parseBRDate(value) || parseAgendaDate(value);
}
function eventPaymentDate(e = {}) {
  const value = firstText(e.paymentDate, e.payDate, e.dataPagamento, e.data_pagamento, e.dataPagamentoPrevista, e.dataPagto, e.pagamento, e.pgto);
  return parseBRDate(value) || parseAgendaDate(value);
}
function pendingOrAnnouncedDividend(e = {}) {
  const status = firstText(e.status, e.paymentStatus, e.type, e.kind).toLowerCase();
  const source = firstText(e.source, e.fonte).toLowerCase();
  const hasNoPaymentDate = !eventPaymentDate(e);
  if (!hasNoPaymentDate) return false;
  return /prev|futur|agenda|provision|anunci|a confirmar|sem data|confirm/.test(status) ||
    /agenda|provision/.test(source) ||
    Boolean(firstText(e.dateCom, e.comDate, e.dataCom, e.recordDate, e.dataBase) || Number(e.valuePerShare || 0) > 0 || Number(e.estimatedAmount || 0) > 0);
}
function eligibleByDateCom(pos = {}, eligibilityDate = null) {
  const firstPurchaseAt = Number(pos?.firstPurchaseAt || 0);
  return !firstPurchaseAt || !eligibilityDate || firstPurchaseAt <= eligibilityDate.getTime() + 86_399_999;
}
function splitOfficialByPaymentStatus(events = []) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const paid = [];
  const future = [];
  const announced = [];
  for (const e of events || []) {
    const paymentDate = eventPaymentDate(e);
    if (paymentDate && paymentDate < today && !pendingOrAnnouncedDividend(e)) {
      paid.push(e);
    } else if (paymentDate && paymentDate >= today) {
      future.push(e);
    } else if (pendingOrAnnouncedDividend(e) || !paymentDate) {
      announced.push(e);
    }
  }
  return { officialPaidEvents: paid, officialFutureEvents: future, officialAnnouncedEvents: announced, officialUpcomingEvents: [...future, ...announced] };
}
function splitByPortfolio(events = [], positions = []) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const positionsByTicker = new Map((positions || []).map(p => [canonicalizeTicker(p.ticker), p]));
  const received = [];
  const upcoming = [];
  for (const e of events) {
    const pos = positionsByTicker.get(canonicalizeTicker(e.ticker));
    const quantity = firstNumber(pos?.quantity, e.quantity);
    const paymentDate = eventPaymentDate(e);
    const displayDate = paymentDate || eventDate(e, 'payment');
    const eligibilityDate = eventDate(e, 'eligibility') || displayDate;
    const hasPaymentDate = Boolean(paymentDate);
    const isPastPaid = hasPaymentDate && paymentDate < today && !pendingOrAnnouncedDividend(e);
    // Data Com/record date define elegibilidade; data de pagamento define
    // Evolução x Agenda. Sem data de pagamento confirmada, permanece Agenda.
    const eligible = eligibleByDateCom(pos, eligibilityDate);
    const amount = quantity > 0 && Number(e.valuePerShare || 0) > 0 ? Number((quantity * Number(e.valuePerShare || 0)).toFixed(2)) : firstNumber(e.estimatedAmount, e.totalAmount, e.grossAmount);
    const out = { ...e, quantity, estimatedAmount: amount, totalAmount: amount, eligibilityDate: eligibilityDate ? eligibilityDate.toISOString().slice(0, 10) : undefined };
    if (isPastPaid) {
      if (eligible) received.push({ ...out, originalStatus: out.status, status: 'Recebido', portfolioBlock: 'received' });
    } else if (quantity > 0 && eligible) {
      const nextStatus = hasPaymentDate ? 'Previsto' : firstText(out.status, 'Anunciado/Provisionado');
      upcoming.push({ ...out, originalStatus: out.status, status: nextStatus, portfolioBlock: 'upcoming' });
    }
  }
  return { portfolioReceived: received, portfolioUpcoming: upcoming };
}
function normalizeEvents(rawEvents = [], positions = []) {
  const byKey = new Map();
  for (const row of rawEvents || []) {
    const event = normalizeDividendEvent(row, row?.ticker || row?.symbol || '', row?.status || 'Provento');
    if (!event.ticker || (!event.dateCom && !event.paymentDate && !event.valuePerShare)) continue;
    byKey.set(eventKey(event), event);
  }
  const officialEvents = [...byKey.values()].sort((a, b) => (eventDate(a, 'payment')?.getTime() || 0) - (eventDate(b, 'payment')?.getTime() || 0));
  const assetHistory = [...new Set(positions.map(p => canonicalizeTicker(p.ticker)).filter(Boolean))].map(ticker => {
    const events = officialEvents.filter(e => canonicalizeTicker(e.ticker) === ticker);
    const type = isKnownB3Unit(ticker) ? 'ACAO_UNIT' : inferAssetType(ticker);
    return { ticker, assetType: type, assetClass: type === 'FII' ? 'FII' : 'ACAO', events, history: events, count: events.length };
  });
  const officialStatusBlocks = splitOfficialByPaymentStatus(officialEvents);
  return { officialEvents, assetHistory, ...officialStatusBlocks, ...splitByPortfolio(officialEvents, positions) };
}
function sanitizeRanking(data = {}, tickers = []) {
  const ranking = Array.isArray(data.ranking) ? data.ranking : [];
  const score = Array.isArray(data.rankings?.score) ? data.rankings.score : ranking.slice(0, 10).map((x, i) => ({ rank: i + 1, ticker: x.ticker, value: x.score, score: x.score, grade: x.grade }));
  return {
    ok: Boolean(data.version || ranking.length || score.length),
    version: data.version || ValoraeEngine.version,
    source: 'valorae-compare-portfolio-bundle',
    requested: data.requested || tickers,
    ranking,
    score,
    highs: Array.isArray(data.highs) ? data.highs : [],
    lows: Array.isArray(data.lows) ? data.lows : [],
    profiles: data.profiles || {},
    winnerByCriterion: data.winnerByCriterion || {},
    count: data.count || ranking.length || score.length,
    errors: data.errors || [],
    stats: data.stats || {},
    partial: Boolean(data.partial || data.stats?.partial),
  };
}
function compactWarnings(...items) {
  return items.flatMap(item => Array.isArray(item) ? item : item ? [item] : []).map(x => typeof x === 'string' ? x : firstText(x?.message, x?.error, JSON.stringify(x))).filter(Boolean).slice(0, 12);
}

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET', 'POST'], route: 'portfolio-insights-bundle', rateMax: Number(process.env.VALORAE_RATE_LIMIT_PORTFOLIO_MAX || 60), profile: 'portfolio' });
  if (route.done) return;
  try {
    const q = route.input;
    const positionsRaw = normalizePortfolioPositions(q);
    if (!positionsRaw.length) {
      return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: 'Envie positions=[...] com ticker, quantity e averagePrice.' }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'portfolio' });
    }
    const compactMode = ['mobile', 'fast', 'compact', 'boot'].includes(String(q.mode || q.profile || q.performance || '').toLowerCase());
    const deepMode = boolParam(q.deep || q.deepSync || q.complete || q.full, false) || /deep|background|complete|full/i.test(String(q.mode || ''));
    const includeRankings = !['0', 'false', 'no', 'nao', 'não'].includes(String(q.includeRankings ?? q.rankings ?? '1').toLowerCase());
    const includeDividends = !['0', 'false', 'no', 'nao', 'não'].includes(String(q.includeDividends ?? q.dividends ?? '1').toLowerCase());
    const warnings = [];
    const positions = positionsRaw.length > MAX_POSITIONS ? positionsRaw.slice(0, MAX_POSITIONS) : positionsRaw;
    if (positionsRaw.length > MAX_POSITIONS) warnings.push({ scope: 'portfolio-insights-bundle', message: `Carteira com ${positionsRaw.length} ativos; processando ${MAX_POSITIONS} para preservar deadline mobile.` });
    const dividendInputPositions = Array.isArray(q.dividendPositions) && q.dividendPositions.length ? q.dividendPositions : positionsRaw;
    const dividendPositionsRaw = normalizePortfolioPositions({ positions: dividendInputPositions });
    const dividendPositions = dividendPositionsRaw.length > MAX_POSITIONS ? dividendPositionsRaw.slice(0, MAX_POSITIONS) : dividendPositionsRaw;
    if (dividendPositionsRaw.length > MAX_POSITIONS) warnings.push({ scope: 'portfolio-insights-bundle-dividends', message: `Agenda recebeu ${dividendPositionsRaw.length} ativos; processando ${MAX_POSITIONS} tickers balanceados.` });
    const tickers = [...new Set(positions.map(p => canonicalizeTicker(p.ticker)).filter(Boolean))];
    const dividendTickers = [...new Set([
      ...dividendPositions.map(p => canonicalizeTicker(p.ticker)),
      ...String(q.dividendTickers || '').split(',').map(s => canonicalizeTicker(s.trim()))
    ].filter(Boolean))];
    const inputErrors = [];
    const cleanTickers = [];
    for (const item of tickers) {
      const err = validarTicker(item);
      if (err) inputErrors.push({ ticker: item, error: err }); else cleanTickers.push(item);
    }
    const cleanDividendTickers = [];
    for (const item of (dividendTickers.length ? dividendTickers : tickers)) {
      const err = validarTicker(item);
      if (err) inputErrors.push({ ticker: item, error: err }); else cleanDividendTickers.push(item);
    }
    const range = firstText(q.range, '1Y');
    const months = clampNumber(q.months || q.last || q.ipcaMonths, 12, 1, 120);
    const routeDeadlineMs = clampNumber(q.routeDeadlineMs || q.deadlineMs, deepMode ? 15000 : 7800, 1200, 22000);
    const cache = !boolParam(q.nocache || q.refresh, false);
    const signature = JSON.stringify({ p: positions.map(p => [canonicalizeTicker(p.ticker), Number(p.quantity || 0), Number(p.averagePrice || 0), Number(p.firstPurchaseAt || 0)]), d: dividendPositions.map(p => [canonicalizeTicker(p.ticker), Number(p.quantity || 0), Number(p.firstPurchaseAt || 0)]), range, months, deepMode, includeRankings, includeDividends });
    const out = await coalesce(`portfolio-insights-bundle:${signature}`, async () => {
      const commonProfile = q.profile || (compactMode ? 'mobile' : 'portfolio');
      const analysisPromise = withRouteDeadline(
        () => analyzePortfolio({ ...q, positions }, {
          view: q.view || 'standard',
          assetView: q.assetView || 'compact',
          cache,
          bypassCache: !cache,
          maxConcurrency: clampNumber(q.maxConcurrency || q.concurrency, compactMode ? 3 : 4, 1, 6),
          valoraeScrapeUrl: resolveSelfScrapeUrl(req, q),
          profile: commonProfile,
        }),
        Math.min(routeDeadlineMs - 600, deepMode ? 8500 : 3200),
        () => ({ ok: false, partial: true, status: 'PARTIAL', warnings: [`Análise excedeu deadline do bundle; APK deve manter cache local.`] })
      ).catch(err => ({ ok: false, partial: true, warnings: [err?.message || String(err)] }));

      const historyPromise = withRouteDeadline(
        () => buildPortfolioHistory(positions, { range, timeoutMs: deepMode ? 9000 : 2800, maxConcurrency: compactMode ? 3 : 4, limit: clampNumber(q.limit, 370, 60, 900) }),
        Math.min(routeDeadlineMs - 500, deepMode ? 9500 : 3400),
        () => ({ ok: false, partial: true, points: [], history: [], series: [], warnings: [`Histórico excedeu deadline do bundle; APK deve usar histórico local/cache.`] })
      ).catch(err => ({ ok: false, partial: true, points: [], history: [], series: [], warnings: [err?.message || String(err)] }));

      const ipcaPromise = withRouteDeadline(
        () => fetchIpca({ last: months, timeoutMs: deepMode ? 6000 : 1600, bypassCache: !cache, cache }),
        Math.min(routeDeadlineMs - 800, deepMode ? 6200 : 1900),
        () => ({ ok: false, partial: true, points: [], series: [], items: [], warnings: [`IPCA excedeu deadline do bundle; APK deve usar cache/fallback.`] })
      ).catch(err => ({ ok: false, partial: true, points: [], series: [], items: [], warnings: [err?.message || String(err)] }));

      const dividendsPromise = includeDividends ? withRouteDeadline(
        () => fetchInvestidor10DividendAgenda(cleanDividendTickers, {
          timeoutMs: deepMode ? 11000 : 3600,
          historyMonths: clampNumber(q.historyMonths || q.monthsBack || q.pastMonths, deepMode ? 48 : 24, 0, 72),
          futureMonths: clampNumber(q.futureMonths || q.monthsForward || q.horizonMonths, deepMode ? 24 : 18, 0, 72),
          startDate: q.startDate || q.portfolioCreatedAt || q.createdAt,
          concurrency: clampNumber(q.agendaConcurrency || q.concurrency, compactMode ? 5 : 5, 1, 8),
          futureFirst: true,
          priority: 'upcoming-first',
          deadlineMs: Math.min(routeDeadlineMs - 700, deepMode ? 12500 : 5200),
        }),
        Math.min(routeDeadlineMs - 500, deepMode ? 13000 : 5600),
        () => ({ ok: false, partial: true, events: [], diagnostics: [{ level: 'warning', message: `Agenda de dividendos excedeu deadline do bundle; APK deve preservar cache oficial.` }] })
      ).catch(err => ({ ok: false, partial: true, events: [], diagnostics: [{ level: 'warning', message: err?.message || String(err) }] })) : Promise.resolve({ ok: true, events: [], diagnostics: [] });

      const rankingsPromise = includeRankings ? withRouteDeadline(
        () => fetchAndCompareTickers(cleanTickers.slice(0, MAX_RANKING_TICKERS), {
          view: deepMode ? 'full' : 'compact',
          maxConcurrency: clampNumber(q.rankingConcurrency || q.maxConcurrency, deepMode ? 2 : 3, 1, 5),
          cache,
          valoraeScrapeUrl: resolveSelfScrapeUrl(req, q),
          profile: deepMode ? 'deep' : 'portfolio',
          complete: deepMode,
          timeoutMs: deepMode ? 9000 : 3300,
        }),
        Math.min(routeDeadlineMs - 400, deepMode ? 10000 : 3600),
        () => ({ ok: false, partial: true, ranking: [], rankings: {}, warnings: [`Rankings excederam deadline do bundle; APK deve preservar último ranking/cache.`] })
      ).catch(err => ({ ok: false, partial: true, ranking: [], rankings: {}, warnings: [err?.message || String(err)] })) : Promise.resolve({ ok: true, ranking: [], rankings: {} });

      const [analysis, history, ipca, dividendsRaw, rankingsRaw] = await Promise.all([analysisPromise, historyPromise, ipcaPromise, dividendsPromise, rankingsPromise]);
      const dividends = normalizeEvents(dividendsRaw.events || dividendsRaw.items || [], dividendPositions.length ? dividendPositions : positions);
      const ranking = sanitizeRanking(rankingsRaw, cleanTickers.slice(0, MAX_RANKING_TICKERS));
      const historyPoints = history.points || history.history || history.series || [];
      const ipcaPoints = ipca.points || ipca.series || ipca.items || [];
      const blockStatus = {
        analysis: { ok: analysis?.ok !== false, partial: Boolean(analysis?.partial), count: Array.isArray(analysis?.assets) ? analysis.assets.length : undefined },
        history: { ok: historyPoints.length > 0, partial: Boolean(history?.partial), count: historyPoints.length },
        ipca: { ok: ipcaPoints.length > 0, partial: Boolean(ipca?.partial), count: ipcaPoints.length },
        dividends: { ok: dividends.officialEvents.length > 0, partial: Boolean(dividendsRaw?.partial), count: dividends.officialEvents.length },
        rankings: { ok: ranking.count > 0, partial: Boolean(ranking.partial || rankingsRaw?.partial), count: ranking.count },
      };
      const partial = Object.values(blockStatus).some(s => s.partial) || !blockStatus.history.ok || !blockStatus.ipca.ok || (includeRankings && !blockStatus.rankings.ok);
      return {
        version: ValoraeEngine.version,
        bundleVersion: INSIGHTS_BUNDLE_VERSION,
        requestId: route.requestId,
        endpoint: 'portfolio-insights-bundle',
        ok: true,
        partial,
        mode: deepMode ? 'deep-background' : 'mobile',
        cachePolicy: 'single-request-coalesced-stale-first-mobile',
        warnings: compactWarnings(warnings, inputErrors, analysis?.warnings, history?.warnings, ipca?.warnings, dividendsRaw?.diagnostics, rankingsRaw?.warnings),
        blockStatus,
        counts: {
          positions: positions.length,
          dividendPositions: dividendPositions.length,
          dividendTickers: cleanDividendTickers.length,
          truncatedPositions: Math.max(0, positionsRaw.length - positions.length),
          historyPoints: historyPoints.length,
          ipcaPoints: ipcaPoints.length,
          officialDividendEvents: dividends.officialEvents.length,
          officialFutureEvents: dividends.officialFutureEvents.length,
          officialAnnouncedEvents: dividends.officialAnnouncedEvents.length,
          portfolioReceivedDividends: dividends.portfolioReceived.length,
          portfolioUpcomingDividends: dividends.portfolioUpcoming.length,
          rankingItems: ranking.count,
        },
        analysis,
        portfolioAnalysis: analysis,
        allocation: analysis?.allocation,
        history,
        portfolioHistory: historyPoints,
        points: historyPoints,
        ipca: { ...ipca, points: ipcaPoints, series: ipcaPoints, items: ipcaPoints },
        ipcaSeries: ipcaPoints,
        dividends: {
          officialEvents: dividends.officialEvents,
          officialPaidEvents: dividends.officialPaidEvents,
          officialFutureEvents: dividends.officialFutureEvents,
          officialAnnouncedEvents: dividends.officialAnnouncedEvents,
          officialUpcomingEvents: dividends.officialUpcomingEvents,
          allOfficialFuturePayments: dividends.officialUpcomingEvents,
          assetHistory: dividends.assetHistory,
          portfolioReceived: dividends.portfolioReceived,
          portfolioUpcoming: dividends.portfolioUpcoming,
          portfolioReceivedDividends: dividends.portfolioReceived,
          portfolioUpcomingDividends: dividends.portfolioUpcoming,
          events: dividends.officialEvents,
          diagnostics: dividendsRaw?.diagnostics || [],
          partial: Boolean(dividendsRaw?.partial),
        },
        officialDividendEvents: dividends.officialEvents,
        officialPaidEvents: dividends.officialPaidEvents,
        officialFutureEvents: dividends.officialFutureEvents,
        officialAnnouncedEvents: dividends.officialAnnouncedEvents,
        officialUpcomingEvents: dividends.officialUpcomingEvents,
        allOfficialFuturePayments: dividends.officialUpcomingEvents,
        assetDividendHistory: dividends.assetHistory,
        portfolioReceivedDividends: dividends.portfolioReceived,
        portfolioUpcomingDividends: dividends.portfolioUpcoming,
        dividendEvents: dividends.officialEvents,
        rankings: { portfolio: ranking, market: null },
        portfolioRanking: ranking,
        sourceStatus: partial ? 'Parcial/cache-first' : 'Completo/live-cache',
        deadlineMs: routeDeadlineMs,
      };
    });
    return sendJson(req, res, out, { status: 200, engineVersion: ValoraeEngine.version, profile: 'portfolio', cacheControl: 'private, max-age=20, stale-while-revalidate=240' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'portfolio' });
  }
}
