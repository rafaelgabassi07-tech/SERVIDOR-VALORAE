import { ValoraeEngine, canonicalizeTicker, inferAssetType, validarTicker } from '../../lib/Valorae-engine.js';
import { fetchYahooHistory, fetchInvestidor10Rankings, fetchIpca } from '../../lib/sources/adapters/index.js';
import { fetchIndicesSnapshot } from '../../lib/market/indices.js';
import { buildPortfolioHistory, normalizePortfolioPositions, normalizePortfolioTransactions } from '../../lib/portfolio/history.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, boolParam, clampNumber, parseList, resolveSelfScrapeUrl, sendRouteError } from '../../lib/http/route.js';
import { buildMobileScraperAssetContract, VALORAE_MOBILE_SCRAPER_CONTRACT_VERSION } from '../../lib/compat/mobile-scraper-contract.js';

const MODE_ALIASES = {
  ranking: 'rankings',
  rankings: 'rankings',
  indices: 'indices',
  índices: 'indices',
  ipca: 'ipca',
  fundamentos: 'fundamentos',
  asset: 'fundamentos',
  cotacao_historica: 'cotacao_historica',
  cotação_histórica: 'cotacao_historica',
  historico: 'cotacao_historica',
  histórico: 'cotacao_historica',
  historico_portfolio: 'historico_portfolio',
  historico_12m: 'historico_12m',
  proventos_carteira: 'proventos_carteira',
  proximo_provento: 'proximo_provento',
};
const ALLOWED_MODES = new Set(Object.values(MODE_ALIASES));

const KNOWN_ROUTE_UNITS = new Set(['ALUP11','BPAC11','BRBI11','ENGI11','KLBN11','SANB11','SAPR11','TAEE11','TIET11','CESP11','AESB11','CPLE11','EQTL11','IGTI11','RNEW11']);
const KNOWN_ROUTE_ETFS = new Set(['BOVA11','BOVV11','SMAL11','IVVB11','HASH11','QBTC11','BITH11','ETHE11','GOLD11','FIND11','DIVO11','ECOO11','PIBB11','SPXI11','XFIX11','MATB11','NASD11','TECK11','WRLD11','ACWI11','GENB11','MILL11','SHOT11','U30B11','USAL11','B5P211','IMAB11','IRFM11']);

function parsePayload(input = {}) {
  if (input.payload && typeof input.payload === 'object') return input.payload;
  if (typeof input.payload === 'string') {
    try { return JSON.parse(input.payload); } catch {}
  }
  const { mode, payload, ...rest } = input;
  return rest;
}
function normalizeMode(raw = '') {
  const key = String(raw || '').trim().toLowerCase();
  return MODE_ALIASES[key] || key;
}

function tickerFromPayload(payload = {}) {
  const raw = payload.ticker || payload.symbol || payload.ativo || payload.codigo || payload.code || payload.papel || payload.slug || payload.asset || payload.query || payload.q || payload.url || '';
  const text = String(raw || '').trim();
  const fromUrl = text.match(/\/(?:acoes|fiis|fiagros|etfs|bdrs|stocks|reits)\/([a-z]{4}[0-9]{1,2}[a-z]?)\/?/i)?.[1];
  const fromQuery = text.match(/[?&](?:ticker|symbol|ativo|codigo|papel)=([a-z]{4}[0-9]{1,2}[a-z]?)/i)?.[1];
  const fromFreeText = text.match(/\b((?:[A-Z]{4}[0-9]{1,2}[A-Z]?|[A-Z0-9]{3,6}[0-9]{1,2}))\b/i)?.[1];
  return canonicalizeTicker(fromUrl || fromQuery || fromFreeText || text);
}

function assetTypeFromPayload(payload = {}, ticker = '') {
  const raw = String(payload.type || payload.assetType || payload.assetClass || payload.classe_ativo || payload.tipo_ativo || payload.tipo || '').toUpperCase();
  const url = String(payload.url || payload.sourceUrl || '').toLowerCase();
  if (url.includes('/acoes/')) return 'ACAO';
  if (url.includes('/fiis/') || url.includes('/fiagros/')) return 'FII';
  if (url.includes('/etfs/')) return 'ETF';
  if (url.includes('/bdrs/')) return 'BDR';
  if (url.includes('/stocks/') || url.includes('/reits/')) return 'STOCK';
  if (raw.includes('FII') || raw.includes('FUNDO IMOB') || raw.includes('FIAGRO')) return 'FII';
  if (raw.includes('ETF')) return 'ETF';
  if (raw.includes('BDR')) return 'BDR';
  if (raw.includes('STOCK') || raw.includes('REIT')) return 'STOCK';
  if (raw.includes('ACAO') || raw.includes('AÇÃO') || raw.includes('UNIT')) return 'ACAO';
  if (KNOWN_ROUTE_ETFS.has(ticker)) return 'ETF';
  if (/^[A-Z]{4}3[0-9]$/.test(ticker)) return 'BDR';
  if (KNOWN_ROUTE_UNITS.has(ticker)) return 'ACAO';
  return inferAssetType(ticker);
}

