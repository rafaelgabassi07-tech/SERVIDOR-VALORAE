import { ValoraeEngine, canonicalizeTicker, validarTicker, inferAssetType } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { fetchInvestidor10DividendAgenda } from '../../lib/market/investidor10-dividend-agenda.js';
import { beginRoute, boolParam, parseList, clampNumber, resolveSelfScrapeUrl, sendRouteError } from '../../lib/http/route.js';

const MAX_TICKERS = Number(process.env.VALORAE_PORTFOLIO_DIVIDENDS_MAX_TICKERS || 30);
function parseBRDate(d) {
  const s = String(d || '').trim();
  const br = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/);
  if (br) {
    const y = String(br[3]).length === 2 ? `20${br[3]}` : br[3];
    return new Date(`${y}-${String(br[2]).padStart(2, '0')}-${String(br[1]).padStart(2, '0')}T00:00:00Z`);
  }
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
  return null;
}
function firstText(...values) {
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}
function firstNumber(...values) {
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v).replace(/R\$/gi, '').replace(/%/g, '').trim();
    const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
    const n = Number(normalized);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}
function splitDividendEvents(events = []) {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const decorated = (events || []).map(e => ({ ...e, _pag: parseBRDate(e.paymentDate || e.dataPagamento), _com: parseBRDate(e.dateCom || e.dataCom) }));
  const upcomingEvents = decorated
    .filter(e => (e._pag && e._pag >= today) || (!e._pag && e._com && e._com >= today))
    .sort((a, b) => (a._pag || a._com || 0) - (b._pag || b._com || 0))
    .map(({ _pag, _com, ...e }) => ({ ...e, status: String(firstText(e.status, 'previsto')).toLowerCase() }));
  const historyEvents = decorated
    .filter(e => !((e._pag && e._pag >= today) || (!e._pag && e._com && e._com >= today)))
    .sort((a, b) => (b._pag || b._com || 0) - (a._pag || a._com || 0))
    .map(({ _pag, _com, ...e }) => ({ ...e, status: String(firstText(e.status, 'pago')).toLowerCase() }));
  return { upcomingEvents, historyEvents, agendaEvents: [...upcomingEvents, ...historyEvents] };
}
const dateToIso = (d) => { const m = String(d || '').match(/(\d{2})\/(\d{2})\/(\d{4}|\d{2})/); if(!m) return ''; const y = String(m[3]).length===2? `20${m[3]}`:m[3]; return `${y}-${m[2]}-${m[1]}`; };

