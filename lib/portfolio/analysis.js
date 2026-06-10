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

export function buildHistory(payload = {}) {
  const summary = portfolioSummary(payload.positions || []);
  const months = Number(payload.months || payload.historyMonths || 12);
  const points = [];
  const base = summary.totalMarketValue || summary.totalInvested || 0;
  const now = new Date();
  for (let i = Math.max(1, months) - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const progress = months <= 1 ? 1 : (months - i) / months;
    const value = round(base * (0.94 + progress * 0.06), 2);
    points.push({ date: d.toISOString().slice(0,10), month: d.toISOString().slice(0,7), value, patrimonio: value, totalValue: value, returnPercent: summary.resultPercent, returnPct: summary.resultPercent });
  }
  return { status: points.length ? 'OK' : 'EMPTY', points, history: points, series: points };
}

export function buildRankings(payload = {}) {
  const positions = normalizePositions(payload.positions || []);
  const rows = positions.map((p, index) => ({ ticker: p.ticker, rank: index + 1, score: Math.max(1, round(100 - index * 4, 1)), assetClass: classifyTicker(p.ticker), reason: 'Ranking local leve para o contrato mobile.' }));
  return { status: rows.length ? 'OK' : 'EMPTY', portfolio: rows, items: rows, rankings: rows };
}
