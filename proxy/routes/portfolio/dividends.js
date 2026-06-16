import { ValoraeEngine, canonicalizeTicker, validarTicker, inferAssetType } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { fetchInvestidor10DividendAgenda } from '../../lib/market/investidor10-dividend-agenda.js';
import { coalesce } from '../../lib/resilience/inflight.js';
import { beginRoute, boolParam, parseList, clampNumber, resolveSelfScrapeUrl, sendRouteError, withRouteDeadline } from '../../lib/http/route.js';

const MAX_TICKERS = Number(process.env.VALORAE_PORTFOLIO_DIVIDENDS_MAX_TICKERS || 45);

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
function parseBRDate(d) {
  const s = String(d || '').trim();
  const br = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})/);
  if (br) {
    const y = String(br[3]).length === 2 ? `20${br[3]}` : br[3];
    return new Date(`${y}-${String(br[2]).padStart(2, '0')}-${String(br[1]).padStart(2, '0')}T00:00:00Z`);
  }
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
  return null;
}

function formatBRDateUTC(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return '';
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
}
function previousBusinessDayText(raw = '') {
  const d = parseBRDate(raw);
  if (!d) return '';
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  do { out.setUTCDate(out.getUTCDate() - 1); } while (out.getUTCDay() === 0 || out.getUTCDay() === 6);
  return formatBRDateUTC(out);
}
function resolveDividendDates(row = {}) {
  const explicitDateCom = firstText(row.dateCom, row.comDate, row.dataCom, row.data_com, row.recordDate, row.dataBase, row.baseDate, row.lastDateCom);
  const exDate = firstText(row.exDate, row.dataEx, row.exDividendDate, row.dataExProvento, row.dateEx);
  const paymentDirect = firstText(row.paymentDate, row.payDate, row.dataPagamento, row.data_pagamento, row.dataPagamentoPrevista, row.dataPagto, row.pagamento, row.pgto);
  const genericDate = firstText(row.date, row.data);
  const statusText = firstText(row.status, row.paymentStatus, row.situacao, row.state, row.kind).toLowerCase();
  const genericLooksLikePayment = Boolean(genericDate) && (Boolean(explicitDateCom || exDate || paymentDirect) || /pag|pago|pay|receb|confirm|liquid/.test(statusText));
  const dateCom = explicitDateCom || previousBusinessDayText(exDate) || (!paymentDirect && !genericLooksLikePayment ? genericDate : '');
  const paymentDate = paymentDirect || (genericLooksLikePayment ? genericDate : '');
  return { dateCom, paymentDate, exDate, eligibilityDateSource: explicitDateCom ? 'dateCom' : exDate ? 'exDate-previous-business-day' : dateCom ? 'generic-date' : '' };
}

