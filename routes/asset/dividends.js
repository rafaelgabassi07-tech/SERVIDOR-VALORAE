import { ValoraeEngine, canonicalizeTicker, inferAssetType, validarTicker } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { fetchInvestidor10DividendAgenda } from '../../lib/market/investidor10-dividend-agenda.js';
import { beginRoute, boolParam, resolveSelfScrapeUrl, sendRouteError, clampNumber } from '../../lib/http/route.js';

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET', 'POST'], route: 'asset-dividends', rateMax: Number(process.env.VALORAE_RATE_LIMIT_DIVIDENDS_MAX || 90), profile: 'dividends' });
  if (route.done) return;
  try {
    const q = route.input;
    const ticker = canonicalizeTicker(q.ticker);
    const err = validarTicker(ticker);
    if (err) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: err }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'dividends' });
    const data = await ValoraeEngine.fetchAtivo(ticker, inferAssetType(ticker), { mode: q.mode || 'super', includeNews: false, view: 'full', cache: !boolParam(q.nocache || q.refresh), bypassCache: boolParam(q.nocache || q.refresh), valoraeScrapeUrl: resolveSelfScrapeUrl(req, q), profile: q.profile || 'standard' });
    const type = data.type || inferAssetType(ticker);
    const historico = data.results?.dividendos?.historico || data.results?.dividends?.history || data.results?.historicoDividendos || [];
    const wantsUpcoming = boolParam(q.includeUpcoming || q.upcoming || q.complete, String(q.mode || '').toLowerCase() === 'complete');
    let agendaEvents = [];
    let agendaDiagnostics = [];
    if (wantsUpcoming) {
      const agenda = await fetchInvestidor10DividendAgenda([ticker], { assetClass: type === 'FII' ? 'FII' : 'ACAO', timeoutMs: clampNumber(q.timeoutMs || q.agendaTimeoutMs, 9000, 1000, 18000), historyMonths: clampNumber(q.historyMonths || q.monthsBack || q.pastMonths, 36, 0, 72), futureMonths: clampNumber(q.futureMonths || q.monthsForward || q.horizonMonths, 18, 0, 72), startDate: q.startDate || q.portfolioCreatedAt || q.createdAt, concurrency: clampNumber(q.agendaConcurrency || q.concurrency, 4, 1, 8) });
      agendaEvents = agenda.events || [];
      agendaDiagnostics = agenda.diagnostics || [];
    }
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const parseDate = (d) => { const s = String(d || ''); const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/); if (m) { const y = String(m[3]).length === 2 ? `20${m[3]}` : m[3]; return new Date(`${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}T00:00:00Z`); } const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/); return iso ? new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`) : null; };
    const normalizedHistory = historico.map(row => ({
      ...row,
      ticker,
      valuePerShare: Number(row.valuePerShare ?? row.valor ?? row.value ?? 0) || 0,
      valor: Number(row.valor ?? row.valuePerShare ?? row.value ?? 0) || 0,
      type: row.type || row.tipo || 'Provento',
      tipo: row.tipo || row.type || 'Provento',
      paymentDate: row.paymentDate || row.dataPagamento || '',
      dataPagamento: row.dataPagamento || row.paymentDate || '',
      dateCom: row.dateCom || row.dataCom || '',
      dataCom: row.dataCom || row.dateCom || '',
      status: row.status || 'Recebido',
      source: row.source || 'Investidor10 Página do Ativo'
    }));
    const events = [...agendaEvents, ...normalizedHistory];
    const upcomingEvents = events.filter(e => { const d = parseDate(e.paymentDate || e.dataPagamento || e.dateCom || e.dataCom); return d && d >= today; });
    const historyEvents = events.filter(e => { const d = parseDate(e.paymentDate || e.dataPagamento || e.dateCom || e.dataCom); return !d || d < today; });
    return sendJson(req, res, {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      ticker,
      type,
      dividendYield: data.results?.dividendos?.dividendYield || data.results?.dividendYield,
      dyMedio5a: data.results?.dividendos?.dyMedio5a || data.results?.dyMedio5a,
      count: events.length,
      historico: normalizedHistory,
      history: normalizedHistory,
      events,
      items: events,
      dividends: events,
      dividendos: events,
      proventos: events,
      agendaEvents: events,
      upcomingEvents,
      historyEvents,
      upcomingCount: upcomingEvents.length,
      agendaDiagnostics,
      quality: data.quality
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'dividends', cacheControl: 'private, max-age=30, stale-while-revalidate=300' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'dividends' });
  }
}
