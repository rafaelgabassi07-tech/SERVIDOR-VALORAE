import { fetchAndCompareTickers } from '../../lib/market/compare.js';
import { fetchInvestidor10Rankings } from '../../lib/market/rankings-i10.js';
import { buildMarketMovers } from '../../lib/sources/quotes.js';
import { ValoraeEngine, canonicalizeTicker, validarTicker } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, boolParam, parseList, clampNumber, resolveSelfScrapeUrl, sendRouteError, withRouteDeadline } from '../../lib/http/route.js';


function rankingArraysFrom(payload = {}) {
  const rankings = payload?.rankings && typeof payload.rankings === 'object' ? payload.rankings : {};
  const highs = payload?.altas || payload?.highs || payload?.gainers || payload?.maioresAltas || rankings.altas || rankings.highs || rankings.gainers || rankings.maioresAltas || [];
  const lows = payload?.baixas || payload?.lows || payload?.losers || payload?.maioresBaixas || rankings.baixas || rankings.lows || rankings.losers || rankings.maioresBaixas || [];
  return { highs: Array.isArray(highs) ? highs : [], lows: Array.isArray(lows) ? lows : [] };
}

function mergeRankingRows(primary = [], fallback = [], limit = 6) {
  const out = [];
  const seen = new Set();
  for (const row of [...(primary || []), ...(fallback || [])]) {
    const symbol = String(row?.ticker || row?.symbol || row?.code || '').trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({ ...row, ticker: symbol, symbol, rank: out.length + 1 });
    if (out.length >= limit) break;
  }
  return out;
}

function withRankingAliases(highs = [], lows = []) {
  return { highs, lows, altas: highs, baixas: lows, maioresAltas: highs, maioresBaixas: lows, gainers: highs, losers: lows, topGainers: highs, topLosers: lows };
}

