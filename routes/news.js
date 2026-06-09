import { ValoraeEngine, canonicalizeTicker, validarTicker } from '../lib/Valorae-engine.js';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute, boolParam, clampNumber, sendRouteError } from '../lib/http/route.js';

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET'], route: 'news', rateMax: Number(process.env.VALORAE_RATE_LIMIT_NEWS_MAX || 90), profile: 'news' });
  if (route.done) return;
  try {
    const input = route.input;
    const ticker = canonicalizeTicker(input.ticker);
    // Notícias globais da página "Notícias" do APK chegam sem ticker.
    // Antes essa rota validava string vazia como ticker inválido e devolvia 400,
    // fazendo o APK parecer incompatível com o Proxy. Valide apenas quando o
    // usuário pediu notícia de um ativo específico.
    const validation = ticker ? validarTicker(ticker) : null;
    if (validation) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: validation }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'news' });
    const aliases = typeof input.aliases === 'string' ? input.aliases.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8) : [];
    const timeoutMs = input.timeoutMs ? clampNumber(input.timeoutMs, undefined, 350, 12000) : undefined;
    const newsTimeoutMs = input.newsTimeoutMs ? clampNumber(input.newsTimeoutMs, undefined, 350, 12000) : timeoutMs;
    const news = await ValoraeEngine.fetchNews(ticker, aliases, {
      limit: clampNumber(input.limit || input.newsLimit, 8, 1, 25),
      timeoutMs,
      newsTimeoutMs,
      refresh: boolParam(input.refresh || input.nocache),
      nocache: boolParam(input.nocache),
      bypassCache: boolParam(input.refresh || input.nocache),
      lowLatencyBudget: timeoutMs !== undefined && timeoutMs <= 1000,
    });
    return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, ticker, ...news }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'news', cacheControl: 'private, max-age=60, stale-while-revalidate=300' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'news' });
  }
}
