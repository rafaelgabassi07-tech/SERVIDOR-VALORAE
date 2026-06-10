import { canonicalizeTicker, inferAssetType, isKnownB3Unit } from '../Valorae-engine.js';
import { parseAgendaDate } from '../market/investidor10-dividend-agenda.js';

export function firstText(...values) {
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

export function firstNumber(...values) {
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

export function parseBRDate(d) {
  const s = String(d || '').trim();
  const br = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})/);
  if (br) {
    const y = String(br[3]).length === 2 ? `20${br[3]}` : br[3];
    const out = new Date(`${y}-${String(br[2]).padStart(2, '0')}-${String(br[1]).padStart(2, '0')}T00:00:00Z`);
    return Number.isFinite(out.getTime()) ? out : null;
  }
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
  return null;
}

function formatBRDateUTC(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return '';
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
}

export function previousBusinessDayText(raw = '') {
  const d = parseBRDate(raw) || parseAgendaDate(raw);
  if (!d) return '';
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  do {
    out.setUTCDate(out.getUTCDate() - 1);
  } while (out.getUTCDay() === 0 || out.getUTCDay() === 6);
  return formatBRDateUTC(out);
}

export function resolveDividendDates(row = {}) {
  const explicitDateCom = firstText(row.dateCom, row.comDate, row.dataCom, row.data_com, row.recordDate, row.dataBase, row.baseDate, row.lastDateCom, row.eligibilityDate);
  const exDate = firstText(row.exDate, row.dataEx, row.exDividendDate, row.dataExProvento, row.dateEx);
  const paymentDirect = firstText(row.paymentDate, row.payDate, row.dataPagamento, row.data_pagamento, row.dataPagamentoPrevista, row.dataPagto, row.pagamento, row.pgto);
  const genericDate = firstText(row.date, row.data);
  const statusText = firstText(row.status, row.paymentStatus, row.situacao, row.state).toLowerCase();
  const kindText = firstText(row.dividendType, row.type, row.tipo, row.kind, row.eventType).toLowerCase();
  const genericLooksLikePayment = Boolean(genericDate) && (
    Boolean(explicitDateCom || exDate || paymentDirect) ||
    /pag|pago|pay|receb|confirm|liquid/.test(statusText) ||
    /pagamento|payment/.test(kindText)
  );
  const dateCom = explicitDateCom || previousBusinessDayText(exDate) || (!paymentDirect && !genericLooksLikePayment ? genericDate : '');
  const paymentDate = paymentDirect || (genericLooksLikePayment ? genericDate : '');
  return {
    dateCom,
    paymentDate,
    exDate,
    eligibilityDateSource: explicitDateCom ? 'dateCom' : exDate ? 'exDate-previous-business-day' : dateCom ? 'generic-date' : '',
    paymentDateSource: paymentDirect ? 'paymentDate' : genericLooksLikePayment ? 'generic-date' : '',
  };
}

export function eventKey(e = {}) {
  return [
    firstText(e.ticker, e.symbol, e.codigo).toUpperCase(),
    firstText(e.dateCom, e.comDate, e.dataCom, e.recordDate),
    firstText(e.paymentDate, e.payDate, e.dataPagamento),
    firstText(e.dividendType, e.type, e.tipo),
    Number(e.valuePerShare || e.value || e.amount || 0).toFixed(8),
  ].join('|').toUpperCase();
}

