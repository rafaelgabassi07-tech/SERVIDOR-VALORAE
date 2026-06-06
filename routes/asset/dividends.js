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
      const agenda = await fetchInvestidor10DividendAgenda([ticker], { assetClass: type === 'FII' ? 'FII' : 'ACAO', timeoutMs: clampNumber(q.timeoutMs || q.agendaTimeoutMs, 9000, 1000, 18000) });
      agendaEvents = agenda.events || [];
      agendaDiagnostics = agenda.diagnostics || [];
    }
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const parseDate = (d) => { const s = String(d || '').trim(); const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/); if (m) { const y = String(m[3]).length === 2 ? `20${m[3]}` : m[3]; return new Date(`${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}T00:00:00Z`); } const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/); return iso ? new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`) : null; };
    const dateToIso = (d) => { const m = String(d || '').trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/); if(!m) return ''; const y = String(m[3]).length===2? `20${m[3]}`:m[3]; return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`; };

    const normalizedHistory = historico.map(row => {
      const paymentDate = row.paymentDate || row.dataPagamento || '';
      const dateCom = row.dateCom || row.dataCom || '';
      const v = Number(row.valuePerShare ?? row.valor ?? row.value ?? row.amount ?? 0) || 0;
      const t = row.type || row.tipo || row.eventType || 'Provento';
      return {
        ...row,
        ticker,
        symbol: ticker,
        assetType: type,
        valuePerShare: v,
        valor: v,
        value: v,
        amount: v,
        valueFormatted: `R$ ${v.toFixed(2).replace('.', ',')}`,
        currency: 'BRL',
        type: t,
        tipo: t,
        eventType: t,
        paymentDate,
        dataPagamento: paymentDate,
        paymentDateIso: dateToIso(paymentDate),
        dateCom,
        dataCom: dateCom,
        dataComIso: dateToIso(dateCom),
        status: String(row.status || 'pago').toLowerCase(),
        source: row.source || 'investidor10',
        sourceUrl: row.sourceUrl || `https://investidor10.com.br/${String(type).toLowerCase()==='fii'?'fiis':'acoes'}/${String(ticker).toLowerCase()}/`
      };
    });
    
    // Normalize agenda events to match
    const normalizedAgenda = agendaEvents.map(row => {
      const paymentDate = row.paymentDate || row.dataPagamento || '';
      const dateCom = row.dateCom || row.dataCom || '';
      const v = Number(row.valuePerShare ?? row.valor ?? row.value ?? row.amount ?? 0) || 0;
      const t = row.type || row.tipo || row.eventType || 'Provento';
      return {
        ...row,
        ticker,
        symbol: ticker,
        assetType: type,
        valuePerShare: v,
        valor: v,
        value: v,
        amount: v,
        valueFormatted: `R$ ${v.toFixed(2).replace('.', ',')}`,
        currency: 'BRL',
        type: t,
        tipo: t,
        eventType: t,
        paymentDate,
        dataPagamento: paymentDate,
        paymentDateIso: dateToIso(paymentDate),
        dateCom,
        dataCom: dateCom,
        dataComIso: dateToIso(dateCom),
        status: String(row.status || 'previsto').toLowerCase(),
        source: row.source || 'investidor10',
        sourceUrl: row.sourceUrl || `https://investidor10.com.br/${String(type).toLowerCase()==='fii'?'fiis':'acoes'}/${String(ticker).toLowerCase()}/`
      };
    });

    const merged = [...normalizedAgenda, ...normalizedHistory]
      .filter((e, idx, arr) => arr.findIndex(x => [x.ticker, x.dateCom, x.paymentDate, x.type, x.valuePerShare].join('|') === [e.ticker, e.dateCom, e.paymentDate, e.type, e.valuePerShare].join('|')) === idx);

    const decorated = merged.map(e => ({ ...e, _pag: parseDate(e.paymentDate || e.dataPagamento), _com: parseDate(e.dateCom || e.dataCom) }));
    const upcomingEvents = decorated
      .filter(e => (e._pag && e._pag >= today) || (!e._pag && e._com && e._com >= today))
      .sort((a, b) => (a._pag || a._com || 0) - (b._pag || b._com || 0))
      .map(({ _pag, _com, ...e }) => ({...e, status: 'previsto'}));
    const historyEvents = decorated
      .filter(e => !((e._pag && e._pag >= today) || (!e._pag && e._com && e._com >= today)))
      .sort((a, b) => (b._pag || b._com || 0) - (a._pag || a._com || 0))
      .map(({ _pag, _com, ...e }) => ({...e, status: 'pago'}));

    const events = [...upcomingEvents, ...historyEvents];

    return sendJson(req, res, {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      ticker,
      type,
      dividendYield: data.results?.dividendos?.dividendYield || data.results?.dividendYield,
      dyMedio5a: data.results?.dividendos?.dyMedio5a || data.results?.dyMedio5a,
      count: events.length,
      historico: events,
      history: events,
      events,
      items: events,
      dividends: events,
      dividendos: events,
      proventos: events,
      agendaEvents: events,
      upcomingEvents,
      historyEvents,
      upcomingCount: upcomingEvents.length,
      historyCount: historyEvents.length,
      totalCount: events.length,
      source: 'investidor10',
      status: 'ok',
      agendaDiagnostics,
      quality: data.quality
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'dividends', cacheControl: 'private, max-age=30, stale-while-revalidate=300' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'dividends' });
  }
}
