import { classifyTicker, normalizeTicker, uniqueTickers } from '../core/tickers.js';

export function filterPayloadByAssetClass(payload = {}, assetFilter = 'ALL') {
  const filter = String(assetFilter || 'ALL').trim().toUpperCase();
  if (filter === 'ALL' || filter === 'TODOS') return payload;
  const wantFii = filter.includes('FII');
  const wantStock = filter.includes('ACAO') || filter.includes('AÇÃO') || filter.includes('STOCK');
  const positions = Array.isArray(payload.positions) ? payload.positions : [];
  const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];
  const dividendEvents = Array.isArray(payload.dividendEvents)
    ? payload.dividendEvents
    : (Array.isArray(payload.events) ? payload.events : (Array.isArray(payload.dividends) ? payload.dividends : []));
  const matchesRequestedClass = (item = {}) => {
    const ticker = normalizeTicker(item.ticker || item.symbol || item.codigo || item.ativo);
    if (!ticker) return false;
    const cls = String(item.assetClass || item.assetType || item.type || classifyTicker(ticker) || '').toUpperCase();
    return wantFii ? cls.includes('FII') : wantStock ? (cls.includes('ACAO') || cls.includes('AÇÃO')) : true;
  };
  // O histórico de retorno inclui ativos já encerrados. Construir o universo somente a
  // partir das posições atuais apaga operações e proventos de tickers vendidos.
  const allowed = new Set([...positions, ...transactions, ...dividendEvents]
    .filter(matchesRequestedClass)
    .map(item => normalizeTicker(item.ticker || item.symbol || item.codigo || item.ativo))
    .filter(Boolean));
  if (!allowed.size) return { ...payload, positions: [], transactions: [], dividendEvents: [] };
  return {
    ...payload,
    positions: positions.filter(item => allowed.has(normalizeTicker(item.ticker || item.symbol || item.codigo || item.ativo))),
    transactions: transactions.filter(item => allowed.has(normalizeTicker(item.ticker || item.symbol || item.codigo || item.ativo))),
    dividendEvents: dividendEvents.filter(item => allowed.has(normalizeTicker(item.ticker || item.symbol || item.codigo || item.ativo))),
  };
}

export function mobileAlertDividendSymbols(positions = [], transactions = [], explicitTickers = []) {
  return uniqueTickers([
    ...(Array.isArray(positions) ? positions : []),
    ...(Array.isArray(transactions) ? transactions : []),
    ...(Array.isArray(explicitTickers) ? explicitTickers : []),
  ]).slice(0, 180);
}
