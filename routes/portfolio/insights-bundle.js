import { analyzePortfolio } from '../../lib/portfolio/analytics.js';
import { buildPortfolioHistory, normalizePortfolioPositions, normalizePortfolioTransactions } from '../../lib/portfolio/history.js';
import { fetchIpca } from '../../lib/sources/adapters/index.js';
import { fetchInvestidor10DividendAgenda } from '../../lib/market/investidor10-dividend-agenda.js';
import { fetchAndCompareTickers } from '../../lib/market/compare.js';
import { ValoraeEngine, canonicalizeTicker, validarTicker } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, boolParam, clampNumber, resolveSelfScrapeUrl, sendRouteError, withRouteDeadline } from '../../lib/http/route.js';
import { coalesce } from '../../lib/resilience/inflight.js';
import { firstText, normalizeEvents } from '../../lib/portfolio/dividends-contract.js';

const MAX_POSITIONS = Number(process.env.VALORAE_PORTFOLIO_INSIGHTS_MAX_POSITIONS || 45);
const MAX_RANKING_TICKERS = Number(process.env.VALORAE_PORTFOLIO_INSIGHTS_RANKING_MAX_TICKERS || 15);
const INSIGHTS_BUNDLE_VERSION = '21.12.93';

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
    const portfolioTransactions = normalizePortfolioTransactions(q);
    if (!positionsRaw.length) {
      return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: 'Envie positions=[...] com ticker, quantity e averagePrice.' }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'portfolio' });
    }
    const routePath = String(req.url || '');
    const compactMode = ['mobile', 'fast', 'compact', 'boot'].includes(String(q.mode || q.profile || q.performance || '').toLowerCase()) || routePath.includes('/mobile/portfolio-sync');
    const deepMode = boolParam(q.deep || q.deepSync || q.complete || q.full, false) || /deep|background|complete|full/i.test(String(q.mode || ''));
    const explicitInclude = (value, fallback = true) => !['0', 'false', 'no', 'nao', 'não'].includes(String(value ?? (fallback ? '1' : '0')).toLowerCase());
    const mobileDefaultRankings = compactMode ? deepMode : true;
    const includeAnalysis = explicitInclude(q.includeAnalysis ?? q.analysis, true);
    const includeHistory = explicitInclude(q.includeHistory ?? q.history, true);
    const includeIpca = explicitInclude(q.includeIpca ?? q.ipca, true);
    const includeRankings = explicitInclude(q.includeRankings ?? q.rankings, mobileDefaultRankings);
    const includeDividends = explicitInclude(q.includeDividends ?? q.dividends, true);
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
    const signature = JSON.stringify({
      p: positions.map(p => [canonicalizeTicker(p.ticker), Number(p.quantity || 0), Number(p.averagePrice || 0), Number(p.firstPurchaseAt || 0)]),
      d: dividendPositions.map(p => [canonicalizeTicker(p.ticker), Number(p.quantity || 0), Number(p.firstPurchaseAt || 0)]),
      range, months, deepMode, includeAnalysis, includeHistory, includeIpca, includeRankings, includeDividends
    });
    const out = await coalesce(`portfolio-insights-bundle:${signature}`, async () => {
      const commonProfile = q.profile || (compactMode ? 'mobile' : 'portfolio');
      const analysisPromise = includeAnalysis ? withRouteDeadline(
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
      ).catch(err => ({ ok: false, partial: true, warnings: [err?.message || String(err)] })) : Promise.resolve({ ok: true, skipped: true, assets: [], warnings: [] });

      const historyPromise = includeHistory ? withRouteDeadline(
        () => buildPortfolioHistory(positions, { range, timeoutMs: deepMode ? 9000 : 2800, maxConcurrency: compactMode ? 3 : 4, limit: clampNumber(q.limit, 370, 60, 900), transactions: portfolioTransactions }),
        Math.min(routeDeadlineMs - 500, deepMode ? 9500 : 3400),
        () => ({ ok: false, partial: true, points: [], history: [], series: [], warnings: [`Histórico excedeu deadline do bundle; APK deve usar histórico local/cache.`] })
      ).catch(err => ({ ok: false, partial: true, points: [], history: [], series: [], warnings: [err?.message || String(err)] })) : Promise.resolve({ ok: true, skipped: true, points: [], history: [], series: [], warnings: [] });

      const ipcaPromise = includeIpca ? withRouteDeadline(
        () => fetchIpca({ last: months, timeoutMs: deepMode ? 6000 : 1600, bypassCache: !cache, cache }),
        Math.min(routeDeadlineMs - 800, deepMode ? 6200 : 1900),
        () => ({ ok: false, partial: true, points: [], series: [], items: [], warnings: [`IPCA excedeu deadline do bundle; APK deve usar cache/fallback.`] })
      ).catch(err => ({ ok: false, partial: true, points: [], series: [], items: [], warnings: [err?.message || String(err)] })) : Promise.resolve({ ok: true, skipped: true, points: [], series: [], items: [], warnings: [] });

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
        analysis: { ok: !includeAnalysis || analysis?.ok !== false, skipped: !includeAnalysis, partial: Boolean(analysis?.partial), count: Array.isArray(analysis?.assets) ? analysis.assets.length : undefined },
        history: { ok: !includeHistory || historyPoints.length > 0, skipped: !includeHistory, partial: Boolean(history?.partial), count: historyPoints.length },
        ipca: { ok: !includeIpca || ipcaPoints.length > 0, skipped: !includeIpca, partial: Boolean(ipca?.partial), count: ipcaPoints.length },
        dividends: { ok: !includeDividends || dividends.officialEvents.length > 0, skipped: !includeDividends, partial: Boolean(dividendsRaw?.partial), count: dividends.officialEvents.length },
        rankings: { ok: !includeRankings || ranking.count > 0, skipped: !includeRankings, partial: Boolean(ranking.partial || rankingsRaw?.partial), count: ranking.count },
      };
      const partial = Object.values(blockStatus).some(s => s.partial) || Object.values(blockStatus).some(s => !s.ok && !s.skipped);
      return {
        version: ValoraeEngine.version,
        bundleVersion: INSIGHTS_BUNDLE_VERSION,
        requestId: route.requestId,
        endpoint: routePath.includes('/mobile/portfolio-sync') ? 'mobile-portfolio-sync' : 'portfolio-insights-bundle',
        contract: {
          name: 'valorae-mobile-portfolio-sync',
          version: INSIGHTS_BUNDLE_VERSION,
          style: 'valorae-single-request-cache-first',
          optionalBlocks: ['rankings'],
          included: { analysis: includeAnalysis, history: includeHistory, ipca: includeIpca, dividends: includeDividends, rankings: includeRankings }
        },
        ok: true,
        partial,
        mode: deepMode ? 'deep-background' : 'mobile',
        cachePolicy: 'single-request-coalesced-stale-first-mobile',
        includeAnalysis,
        includeHistory,
        includeIpca,
        includeDividends,
        includeRankings,
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