function parseBRDate(d) { const m = String(d || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`) : null; }
function nextDividendFromAsset(asset) {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const historico = asset.results?.dividendos?.historico || asset.results?.historicoDividendos || [];
  const upcoming = historico.map(x => ({ ...x, _pag: parseBRDate(x.dataPagamento || x.paymentDate) })).filter(x => x._pag && x._pag >= today).sort((a, b) => a._pag - b._pag);
  const next = upcoming[0] || null;
  if (next) delete next._pag;
  return { ticker: asset.ticker, type: asset.type, nextDividend: next, lastDividend: historico[0] || null, dividendYield: asset.results?.dividendos?.dividendYield || asset.results?.dividendYield };
}

function tickerItemsFromPayload(payload = {}) {
  const raw = Array.isArray(payload.fiiList) ? payload.fiiList : parseList(payload.tickers || payload.ticker || payload.fiis || payload.assets);
  return raw.map((item) => {
    if (typeof item === 'string') return { ticker: canonicalizeTicker(item), limit: clampNumber(payload.limit, 12, 1, 120) };
    return { ticker: canonicalizeTicker(item?.ticker || item?.symbol || item?.ativo || ''), limit: clampNumber(item?.limit || payload.limit, 12, 1, 120) };
  }).filter(x => x.ticker);
}

function dividendHistoryFromAsset(asset, limit = 12) {
  const historico = asset?.results?.dividendos?.historico || asset?.results?.historicoDividendos || [];
  return historico.slice(0, Math.max(1, Math.min(Number(limit || 12), 120))).map(item => ({
    symbol: asset.ticker,
    ticker: asset.ticker,
    dataCom: item.dataCom || item.comDate || null,
    paymentDate: item.dataPagamento || item.paymentDate || null,
    value: Number(item.valor ?? item.value ?? 0) || 0,
    type: item.tipo || item.type || 'PROVENTO',
    rawType: item.rawType ?? item.tipo ?? item.type ?? null,
  }));
}

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET', 'POST'], route: 'compat-scraper4', rateMax: Number(process.env.VALORAE_RATE_LIMIT_COMPAT_MAX || 80), profile: 'compat' });
  if (route.done) return;
  try {
    const mode = normalizeMode(route.input.mode);
    const payload = parsePayload(route.input);
    if (!ALLOWED_MODES.has(mode)) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: 'Modo inválido.', allowedModes: Array.from(ALLOWED_MODES), aliases: Object.keys(MODE_ALIASES) }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'compat' });

    if (mode === 'indices') return sendJson(req, res, { json: await fetchIndicesSnapshot(), _src: 'valorae-compat' }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'compat', cacheControl: 'private, max-age=60, stale-while-revalidate=300' });
    if (mode === 'ipca') return sendJson(req, res, { json: await fetchIpca({ last: clampNumber(payload.last || payload.limit, 24, 1, 120) }), _src: 'valorae-compat' }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'compat', cacheControl: 'private, max-age=3600, stale-while-revalidate=86400' });
    if (mode === 'rankings') return sendJson(req, res, { json: await fetchInvestidor10Rankings({ bypassCache: boolParam(payload.nocache || payload.refresh) }), _src: 'valorae-compat' }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'compat', cacheControl: 'private, max-age=60, stale-while-revalidate=300' });

    if (mode === 'cotacao_historica') {
      const ticker = tickerFromPayload(payload);
      const err = validarTicker(ticker);
      if (err) return sendJson(req, res, { error: err }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'compat' });
      return sendJson(req, res, { json: await fetchYahooHistory(ticker, { range: payload.range || '1Y', interval: payload.interval, limit: payload.limit, timeoutMs: clampNumber(payload.timeoutMs, 9000, 1000, 20000) }), _src: 'valorae-compat' }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'compat', cacheControl: 'private, max-age=60, stale-while-revalidate=300' });
    }

    if (mode === 'fundamentos') {
      const ticker = tickerFromPayload(payload);
      const err = validarTicker(ticker);
      if (err) return sendJson(req, res, { error: err }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'compat' });
      const data = await ValoraeEngine.fetchAtivo(ticker, assetTypeFromPayload(payload, ticker), {
        mode: payload.valoraeMode || payload.mode || 'super',
        view: payload.view || 'full',
        includeNews: boolParam(payload.includeNews || payload.news),
        cache: !boolParam(payload.nocache || payload.refresh),
        valoraeScrapeUrl: resolveSelfScrapeUrl(req, payload),
        profile: payload.profile || 'deep-mobile',
        complete: payload.complete === undefined ? true : boolParam(payload.complete, true),
        fullCapture: payload.fullCapture === undefined ? true : boolParam(payload.fullCapture, true),
        enableInternalApis: payload.enableInternalApis === undefined ? true : boolParam(payload.enableInternalApis, true),
        returnHtml: payload.returnHtml === undefined ? true : boolParam(payload.returnHtml, true),
        adaptiveCompletion: payload.adaptiveCompletion === undefined ? true : boolParam(payload.adaptiveCompletion, true),
        timeoutMs: clampNumber(payload.timeoutMs, 18000, 1500, 30000),
        internalApiTimeoutMs: clampNumber(payload.internalApiTimeoutMs, 7000, 1000, 15000),
      });
      const contract = buildMobileScraperAssetContract(data);
      return sendJson(req, res, { json: contract, _src: 'valorae-compat', contract: VALORAE_MOBILE_SCRAPER_CONTRACT_VERSION }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'compat' });
    }

    if (mode === 'historico_portfolio') {
      const positions = normalizePortfolioPositions(payload);
      const transactions = normalizePortfolioTransactions(payload);
      const data = await buildPortfolioHistory(positions, { range: payload.range || '1Y', interval: payload.interval, maxConcurrency: clampNumber(payload.maxConcurrency || payload.concurrency, 4, 1, 8), limit: payload.limit, transactions });
      return sendJson(req, res, { json: data, _src: 'valorae-compat' }, { status: data.ok ? 200 : 502, engineVersion: ValoraeEngine.version, profile: 'compat' });
    }

    if (mode === 'historico_12m') {
      const ticker = tickerFromPayload(payload);
      const err = validarTicker(ticker);
      if (err) return sendJson(req, res, { error: err }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'compat' });
      const asset = await ValoraeEngine.fetchAtivo(ticker, assetTypeFromPayload(payload, ticker), { mode: 'super', view: 'full', includeNews: false, cache: !boolParam(payload.nocache || payload.refresh), valoraeScrapeUrl: resolveSelfScrapeUrl(req, payload), profile: 'portfolio' });
      return sendJson(req, res, { json: dividendHistoryFromAsset(asset, payload.limit || 120), _src: 'valorae-compat' }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'compat', cacheControl: 'private, max-age=120, stale-while-revalidate=600' });
    }

    if (mode === 'proximo_provento' || mode === 'proventos_carteira') {
      const itemsInput = mode === 'proximo_provento' ? [{ ticker: tickerFromPayload(payload), limit: 1 }] : tickerItemsFromPayload(payload);
      const clean = itemsInput.map(x => x.ticker).filter(Boolean);
      const batch = await ValoraeEngine.fetchAtivosBatch(clean, { mode: 'super', view: 'full', includeNews: false, maxConcurrency: clampNumber(payload.maxConcurrency || payload.concurrency, 4, 1, 6), cache: !boolParam(payload.nocache || payload.refresh), valoraeScrapeUrl: resolveSelfScrapeUrl(req, payload), profile: 'portfolio' });
      if (mode === 'proximo_provento') {
        const result = nextDividendFromAsset(batch.assets[0] || {});
        return sendJson(req, res, { json: result, _src: 'valorae-compat' }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'compat' });
      }
      const limitByTicker = Object.fromEntries(itemsInput.map(x => [x.ticker, x.limit]));
      const flat = batch.assets.flatMap(asset => dividendHistoryFromAsset(asset, limitByTicker[asset.ticker] || payload.limit || 12));
      return sendJson(req, res, { json: flat, _src: 'valorae-compat', stats: batch.stats, errors: batch.errors }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'compat', cacheControl: 'private, max-age=120, stale-while-revalidate=600' });
    }
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'compat' });
  }
}