const DEFAULTS = { ACAO: ['PETR4','VALE3','ITUB4','BBAS3','PRIO3','WEGE3'], FII: ['GARE11','HGLG11','TRXF11','MXRF11','KNRI11','VISC11'] };
const MAX_RANKING = Number(process.env.VALORAE_RANKING_MAX_TICKERS || 15);

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET', 'POST'], route: 'market-rankings', rateMax: Number(process.env.VALORAE_RATE_LIMIT_MARKET_MAX || 90), profile: 'market' });
  if (route.done) return;
  try {
    const q = route.input;
    const kind = String(q.type || q.kind || 'ACAO').toUpperCase();
    const sourceMode = String(q.source || 'auto').toLowerCase();
    const rankingMode = String(q.mode || q.captureMode || (boolParam(q.complete || q.full || q.precise) ? 'complete' : 'auto')).toLowerCase();
    const completeMode = ['complete','full','deep','precise','max'].includes(rankingMode) || boolParam(q.complete || q.fullCapture || q.precise);
    const requestedLimit = clampNumber(q.limit || q.max || q.maxItems, 15, 1, 30);
    const minRows = clampNumber(q.minRows || q.completeMinRows, Math.min(6, requestedLimit), 1, requestedLimit);
    const source = parseList(q.tickers).map(x => String(x).trim()).filter(Boolean);
    // Para a Home do APK, a fonte canônica é a própria Home do Investidor10.
    // Não usar fallback de cesta fixa/comparação quando não há tickers, para evitar mostrar ativos
    // que não aparecem em Maiores Altas/Baixas do Investidor10.
    if (!source.length && kind === 'ACAO' && sourceMode !== 'compare') {
      const preferredSource = ['dedicated','pages','ranking-pages'].includes(sourceMode) ? 'dedicated' : 'home';
      const routeDeadlineMs = clampNumber(q.routeDeadlineMs || q.deadlineMs, completeMode ? 15000 : 5200, 1000, 25000);
      const live = await withRouteDeadline(
        () => fetchInvestidor10Rankings({
          bypassCache: boolParam(q.nocache || q.refresh),
          timeoutMs: clampNumber(q.timeoutMs, completeMode ? 14000 : 4200, 1000, 25000),
          mode: rankingMode,
          requireComplete: completeMode && boolParam(q.strict, false),
          limit: requestedLimit,
          minRows,
          preferredSource,
        }),
        routeDeadlineMs,
        () => ({ ok: false, highs: [], lows: [], score: [], warnings: [`Ranking excedeu deadline de ${routeDeadlineMs}ms; APK deve preservar último ranking/cache.`], partial: true })
      );
      const liveRows = rankingArraysFrom(live);
      const liveComplete = liveRows.highs.length >= minRows && liveRows.lows.length >= minRows;
      const liveSourceLabel = preferredSource === 'home'
        ? (completeMode ? 'investidor10-home-live-complete' : 'investidor10-home-live')
        : (completeMode ? 'investidor10-dedicated-live-complete' : 'investidor10-dedicated-live');
      if (liveComplete || (liveRows.highs.length + liveRows.lows.length > 0 && boolParam(q.strictLive))) {
        return sendJson(req, res, {
          version: ValoraeEngine.version,
          requestId: route.requestId,
          endpoint: 'market-rankings',
          type: kind,
          rankingSource: liveSourceLabel,
          fallbackUsed: false,
          fallbackPolicy: 'live-investidor10-rankings',
          captureMode: rankingMode,
          ...live,
        }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'market', cacheControl: 'private, max-age=60, stale-while-revalidate=300' });
      }
      const fallback = await buildMarketMovers({ ...q, source: 'compare', limit: requestedLimit, timeoutMs: clampNumber(q.fallbackTimeoutMs || q.quoteTimeoutMs || q.timeoutMs, 2600, 700, 8000) });
      const fallbackRows = rankingArraysFrom(fallback);
      const highs = mergeRankingRows(liveRows.highs, fallbackRows.highs, requestedLimit);
      const lows = mergeRankingRows(liveRows.lows, fallbackRows.lows, requestedLimit);
      const hasRows = highs.length > 0 || lows.length > 0;
      const aliases = withRankingAliases(highs, lows);
      const warnings = [live?.warning, ...(Array.isArray(live?.warnings) ? live.warnings : []), ...(Array.isArray(live?.errors) ? live.errors : []), fallback?.warning, ...(Array.isArray(fallback?.warnings) ? fallback.warnings : [])].filter(Boolean).slice(0, 8);
      return sendJson(req, res, {
        version: ValoraeEngine.version,
        requestId: route.requestId,
        status: hasRows ? (fallback?.fallbackUsed ? 'FALLBACK' : 'OK') : 'EMPTY',
        ok: hasRows,
        endpoint: 'market-rankings',
        type: kind,
        rankingSource: `${liveSourceLabel}+valorae-quote-fallback`,
        fallbackUsed: true,
        fallbackPolicy: 'live-investidor10-first-then-proxy-quote-operational-fallback',
        captureMode: rankingMode,
        partial: true,
        source: fallback?.source || live?.source || 'VALORAE Fonte Oficial',
        generatedAt: new Date().toISOString(),
        requestedLimit,
        rankings: aliases,
        ...aliases,
        warnings,
        warning: warnings[0] || 'Ranking ao vivo não retornou linhas suficientes; usando fallback operacional via Proxy.',
        liveStatus: live?.status || null,
        fallbackStatus: fallback?.status || null,
        attempts: live?.attempts || [],
        errors: live?.errors || [],
      }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'market', cacheControl: 'private, max-age=60, stale-while-revalidate=300' });
    }
    const raw = source.length ? source : (DEFAULTS[kind] || DEFAULTS.ACAO);
    if (raw.length > MAX_RANKING) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: `Máximo de ${MAX_RANKING} tickers no ranking.` }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'market' });
    const list = [];
    const errors = [];
    for (const item of raw) {
      const t = canonicalizeTicker(item);
      const err = validarTicker(t);
      if (err) errors.push({ ticker: item, error: err });
      else list.push(t);
    }
    const routeDeadlineMs = clampNumber(q.routeDeadlineMs || q.deadlineMs, completeMode ? 19000 : 5200, 1000, 25000);
    const data = await withRouteDeadline(
      () => fetchAndCompareTickers(list, {
        view: completeMode ? (q.view || 'full') : 'compact',
        maxConcurrency: clampNumber(q.maxConcurrency, completeMode ? 2 : 4, 1, 6),
        cache: !boolParam(q.nocache || q.refresh),
        valoraeScrapeUrl: resolveSelfScrapeUrl(req, q),
        profile: q.profile || (completeMode ? 'deep' : 'portfolio'),
        complete: completeMode,
        adaptiveCompletion: completeMode ? true : undefined,
        statusInvestComplement: completeMode ? true : undefined,
        returnHtml: completeMode ? true : undefined,
        enableInternalApis: completeMode ? true : undefined,
        timeoutMs: completeMode ? clampNumber(q.timeoutMs, 18000, 1000, 25000) : clampNumber(q.timeoutMs, 4200, 500, 20000),
        maxHtmlChars: completeMode ? clampNumber(q.maxHtmlChars, 4500000, 10000, 4500000) : undefined,
      }),
      routeDeadlineMs,
      () => ({ highs: [], lows: [], score: [], warnings: [`Ranking comparativo excedeu deadline de ${routeDeadlineMs}ms; resposta parcial para preservar fluidez mobile.`], partial: true, errors: list.map(ticker => ({ ticker, error: 'deadline' })) })
    );
    return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, endpoint: 'market-rankings', type: kind, rankingSource: completeMode ? 'valorae-compare-complete' : 'valorae-compare-fallback', fallbackUsed: !source.length && sourceMode !== 'compare', captureMode: rankingMode, inputErrors: errors, ...data }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'market', cacheControl: 'private, max-age=60, stale-while-revalidate=300' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'market' });
  }
}
