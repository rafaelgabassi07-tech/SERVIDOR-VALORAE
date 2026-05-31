import { ValoraeEngine, canonicalizeTicker, validarTicker } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute, boolParam, parseList, clampNumber, resolveSelfScrapeUrl, sendRouteError } from '../../lib/http/route.js';

const MAX_TICKERS = Number(process.env.VALORAE_PORTFOLIO_DIVIDENDS_MAX_TICKERS || 30);
function parseBRDate(d) {
  const s = String(d || '').trim();
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(`${br[3]}-${br[2]}-${br[1]}T00:00:00Z`);
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
function normalizeDividendEvent(row = {}, ticker = '', status = '') {
  const valuePerShare = firstNumber(row.valuePerShare, row.valorPorCota, row.valorPorAcao, row.valor, row.value, row.amount, row.dividend, row.rendimento, row.provento, row.cashAmount);
  const type = firstText(row.type, row.tipo, row.kind, 'Provento');
  return {
    ticker: firstText(row.ticker, row.symbol, row.codigo, ticker).toUpperCase(),
    dateCom: firstText(row.dateCom, row.comDate, row.dataCom, row.recordDate, row.dataBase),
    paymentDate: firstText(row.paymentDate, row.payDate, row.dataPagamento, row.dataPagamentoPrevista, row.dataPagto, row.date, row.data),
    valuePerShare,
    valor: valuePerShare,
    type,
    tipo: type,
    status: firstText(row.status, status),
    source: firstText(row.source, 'Investidor10/VALORAE'),
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
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const events = [];
    const upcomingEvents = [];
    const historyEvents = [];
    const items = batch.assets.map(a => {
      const historico = dividendHistoryFromAsset(a).map(row => normalizeDividendEvent(row, a.ticker, 'Recebido')).filter(e => e.valuePerShare > 0 || e.paymentDate || e.dateCom);
      const upcoming = historico
        .map(x => ({ ...x, _pag: parseBRDate(x.paymentDate), _com: parseBRDate(x.dateCom) }))
        .filter(x => x._pag && x._pag >= today)
        .sort((x, y) => x._pag - y._pag)
        .map(({ _pag, _com, ...x }) => ({ ...x, status: firstText(x.status, 'Previsto') }));
      const history = historico
        .map(x => ({ ...x, _pag: parseBRDate(x.paymentDate), _com: parseBRDate(x.dateCom) }))
        .filter(x => !x._pag || x._pag < today)
        .sort((x, y) => (y._pag || 0) - (x._pag || 0))
        .map(({ _pag, _com, ...x }) => x);
      const next = upcoming[0] || null;
      events.push(...upcoming, ...history);
      upcomingEvents.push(...upcoming);
      historyEvents.push(...history);
      return {
        ticker: a.ticker,
        type: a.type,
        nextDividend: next,
        upcoming: next,
        lastDividend: history[0] || historico[0] || null,
        historico,
        events: historico,
        upcomingEvents: upcoming,
        historyEvents: history,
        upcomingCount: upcoming.length,
        historicoCount: historico.length,
        quality: a.quality?.score,
      };
    });
    return sendJson(req, res, {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      endpoint: 'portfolio-next-dividends',
      count: items.length,
      items,
      events,
      dividends: events,
      proventos: events,
      upcomingEvents,
      historyEvents,
      stats: batch.stats,
      errors: [...inputErrors, ...batch.errors],
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'portfolio', cacheControl: 'private, max-age=30, stale-while-revalidate=300' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'portfolio' });
  }
}