function splitDividendEvents(events = []) {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const pending = e => !firstText(e.paymentDate, e.dataPagamento, e.payDate) && /prev|futur|agenda|provision|anunci|a confirmar|sem data|confirm|dividend|rendimento|jcp|jscp/i.test(firstText(e.status, e.paymentStatus, e.type, e.kind, e.dateCom, e.dataCom));
  const decorated = (events || []).map(e => ({ ...e, _pag: parseBRDate(e.paymentDate || e.dataPagamento || e.payDate), _com: parseBRDate(e.dateCom || e.dataCom) }));
  const upcomingEvents = decorated
    .filter(e => (e._pag && e._pag >= today) || (!e._pag && (pending(e) || (e._com && e._com >= today))))
    .sort((a, b) => (a._pag || a._com || Number.MAX_SAFE_INTEGER) - (b._pag || b._com || Number.MAX_SAFE_INTEGER))
    .map(({ _pag, _com, ...e }) => ({ ...e, status: firstText(e.status, 'Previsto') }));
  const historyEvents = decorated
    .filter(e => !((e._pag && e._pag >= today) || (!e._pag && (pending(e) || (e._com && e._com >= today)))))
    .sort((a, b) => (b._pag || b._com || 0) - (a._pag || a._com || 0))
    .map(({ _pag, _com, ...e }) => e);
  return { upcomingEvents, historyEvents, agendaEvents: [...upcomingEvents, ...historyEvents] };
}
function normalizeDividendEvent(row = {}, ticker = '', status = '') {
  const valuePerShare = firstNumber(row.valuePerShare, row.valorPorCota, row.valorPorAcao, row.valor, row.value, row.amount, row.dividend, row.rendimento, row.provento, row.cashAmount);
  const dividendType = firstText(row.dividendType, row.type, row.tipo, row.kind, row.eventType, 'Provento');
  const tickerOut = firstText(row.ticker, row.symbol, row.codigo, ticker).toUpperCase();
  const { dateCom, paymentDate, exDate, eligibilityDateSource } = resolveDividendDates(row);
  const confirmed = Boolean(paymentDate);
  const provisioned = !confirmed && /provision|anunci|jscp|jcp|dividend|rendimento|amort/i.test(firstText(row.paymentStatus, row.status, row.situacao, dividendType));
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
    type: dividendType,
    kind: dividendType,
    tipo: dividendType,
    dividendType,
    exDate,
    eligibilityDateSource,
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
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET', 'POST'], route: 'portfolio-dividends', rateMax: Number(process.env.VALORAE_RATE_LIMIT_PORTFOLIO_MAX || 60), profile: 'portfolio' });
  if (route.done) return;
  try {
    const q = route.input;
    const positionTickers = Array.isArray(q.positions) ? q.positions.map(p => p?.ticker).filter(Boolean) : [];
    let raw = parseList(q.tickers || q.ticker || positionTickers.join(',')).map(String).map(s => s.trim()).filter(Boolean);
    if (!raw.length) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: 'Envie tickers=PETR4,GARE11' }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'portfolio' });
    const warnings = [];
    if (raw.length > MAX_TICKERS) {
      warnings.push({ scope: 'portfolio-dividends', message: `Carteira com ${raw.length} tickers; processando lote móvel de ${MAX_TICKERS} para preservar deadline.` });
      raw = raw.slice(0, MAX_TICKERS);
    }
    const tickers = [];
    const errors = [];
    for (const item of raw) {
      const t = canonicalizeTicker(item);
      const err = validarTicker(t);
      if (err) errors.push({ ticker: item, error: err });
      else tickers.push(t);
    }
    if (!tickers.length) return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, error: 'Nenhum ticker válido enviado.', errors }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'portfolio' });
    const compactMode = ['compact','boot','fast','mobile'].includes(String(q.mode || q.profile || '').toLowerCase());
    const routeDeadlineMs = clampNumber(q.routeDeadlineMs || q.deadlineMs, compactMode ? 7200 : 10500, 1000, 22000);
    const agendaOptions = {
      timeoutMs: clampNumber(q.timeoutMs || q.agendaTimeoutMs, compactMode ? 4200 : 10000, 1000, 20000),
      historyMonths: clampNumber(q.historyMonths || q.monthsBack || q.pastMonths, compactMode ? 24 : 48, 0, 72),
      futureMonths: clampNumber(q.futureMonths || q.monthsForward || q.horizonMonths, compactMode ? 18 : 24, 0, 72),
      startDate: q.startDate || q.portfolioCreatedAt || q.createdAt,
      concurrency: clampNumber(q.agendaConcurrency || q.concurrency, compactMode ? 5 : 5, 1, 8),
      futureFirst: boolParam(q.futureFirst || q.prioritizeFuture || q.upcomingFirst, true),
      priority: q.priority || q.priorityMode || 'upcoming-first',
      assetClass: normalizeAgendaAssetClass(q.assetClass || q.type || q.classe) || assetClassFromPositions(q.positions),
    };

    // Rodar fundamentos e agenda em paralelo é essencial para mobile: antes o handler
    // gastava um deadline no batch e só depois começava a agenda, dobrando a latência
    // percebida no APK. Cada bloco preserva fallback parcial e a resposta chega mais cedo.
    const batchPromise = withRouteDeadline(
      () => ValoraeEngine.fetchAtivosBatch(tickers, {
        mode: compactMode ? 'turbo' : (q.mode || 'super'),
        includeNews: false,
        view: 'compact',
        maxConcurrency: clampNumber(q.maxConcurrency || q.concurrency, compactMode ? 4 : 4, 1, 6),
        cache: !boolParam(q.nocache || q.refresh),
        valoraeScrapeUrl: resolveSelfScrapeUrl(req, q),
        profile: q.profile || (compactMode ? 'fast' : 'portfolio'),
        timeoutMs: compactMode ? 1800 : clampNumber(q.timeoutMs, 4500, 1000, 12000),
        continueOnError: true,
      }),
      Math.max(800, Math.min(routeDeadlineMs - 900, compactMode ? 2100 : 4500)),
      () => ({ assets: [], stats: { partial: true, timeout: true, scope: 'fetchAtivosBatch' }, errors: [{ scope: 'fetchAtivosBatch', error: 'Deadline parcial atingido; continuando com agenda e cache.' }] })
    ).catch(err => ({ assets: [], stats: { partial: true, error: true, scope: 'fetchAtivosBatch' }, errors: [{ scope: 'fetchAtivosBatch', error: err?.message || String(err) }] }));

    const agendaPromise = boolParam(q.includeUpcoming || q.complete || q.upcoming, true)
      ? withRouteDeadline(
          () => coalesce(`dividends:${tickers.slice().sort().join(',')}:${agendaOptions.historyMonths}:${agendaOptions.futureMonths}:${agendaOptions.assetClass || 'ALL'}:${compactMode ? 'fast' : 'normal'}`, () => fetchInvestidor10DividendAgenda(tickers, { ...agendaOptions, deadlineMs: Math.max(1200, routeDeadlineMs - 650) })),
          Math.max(900, routeDeadlineMs - 500),
          () => ({ events: [], diagnostics: [{ level: 'warning', message: `Agenda excedeu deadline de ${routeDeadlineMs}ms; retornando payload parcial/cacheável.` }], range: agendaOptions, partial: true })
        ).catch(err => ({ events: [], diagnostics: [{ level: 'warning', message: err?.message || String(err) }], range: agendaOptions, partial: true }))
      : Promise.resolve({ events: [], diagnostics: [], range: agendaOptions });

    const [batch, agenda] = await Promise.all([batchPromise, agendaPromise]);
    const agendaByTicker = new Map();
    for (const ev of agenda.events || []) {
      const k = canonicalizeTicker(ev.ticker);
      if (!agendaByTicker.has(k)) agendaByTicker.set(k, []);
      agendaByTicker.get(k).push(normalizeDividendEvent(ev, k, 'Previsto'));
    }
    const events = [];
    const assetByTicker = new Map((batch.assets || []).map(a => [canonicalizeTicker(a.ticker), a]));
    const itemAssets = tickers.map(t => assetByTicker.get(t) || { ticker: t, type: inferAssetType(t), results: {}, quality: null });
    const items = itemAssets.map(a => {
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
    const { upcomingEvents, historyEvents, agendaEvents } = splitDividendEvents(events);
    return sendJson(req, res, {
      version: ValoraeEngine.version,
      requestId: route.requestId,
      endpoint: 'portfolio-dividends',
      count: items.length,
      items,
      events,
      dividends: events,
      dividendos: events,
      proventos: events,
      agendaEvents,
      upcomingEvents,
      historyEvents,
      upcomingCount: upcomingEvents.length,
      historyCount: historyEvents.length,
      agendaDiagnostics: [...warnings, ...(agenda.diagnostics || [])],
      warnings,
      agendaRange: agenda.range || agendaOptions,
      partial: !!agenda.partial || !!batch.stats?.partial,
      deadlineMs: routeDeadlineMs,
      stats: batch.stats,
      errors: [...errors, ...(batch.errors || [])],
    }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'portfolio', cacheControl: 'private, max-age=30, stale-while-revalidate=300' });
  } catch (err) {
    return sendRouteError(req, res, err, { version: ValoraeEngine.version, requestId: route.requestId, profile: 'portfolio' });
  }
}