function normalizeDividendEvent(row = {}, ticker = '', status = '') {
  const valuePerShare = firstNumber(row.valuePerShare, row.valorPorCota, row.valorPorAcao, row.valor, row.value, row.amount, row.dividend, row.rendimento, row.provento, row.cashAmount);
  const type = firstText(row.type, row.tipo, row.kind, row.eventType, 'Provento');
  const paymentDate = firstText(row.paymentDate, row.payDate, row.dataPagamento, row.dataPagamentoPrevista, row.dataPagto, row.date, row.data);
  const dateCom = firstText(row.dateCom, row.comDate, row.dataCom, row.recordDate, row.dataBase);
  const t = firstText(row.ticker, row.symbol, row.codigo, ticker).toUpperCase();
  const assetType = row.assetType || row.assetClass || inferAssetType(t) || 'ACAO';
  return {
    ticker: t,
    symbol: t,
    assetType,
    type,
    tipo: type,
    eventType: type,
    dateCom,
    dataCom: dateCom,
    dataComIso: dateToIso(dateCom),
    paymentDate,
    dataPagamento: paymentDate,
    paymentDateIso: dateToIso(paymentDate),
    valuePerShare,
    valor: valuePerShare,
    value: valuePerShare,
    amount: valuePerShare,
    valueFormatted: `R$ ${valuePerShare.toFixed(2).replace('.', ',')}`,
    currency: 'BRL',
    status: String(firstText(row.status, status)).toLowerCase(),
    source: firstText(row.source, 'investidor10'),
    sourceUrl: row.sourceUrl || `https://investidor10.com.br/${assetType.toLowerCase()==='fii'?'fiis':'acoes'}/${t.toLowerCase()}/`
  };
}
function dividendHistoryFromAsset(asset = {}) {
  const r = asset.results || {};
  const divs = r.dividendos || r.dividends || r.proventos || {};
  return divs.historico || divs.history || divs.items || r.historicoDividendos || r.historicoProventos || r.proventos || [];
}

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET', 'POST'], route: 'portfolio-next-dividends', rateMax: Number(process.env.VALORAE_RATE_LIMIT_PORTFOLIO_MAX || 60), profile: 'portfolio' });
  if (route.done) return;
  try {
    const q = route.input;
    const positionTickers = Array.isArray(q.positions) ? q.positions.map(p => p?.ticker).filter(Boolean) : [];
    const raw = parseList(q.tickers || q.ticker || positionTickers.join(',')).map(String).map(s => s.trim()).filter(Boolean);
    if (!raw.length) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: 'Envie tickers=PETR4,GARE11' }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'portfolio' });
    if (raw.length > MAX_TICKERS) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: `Máximo de ${MAX_TICKERS} tickers.` }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'portfolio' });
    const tickers = [];
    const inputErrors = [];
    for (const item of raw) {
      const t = canonicalizeTicker(item);
      const err = validarTicker(t);
      if (err) inputErrors.push({ ticker: item, error: err }); else tickers.push(t);
    }
    const batch = await ValoraeEngine.fetchAtivosBatch(tickers, { mode: q.mode || 'super', includeNews: false, view: 'full', maxConcurrency: clampNumber(q.maxConcurrency || q.concurrency, 4, 1, 6), cache: !boolParam(q.nocache || q.refresh), valoraeScrapeUrl: resolveSelfScrapeUrl(req, q), profile: q.profile || 'portfolio' });
    const agenda = boolParam(q.includeUpcoming || q.complete || q.upcoming, true)
      ? await fetchInvestidor10DividendAgenda(tickers, { timeoutMs: clampNumber(q.timeoutMs || q.agendaTimeoutMs, 9000, 1000, 18000) })
      : { events: [], diagnostics: [] };
    const agendaByTicker = new Map();
    for (const ev of agenda.events || []) {
      const k = canonicalizeTicker(ev.ticker);
      if (!agendaByTicker.has(k)) agendaByTicker.set(k, []);
      agendaByTicker.get(k).push(normalizeDividendEvent(ev, k, 'Previsto'));
    }
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const events = [];
    const items = batch.assets.map(a => {
      const historico = dividendHistoryFromAsset(a).map(row => normalizeDividendEvent(row, a.ticker, 'recebido')).filter(e => e.valuePerShare > 0 || e.paymentDate || e.dateCom);
      const merged = [...(agendaByTicker.get(a.ticker) || []), ...historico]
        .filter((e, idx, arr) => arr.findIndex(x => [x.ticker, x.dateCom, x.paymentDate, x.type, x.valuePerShare].join('|') === [e.ticker, e.dateCom, e.paymentDate, e.type, e.valuePerShare].join('|')) === idx);
      
      const parts = splitDividendEvents(merged);
      events.push(...parts.agendaEvents);
      
      const next = parts.upcomingEvents[0] || null;
      return {
        ticker: a.ticker,
        type: a.type,
        nextDividend: next,
        upcoming: next,
        lastDividend: parts.historyEvents[0] || historico[0] || null,
        historico: parts.agendaEvents,
        events: parts.agendaEvents,
        upcomingEvents: parts.upcomingEvents,
        historyEvents: parts.historyEvents,
        upcomingCount: parts.upcomingEvents.length,
        historicoCount: parts.historyEvents.length,
        quality: a.quality?.score,
      };
    });
    const parsedAll = splitDividendEvents(events);
    return sendJson(req, res, {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      endpoint: 'portfolio-next-dividends',
      count: parsedAll.upcomingEvents.length,
      items,
      events: parsedAll.agendaEvents,
      dividends: parsedAll.agendaEvents,
      dividendos: parsedAll.agendaEvents,
      proventos: parsedAll.agendaEvents,
      upcomingEvents: parsedAll.upcomingEvents,
      historyEvents: parsedAll.historyEvents,
      agendaEvents: parsedAll.agendaEvents,
      upcomingCount: parsedAll.upcomingEvents.length,
      historyCount: parsedAll.historyEvents.length,
      agendaDiagnostics: agenda.diagnostics || [],
      stats: batch.stats,
      errors: [...inputErrors, ...batch.errors],
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'portfolio', cacheControl: 'private, max-age=30, stale-while-revalidate=300' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'portfolio' });
  }
}
