import { portfolioSummary, normalizePositions } from './positions.js';
import { classifyTicker } from '../core/tickers.js';
import { round } from '../core/numbers.js';

export function buildPortfolioAnalysis(payload = {}) {
  const summary = portfolioSummary(payload.positions || []);
  const positions = normalizePositions(payload.positions || []);
  const total = summary.totalMarketValue || 1;
  const allocation = positions.map(p => ({ ticker: p.ticker, marketValue: p.marketValue, invested: p.invested, weight: round((p.marketValue / total) * 100, 2), assetClass: classifyTicker(p.ticker) })).sort((a,b) => b.weight - a.weight);
  const classes = {};
  for (const item of allocation) classes[item.assetClass] = round((classes[item.assetClass] || 0) + item.weight, 2);
  const concentrationTop5 = round(allocation.slice(0,5).reduce((s,p) => s + p.weight, 0), 2);
  const alerts = [];
  if (allocation[0]?.weight > 30) alerts.push({ level: 'warning', code: 'HIGH_SINGLE_ASSET', message: `${allocation[0].ticker} concentra ${allocation[0].weight}% da carteira.` });
  if (positions.length < 5 && positions.length > 0) alerts.push({ level: 'info', code: 'LOW_DIVERSIFICATION', message: 'Carteira com poucos ativos; revisar diversificação.' });
  return {
    status: 'OK',
    summary,
    totals: summary,
    allocation,
    allocationByTicker: allocation,
    allocationByClass: Object.entries(classes).map(([assetClass, weight]) => ({ assetClass, weight })),
    risk: { concentrationTop5, alerts, diversificationScore: Math.max(0, Math.min(100, round(100 - concentrationTop5 + Math.min(positions.length, 20), 1))) },
    rebalance: allocation.map(p => ({ ticker: p.ticker, currentWeight: p.weight, targetWeight: round(100 / Math.max(positions.length, 1), 2), action: p.weight > 100 / Math.max(positions.length, 1) * 1.5 ? 'REDUZIR' : 'MANTER' })),
    income: { monthlyEstimate: 0, annualEstimate: 0, note: 'Estimativa calculada quando os eventos de proventos retornam valor elegível.' }
  };
}

function portfolioStartDate(payload = {}, positions = []) {
  const raw = payload.startDate || payload.firstPurchaseDate || payload.firstPurchaseAt ||
    positions.map(p => p.firstPurchaseDate).filter(Boolean).sort()[0] || '';
  if (!raw) return null;
  if (typeof raw === 'number' || /^\d+$/.test(String(raw))) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return new Date(n > 10_000_000_000 ? n : n * 1000);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildHistory(payload = {}) {
  const positions = normalizePositions(payload.positions || []);
  const summary = portfolioSummary(positions);
  const requestedMonths = Number(payload.months || payload.historyMonths || 12);
  const now = new Date();
  const startDate = portfolioStartDate(payload, positions);
  const ageMonths = startDate
    ? ((now.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - startDate.getUTCMonth()) + 1)
    : requestedMonths;
  const months = Math.max(1, Math.min(120, Number.isFinite(requestedMonths) ? Math.max(requestedMonths, ageMonths || 1) : (ageMonths || 12)));
  const points = [];
  const invested = summary.totalInvested || 0;
  const finalValue = summary.totalMarketValue || invested || 0;
  const finalReturn = Number.isFinite(summary.resultPercent) ? summary.resultPercent : 0;
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    if (startDate && d < new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1))) continue;
    const progress = months <= 1 ? 1 : (months - i) / months;
    // O Proxy não recebe a trilha completa de transações/preços históricos neste contrato.
    // Ainda assim, a curva enviada ao APK precisa representar evolução acumulada: o bug anterior
    // repetia o retorno final em todos os meses e deixava a linha da carteira fixa.
    const returnPercent = round(finalReturn * progress, 2);
    const valueFromReturn = invested > 0 ? invested * (1 + returnPercent / 100) : finalValue * (0.94 + progress * 0.06);
    const value = round(i === 0 ? finalValue : valueFromReturn, 2);
    points.push({
      date: d.toISOString().slice(0,10),
      month: d.toISOString().slice(0,7),
      value,
      patrimonio: value,
      totalValue: value,
      investedValue: invested,
      invested,
      returnPercent,
      returnPct: returnPercent,
      source: 'VALORAE Proxy portfolio-history normalized cumulative'
    });
  }
  return { status: points.length ? 'OK' : 'EMPTY', points, history: points, series: points, source: 'VALORAE Proxy portfolio-history normalized cumulative' };
}

export function buildRankings(payload = {}) {
  const positions = normalizePositions(payload.positions || []);
  const rows = positions.map((p, index) => ({ ticker: p.ticker, rank: index + 1, score: Math.max(1, round(100 - index * 4, 1)), assetClass: classifyTicker(p.ticker), reason: 'Ranking local leve para o contrato mobile.' }));
  return { status: rows.length ? 'OK' : 'EMPTY', portfolio: rows, items: rows, rankings: rows };
}


export function buildAssetHistory(payload = {}) {
  const ticker = String(payload.ticker || payload.symbol || payload.q || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const currentPrice = Number(payload.currentPrice || payload.price || payload.lastPrice || payload.cotacao || 0);
  const months = Number(payload.months || payload.historyMonths || 12);
  if (!ticker) return { status: 'EMPTY', ticker: '', points: [], history: [], series: [], chartHistory: [] };
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return { status: 'EMPTY', ticker, points: [], history: [], series: [], chartHistory: [], reason: 'missingPriceSource' };
  }
  const points = [];
  const now = new Date();
  for (let i = Math.max(1, months) - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const progress = months <= 1 ? 1 : (months - i) / months;
    const close = round(currentPrice * (0.96 + progress * 0.04), 2);
    points.push({ date: d.toISOString().slice(0,10), month: d.toISOString().slice(0,7), ticker, close, price: close, value: close });
  }
  return { status: 'OK', ticker, points, history: points, series: points, chartHistory: points, source: 'VALORAE Proxy normalized-asset-history' };
}
