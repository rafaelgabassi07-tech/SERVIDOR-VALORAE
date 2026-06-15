import { ValoraeEngine, canonicalizeTicker, inferAssetType, validarTicker } from '../lib/Valorae-engine.js';
import { resolvePerformanceOptions } from '../lib/performance/profile.js';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute, boolParam, falseParam, parseList, clampNumber, resolveSelfScrapeUrl, sendRouteError, withRouteDeadline } from '../lib/http/route.js';

const MAX_TICKERS = Number(process.env.MAX_TICKERS_PER_REQUEST || 20);

const ASSET_SUGGESTION_CATALOG = [
  ['PETR4', 'Petrobras PN', 'Petróleo, Gás e Biocombustíveis'],
  ['PETR3', 'Petrobras ON', 'Petróleo, Gás e Biocombustíveis'],
  ['VALE3', 'Vale ON', 'Mineração'],
  ['BBAS3', 'Banco do Brasil ON', 'Bancos'],
  ['ITUB4', 'Itaú Unibanco PN', 'Bancos'],
  ['BBDC4', 'Bradesco PN', 'Bancos'],
  ['BBDC3', 'Bradesco ON', 'Bancos'],
  ['ABEV3', 'Ambev ON', 'Bebidas'],
  ['WEGE3', 'WEG ON', 'Máquinas e Equipamentos'],
  ['BBSE3', 'BB Seguridade ON', 'Seguradoras'],
  ['EGIE3', 'Engie Brasil ON', 'Energia Elétrica'],
  ['TAEE11', 'Taesa Unit', 'Energia Elétrica'],
  ['SANB11', 'Santander Brasil Unit', 'Bancos'],
  ['KLBN11', 'Klabin Unit', 'Papel e Celulose'],
  ['ALUP11', 'Alupar Unit', 'Energia Elétrica'],
  ['BPAC11', 'BTG Pactual Unit', 'Financeiro'],
  ['ELET3', 'Eletrobras ON', 'Energia Elétrica'],
  ['ELET6', 'Eletrobras PNB', 'Energia Elétrica'],
  ['RENT3', 'Localiza ON', 'Aluguel de veículos'],
  ['LREN3', 'Lojas Renner ON', 'Varejo'],
  ['SUZB3', 'Suzano ON', 'Papel e Celulose'],
  ['PRIO3', 'PRIO ON', 'Petróleo e Gás'],
  ['MXRF11', 'Maxi Renda FII', 'Recebíveis imobiliários'],
  ['KNCR11', 'Kinea Rendimentos Imobiliários FII', 'Recebíveis imobiliários'],
  ['CPTS11', 'Capitânia Securities II FII', 'Recebíveis imobiliários'],
  ['HGCR11', 'CSHG Recebíveis Imobiliários FII', 'Recebíveis imobiliários'],
  ['HGLG11', 'CSHG Logística FII', 'Logística'],
  ['XPLG11', 'XP Log FII', 'Logística'],
  ['BTLG11', 'BTG Pactual Logística FII', 'Logística'],
  ['BRCO11', 'Bresco Logística FII', 'Logística'],
  ['VISC11', 'Vinci Shopping Centers FII', 'Shopping centers'],
  ['XPML11', 'XP Malls FII', 'Shopping centers'],
  ['HSML11', 'HSI Malls FII', 'Shopping centers'],
  ['KNRI11', 'Kinea Renda Imobiliária FII', 'Híbrido'],
  ['ALZR11', 'Alianza Trust Renda Imobiliária FII', 'Renda urbana'],
  ['TRXF11', 'TRX Real Estate FII', 'Renda urbana'],
  ['VGIP11', 'Valora CRI Índice de Preço FII', 'Recebíveis imobiliários'],
  ['IRDM11', 'Iridium Recebíveis Imobiliários FII', 'Recebíveis imobiliários'],
  ['GARE11', 'Guardian Real Estate FII', 'Híbrido'],
  ['BOVA11', 'iShares Ibovespa Fundo de Índice', 'ETF Brasil'],
  ['IVVB11', 'ETF S&P 500', 'ETF exterior'],
  ['SMAL11', 'ETF Small Caps', 'ETF Brasil'],
  ['DIVO11', 'ETF Dividendos', 'ETF Brasil'],
  ['HASH11', 'ETF Cripto', 'ETF cripto'],
  ['AAPL34', 'Apple BDR', 'BDR'],
  ['MSFT34', 'Microsoft BDR', 'BDR'],
  ['GOGL34', 'Alphabet BDR', 'BDR'],
  ['AMZO34', 'Amazon BDR', 'BDR'],
  ['TSLA34', 'Tesla BDR', 'BDR'],
  ['NVDC34', 'NVIDIA BDR', 'BDR'],
];

function suggestionQuery(input = {}) {
  return String(input.q || input.search || input.query || '').trim();
}

function looksLikeFullB3Ticker(rawQuery = '') {
  return /^[A-Z]{4}[0-9]{1,2}[A-Z]?$/.test(canonicalizeTicker(rawQuery));
}

function buildAssetSuggestions(rawQuery = '', max = 8) {
  const clean = canonicalizeTicker(rawQuery).slice(0, 12);
  if (clean.length < 2) return [];
  return ASSET_SUGGESTION_CATALOG
    .filter(([ticker, name, segment]) => ticker.startsWith(clean) || String(name).toUpperCase().includes(clean) || String(segment).toUpperCase().includes(clean))
    .slice(0, max)
    .map(([ticker, name, segment]) => ({
      symbol: ticker,
      ticker,
      name,
      assetClass: inferAssetType(ticker),
      segment,
      suggestion: true,
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
