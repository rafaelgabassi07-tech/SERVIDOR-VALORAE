import { ValoraeEngine, canonicalizeTicker, validarTicker, inferAssetType } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { fetchInvestidor10DividendAgenda } from '../../lib/market/investidor10-dividend-agenda.js';
import { beginRoute, boolParam, parseList, clampNumber, resolveSelfScrapeUrl, sendRouteError } from '../../lib/http/route.js';

const MAX_TICKERS = Number(process.env.VALORAE_PORTFOLIO_DIVIDENDS_MAX_TICKERS || 30);

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
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET', 'POST'], route: 'portfolio-dividends', rateMax: Number(process.env.VALORAE_RATE_LIMIT_PORTFOLIO_MAX || 60), profile: 'portfolio' });
  if (route.done) return;
  try {
    const q = route.input;
    const positionTickers = Array.isArray(q.positions) ? q.positions.map(p => p?.ticker).filter(Boolean) : [];
    const raw = parseList(q.tickers || q.ticker || positionTickers.join(',')).map(String).map(s => s.trim()).filter(Boolean);
    if (!raw.length) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: 'Envie tickers=PETR4,GARE11' }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'portfolio' });
    if (raw.length > MAX_TICKERS) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: `Máximo de ${MAX_TICKERS} tickers.` }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'portfolio' });
    const tickers = [];
    const errors = [];
    for (const item of raw) {
      const t = canonicalizeTicker(item);
      const err = validarTicker(t);
      if (err) errors.push({ ticker: item, error: err });
      else tickers.push(t);
    }
    if (!tickers.length) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: 'Nenhum ticker válido enviado.', errors }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'portfolio' });
    const batch = await ValoraeEngine.fetchAtivosBatch(tickers, { mode: q.mode || 'super', includeNews: false, view: 'compact', maxConcurrency: clampNumber(q.maxConcurrency || q.concurrency, 4, 1, 6), cache: !boolParam(q.nocache || q.refresh), valoraeScrapeUrl: resolveSelfScrapeUrl(req, q), profile: q.profile || 'portfolio' });
    const agenda = boolParam(q.includeUpcoming || q.complete || q.upcoming, true)
      ? await fetchInvestidor10DividendAgenda(tickers, { timeoutMs: clampNumber(q.timeoutMs || q.agendaTimeoutMs, 9000, 1000, 18000) })
      : { events: [], diagnostics: [] };
    const agendaByTicker = new Map();
    for (const ev of agenda.events || []) {
      const k = canonicalizeTicker(ev.ticker);
      if (!agendaByTicker.has(k)) agendaByTicker.set(k, []);
      agendaByTicker.get(k).push(normalizeDividendEvent(ev, k, 'Previsto'));
    }
    const events = [];
    const items = batch.assets.map(a => {
      const h = [
        ...(agendaByTicker.get(a.ticker) || []),
        ...dividendHistoryFromAsset(a).map(row => normalizeDividendEvent(row, a.ticker, 'Recebido'))
      ].filter(e => e.valuePerShare > 0 || e.paymentDate || e.dateCom)
        .filter((e, idx, arr) => arr.findIndex(x => [x.ticker, x.dateCom, x.paymentDate, x.type, x.valuePerShare].join('|') === [e.ticker, e.dateCom, e.paymentDate, e.type, e.valuePerShare].join('|')) === idx);
      events.push(...h);
      return {
        ticker: a.ticker,
        type: a.type,
        dividendYield: a.results?.dividendos?.dividendYield || a.results?.dividendYield,
        dyMedio5a: a.results?.dividendos?.dyMedio5a || a.results?.dyMedio5a,
        ultimo: h[0] || null,
        historico: h,
        events: h,
        historicoCount: h.length,
        quality: a.quality?.score,
      };
    });
    return sendJson(req, res, {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      endpoint: 'portfolio-dividends',
      count: items.length,
      items,
      events,
      dividends: events,
      proventos: events,
      agendaDiagnostics: agenda.diagnostics || [],
      stats: batch.stats,
      errors: [...errors, ...batch.errors],
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'portfolio', cacheControl: 'private, max-age=30, stale-while-revalidate=300' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'portfolio' });
  }
}
