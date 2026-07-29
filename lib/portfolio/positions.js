import { normalizeTicker, uniqueTickers } from '../core/tickers.js';
import { normalizeDate, dateMillis, todayIso } from '../core/dates.js';
import { numberValue, round } from '../core/numbers.js';

export function normalizePositions(input = []) {
  const list = Array.isArray(input) ? input : [];
  const normalized = list.map((item) => {
    const ticker = normalizeTicker(item?.ticker || item?.symbol || item?.codigo);
    const quantity = numberValue(item?.quantity ?? item?.qty ?? item?.shares ?? item?.quantidade, 0);
    const avgPrice = numberValue(item?.avgPrice ?? item?.averagePrice ?? item?.precoMedio ?? item?.price, 0);
    const currentPrice = numberValue(item?.currentPrice ?? item?.price ?? item?.lastPrice ?? item?.cotacao, avgPrice);
    const firstPurchaseAt = Number(item?.firstPurchaseAt || 0);
    const firstPurchaseDate = normalizeDate(item?.firstPurchaseDate || item?.purchaseDate || item?.date) || (firstPurchaseAt ? new Date(firstPurchaseAt).toISOString().slice(0,10) : '');
    const rawAssetClass = String(item?.assetClass || item?.type || item?.assetType || '').trim().toUpperCase();
    const assetClass = rawAssetClass || '';
    const sector = String(item?.sector || item?.setor || item?.segment || item?.segmento || item?.industry || '').trim();
    const name = String(item?.name || item?.nome || item?.companyName || '').trim();
    return {
      ...item,
      ticker,
      symbol: ticker,
      quantity,
      avgPrice,
      averagePrice: avgPrice,
      currentPrice,
      firstPurchaseDate,
      firstPurchaseAt: Number.isFinite(firstPurchaseAt) && firstPurchaseAt > 0 ? firstPurchaseAt : 0,
      assetClass,
      sector,
      segment: String(item?.segment || item?.segmento || sector || '').trim(),
      name,
    };
  }).filter(position => position.ticker && Number.isFinite(position.quantity) && position.quantity !== 0);

  const grouped = new Map();
  for (const position of normalized) {
    const investedRaw = position.quantity * position.avgPrice;
    const marketValueRaw = position.quantity * position.currentPrice;
    const previous = grouped.get(position.ticker);
    if (!previous) {
      grouped.set(position.ticker, {
        ...position,
        _investedRaw: Number.isFinite(investedRaw) ? investedRaw : 0,
        _marketValueRaw: Number.isFinite(marketValueRaw) ? marketValueRaw : 0,
      });
      continue;
    }
    previous.quantity += position.quantity;
    previous._investedRaw += Number.isFinite(investedRaw) ? investedRaw : 0;
    previous._marketValueRaw += Number.isFinite(marketValueRaw) ? marketValueRaw : 0;
    if (position.firstPurchaseDate && (!previous.firstPurchaseDate || position.firstPurchaseDate < previous.firstPurchaseDate)) {
      previous.firstPurchaseDate = position.firstPurchaseDate;
    }
    if (position.firstPurchaseAt > 0 && (!previous.firstPurchaseAt || position.firstPurchaseAt < previous.firstPurchaseAt)) {
      previous.firstPurchaseAt = position.firstPurchaseAt;
    }
    if (!previous.assetClass && position.assetClass) previous.assetClass = position.assetClass;
    if (!previous.sector && position.sector) previous.sector = position.sector;
    if (!previous.segment && position.segment) previous.segment = position.segment;
    if (!previous.name && position.name) previous.name = position.name;
  }

  return [...grouped.values()].map((position) => {
    const { _investedRaw, _marketValueRaw, ...base } = position;
    const quantity = Number(base.quantity || 0);
    const avgPrice = quantity ? _investedRaw / quantity : 0;
    const currentPrice = quantity ? _marketValueRaw / quantity : 0;
    return {
      ...base,
      quantity,
      avgPrice: Number.isFinite(avgPrice) ? avgPrice : 0,
      averagePrice: Number.isFinite(avgPrice) ? avgPrice : 0,
      currentPrice: Number.isFinite(currentPrice) ? currentPrice : 0,
      invested: round(_investedRaw, 2),
      marketValue: round(_marketValueRaw, 2),
      currentValue: round(_marketValueRaw, 2),
    };
  }).filter(position => Number.isFinite(position.quantity) && position.quantity !== 0);
}

