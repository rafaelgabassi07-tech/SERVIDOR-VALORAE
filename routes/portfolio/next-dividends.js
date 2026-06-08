import { ValoraeEngine, canonicalizeTicker, validarTicker, inferAssetType } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { fetchInvestidor10DividendAgenda } from '../../lib/market/investidor10-dividend-agenda.js';
import { beginRoute, boolParam, parseList, clampNumber, resolveSelfScrapeUrl, sendRouteError } from '../../lib/http/route.js';

const MAX_TICKERS = Number(process.env.VALORAE_PORTFOLIO_DIVIDENDS_MAX_TICKERS || 30);
function parseBRDate(d) {
  const s = String(d || '').trim();
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{2}|\d{4})/);
  if (br) { const y = String(br[3]).length === 2 ? `20${br[3]}` : br[3]; return new Date(`${y}-${br[2]}-${br[1]}T00:00:00Z`); }
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
  const tickerOut = firstText(row.ticker, row.symbol, row.codigo, ticker).toUpperCase();
  const dateCom = firstText(row.dateCom, row.comDate, row.dataCom, row.recordDate, row.dataBase);
  const paymentDate = firstText(row.paymentDate, row.payDate, row.dataPagamento, row.dataPagamentoPrevista, row.dataPagto, row.date, row.data);
  const confirmed = Boolean(paymentDate);
  const provisioned = !confirmed && /provision|anunci|jscp|jcp|dividend|rendimento|amort/i.test(firstText(row.paymentStatus, row.status, type));
  const finalStatus = firstText(row.status, status, confirmed ? 'Confirmado' : provisioned ? 'Anunciado/Provisionado' : 'Anunciado');
  return {
    ticker: tickerOut,
    asset: tickerOut,
    symbol: tickerOut,
    codigo: tickerOut,
    dateCom,
    dataCom: dateCom,
    comDate: dateCom,
    recordDate: dateCom,
    paymentDate,
    payDate: paymentDate,
    dataPagamento: paymentDate,
    valuePerShare,
    value: valuePerShare,
    amount: valuePerShare,
    valor: valuePerShare,
    type,
    kind: type,
    tipo: type,
    dividendType: type,
    status: finalStatus,
    paymentStatus: confirmed ? 'CONFIRMED' : provisioned ? 'PROVISIONED' : 'ANNOUNCED',
    announcementStatus: 'ANNOUNCED',
    announced: Boolean(dateCom || valuePerShare > 0),
    confirmed,
    provisioned,
    source: firstText(row.source, 'Investidor10/VALORAE'),
  };
}

function normalizeAgendaAssetClass(value = '') {
  const s = String(value || '').trim().toUpperCase();
  if (/FII|FUNDO|IMOB/.test(s)) return 'FII';
  if (/ACAO|AÇÃO|ACOES|AÇÕES|STOCK|ON|PN|UNIT/.test(s)) return 'ACAO';
  return '';
}
function assetClassFromPositions(positions = []) {
  if (!Array.isArray(positions)) return '';
  const classes = new Set(positions.map(p => normalizeAgendaAssetClass(p?.type || p?.assetClass || p?.classe || p?.category)).filter(Boolean));
  return classes.size === 1 ? Array.from(classes)[0] : '';
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
    let batch = { assets: [], stats: {}, errors: [] };
    try {
      batch = await ValoraeEngine.fetchAtivosBatch(tickers, { mode: q.mode || 'super', includeNews: false, view: 'full', maxConcurrency: clampNumber(q.maxConcurrency || q.concurrency, 4, 1, 6), cache: !boolParam(q.nocache || q.refresh), valoraeScrapeUrl: resolveSelfScrapeUrl(req, q), profile: q.profile || 'portfolio' });
    } catch (err) {
      batch.errors = [{ scope: 'fetchAtivosBatch', error: err?.message || String(err) }];
    }
    const agendaOptions = {
      timeoutMs: clampNumber(q.timeoutMs || q.agendaTimeoutMs, 9000, 1000, 18000),
      historyMonths: clampNumber(q.historyMonths || q.monthsBack || q.pastMonths, 36, 0, 72),
      futureMonths: clampNumber(q.futureMonths || q.monthsForward || q.horizonMonths, 18, 0, 72),
      startDate: q.startDate || q.portfolioCreatedAt || q.createdAt,
      concurrency: clampNumber(q.agendaConcurrency || q.concurrency, 4, 1, 8),
      assetClass: normalizeAgendaAssetClass(q.assetClass || q.type || q.classe) || assetClassFromPositions(q.positions),
    };
    const agenda = boolParam(q.includeUpcoming || q.complete || q.upcoming, true)
      ? await fetchInvestidor10DividendAgenda(tickers, agendaOptions)
      : { events: [], diagnostics: [], range: agendaOptions };
    const agendaByTicker = new Map();
    for (const ev of agenda.events || []) {
      const k = canonicalizeTicker(ev.ticker);
      if (!agendaByTicker.has(k)) agendaByTicker.set(k, []);
      agendaByTicker.get(k).push(normalizeDividendEvent(ev, k, 'Previsto'));
    }
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const events = [];
    const upcomingEvents = [];
    const historyEvents = [];
    const assetByTicker = new Map((batch.assets || []).map(a => [canonicalizeTicker(a.ticker), a]));
    const itemAssets = tickers.map(t => assetByTicker.get(t) || { ticker: t, type: inferAssetType(t), results: {}, quality: null });
    const items = itemAssets.map(a => {
      const historico = dividendHistoryFromAsset(a).map(row => normalizeDividendEvent(row, a.ticker, 'Recebido')).filter(e => e.valuePerShare > 0 || e.paymentDate || e.dateCom);
      const merged = [...(agendaByTicker.get(a.ticker) || []), ...historico]
        .filter((e, idx, arr) => arr.findIndex(x => [x.ticker, x.dateCom, x.paymentDate, x.type, x.valuePerShare].join('|') === [e.ticker, e.dateCom, e.paymentDate, e.type, e.valuePerShare].join('|')) === idx);
      const upcoming = merged
        .map(x => ({ ...x, _pag: parseBRDate(x.paymentDate), _com: parseBRDate(x.dateCom) }))
        .filter(x => (x._pag && x._pag >= today) || (!x._pag && x._com && x._com >= today))
        .sort((x, y) => (x._pag || x._com || 0) - (y._pag || y._com || 0))
        .map(({ _pag, _com, ...x }) => ({ ...x, status: firstText(x.status, 'Previsto') }));
      const history = merged
        .map(x => ({ ...x, _pag: parseBRDate(x.paymentDate), _com: parseBRDate(x.dateCom) }))
        .filter(x => !((x._pag && x._pag >= today) || (!x._pag && x._com && x._com >= today)))
        .sort((x, y) => (y._pag || y._com || 0) - (x._pag || x._com || 0))
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
        historico: merged,
        events: merged,
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
      agendaDiagnostics: agenda.diagnostics || [],
      agendaRange: agenda.range || agendaOptions,
      stats: batch.stats,
      errors: [...inputErrors, ...batch.errors],
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'portfolio', cacheControl: 'private, max-age=30, stale-while-revalidate=300' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'portfolio' });
  }
}