export function normalizeDividendEvent(row = {}, ticker = '', status = '') {
  const tickerOut = firstText(row.ticker, row.symbol, row.codigo, row.asset, ticker).toUpperCase();
  const valuePerShare = firstNumber(row.valuePerShare, row.valorPorCota, row.valorPorAcao, row.valor, row.value, row.amount, row.dividend, row.rendimento, row.provento, row.cashAmount);
  const dividendType = firstText(row.dividendType, row.type, row.tipo, row.eventType, row.proventoTipo, row.rawType, 'Provento');
  const { dateCom, paymentDate, exDate, eligibilityDateSource, paymentDateSource } = resolveDividendDates(row);
  const confirmed = Boolean(paymentDate);
  const inferred = inferAssetType(tickerOut);
  const assetType = isKnownB3Unit(tickerOut) ? 'ACAO_UNIT' : firstText(row.assetType, row.assetClass, inferred);
  const normalizedStatus = firstText(row.status, row.paymentStatus, row.situacao, status, confirmed ? 'Confirmado' : 'Anunciado/Provisionado');
  return {
    ticker: tickerOut,
    asset: tickerOut,
    symbol: tickerOut,
    codigo: tickerOut,
    eventKey: eventKey({ ticker: tickerOut, dateCom, paymentDate, dividendType, valuePerShare }),
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
    paymentDateSource,
    status: normalizedStatus,
    paymentStatus: confirmed ? 'CONFIRMED' : 'ANNOUNCED',
    announcementStatus: 'ANNOUNCED',
    announced: Boolean(dateCom || paymentDate || valuePerShare > 0),
    confirmed,
    provisioned: !confirmed,
    assetType,
    assetClass: assetType === 'FII' ? 'FII' : 'ACAO',
    source: firstText(row.source, row.fonte, 'Investidor10/VALORAE'),
  };
}

export function dividendHistoryFromAsset(asset = {}) {
  const r = asset.results || {};
  const divs = r.dividendos || r.dividends || r.proventos || {};
  return divs.historico || divs.history || divs.items || r.historicoDividendos || r.historicoProventos || r.proventos || [];
}

export function normalizeAgendaAssetClass(value = '') {
  const s = String(value || '').trim().toUpperCase();
  if (/FII|FUNDO|IMOB/.test(s)) return 'FII';
  if (/ACAO|AÇÃO|ACOES|AÇÕES|STOCK|ON|PN|UNIT/.test(s)) return 'ACAO';
  return '';
}

export function eventDate(e = {}, kind = 'payment') {
  const value = kind === 'eligibility'
    ? firstText(e.dateCom, e.comDate, e.dataCom, e.recordDate, e.dataBase, e.eligibilityDate, e.paymentDate, e.payDate, e.dataPagamento)
    : firstText(e.paymentDate, e.payDate, e.dataPagamento, e.date, e.data, e.dateCom, e.comDate, e.dataCom);
  return parseBRDate(value) || parseAgendaDate(value);
}

export function eventPaymentDate(e = {}) {
  const value = firstText(e.paymentDate, e.payDate, e.dataPagamento, e.data_pagamento, e.dataPagamentoPrevista, e.dataPagto, e.pagamento, e.pgto);
  return parseBRDate(value) || parseAgendaDate(value);
}

export function pendingOrAnnouncedDividend(e = {}) {
  const status = firstText(e.status, e.paymentStatus, e.announcementStatus).toLowerCase();
  const dividendType = firstText(e.dividendType, e.type, e.tipo, e.kind).toLowerCase();
  const source = firstText(e.source, e.fonte).toLowerCase();
  const hasNoPaymentDate = !eventPaymentDate(e);
  if (!hasNoPaymentDate) return false;
  return /prev|futur|agenda|provision|anunci|a confirmar|sem data|confirm/.test(status) ||
    /provision|anunci|agenda/.test(dividendType) ||
    /agenda|provision/.test(source) ||
    Boolean(firstText(e.dateCom, e.comDate, e.dataCom, e.recordDate, e.dataBase) || Number(e.valuePerShare || 0) > 0 || Number(e.estimatedAmount || 0) > 0);
}

export function eligibleByDateCom(pos = {}, eligibilityDate = null) {
  const firstPurchaseAt = Number(pos?.firstPurchaseAt || 0);
  return !firstPurchaseAt || !eligibilityDate || firstPurchaseAt <= eligibilityDate.getTime() + 86_399_999;
}

export function splitOfficialByPaymentStatus(events = []) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const paid = [];
  const future = [];
  const announced = [];
  for (const e of events || []) {
    const paymentDate = eventPaymentDate(e);
    if (paymentDate && paymentDate < today && !pendingOrAnnouncedDividend(e)) paid.push(e);
    else if (paymentDate && paymentDate >= today) future.push(e);
    else if (pendingOrAnnouncedDividend(e) || !paymentDate) announced.push(e);
  }
  return { officialPaidEvents: paid, officialFutureEvents: future, officialAnnouncedEvents: announced, officialUpcomingEvents: [...future, ...announced] };
}

