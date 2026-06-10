import { normalizeTicker, uniqueTickers } from '../core/tickers.js';
import { normalizeDate, dateMillis } from '../core/dates.js';
import { numberValue, round } from '../core/numbers.js';

export function normalizePositions(input = []) {
  const list = Array.isArray(input) ? input : [];
  return list.map((item) => {
    const ticker = normalizeTicker(item?.ticker || item?.symbol || item?.codigo);
    const quantity = numberValue(item?.quantity ?? item?.qty ?? item?.shares ?? item?.quantidade, 0);
    const avgPrice = numberValue(item?.avgPrice ?? item?.averagePrice ?? item?.precoMedio ?? item?.price, 0);
    const currentPrice = numberValue(item?.currentPrice ?? item?.price ?? item?.lastPrice ?? item?.cotacao, avgPrice);
    const firstPurchaseAt = Number(item?.firstPurchaseAt || 0);
    const firstPurchaseDate = normalizeDate(item?.firstPurchaseDate || item?.purchaseDate || item?.date) || (firstPurchaseAt ? new Date(firstPurchaseAt).toISOString().slice(0,10) : '');
    return { ticker, quantity, avgPrice, currentPrice, invested: round(quantity * avgPrice, 2), marketValue: round(quantity * currentPrice, 2), firstPurchaseDate, firstPurchaseAt };
  }).filter(p => p.ticker && p.quantity !== 0);
}

export function normalizeTransactions(input = []) {
  const list = Array.isArray(input) ? input : [];
  return list.map((item) => {
    const ticker = normalizeTicker(item?.ticker || item?.symbol || item?.codigo);
    const sideRaw = String(item?.side || item?.type || item?.operation || item?.tipo || '').toUpperCase();
    const sign = /VENDA|SELL|SAIDA|SAÍDA|VENDER/.test(sideRaw) ? -1 : 1;
    const quantity = numberValue(item?.quantity ?? item?.qty ?? item?.shares ?? item?.quantidade, 0) * sign;
    const price = numberValue(item?.price ?? item?.unitPrice ?? item?.preco ?? item?.precoMedio, 0);
    const date = normalizeDate(item?.date || item?.executedAt || item?.createdAt || item?.data);
    return { ticker, quantity, price, date, millis: dateMillis(date) };
  }).filter(t => t.ticker && t.quantity && t.date);
}

export function dividendTickers(payload = {}) {
  return uniqueTickers([
    ...(payload.dividendTickers || []),
    ...(payload.tickers || []),
    ...(payload.dividendPositions || []),
    ...(payload.positions || []),
    ...(payload.transactions || [])
  ]);
}

export function quantityAtDate(ticker, targetDate, positions = [], transactions = []) {
  const clean = normalizeTicker(ticker);
  const target = dateMillis(targetDate);
  if (!clean || !target) return 0;
  const txs = normalizeTransactions(transactions).filter(t => t.ticker === clean && t.millis <= target);
  if (txs.length) return round(txs.reduce((sum, tx) => sum + tx.quantity, 0), 8);
  const pos = normalizePositions(positions).find(p => p.ticker === clean);
  if (!pos) return 0;
  if (pos.firstPurchaseDate && dateMillis(pos.firstPurchaseDate) > target) return 0;
  return pos.quantity;
}

export function portfolioSummary(positions = []) {
  const normalized = normalizePositions(positions);
  const invested = round(normalized.reduce((s, p) => s + p.invested, 0), 2);
  const marketValue = round(normalized.reduce((s, p) => s + p.marketValue, 0), 2);
  const result = round(marketValue - invested, 2);
  const resultPercent = invested > 0 ? round((result / invested) * 100, 2) : 0;
  return { positions: normalized, totalInvested: invested, totalMarketValue: marketValue, result, resultPercent, count: normalized.length };
}
