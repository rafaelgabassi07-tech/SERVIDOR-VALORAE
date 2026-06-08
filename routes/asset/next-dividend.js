import { ValoraeEngine, canonicalizeTicker, inferAssetType, validarTicker } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { fetchInvestidor10DividendAgenda } from '../../lib/market/investidor10-dividend-agenda.js';
import { beginRoute, boolParam, resolveSelfScrapeUrl, sendRouteError, clampNumber } from '../../lib/http/route.js';

function parseBRDate(d) { const m = String(d || '').match(/(\d{2})\/(\d{2})\/(\d{2}|\d{4})/); if (!m) return null; const y = String(m[3]).length === 2 ? `20${m[3]}` : m[3]; return new Date(`${y}-${m[2]}-${m[1]}T00:00:00Z`); }

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET', 'POST'], route: 'asset-next-dividend', rateMax: Number(process.env.VALORAE_RATE_LIMIT_DIVIDENDS_MAX || 90), profile: 'next-dividend' });
  if (route.done) return;
  try {
    const q = route.input;
    const ticker = canonicalizeTicker(q.ticker);
    const err = validarTicker(ticker);
    if (err) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: err }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'next-dividend' });
    let data = { ticker, type: inferAssetType(ticker), results: {}, quality: { score: 0 }, errors: [] };
    try {
      data = await ValoraeEngine.fetchAtivo(ticker, inferAssetType(ticker), { mode: q.mode || 'super', includeNews: false, view: 'full', cache: !boolParam(q.nocache || q.refresh), bypassCache: boolParam(q.nocache || q.refresh), valoraeScrapeUrl: resolveSelfScrapeUrl(req, q), profile: q.profile || 'standard' });
    } catch (assetErr) {
      data.errors = [{ source: 'ValoraeEngine.fetchAtivo', error: assetErr?.message || String(assetErr) }];
      data.degraded = true;
    }
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const historico = data.results?.dividendos?.historico || data.results?.historicoDividendos || [];
    const agenda = await fetchInvestidor10DividendAgenda([ticker], { assetClass: data.type === 'FII' ? 'FII' : 'ACAO', timeoutMs: clampNumber(q.timeoutMs || q.agendaTimeoutMs, 9000, 1000, 18000) });
    const events = [...(agenda.events || []), ...historico.map(x => ({ ...x, ticker, status: 'Recebido', source: x.source || 'Investidor10 Página do Ativo' }))];
    const upcoming = events.map(x => ({ ...x, _pag: parseBRDate(x.paymentDate || x.dataPagamento), _com: parseBRDate(x.dateCom || x.dataCom) })).filter(x => (x._pag && x._pag >= today) || (!x._pag && x._com && x._com >= today)).sort((a, b) => (a._pag || a._com) - (b._pag || b._com));
    const history = events.map(x => ({ ...x, _pag: parseBRDate(x.paymentDate || x.dataPagamento), _com: parseBRDate(x.dateCom || x.dataCom) })).filter(x => !((x._pag && x._pag >= today) || (!x._pag && x._com && x._com >= today))).sort((a, b) => (b._pag || b._com || 0) - (a._pag || a._com || 0));
    const last = history[0] || historico[0] || null;
    const next = upcoming[0] || null;
    for (const x of [next, last]) if (x) { delete x._pag; delete x._com; }
    return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, ticker, type: data.type, nextDividend: next, upcoming: next, lastDividend: last, events, dividends: events, proventos: events, upcomingEvents: upcoming.map(({ _pag, _com, ...x }) => x), historyEvents: history.map(({ _pag, _com, ...x }) => x), upcomingCount: upcoming.length, agendaDiagnostics: agenda.diagnostics || [], quality: data.quality }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'next-dividend', cacheControl: 'private, max-age=30, stale-while-revalidate=300' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'next-dividend' });
  }
}
