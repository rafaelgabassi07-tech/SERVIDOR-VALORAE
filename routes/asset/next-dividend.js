import { ValoraeEngine, canonicalizeTicker, inferAssetType, validarTicker } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { fetchInvestidor10DividendAgenda } from '../../lib/market/investidor10-dividend-agenda.js';
import { beginRoute, boolParam, resolveSelfScrapeUrl, sendRouteError, clampNumber } from '../../lib/http/route.js';

function parseBRDate(d) {
  const s = String(d || '').trim();
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/);
  if (m) { const y = String(m[3]).length === 2 ? `20${m[3]}` : m[3]; return new Date(`${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}T00:00:00Z`); }
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
  return null;
}
const dateToIso = (d) => { const m = String(d || '').trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/); if(!m) return ''; const y = String(m[3]).length===2? `20${m[3]}`:m[3]; return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`; };

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET', 'POST'], route: 'asset-next-dividend', rateMax: Number(process.env.VALORAE_RATE_LIMIT_DIVIDENDS_MAX || 90), profile: 'next-dividend' });
  if (route.done) return;
  try {
    const q = route.input;
    const ticker = canonicalizeTicker(q.ticker);
    const err = validarTicker(ticker);
    if (err) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: err }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'next-dividend' });
    const data = await ValoraeEngine.fetchAtivo(ticker, inferAssetType(ticker), { mode: q.mode || 'super', includeNews: false, view: 'full', cache: !boolParam(q.nocache || q.refresh), bypassCache: boolParam(q.nocache || q.refresh), valoraeScrapeUrl: resolveSelfScrapeUrl(req, q), profile: q.profile || 'standard' });
    const type = data.type || inferAssetType(ticker);
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const historico = data.results?.dividendos?.historico || data.results?.historicoDividendos || [];
    
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

    const agenda = await fetchInvestidor10DividendAgenda([ticker], { assetClass: data.type === 'FII' ? 'FII' : 'ACAO', timeoutMs: clampNumber(q.timeoutMs || q.agendaTimeoutMs, 9000, 1000, 18000) });
    
    // Normalize agenda events to match
    const normalizedAgenda = (agenda.events || []).map(row => {
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

    const decorated = merged.map(x => ({ ...x, _pag: parseBRDate(x.paymentDate), _com: parseBRDate(x.dateCom) }));
    
    const upcoming = decorated
      .filter(x => (x._pag && x._pag >= today) || (!x._pag && x._com && x._com >= today))
      .sort((a, b) => (a._pag || a._com) - (b._pag || b._com))
      .map(({ _pag, _com, ...x }) => ({ ...x, status: 'previsto' }));
      
    const history = decorated
      .filter(x => !((x._pag && x._pag >= today) || (!x._pag && x._com && x._com >= today)))
      .sort((a, b) => (b._pag || b._com || 0) - (a._pag || a._com || 0))
      .map(({ _pag, _com, ...x }) => ({ ...x, status: 'pago' }));

    const events = [...upcoming, ...history];
    const last = history[0] || null;
    const next = upcoming[0] || null;

    return sendJson(req, res, { 
      version: ValoraeEngine.version, 
      requestId: route.requestId, 
      ticker, 
      type: type, 
      nextDividend: next, 
      upcoming: next, 
      lastDividend: last, 
      events, 
      items: events,
      dividends: events, 
      dividendos: events,
      proventos: events,
      historico: events,
      history: events,
      agendaEvents: events,
      upcomingEvents: upcoming, 
      historyEvents: history, 
      upcomingCount: upcoming.length, 
      historyCount: history.length,
      totalCount: events.length,
      source: 'investidor10',
      status: 'ok',
      agendaDiagnostics: agenda.diagnostics || [], 
      quality: data.quality 
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'next-dividend', cacheControl: 'private, max-age=30, stale-while-revalidate=300' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'next-dividend' });
  }
}
