import { ValoraeEngine, canonicalizeTicker, inferAssetType, validarTicker } from '../lib/Valorae-engine.js';
import { resolvePerformanceOptions } from '../lib/performance/profile.js';
import { ASSET_SUGGESTION_CATALOG, buildPeerCatalogEntries, describePeerCompatibility } from '../lib/catalogs/asset-peers.js';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute, boolParam, falseParam, parseList, clampNumber, resolveSelfScrapeUrl, sendRouteError, withRouteDeadline } from '../lib/http/route.js';

const MAX_TICKERS = Number(process.env.MAX_TICKERS_PER_REQUEST || 20);



function suggestionQuery(input = {}) {
  return String(input.q || input.search || input.query || '').trim();
}

function looksLikeFullB3Ticker(rawQuery = '') {
  return /^(?:[A-Z]{4}[0-9]{1,2}[A-Z]?|[A-Z0-9]{3,6}[0-9]{1,2})$/.test(canonicalizeTicker(rawQuery));
}

function normalizeSearchText(raw = '') {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function buildAssetSuggestions(rawQuery = '', max = 8) {
  const clean = normalizeSearchText(rawQuery).slice(0, 24);
  if (clean.length < 2) return [];
  const scored = ASSET_SUGGESTION_CATALOG
    .map((entry) => {
      const { ticker, name, segment, sector, peerGroup } = entry;
      const tickerKey = normalizeSearchText(ticker);
      const nameKey = normalizeSearchText(name);
      const segmentKey = normalizeSearchText(segment);
      const sectorKey = normalizeSearchText(sector);
      const match = tickerKey.startsWith(clean) ? 'ticker_prefix'
        : tickerKey.includes(clean) ? 'ticker_contains'
          : nameKey.includes(clean) ? 'name'
            : segmentKey.includes(clean) ? 'segment'
              : sectorKey.includes(clean) ? 'sector'
                : null;
      if (!match) return null;
      const score = match === 'ticker_prefix' ? 100 : match === 'ticker_contains' ? 85 : match === 'name' ? 70 : 55;
      return { ticker, name, segment, sector, peerGroup, match, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker))
    .slice(0, max);
  return scored.map((item, index) => ({
    symbol: item.ticker,
    ticker: item.ticker,
    name: item.name,
    assetClass: inferAssetType(item.ticker),
    segment: item.segment,
    sector: item.sector,
    peerGroup: item.peerGroup,
    suggestion: true,
    rank: index + 1,
    match: item.match,
    searchPolicy: 'analysis_intelligent_search_v35',
    source: 'VALORAE_CATALOG',
    price: null,
    variationPercent: null,
  }));
}

export default async function handler(req, res) {
  const route = beginRoute(req, res, {
    version: ValoraeEngine.version,
    methods: ['GET', 'POST'],
    route: 'assets',
    rateMax: Number(process.env.VALORAE_RATE_LIMIT_ASSETS_MAX || 80),
    profile: 'assets',
  });
  if (route.done) return;
  const input = route.input;

  try {
    const query = suggestionQuery(input);
    const explicitPeerOf = input.peerOf || input.sameSectorOf || input.baseTicker;
    const compareWith = input.compareWith || input.targetTicker || input.candidateTicker || input.rightTicker;
    const peerOf = explicitPeerOf || compareWith;
    if (peerOf) {
      const cleanPeer = canonicalizeTicker(peerOf);
      const cleanCompareWith = explicitPeerOf && compareWith ? canonicalizeTicker(compareWith) : '';
      const max = clampNumber(input.max || input.limit, 10, 1, 25);
      const { base, peers } = buildPeerCatalogEntries(cleanPeer, { query, max, includeBase: false });
      const compatibility = cleanCompareWith ? describePeerCompatibility(cleanPeer, cleanCompareWith) : null;
      const suggestions = peers.map((item, index) => ({
        symbol: item.ticker,
        ticker: item.ticker,
        name: item.name,
        assetClass: inferAssetType(item.ticker),
        segment: item.segment,
        sector: item.sector,
        peerGroup: item.peerGroup,
        suggestion: true,
        rank: index + 1,
        match: 'same_sector',
        searchPolicy: 'analysis_same_sector_suggestions_v103',
        comparisonMode: 'decision',
        comparisonConfidence: 'HIGH',
        peerQuality: item.peerGroup === base?.peerGroup ? 'same_peer_group' : 'same_sector_fallback',
        displayLabel: `${item.ticker} • ${item.segment}`,
        visualGroupLabel: `${item.sector} • ${item.segment}`,
        uiRole: 'sector_peer_card',
        source: 'VALORAE_PEER_CATALOG',
        baseTicker: cleanPeer,
        baseSegment: base?.segment || null,
        baseSector: base?.sector || null,
        strictSameSector: true,
        price: null,
        variationPercent: null,
      }));
      return sendJson(req, res, {
        version: ValoraeEngine.version,
        requestId: route.requestId,
        status: suggestions.length ? 'SAME_SECTOR_SUGGESTIONS' : 'EMPTY',
        count: suggestions.length,
        query: cleanPeer,
        searchText: query || null,
        peerOf: cleanPeer,
        compareWith: cleanCompareWith || null,
        compatibility,
        strictSameSector: true,
        baseKnown: Boolean(base),
        base: base ? { ticker: base.ticker, name: base.name, sector: base.sector, segment: base.segment, peerGroup: base.peerGroup } : null,
        assets: suggestions,
        results: suggestions,
        source: 'VALORAE_PEER_CATALOG',
        searchPolicy: 'analysis_same_sector_suggestions_v103',
        comparisonContract: 'analysis_comparison_decision_v103',
        comparisonMode: base ? 'decision' : 'informative',
        comparisonConfidence: base ? 'HIGH' : 'UNKNOWN_BASE',
        uiPolicy: {
          presentation: 'analysis_sector_peer_cards_v103',
          strictSameSector: true,
          showManualWarning: true,
          emptyState: 'manual_comparison_allowed_without_auto_mixing',
        },
        visualHints: {
          baseLabel: base ? `${base.ticker} • ${base.segment}` : cleanPeer,
          groupLabel: base ? `${base.sector} • ${base.segment}` : null,
          cardTitle: 'Pares comparáveis',
        },
        message: suggestions.length ? 'Sugestões limitadas ao mesmo grupo comparável do ativo-base com metadados de decisão v103.' : 'Ativo-base ainda sem pares setoriais no catálogo local do Proxy.',
      }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'assets-sector-peers', cacheControl: 'private, max-age=300, stale-while-revalidate=900' });
    }
    const rawInput = input.tickers || input.ticker || input.symbols || input.symbol;
    let raw = parseList(rawInput).map(t => String(t).trim()).filter(Boolean);
    if (!raw.length && query) {
      const cleanQuery = canonicalizeTicker(query);
      if (cleanQuery && looksLikeFullB3Ticker(cleanQuery) && !validarTicker(cleanQuery)) raw = [cleanQuery];
      else {
        const max = clampNumber(input.max || input.limit, 8, 1, 25);
        const suggestions = buildAssetSuggestions(query, max);
        return sendJson(req, res, {
          version: ValoraeEngine.version,
          requestId: route.requestId,
          status: suggestions.length ? 'SUGGESTIONS' : 'EMPTY',
          count: suggestions.length,
          query: cleanQuery,
          assets: suggestions,
          results: suggestions,
          source: 'VALORAE_CATALOG',
          searchPolicy: 'analysis_intelligent_search_v35',
          minQueryLength: 2,
          debounceRecommendedMs: 360,
          analysisEndpoint: '/api/v1/analysis',
          message: suggestions.length ? 'Sugestões de ticker retornadas sem simular cotação.' : 'Nenhum ticker sugerido para a busca informada.',
        }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'assets-suggestions', cacheControl: 'private, max-age=300, stale-while-revalidate=900' });
      }
    }
    if (!raw.length) {
      return sendJson(req, res, {
        version: ValoraeEngine.version,
        requestId: route.requestId,
        error: 'Envie ao menos um ticker ou uma busca parcial.',
        hint: 'GET /api/assets?tickers=PETR4,GARE11 ou GET /api/assets?q=BBA para sugestões.',
      }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'assets' });
    }
    if (raw.length > MAX_TICKERS) {
      return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: `Máximo de ${MAX_TICKERS} tickers por requisição.` }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'assets' });
    }

    const valid = [];
    const errors = [];
    for (const r of raw) {
      const t = canonicalizeTicker(r);
      const err = validarTicker(t);
      if (err) errors.push({ ticker: r, error: err });
      else valid.push(t);
    }
    if (!valid.length) {
      return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: 'Nenhum ticker válido enviado.', errors }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'assets' });
    }

    const completeRequested = boolParam(input.complete || input.full || input.fullCapture || input.precise) || ['complete','full','deep','precise','max'].includes(String(input.mode || input.captureMode || input.profile || input.performance || '').toLowerCase());
    const requestedTimeoutMs = input.timeoutMs ? clampNumber(input.timeoutMs, undefined, 500, 25000) : (completeRequested ? 18000 : undefined);
    const requestedNewsTimeoutMs = input.newsTimeoutMs ? clampNumber(input.newsTimeoutMs, undefined, 350, 12000) : requestedTimeoutMs;
    const lowLatencyBudget = requestedTimeoutMs !== undefined
      && requestedTimeoutMs <= 1000
      && input.complete === undefined
      && input.adaptiveCompletion === undefined;

    const perfOptions = resolvePerformanceOptions({
      mode: input.mode || 'super',
      includeNews: lowLatencyBudget ? false : boolParam(input.includeNews ?? input.news, false),
      newsLimit: clampNumber(input.newsLimit || input.limit, 8, 0, 25),
      useYahooFallback: lowLatencyBudget ? false : (input.yahoo === undefined ? true : boolParam(input.yahoo, true)),
      adaptiveCompletion: completeRequested ? true : (lowLatencyBudget ? false : (input.complete !== undefined ? boolParam(input.complete, true) : (input.adaptiveCompletion === undefined ? undefined : boolParam(input.adaptiveCompletion, true)))),
      adaptiveCompletionTimeoutMs: input.adaptiveCompletionTimeoutMs ? clampNumber(input.adaptiveCompletionTimeoutMs, undefined, 500, 12000) : requestedTimeoutMs,
      valoraeScrapeTimeoutMs: requestedTimeoutMs,
      internalApiTimeoutMs: requestedTimeoutMs,
      newsTimeoutMs: requestedNewsTimeoutMs,
      statusInvestTimeoutMs: requestedTimeoutMs,
      statusInvestComplement: completeRequested ? true : (lowLatencyBudget ? false : (input.statusInvestComplement === undefined ? undefined : boolParam(input.statusInvestComplement, true))),
      returnHtml: completeRequested ? true : (lowLatencyBudget ? false : undefined),
      enableInternalApis: completeRequested ? true : (lowLatencyBudget ? false : undefined),
      lowLatencyBudget,
      maxConcurrency: completeRequested ? clampNumber(input.maxConcurrency || input.concurrency, 2, 1, 4) : clampNumber(input.maxConcurrency || input.concurrency, undefined, 1, 8),
      continueOnError: input.continueOnError === undefined ? true : boolParam(input.continueOnError, true),
      timeoutMs: requestedTimeoutMs,
      maxHtmlChars: input.maxHtmlChars ? clampNumber(input.maxHtmlChars, undefined, 10000, 4500000) : (completeRequested ? 4500000 : undefined),
      valoraeScrapeUrl: lowLatencyBudget && !(input.valoraeScrapeUrl || input.scrapeUrl) ? undefined : resolveSelfScrapeUrl(req, input),
      cache: !(boolParam(input.nocache || input.refresh) || falseParam(input.cache)),
      bypassCache: boolParam(input.nocache || input.refresh),
      view: input.view || (completeRequested ? 'full' : (process.env.VALORAE_DEFAULT_ASSETS_VIEW || 'app')),
      includeQuality: input.includeQuality === undefined ? true : boolParam(input.includeQuality, true),
      complete: completeRequested,
      fullCapture: completeRequested,
      profile: input.profile || input.performance || (completeRequested ? 'deep' : undefined),
    }, { endpoint: 'assets', batchSize: valid.length });

    const routeDeadlineMs = clampNumber(
      input.routeDeadlineMs || input.deadlineMs,
      completeRequested ? 19_000 : 3_200,
      750,
      completeRequested ? 26_000 : 8_000
    );
    const batch = await withRouteDeadline(
      () => ValoraeEngine.fetchAtivosBatch(valid, perfOptions),
      routeDeadlineMs,
      () => ({
        assets: [],
        stats: {
          partial: true,
          timeout: true,
          routeDeadlineMs,
          message: 'Deadline mobile atingido; o APK deve preservar snapshot/cache local e revalidar em background.',
        },
        errors: valid.map(ticker => ({ ticker, error: `Deadline da rota assets atingido em ${routeDeadlineMs}ms.` })),
      })
    );
    return sendJson(req, res, {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      count: (batch.assets || []).length,
      partial: !!batch.stats?.partial,
      deadlineMs: routeDeadlineMs,
      stats: batch.stats || {},
      assets: batch.assets || [],
      errors: [...errors, ...(batch.errors || [])],
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: perfOptions.performanceProfile, cachePolicy: perfOptions.cachePolicy, cacheControl: 'private, max-age=15, stale-while-revalidate=60' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'assets' });
  }
}
