import { fetchYahooHistory } from '../../lib/market/yahoo.js';
import { getAssetHistory } from '../../lib/sources/asset-details.js';
import { ValoraeEngine, canonicalizeTicker, validarTicker } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, clampNumber, sendRouteError } from '../../lib/http/route.js';

function normalizeHistoryTicker(raw = '') {
  const text = String(raw || '').trim().toUpperCase();
  const compactAlias = text.replace(/\.SA$/i, '').replace(/[^A-Z0-9^]/g, '');
  const canonical = canonicalizeTicker(text);
  const aliases = new Set([compactAlias, canonical]);
  if (aliases.has('IFIX') || aliases.has('^IFIX')) return 'IFIX';
  if (aliases.has('IBOV') || aliases.has('IBOVESPA') || aliases.has('^BVSP')) return 'IBOV';
  if (aliases.has('SMLL') || aliases.has('SMALL')) return 'SMLL';
  if (aliases.has('IDIV')) return 'IDIV';
  return canonical;
}

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET', 'POST'], route: 'asset-history', rateMax: Number(process.env.VALORAE_RATE_LIMIT_HISTORY_MAX || 90), profile: 'history' });
  if (route.done) return;
  try {
    const q = route.input;
    const ticker = normalizeHistoryTicker(q.ticker);
    const officialIndexAlias = ['IFIX', 'IBOV', 'SMLL', 'IDIV'].includes(ticker);
    const isIndexAlias = officialIndexAlias || ['^BVSP'].includes(ticker);
    const err = isIndexAlias ? null : validarTicker(ticker);
    if (err) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: err }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'history' });
    const data = officialIndexAlias
      ? await getAssetHistory({ ticker, range: q.range || '1Y', interval: q.interval, timeoutMs: clampNumber(q.timeoutMs, 9000, 1000, 20000), limit: clampNumber(q.limit, 520, 30, 1200), bypassCache: q.nocache === '1' || q.refresh === '1' })
      : await fetchYahooHistory(ticker, { range: q.range || '1Y', interval: q.interval, timeoutMs: clampNumber(q.timeoutMs, 9000, 1000, 20000) });
    const payload = data.ok ? data : {
      ...data,
      ok: false,
      empty: true,
      fallbackUsed: true,
      warning: data.error || 'Histórico temporariamente indisponível.',
      message: 'Histórico é bloco opcional: o APK deve manter gráfico/cache local ou tentar appPayload.charts.',
      appPolicy: {
        optionalBlock: true,
        canReplacePreviousHistory: false,
        shouldKeepPreviousHistory: true,
        fallbackRoots: ['appPayload.charts', 'appMobileSnapshot.charts', 'cache local do APK'],
      },
      reliability: {
        source: data.source || (officialIndexAlias ? `B3 Oficial - ${ticker}` : 'YahooChart'),
        state: 'UNAVAILABLE_OPTIONAL',
        optionalBlock: true,
        shouldKeepPreviousHistory: true,
      },
    };
    delete payload.error;
    return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, endpoint: 'asset-history', ...payload }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'history', cacheControl: data.ok ? 'private, max-age=60, stale-while-revalidate=300' : 'private, max-age=15, stale-while-revalidate=120' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'history' });
  }
}
