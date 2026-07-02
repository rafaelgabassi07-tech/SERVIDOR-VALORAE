import { ValoraeEngine, canonicalizeTicker, validarTicker } from '../lib/Valorae-engine.js';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute, boolParam, clampNumber, sendRouteError } from '../lib/http/route.js';
import { formatBrDateTime } from '../lib/core/dates.js';

function parseSymbolList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',');
  return [];
}


function newsDateMs(item = {}) {
  const raw = item.publishedAt ?? item.pubDate ?? item.date ?? item.time ?? item.timestamp ?? '';
  if (typeof raw === 'number') return raw > 9_999_999_999 ? raw : raw * 1000;
  const str = String(raw || '').trim();
  if (!str) return 0;
  if (/^\d+$/.test(str)) {
    const n = Number(str);
    return n > 9_999_999_999 ? n : n * 1000;
  }
  const parsed = Date.parse(str);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortNewsNewestFirst(items = []) {
  return [...items].sort((a, b) => {
    const byDate = newsDateMs(b) - newsDateMs(a);
    if (byDate) return byDate;
    return Number(b.relevanceScore || 0) - Number(a.relevanceScore || 0);
  });
}

function withBrowserOpenPolicy(news) {
  const items = Array.isArray(news?.items) ? sortNewsNewestFirst(news.items).map(item => ({
    ...item,
    url: item.url || item.link || item.sourceUrl || '',
    originalUrl: item.originalUrl || item.url || item.link || item.sourceUrl || '',
    publishedAtDisplay: formatBrDateTime(item.publishedAt || item.pubDate || item.date || item.time || item.timestamp || '', ''),
    displayDate: formatBrDateTime(item.publishedAt || item.pubDate || item.date || item.time || item.timestamp || '', ''),
    openInBrowser: true,
    inAppReader: false,
  })) : news?.items;
  return {
    ...news,
    items,
    news: items || news?.news,
    articles: items || news?.articles,
    articleExtraction: 'disabled',
    openPolicy: { preferredClientAction: 'OPEN_ORIGINAL_URL_IN_BROWSER', requiresInAppReader: false },
  };
}

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET'], route: 'news', rateMax: Number(process.env.VALORAE_RATE_LIMIT_NEWS_MAX || 90), profile: 'news' });
  if (route.done) return;
  try {
    const input = route.input;
    const requestedSymbols = parseSymbolList(input.symbols || input.tickers || input.assets)
      .map(symbol => canonicalizeTicker(symbol))
      .filter(Boolean)
      .slice(0, 48);
    const ticker = canonicalizeTicker(input.ticker || input.symbol || requestedSymbols[0] || '');
    // Notícias globais da página "Notícias" do APK chegam sem ticker.
    // Valide apenas símbolos realmente pedidos, mantendo o feed geral livre de 400.
    const validationCandidates = [...new Set([ticker, ...requestedSymbols].filter(Boolean))];
    const validation = validationCandidates.map(validarTicker).find(Boolean) || null;
    if (validation) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: validation }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'news' });
    const aliases = [
      ...(typeof input.aliases === 'string' ? input.aliases.split(',') : []),
      ...requestedSymbols.filter(symbol => symbol !== ticker),
    ].map(s => String(s || '').trim()).filter(Boolean).slice(0, 48);
    const timeoutMs = input.timeoutMs ? clampNumber(input.timeoutMs, undefined, 350, 12000) : 3000;
    const newsTimeoutMs = input.newsTimeoutMs ? clampNumber(input.newsTimeoutMs, undefined, 350, 12000) : timeoutMs;
    const news = await ValoraeEngine.fetchNews(ticker, aliases, {
      limit: clampNumber(input.limit || input.newsLimit, 24, 1, 50),
      timeoutMs,
      newsTimeoutMs,
      refresh: boolParam(input.refresh || input.nocache),
      nocache: boolParam(input.nocache),
      bypassCache: boolParam(input.refresh || input.nocache),
      lowLatencyBudget: timeoutMs !== undefined && timeoutMs <= 1000,
    });
    const normalizedNews = withBrowserOpenPolicy(news);
    return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, ticker, symbols: requestedSymbols, ...normalizedNews }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'news', cacheControl: 'private, max-age=30, stale-while-revalidate=120' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'news' });
  }
}