export function splitByPortfolio(events = [], positions = []) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const positionsByTicker = new Map((positions || []).map(p => [canonicalizeTicker(p.ticker), p]));
  const received = [];
  const upcoming = [];
  for (const e of events || []) {
    const pos = positionsByTicker.get(canonicalizeTicker(e.ticker));
    const quantity = firstNumber(pos?.quantity, e.quantity);
    const paymentDate = eventPaymentDate(e);
    const displayDate = paymentDate || eventDate(e, 'payment');
    const eligibilityDate = eventDate(e, 'eligibility') || displayDate;
    const hasPaymentDate = Boolean(paymentDate);
    const isPastPaid = hasPaymentDate && paymentDate < today && !pendingOrAnnouncedDividend(e);
    const eligible = eligibleByDateCom(pos, eligibilityDate);
    const amount = quantity > 0 && Number(e.valuePerShare || 0) > 0
      ? Number((quantity * Number(e.valuePerShare || 0)).toFixed(2))
      : firstNumber(e.estimatedAmount, e.totalAmount, e.grossAmount);
    const out = {
      ...e,
      quantity,
      estimatedAmount: amount,
      totalAmount: amount,
      eligibilityDate: eligibilityDate ? eligibilityDate.toISOString().slice(0, 10) : undefined,
    };
    if (isPastPaid) {
      if (eligible) received.push({ ...out, originalStatus: out.status, status: 'Recebido', portfolioBlock: 'received' });
    } else if (quantity > 0 && eligible) {
      const nextStatus = hasPaymentDate ? 'Previsto' : firstText(out.status, 'Anunciado/Provisionado');
      upcoming.push({ ...out, originalStatus: out.status, status: nextStatus, portfolioBlock: 'upcoming' });
    }
  }
  return { portfolioReceived: received, portfolioUpcoming: upcoming };
}

export function normalizeEvents(rawEvents = [], positions = []) {
  const byKey = new Map();
  for (const row of rawEvents || []) {
    const event = normalizeDividendEvent(row, row?.ticker || row?.symbol || '', row?.status || 'Provento');
    if (!event.ticker || (!event.dateCom && !event.paymentDate && !event.valuePerShare)) continue;
    byKey.set(eventKey(event), event);
  }
  const officialEvents = [...byKey.values()].sort((a, b) => (eventDate(a, 'payment')?.getTime() || 0) - (eventDate(b, 'payment')?.getTime() || 0));
  const tickers = [...new Set((positions || []).map(p => canonicalizeTicker(p.ticker)).filter(Boolean))];
  const assetHistory = tickers.map(ticker => {
    const events = officialEvents.filter(e => canonicalizeTicker(e.ticker) === ticker);
    const type = isKnownB3Unit(ticker) ? 'ACAO_UNIT' : inferAssetType(ticker);
    return { ticker, assetType: type, assetClass: type === 'FII' ? 'FII' : 'ACAO', events, history: events, count: events.length };
  });
  const officialStatusBlocks = splitOfficialByPaymentStatus(officialEvents);
  return { officialEvents, assetHistory, ...officialStatusBlocks, ...splitByPortfolio(officialEvents, positions) };
}

export function buildDividendContract(events = [], positions = []) {
  const normalized = normalizeEvents(events, positions);
  return {
    officialEvents: normalized.officialEvents,
    officialPaidEvents: normalized.officialPaidEvents,
    officialFutureEvents: normalized.officialFutureEvents,
    officialAnnouncedEvents: normalized.officialAnnouncedEvents,
    officialUpcomingEvents: normalized.officialUpcomingEvents,
    allOfficialFuturePayments: normalized.officialUpcomingEvents,
    assetHistory: normalized.assetHistory,
    portfolioReceived: normalized.portfolioReceived,
    portfolioUpcoming: normalized.portfolioUpcoming,
    portfolioReceivedDividends: normalized.portfolioReceived,
    portfolioUpcomingDividends: normalized.portfolioUpcoming,
  };
}