export function normalizeTransactions(input = []) {
  const list = Array.isArray(input) ? input : [];
  return list.map((item) => {
    const ticker = normalizeTicker(item?.ticker || item?.symbol || item?.codigo);
    const sideRaw = String(item?.side || item?.type || item?.operation || item?.tipo || '').toUpperCase();
    const rawQuantity = numberValue(item?.quantity ?? item?.qty ?? item?.shares ?? item?.quantidade, 0);
    // Alguns clientes enviam venda como quantity negativo, outros enviam quantity positivo + isSell/side.
    // A normalização precisa preservar venda como quantidade negativa sem inverter duas vezes.
    const isSell = item?.isSell === true || item?.sell === true || rawQuantity < 0 || /VENDA|SELL|SAIDA|SAÍDA|VENDER|AMORT|GRUPAMENTO|AGRUPAMENTO|TRANSFERENCIA SAIDA|TRANSFERÊNCIA SAÍDA/.test(sideRaw);
    const quantity = Math.abs(rawQuantity) * (isSell ? -1 : 1);
    const price = numberValue(item?.price ?? item?.unitPrice ?? item?.preco ?? item?.precoMedio, 0);
    const rawMillis = Number(item?.dateMillis || item?.timestampMillis || item?.timeMillis || 0);
    const millisFromRaw = Number.isFinite(rawMillis) && rawMillis > 0 ? (rawMillis > 10_000_000_000 ? rawMillis : rawMillis * 1000) : 0;
    const date = normalizeDate(item?.date || item?.executedAt || item?.createdAt || item?.data) ||
      (millisFromRaw ? new Date(millisFromRaw).toISOString().slice(0, 10) : '');
    return { ticker, quantity, price, date, millis: dateMillis(date) || millisFromRaw, isSell };
  }).filter(t => t.ticker && t.quantity && (t.date || t.millis));
}

function tickerFieldCandidates(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(/[,;\s]+/).filter(Boolean);
  return [value];
}

export function dividendTickers(payload = {}) {
  return uniqueTickers([
    ...tickerFieldCandidates(payload.ticker),
    ...tickerFieldCandidates(payload.symbol),
    ...tickerFieldCandidates(payload.dividendTickers),
    ...tickerFieldCandidates(payload.tickers),
    ...tickerFieldCandidates(payload.symbols),
    ...tickerFieldCandidates(payload.assets),
    ...tickerFieldCandidates(payload.dividendPositions),
    ...tickerFieldCandidates(payload.positions),
    ...tickerFieldCandidates(payload.transactions)
  ]);
}

export function quantityAtDate(ticker, targetDate, positions = [], transactions = []) {
  const clean = normalizeTicker(ticker);
  const target = dateMillis(targetDate);
  if (!clean || !target) return 0;

  // Quando existe histórico transacional para o ticker ele é a fonte de verdade.
  // Cair para a posição atual quando todas as operações são posteriores à Data COM
  // tornava eventos anteriores à criação da carteira falsamente elegíveis.
  const allTickerTransactions = normalizeTransactions(transactions).filter(t => t.ticker === clean);
  if (allTickerTransactions.length) {
    return Math.max(0, round(
      allTickerTransactions
        .filter(t => t.millis <= target)
        .reduce((sum, tx) => sum + tx.quantity, 0),
      8
    ));
  }

  const pos = normalizePositions(positions).find(p => p.ticker === clean);
  if (!pos) return 0;
  const firstPurchaseMillis = dateMillis(pos.firstPurchaseDate);
  if (firstPurchaseMillis && firstPurchaseMillis > target) return 0;

  // Sem operações e sem data de primeira compra não há evidência suficiente para
  // atribuir proventos históricos. A posição atual só é uma aproximação segura para
  // uma Data COM presente/futura.
  if (!firstPurchaseMillis && target < dateMillis(todayIso())) return 0;
  return Math.max(0, round(pos.quantity, 8));
}

export function portfolioSummary(positions = []) {
  const normalized = normalizePositions(positions);
  const invested = round(normalized.reduce((s, p) => s + p.invested, 0), 2);
  const marketValue = round(normalized.reduce((s, p) => s + p.marketValue, 0), 2);
  const result = round(marketValue - invested, 2);
  const resultPercent = invested > 0 ? round((result / invested) * 100, 2) : 0;
  return { positions: normalized, totalInvested: invested, totalMarketValue: marketValue, result, resultPercent, count: normalized.length };
}
