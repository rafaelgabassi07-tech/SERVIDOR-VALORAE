import { portfolioSummary, normalizePositions, normalizeTransactions, quantityAtDate, portfolioInceptionDate } from './positions.js';
import { classifyTicker, normalizeTicker } from '../core/tickers.js';
import { getAssetHistory } from '../sources/asset-details.js';
import { round } from '../core/numbers.js';
import { buildEquilibriumContract, enrichEquilibriumPosition } from './equilibrium-metadata.js';
import { getCdiAccumulatedSeries, getIpcaSeries, fetchInvestidor10DirectIndexHistory } from '../sources/adapters/index.js';
import { inspectRealHistoryIntegrity } from '../sources/history-integrity.js';
import { filterPayloadByAssetClass } from './mobile-history-contracts.js';
import { benchmarkExposureAlignedMonthMap } from './return-metrics.js';
import { monthHasCapitalExposure, weightedPortfolioCashFlows } from './return-calculation.js';
import { buildExposureOnlyReturnSeriesV5, selectExposureReturnWindowV5, summarizeExposureReturnV5 } from './return-engine-v5.js';
import { buildReturnAnalytics, buildReturnExposureCycles } from './return-insights.js';
import { returnDividendPerformanceMillis, dividendsEarnedBetween } from './return-dividends.js';
import { resolveHistoricalPortfolioValuation, reconcileReturnOpeningTransactions } from './return-valuation.js';
export { filterPayloadByAssetClass } from './mobile-history-contracts.js';

export function buildPortfolioAnalysis(payload = {}) {
  const summary = portfolioSummary(payload.positions || []);
  const positions = normalizePositions(payload.positions || []);
  const total = summary.totalMarketValue || 1;
  const classFor = (p) => String(p.assetClass || classifyTicker(p.ticker) || 'NAO_INFORMADA').toUpperCase();
  const sectorFor = (p) => {
    if (p.sector) return p.sector;
    const assetClass = classFor(p);
    if (assetClass.includes('FII')) return 'Fundos Imobiliários';
    if (assetClass.includes('ACAO') || assetClass.includes('AÇÃO')) return 'Ações sem setor informado';
    return 'Classe não informada';
  };
  const allocation = positions.map(p => {
    const meta = enrichEquilibriumPosition({ ...p, currentValue: p.marketValue, marketValue: p.marketValue, assetClass: classFor(p), type: classFor(p), sector: sectorFor(p), segment: p.segment });
    return {
      ticker: p.ticker,
      name: p.name || '',
      marketValue: p.marketValue,
      invested: p.invested,
      weight: round((p.marketValue / total) * 100, 2),
      assetClass: meta.assetClass || classFor(p),
      type: meta.assetClass || classFor(p),
      sector: meta.sector || sectorFor(p),
      segment: meta.segment || p.segment || sectorFor(p),
      exposure: meta.exposure,
      geography: meta.geography,
      stockSegment: meta.stockSegment,
      stockSector: meta.stockSector,
      fiiType: meta.fiiType,
      fiiSegment: meta.fiiSegment
    };
  }).sort((a,b) => b.weight - a.weight);
  const sumBy = (field) => Object.values(allocation.reduce((acc, item) => {
    const key = item[field] || 'Não informado';
    acc[key] = acc[key] || { [field]: key, weight: 0, marketValue: 0, items: 0 };
    acc[key].weight = round(acc[key].weight + item.weight, 2);
    acc[key].marketValue = round(acc[key].marketValue + item.marketValue, 2);
    acc[key].items += 1;
    return acc;
  }, {})).sort((a, b) => b.weight - a.weight);
  const allocationByClass = sumBy('assetClass').map(({ assetClass, weight, marketValue, items }) => ({ assetClass, weight, marketValue, items }));
  const allocationBySector = sumBy('sector').map(({ sector, weight, marketValue, items }) => ({ sector, weight, marketValue, items }));
  const equilibrium = buildEquilibriumContract({
    ...payload,
    positions: positions.map(p => ({
      ...p,
      currentValue: p.marketValue,
      marketValue: p.marketValue,
      currentPrice: p.currentPrice,
      quantity: p.quantity,
      averagePrice: p.avgPrice,
      assetClass: classFor(p),
      sector: p.sector,
      segment: p.segment
    }))
  });
  const concentrationTop5 = round(allocation.slice(0,5).reduce((s,p) => s + p.weight, 0), 2);
  const alerts = [];
  if (allocation[0]?.weight > 30) alerts.push({ level: 'warning', code: 'HIGH_SINGLE_ASSET', message: `${allocation[0].ticker} concentra ${allocation[0].weight}% da carteira.` });
  if (positions.length < 5 && positions.length > 0) alerts.push({ level: 'info', code: 'LOW_DIVERSIFICATION', message: 'Carteira com poucos ativos; revisar diversificação.' });
  if (allocation.some(item => /sem setor informado|não informada/i.test(item.sector))) {
    alerts.push({ level: 'info', code: 'MISSING_SECTOR_METADATA', message: 'Alguns setores não vieram da fonte oficial; o equilíbrio setorial foi agrupado como não informado, sem inferência por ticker.' });
  }
  const targetWeights = payload.targetWeights || payload.targets || payload.targetAllocation || {};
  const hasTargets = targetWeights && typeof targetWeights === 'object' && Object.keys(targetWeights).length > 0;
  const rebalance = allocation.map(p => {
    const rawTarget = Number(targetWeights[p.ticker] ?? targetWeights[p.assetClass] ?? targetWeights[p.sector] ?? NaN);
    const targetWeight = hasTargets && Number.isFinite(rawTarget) && rawTarget >= 0 ? round(rawTarget, 2) : p.weight;
    const drift = round(p.weight - targetWeight, 2);
    const action = hasTargets ? (Math.abs(drift) < 2 ? 'MANTER' : (drift > 0 ? 'REDUZIR' : 'AUMENTAR')) : 'OBSERVAR';
    return { ticker: p.ticker, currentWeight: p.weight, targetWeight, drift, action, targetSource: hasTargets ? 'payload-target-real' : 'sem-meta-configurada' };
  });
  const topHolding = allocation[0]?.ticker || '';
  const top1Percent = allocation[0]?.weight || 0;
  const diversificationScore = Math.max(0, Math.min(100, round(100 - top1Percent + Math.min(positions.length * 4, 20), 1)));
  const concentrationPenalty = Math.max(0, top1Percent - 25) * 0.4;
  const missingSectorPenalty = allocation.some(item => /sem setor informado|nÃ£o informada/i.test(item.sector)) ? 8 : 0;
  const healthScore = Math.max(0, Math.min(100, round(diversificationScore - concentrationPenalty - missingSectorPenalty, 1)));
  const dataQuality = Math.max(0, Math.min(100, round(100 - missingSectorPenalty, 1)));
  const riskLabel = top1Percent >= 35 ? 'Concentracao alta' : (concentrationTop5 >= 75 ? 'Concentracao relevante' : 'Risco diversificado');
  const diversificationLabel = `${allocationByClass.length} classes / ${allocationBySector.length} setores`;
  const positionRanking = allocation.map((p, index) => {
    const score = Math.max(0, Math.min(100, round(100 - Math.max(0, p.weight - 20) * 1.3, 1)));
    return {
      rank: index + 1,
      ticker: p.ticker,
      score,
      grade: score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C'),
      weightPercent: p.weight,
      monthlyIncomeEstimated: 0,
      reasons: [`Peso atual ${p.weight}%`, p.sector || p.assetClass || 'Classe informada pelo cliente']
    };
  });
  const actionPlan = [
    ...alerts.map(alert => ({ priority: alert.level, code: alert.code, message: alert.message })),
    ...(positions.length ? [{ priority: 'info', code: 'REAL_DIVIDENDS_ONLY', message: 'Renda projetada fica zerada ate existirem eventos oficiais de proventos recebidos.' }] : []),
    ...(hasTargets ? [{ priority: 'info', code: 'TARGETS_RECEIVED', message: 'Metas reais recebidas e usadas no rebalanceamento.' }] : [])
  ].slice(0, 8);
  const rebalanceActions = rebalance.map(item => ({
    scope: item.ticker ? 'ticker' : 'portfolio',
    ticker: item.ticker,
    type: '',
    action: item.action,
    currentPercent: item.currentWeight,
    targetPercent: item.targetWeight,
    deltaValue: round(((item.targetWeight - item.currentWeight) / 100) * total, 2),
    estimatedQuantity: 0
  }));
  const allocationSummary = {
    byTicker: allocation,
    byAsset: allocation,
    byType: allocationByClass,
    byClass: allocationByClass,
    classes: allocationByClass,
    bySector: allocationBySector,
    sectors: allocationBySector,
    byExposure: equilibrium.allocation.byExposure,
    byStockSegment: equilibrium.allocation.byStockSegment,
    byStockSector: equilibrium.allocation.byStockSector,
    byFiiType: equilibrium.allocation.byFiiType,
    byFiiSegment: equilibrium.allocation.byFiiSegment,
    top5Percent: concentrationTop5,
    concentrationPercent: top1Percent,
    label: diversificationLabel
  };
  const summaryWithSignals = {
    ...summary,
    score: healthScore,
    riskLabel,
    diversificationLabel,
    concentrationPercent: top1Percent,
    topHolding,
    dataQuality,
    averageQualityScore: dataQuality,
    allocation: allocationSummary
  };
  return {
    status: 'OK',
    score: healthScore,
    healthScore,
    riskLabel,
    diversificationLabel,
    concentrationPercent: top1Percent,
    topHolding,
    dataQuality,
    source: 'VALORAE Proxy real-only portfolio-analysis',
    portfolioScore: { value: healthScore, score: healthScore, label: healthScore >= 75 ? 'Saudavel' : 'Requer atencao' },
    summary: summaryWithSignals,
    totals: summaryWithSignals,
    allocation,
    allocationSummary,
    allocationBreakdown: allocationSummary,
    equilibrium,
    balance: equilibrium,
    allocationByTicker: allocation,
    allocationByAsset: allocation,
    allocationByClass,
    allocationBySector,
    risk: {
      label: riskLabel,
      riskLabel,
      concentrationTop5,
      concentration: { top1Percent, top5Percent: concentrationTop5, topAssets: allocation.slice(0, 5) },
      diversification: { assetClasses: allocationByClass.length, sectors: allocationBySector.length, score: diversificationScore },
      alerts,
      diversificationScore
    },
    rebalance,
    rebalanceActions,
    quality: { score: dataQuality, status: missingSectorPenalty ? 'PARTIAL' : 'OK' },
    intelligence: {
      healthScore: { score: healthScore, value: healthScore },
      incomeStabilityScore: { score: 0, value: 0, reason: 'Depende de proventos oficiais recebidos.' },
      technologyReadiness: { score: 100, value: 100 },
      dataCompleteness: { score: dataQuality, percent: dataQuality, completeness: dataQuality },
      incomeCoverage: { incomePayerPercent: 0, payersPercent: 0 },
      positionRanking: { items: positionRanking, ranking: positionRanking },
      actionPlan,
      rebalanceRoadmap: { actions: rebalanceActions }
    },
    positionRanking,
    actionPlan,
    warnings: actionPlan.map(item => item.message),
    rebalancePolicy: hasTargets ? 'Metas reais recebidas do payload.' : 'Sem metas reais configuradas; não foi criada recomendação de rebalanceamento por peso igual.',
    income: { monthlyEstimate: 0, annualEstimate: 0, note: 'Valores de renda são preenchidos somente por eventos reais/confirmados de proventos.' }
  };
}

function portfolioStartDate(payload = {}, positions = [], transactions = []) {
  // "Desde o início" belongs to the historical portfolio, not only to positions that are still
  // open today. A fully sold first asset must therefore remain eligible to define inception.
  const explicit = payload.startDate || payload.firstPurchaseDate || payload.firstPurchaseAt || '';
  const raw = portfolioInceptionDate(positions, transactions, explicit);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function tsMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? (n > 10_000_000_000 ? n : n * 1000) : 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function monthStartUtc(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function monthEndUtc(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function historyRangeForMonths(months) {
  const n = Number(months || 12);
  if (n <= 12) return '1Y';
  if (n <= 24) return '2Y';
  if (n <= 60) return '5Y';
  return 'MAX';
}

function pricePointMillis(point = {}) {
  return tsMillis(point.date || point.time || point.timestamp || point.month);
}

function pricePointClose(point = {}) {
  const value = Number(point.close ?? point.price ?? point.value ?? point.adjClose ?? point.lastPrice ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizeHistoryPricePoints(history = {}) {
  const rows = history.points || history.history || history.series || history.prices || history.chartHistory || [];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((point) => ({ millis: pricePointMillis(point), close: pricePointClose(point) }))
    .filter((point) => point.millis > 0 && point.close > 0)
    .sort((a, b) => a.millis - b.millis);
}

const B3_RETURN_CALENDAR = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

function saoPauloCalendarParts(now = new Date()) {
  const safeNow = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const parts = Object.fromEntries(
    B3_RETURN_CALENDAR.formatToParts(safeNow)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return {
    year: Number.isFinite(year) ? year : safeNow.getUTCFullYear(),
    month: Number.isFinite(month) ? month : safeNow.getUTCMonth() + 1,
    day: Number.isFinite(day) ? day : safeNow.getUTCDate()
  };
}

function saoPauloCalendarDate(now = new Date()) {
  const parts = saoPauloCalendarParts(now);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function saoPauloMonthKey(now = new Date()) {
  const parts = saoPauloCalendarParts(now);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

function comparisonPointsFromHistory(history = {}) {
  const rows = normalizeHistoryPricePoints(history);
  if (rows.length < 2) return [];
  const byMonth = new Map();
  for (const row of rows) {
    const date = new Date(row.millis);
    const month = date.toISOString().slice(0, 7);
    byMonth.set(month, { month, date: date.toISOString().slice(0, 10), close: row.close, value: row.close, source: history.source || 'Histórico real' });
  }
  const monthly = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  const firstClose = monthly[0]?.close || 0;
  return monthly.map(point => ({
    ...point,
    label: monthLabelBr(point.month),
    returnPercent: firstClose > 0 ? round(((point.close / firstClose) - 1) * 100, 4) : 0,
    accumulatedPercent: firstClose > 0 ? round(((point.close / firstClose) - 1) * 100, 4) : 0
  }));
}
function liveCurrentPricingSnapshot(rawPositions = []) {
  const rows = Array.isArray(rawPositions) ? rawPositions : [];
  const weighted = new Map();
  const missing = new Set();
  for (const row of rows) {
    const ticker = normalizeTicker(row?.ticker || row?.symbol || row?.codigo || '');
    const quantity = Math.abs(Number(row?.quantity ?? row?.qty ?? row?.shares ?? row?.quantidade ?? 0));
    if (!ticker || !Number.isFinite(quantity) || quantity <= 0) continue;
    const explicitMarketValue = Number(row?.marketValue ?? row?.currentValue ?? NaN);
    const directPrice = Number(row?.currentPrice ?? row?.lastPrice ?? row?.cotacao ?? NaN);
    const price = Number.isFinite(directPrice) && directPrice > 0
      ? directPrice
      : (Number.isFinite(explicitMarketValue) && explicitMarketValue > 0 ? explicitMarketValue / quantity : NaN);
    if (!Number.isFinite(price) || price <= 0) {
      missing.add(ticker);
      continue;
    }
    const previous = weighted.get(ticker) || { quantity: 0, value: 0 };
    previous.quantity += quantity;
    previous.value += quantity * price;
    weighted.set(ticker, previous);
  }
  const prices = new Map([...weighted.entries()].map(([ticker, item]) => [
    ticker,
    item.quantity > 0 ? item.value / item.quantity : 0
  ]));
  return {
    prices,
    missingTickers: [...missing].filter(ticker => !prices.has(ticker)).sort(),
    complete: missing.size === 0 && prices.size > 0
  };
}

function normalizeHistoryDividendEvents(rawEvents = [], positions = [], transactions = []) {
  const list = Array.isArray(rawEvents) ? rawEvents : [];
  const normalized = list.map((event = {}) => {
    if (event.eligible === false) return null;
    const ticker = normalizeTicker(event.ticker || event.symbol || event.codigo || '');
    const paymentMillis = tsMillis(event.paymentDate || event.dataPagamento || event.payDate || event.datePayment);
    if (!ticker || !paymentMillis) return null;
    const eligibilityDate = event.eligibilityDate || event.dateCom || event.dataCom || event.exDate || event.dataEx || '';
    // Performance belongs to the period in which the investor earned the right to the
    // distribution, not to a later cash-payment month after the position may already be closed.
    // If the provider does not expose an eligibility/ex date we retain paymentMillis only as a
    // conservative fallback; a dividend by itself never establishes capital exposure below.
    const eligibilityMillis = tsMillis(eligibilityDate);
    const performanceMillis = returnDividendPerformanceMillis(event) || paymentMillis;
    const quantity = Number(event.quantityAtDate || event.eligibilityQuantity || event.quantity || event.quantidade || 0) ||
      quantityAtDate(ticker, eligibilityDate, positions, transactions);
    const perShare = Number(event.netValuePerShare ?? event.valuePerShare ?? event.valorLiquidoPorAcao ?? event.valorPorAcao ?? event.value ?? 0);
    const amount = Number(event.netAmount ?? event.estimatedAmount ?? event.amountTotal ?? event.valorLiquidoTotal ?? event.total ?? 0) ||
      (quantity > 0 && perShare > 0 ? quantity * perShare : 0);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const kind = String(event.kind || event.dividendType || event.type || 'PROVENTO').trim().toUpperCase();
    return { ticker, paymentMillis, performanceMillis, eligibilityMillis, amount: round(amount, 2), kind };
  }).filter(Boolean).sort((a, b) => a.paymentMillis - b.paymentMillis);
  const unique = new Map();
  for (const event of normalized) {
    const key = `${event.ticker}|${event.paymentMillis}|${event.kind}|${event.amount}`;
    if (!unique.has(key)) unique.set(key, event);
  }
  return [...unique.values()];
}

function dividendsReceivedUntil(events = [], boundary = 0) {
  if (!boundary) return 0;
  return round(events.reduce((sum, event) => event.paymentMillis <= boundary ? sum + event.amount : sum, 0), 2);
}

function dividendsReceivedBetween(events = [], start = 0, end = 0) {
  if (!start || !end) return 0;
  return round(events.reduce((sum, event) => event.paymentMillis >= start && event.paymentMillis <= end ? sum + event.amount : sum, 0), 2);
}

function transactionBucketsAtBoundary(transactions = [], boundary) {
  const buckets = new Map();
  const ordered = transactions.filter(t => t.millis > 0 && t.millis <= boundary).sort((a, b) => a.millis - b.millis);
  for (const tx of ordered) {
    const bucket = buckets.get(tx.ticker) || { quantity: 0, costBasis: 0 };
    const qty = Math.abs(Number(tx.quantity || 0));
    const price = Number(tx.price || 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (tx.quantity >= 0) {
      bucket.quantity += qty;
      bucket.costBasis += qty * (Number.isFinite(price) && price > 0 ? price : 0);
    } else if (bucket.quantity > 0) {
      const sold = Math.min(qty, bucket.quantity);
      const avg = bucket.quantity > 0 ? bucket.costBasis / bucket.quantity : 0;
      bucket.quantity -= sold;
      bucket.costBasis -= sold * avg;
      if (bucket.quantity <= 0.000001) {
        bucket.quantity = 0;
        bucket.costBasis = 0;
      }
    }
    buckets.set(tx.ticker, bucket);
  }
  return buckets;
}

function normalizeProvidedPortfolioHistory(payload = {}) {
  const rows = payload.portfolioHistory || payload.historyPoints || payload.history || payload.points || payload.series || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return { status: 'EMPTY', points: [], history: [], series: [], source: 'VALORAE Proxy real-only portfolio-history', reason: 'real-market-history-required' };
  }
  const syntheticPattern = /(fallback|estimativa|simulad|synthetic|normalized|position-aware|transaction-aware)/i;
  const points = rows.map((item = {}) => {
    const source = String(item.source || payload.source || 'VALORAE external portfolio-history');
    if (syntheticPattern.test(source)) return null;
    const date = item.date || item.time || item.timestamp || item.month;
    const millis = tsMillis(date);
    const value = round(Number(item.totalValue ?? item.value ?? item.portfolioValue ?? 0), 2);
    const marketValue = round(Number(item.marketValue ?? item.portfolioMarketValue ?? item.currentValue ?? value), 2);
    const invested = round(Number(item.investedValue ?? item.invested ?? item.costBasis ?? 0), 2);
    const rawReturn = Number(item.returnPercent ?? item.returnPct ?? item.variationPct ?? item.rentabilidadePercentual ?? NaN);
    const returnPercent = Number.isFinite(rawReturn) ? round(rawReturn, 2) : (invested > 0 && value > 0 ? round(((value - invested) / invested) * 100, 2) : 0);
    if (!millis || (value <= 0 && invested <= 0 && returnPercent === 0)) return null;
    return {
      date: new Date(millis).toISOString().slice(0, 10),
      month: new Date(millis).toISOString().slice(0, 7),
      value,
      patrimonio: value,
      totalValue: value,
      marketValue: marketValue >= 0 ? marketValue : value,
      investedValue: invested,
      invested,
      returnPercent,
      returnPct: returnPercent,
      source
    };
  }).filter(Boolean).sort((a, b) => tsMillis(a.date) - tsMillis(b.date));
  return { status: points.length ? 'OK' : 'EMPTY', points, history: points, series: points, source: 'VALORAE Proxy external real portfolio-history', reason: points.length ? undefined : 'provided-history-empty-or-synthetic' };
}

export function buildHistory(payload = {}) {
  // Real-only mode: this synchronous compatibility path no longer fabricates portfolio
  // curves from current prices. It only echoes already-provided real portfolio history.
  return normalizeProvidedPortfolioHistory(payload);
}

export async function buildRealMarketHistory(payload = {}, now = new Date()) {
  const provided = normalizeProvidedPortfolioHistory(payload);
  if (provided.points.length) return provided;

  const positions = normalizePositions(payload.positions || []);
  const livePricing = liveCurrentPricingSnapshot(payload.positions || []);
  const sourceTransactions = normalizeTransactions(payload.transactions || []);
  const openingReconciliation = reconcileReturnOpeningTransactions(positions, sourceTransactions);
  const transactions = openingReconciliation.transactions;
  const realDividendEvents = normalizeHistoryDividendEvents(payload.dividendEvents || payload.events || payload.dividends || [], positions, transactions);
  if (!transactions.length) {
    return { status: 'EMPTY', points: [], history: [], series: [], source: 'VALORAE Proxy real-only portfolio-history', reason: 'transactions-required-for-real-portfolio-history' };
  }

  const requestedMonths = Number(payload.historyMonths || payload.months || 12);
  const b3Now = saoPauloCalendarParts(now);
  const firstTxMillis = Math.min(...transactions.map(t => t.millis).filter(Number.isFinite));
  if (!Number.isFinite(firstTxMillis) || firstTxMillis <= 0) {
    return { status: 'EMPTY', points: [], history: [], series: [], source: 'VALORAE Proxy real-only portfolio-history', reason: 'valid-transaction-dates-required' };
  }
  const startDate = portfolioStartDate(payload, positions, sourceTransactions) || new Date(firstTxMillis);
  const ageMonths = ((b3Now.year - startDate.getUTCFullYear()) * 12 + ((b3Now.month - 1) - startDate.getUTCMonth()) + 1);
  const requestedWindow = Math.max(1, Math.min(600, Number.isFinite(requestedMonths) ? requestedMonths : 12));
  // Retorno já calcula a janela visível e pede um fechamento extra de base. Nesse fluxo
  // não faz sentido baixar/reconstruir todos os anos da carteira para mostrar 1A/3A/5A.
  // Outros consumidores de portfolio-history mantêm o comportamento histórico desde a
  // origem, portanto a otimização é explicitamente opt-in.
  const months = payload.limitHistoryToRequestedWindow === true
    ? requestedWindow
    : Math.max(1, Math.min(600, Math.max(requestedWindow, ageMonths || 1)));
  // Every ticker that ever participated in the transaction ledger belongs to the historical
  // portfolio, including assets that are fully closed today. There used to be an implicit 35-ticker
  // ceiling here, which silently truncated older/large portfolios. Keep the full universe and cap
  // only concurrent provider work so completeness does not turn into an outbound request burst.
  const tickers = [...new Set(transactions.map(t => t.ticker).filter(Boolean))];
  if (!tickers.length) {
    return { status: 'EMPTY', points: [], history: [], series: [], source: 'VALORAE Proxy real-only portfolio-history', reason: 'tickers-required' };
  }

  const range = historyRangeForMonths(months);
  const priceEntries = new Array(tickers.length);
  let tickerCursor = 0;
  const historyConcurrency = Math.max(1, Math.min(24, Number(payload.historyConcurrency || 16) || 16));
  const historyWorker = async () => {
    while (tickerCursor < tickers.length) {
      const index = tickerCursor++;
      const ticker = tickers[index];
      try {
        const historyLimit = range === 'MAX' ? 600 : 320;
        const history = await getAssetHistory({ ticker, range, timeoutMs: Number(payload.timeoutMs || 3800), limit: historyLimit });
        priceEntries[index] = [ticker, normalizeHistoryPricePoints(history), history?.status || 'EMPTY'];
      } catch (error) {
        priceEntries[index] = [ticker, [], 'ERROR'];
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(historyConcurrency, tickers.length) }, historyWorker));
  const pricesByTicker = new Map(priceEntries.map(([ticker, points]) => [ticker, points]));
  const unavailableTickers = priceEntries.filter(([, points]) => !points.length).map(([ticker]) => ticker);
  const allowHistoricalCostBasisCarry = payload.allowHistoricalCostBasisCarry === true;

  const points = [];
  const skippedMonths = [];
  const inactiveMonths = [];
  const partialValuationMonths = [];
  const unpricedTransactionMonths = [];
  const partialValuationTickers = new Set();
  const lastTransactionMillis = transactions.reduce(
    (latest, transaction) => Math.max(latest, Number(transaction?.millis || 0)),
    0
  );
  for (let i = months - 1; i >= 0; i--) {
    const d = monthStartUtc(new Date(Date.UTC(b3Now.year, (b3Now.month - 1) - i, 1)));
    if (d < monthStartUtc(startDate)) continue;
    const monthStart = d.getTime();
    const monthEnd = monthEndUtc(d).getTime();
    const isCurrentMonth = d.getUTCFullYear() === b3Now.year && d.getUTCMonth() === (b3Now.month - 1);
    // The current month is still in progress. Weighting cash flows through a future
    // month-end overstated their exposure and distorted Modified Dietz. Cap the
    // boundary at the current instant; closed months keep their true month-end.
    const boundary = isCurrentMonth ? Math.min(monthEnd, now.getTime()) : monthEnd;
    const beginningBuckets = transactionBucketsAtBoundary(transactions, Math.max(0, monthStart - 1));
    const beginningActive = [...beginningBuckets.entries()].filter(([, b]) => b.quantity > 0.000001);
    const buckets = transactionBucketsAtBoundary(transactions, boundary);
    const active = [...buckets.entries()].filter(([, b]) => b.quantity > 0.000001);
    const dividendsReceived = dividendsReceivedUntil(realDividendEvents, boundary);
    const dividendsPaidInMonth = dividendsReceivedBetween(realDividendEvents, monthStart, boundary);
    const dividendsInMonth = dividendsEarnedBetween(realDividendEvents, monthStart, boundary);
    const monthFlows = weightedPortfolioCashFlows(transactions, monthStart, boundary, {
      beginningHasCapital: beginningActive.length > 0,
      endingHasCapital: active.length > 0
    });
    // Exposure is established only by holdings or an actual buy/sell interval. A dividend paid
    // after liquidation is income from an earlier entitlement and must never create a new return
    // observation by itself.
    const hasCapitalExposure = monthHasCapitalExposure({
      beginningPositionCount: beginningActive.length,
      endingPositionCount: active.length,
      contributions: monthFlows.contributions,
      withdrawals: monthFlows.withdrawals
    });
    const hasMonthActivity = hasCapitalExposure;
    const exposureStartMillis = hasCapitalExposure
      ? (beginningActive.length > 0 ? monthStart : monthFlows.exposureStart)
      : 0;
    const exposureEndMillis = hasCapitalExposure
      ? (active.length > 0 ? boundary : monthFlows.exposureEnd)
      : 0;
    const capitalExposureStartDate = exposureStartMillis > 0
      ? new Date(exposureStartMillis).toISOString().slice(0, 10)
      : null;
    const capitalExposureEndDate = exposureEndMillis > 0
      ? new Date(exposureEndMillis).toISOString().slice(0, 10)
      : null;
    const partialExposureMonth = hasCapitalExposure && (beginningActive.length === 0 || active.length === 0 || isCurrentMonth);
    const hasUnpricedTransaction = transactions.some(transaction =>
      Number(transaction?.millis || 0) >= monthStart && Number(transaction?.millis || 0) <= boundary &&
      Math.abs(Number(transaction?.quantity || 0)) > 0 && !(Number(transaction?.price || 0) > 0)
    );
    if (hasCapitalExposure && hasUnpricedTransaction) {
      const month = d.toISOString().slice(0, 7);
      unpricedTransactionMonths.push(month);
      skippedMonths.push(month);
      continue;
    }

    // A total sale is itself part of the return history. Months after that sale can also be
    // economically meaningful when a later purchase reopens the portfolio. They are not missing
    // valuation: they are known periods with zero capital at risk. Preserve only those dormant
    // bridge months that have a later transaction; after the final liquidation there is no reason
    // to extend the performance curve indefinitely.
    if (!active.length && !hasMonthActivity) {
      if (lastTransactionMillis > boundary) {
        const month = d.toISOString().slice(0, 7);
        inactiveMonths.push(month);
        points.push({
          date: d.toISOString().slice(0, 10),
          month,
          value: round(dividendsReceived, 2),
          patrimonio: round(dividendsReceived, 2),
          totalValue: round(dividendsReceived, 2),
          marketValue: 0,
          dividendsReceived,
          dividendsPaidInMonth,
          dividendsInMonth: 0,
          monthlyContributions: 0,
          monthlyWithdrawals: 0,
          netCashFlow: 0,
          weightedNetCashFlow: 0,
          investedValue: 0,
          invested: 0,
          returnPercent: 0,
          returnPct: 0,
          components: [],
          completeValuation: true,
          partialValuation: false,
          valuationCoveragePercent: 100,
          unavailableValuationTickers: [],
          currentMonthPartial: false,
          currentLivePricing: false,
          capitalExposed: false,
          source: 'VALORAE Proxy Return v5 • diagnóstico de mês sem capital'
        });
      }
      continue;
    }

    let invested = 0;
    let value = 0;
    let missing = false;
    let realPricedCostBasis = 0;
    const carriedTickers = [];
    const components = [];
    const useLiveCurrentPrices = isCurrentMonth && active.length > 0 && active.every(([ticker]) => {
      const price = livePricing.prices.get(ticker);
      return Number.isFinite(price) && price > 0;
    });
    for (const [ticker, bucket] of active) {
      const livePrice = useLiveCurrentPrices ? livePricing.prices.get(ticker) : null;
      const valuation = Number.isFinite(livePrice) && livePrice > 0
        ? { close: livePrice, mode: 'LIVE_PRICE', partial: false }
        : resolveHistoricalPortfolioValuation(
            pricesByTicker.get(ticker) || [],
            monthStart,
            boundary,
            bucket,
            allowHistoricalCostBasisCarry && !isCurrentMonth
          );
      const close = Number(valuation.close || 0);
      if (close <= 0) {
        missing = true;
        break;
      }
      const tickerValue = bucket.quantity * close;
      const tickerInvested = Math.max(0, bucket.costBasis);
      invested += tickerInvested;
      value += tickerValue;
      if (valuation.partial) {
        carriedTickers.push(ticker);
        partialValuationTickers.add(ticker);
      } else {
        realPricedCostBasis += tickerInvested;
      }
      components.push({
        ticker,
        quantity: round(bucket.quantity, 8),
        close: round(close, 4),
        value: round(tickerValue, 2),
        invested: round(bucket.costBasis, 2),
        valuationMode: valuation.mode
      });
    }
    if (missing || (active.length && (invested <= 0 || value <= 0))) {
      skippedMonths.push(d.toISOString().slice(0, 7));
      continue;
    }
    const partialValuation = carriedTickers.length > 0;
    const valuationCoveragePercent = invested > 0
      ? round(Math.max(0, Math.min(100, (realPricedCostBasis / invested) * 100)), 2)
      : 100;
    if (partialValuation) partialValuationMonths.push(d.toISOString().slice(0, 7));
    const marketValue = round(value, 2);
    const totalValue = round(marketValue + dividendsReceived, 2);
    const investedValue = round(invested, 2);
    const returnPercent = investedValue > 0
      ? round(((totalValue - investedValue) / investedValue) * 100, 2)
      : 0;
    points.push({
      date: d.toISOString().slice(0, 10),
      month: d.toISOString().slice(0, 7),
      value: totalValue,
      patrimonio: totalValue,
      totalValue,
      marketValue,
      dividendsReceived,
      dividendsPaidInMonth,
      dividendsInMonth,
      monthlyContributions: monthFlows.contributions,
      monthlyWithdrawals: monthFlows.withdrawals,
      netCashFlow: monthFlows.netFlow,
      weightedNetCashFlow: monthFlows.weightedNetCashFlow,
      investedValue,
      invested: investedValue,
      returnPercent,
      returnPct: returnPercent,
      components,
      completeValuation: !partialValuation,
      partialValuation,
      valuationCoveragePercent,
      unavailableValuationTickers: carriedTickers,
      currentMonthPartial: isCurrentMonth,
      capitalExposed: hasCapitalExposure,
      capitalExposureStartDate,
      capitalExposureEndDate,
      partialExposureMonth,
      currentLivePricing: useLiveCurrentPrices,
      source: partialValuation
        ? 'VALORAE Proxy real portfolio-history + CostBasisCarry parcial'
        : realDividendEvents.length
          ? 'VALORAE Proxy real portfolio-history Yahoo Finance + transações + proventos confirmados'
          : 'VALORAE Proxy real portfolio-history Yahoo Finance + transações'
    });
  }

  return {
    status: points.length ? (skippedMonths.length || unavailableTickers.length || openingReconciliation.tickers.length ? 'PARTIAL' : 'OK') : 'EMPTY',
    points,
    history: points,
    series: points,
    source: realDividendEvents.length
      ? 'VALORAE Proxy real portfolio-history Yahoo Finance + transações + proventos confirmados'
      : 'VALORAE Proxy real portfolio-history Yahoo Finance + transações',
    realOnly: true,
    partial: Boolean(skippedMonths.length || unavailableTickers.length || partialValuationMonths.length || openingReconciliation.tickers.length),
    skippedMonths,
    inactiveMonths: [...new Set(inactiveMonths)].sort(),
    unavailableTickers,
    partialValuationUsed: partialValuationMonths.length > 0,
    unpricedTransactionMonths: [...new Set(unpricedTransactionMonths)].sort(),
    partialValuationMonths: [...new Set(partialValuationMonths)],
    partialValuationTickers: [...partialValuationTickers].sort(),
    openingInventoryReconciled: openingReconciliation.tickers.length > 0,
    openingInventoryReconciledTickers: openingReconciliation.tickers,
    openingInventoryReconciliationCount: openingReconciliation.reconciliations.length,
    reason: points.length ? undefined : 'insufficient-real-price-history'
  };
}


function pctFromValues(start, end) {
  const a = Number(start);
  const b = Number(end);
  return a > 0 && b > 0 ? round(((b / a) - 1) * 100, 4) : 0;
}

function returnRangeMonths(range = 'SINCE_START', payload = {}, now = new Date()) {
  const r = String(range || 'SINCE_START').trim().toUpperCase();
  if (['1M', 'LAST_MONTH', 'MES', 'MÊS'].includes(r)) return 2;
  if (['3M', 'TRI'].includes(r)) return 3;
  if (['6M', 'SEMESTRE'].includes(r)) return 6;
  if (['12M', '1Y', '1A', 'ULTIMOS_12_MESES', 'ÚLTIMOS_12_MESES'].includes(r)) return 12;
  if (['24M', '2Y', '2A'].includes(r)) return 24;
  if (['36M', '3Y', '3A', '3ANOS'].includes(r)) return 36;
  if (['60M', '5Y', '5A', '5ANOS'].includes(r)) return 60;
  if (['YTD', 'ANO_ATUAL'].includes(r)) return saoPauloCalendarParts(now).month;

  const positions = normalizePositions(payload.positions || []);
  const transactions = normalizeTransactions(payload.transactions || []);
  const inception = portfolioStartDate(payload, positions, transactions);
  if (!inception) return Math.max(12, Math.min(600, Number(payload.historyMonths || 120) || 120));
  const first = inception;
  const b3Now = saoPauloCalendarParts(now);
  const ageMonths = ((b3Now.year - first.getUTCFullYear()) * 12) + ((b3Now.month - 1) - first.getUTCMonth()) + 1;
  return Math.max(1, Math.min(600, ageMonths));
}

function monthLabelBr(month = '') {
  const m = String(month || '').match(/^(\d{4})-(\d{2})/);
  return m ? `${m[2]}/${String(m[1]).slice(2)}` : String(month || '');
}

function normalizeReturnPointMonth(point = {}) {
  const raw = point.month || String(point.date || '').slice(0, 7);
  return /^\d{4}-\d{2}$/.test(String(raw)) ? String(raw) : '';
}

function accumulatedFromMonthly(points = [], valueKey = 'monthlyPercent') {
  let factor = 1;
  return (Array.isArray(points) ? points : [])
    .map(point => {
      const month = normalizeReturnPointMonth(point);
      const monthly = Number(point[valueKey] ?? point.value ?? 0);
      if (!month || !Number.isFinite(monthly)) return null;
      factor *= (1 + monthly / 100);
      return { month, label: monthLabelBr(month), monthlyPercent: round(monthly, 4), accumulatedPercent: round((factor - 1) * 100, 4) };
    })
    .filter(Boolean);
}

function returnSeriesMonthOrdinal(month = '') {
  const match = String(month).match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const monthNumber = Number(match[2]);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) return null;
  return Number(match[1]) * 12 + monthNumber - 1;
}

function trailingBenchmarkReturnFromSeries(series = [], months = 12, selector = () => null) {
  const rows = (Array.isArray(series) ? series : [])
    .filter(row => returnSeriesMonthOrdinal(row?.month) !== null)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  if (!rows.length) return null;
  const safeMonths = Math.max(1, Number(months) || 1);
  const lastOrdinal = returnSeriesMonthOrdinal(rows.at(-1)?.month);
  if (lastOrdinal === null) return null;
  const startOrdinal = lastOrdinal - safeMonths + 1;
  const firstWindowIndex = rows.findIndex(row => {
    const ordinal = returnSeriesMonthOrdinal(row.month);
    return ordinal !== null && ordinal >= startOrdinal;
  });
  if (firstWindowIndex < 0) return null;
  const lastValue = Number(selector(rows.at(-1)));
  if (!Number.isFinite(lastValue)) return null;

  // Exposure-aligned benchmark values are cumulative only while the portfolio is invested.
  // Rebase from the last active observation before the calendar window, not from “N rows ago”.
  // This preserves zero-capital gaps without silently stretching the trailing period.
  if (firstWindowIndex === 0) return round(lastValue, 4);
  const baseValue = Number(selector(rows[firstWindowIndex - 1]));
  if (!Number.isFinite(baseValue)) return null;
  const denominator = 1 + baseValue / 100;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 0.000001) return null;
  const result = ((1 + lastValue / 100) / denominator - 1) * 100;
  return Number.isFinite(result) ? round(result, 4) : null;
}

export function monthlyTableFromSeries(series = []) {
  const monthKeys = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const rows = new Map();
  for (const point of series) {
    const m = String(point.month || '').match(/^(\d{4})-(\d{2})$/);
    if (!m) continue;
    const year = Number(m[1]);
    const idx = Number(m[2]) - 1;
    const row = rows.get(year) || { year };
    // Return v5 only emits months with real capital exposure. Missing months remain absent/null
    // in the calendar table and therefore can never be interpreted as a 0% return.
    row[monthKeys[idx]] = Number.isFinite(Number(point.monthlyReturnPercent))
      ? round(Number(point.monthlyReturnPercent), 2)
      : null;
    rows.set(year, row);
  }
  return [...rows.values()].sort((a, b) => Number(b.year) - Number(a.year));
}

function comparisonToCdi(portfolioPct = 0, cdiPct = 0) {
  const p = Number(portfolioPct || 0);
  const c = Number(cdiPct || 0);
  if (!Number.isFinite(p) || !Number.isFinite(c) || Math.abs(c) < 0.000001) return { percent: 0, label: 'CDI indisponível' };
  const delta = round(((p - c) / Math.abs(c)) * 100, 2);
  return { percent: delta, label: `${Math.abs(delta).toFixed(2).replace('.', ',')}% ${delta >= 0 ? 'acima' : 'abaixo'} do CDI` };
}


const DIRECT_RETURN_INDEX_CODES = new Set(['IBOV', 'SMLL', 'IFIX', 'IDIV']);

async function fetchPortfolioReturnBenchmarkHistory(benchmark = '', {
  months = 12,
  timeoutMs = 9000,
  limit = 520
} = {}) {
  const code = String(benchmark || '').trim().toUpperCase();
  const attempts = [];
  const directEligible = DIRECT_RETURN_INDEX_CODES.has(code);

  const normalizeCandidate = (provider, history) => {
    const integrity = inspectRealHistoryIntegrity(history);
    const points = integrity.trusted
      ? comparisonPointsFromHistory(history)
          .map(point => ({
            ...point,
            month: normalizeReturnPointMonth(point),
            accumulatedPercent: Number(point.returnPercent || 0)
          }))
          .filter(point => point.month)
      : [];
    attempts.push({
      provider,
      status: history?.status || 'EMPTY',
      count: points.length,
      trusted: integrity.trusted,
      error: history?.error,
      source: history?.source
    });
    return { provider, history, integrity, points };
  };

  // Match the modal's resilience: direct index and generic market history are started
  // together. A slow/empty direct provider can no longer consume the whole Return page
  // deadline before the already-working fallback gets a chance to answer.
  const genericPromise = getAssetHistory({
    ticker: code,
    range: historyRangeForMonths(months),
    timeoutMs: Math.max(3200, Number(timeoutMs || 9000)),
    limit
  }).catch(error => ({ status: 'ERROR', points: [], error: error?.message || String(error) }));

  const directPromise = directEligible
    ? fetchInvestidor10DirectIndexHistory(code, {
        months: Math.min(600, Math.max(Number(months) || 12, 2) + 1),
        timeoutMs: Math.max(3200, Math.min(6500, Number(timeoutMs) || 9000)),
        limit: Math.max(36, Math.min(360, Number(limit) || 120))
      }).catch(error => ({
        ok: false, status: 'ERROR', ticker: code, points: [], error: error?.message || String(error)
      }))
    : Promise.resolve(null);

  const [directRaw, genericRaw] = await Promise.all([directPromise, genericPromise]);
  const candidates = [];
  if (directRaw) candidates.push(normalizeCandidate('Investidor10DirectIndexHistory', directRaw));
  candidates.push(normalizeCandidate('getAssetHistory', genericRaw));

  const usable = candidates.filter(candidate => candidate.integrity.trusted && candidate.points.length >= 2);
  const selected = usable.sort((a, b) => {
    // Prefer broader real coverage. On ties, retain the direct B3-index source.
    const countDelta = b.points.length - a.points.length;
    if (countDelta) return countDelta;
    return a.provider === 'Investidor10DirectIndexHistory' ? -1 : 1;
  })[0] || candidates.sort((a, b) => b.points.length - a.points.length)[0];

  return {
    history: selected?.history || genericRaw,
    points: selected?.points || [],
    integrity: selected?.integrity || inspectRealHistoryIntegrity(genericRaw),
    attempts,
    provider: selected?.provider || 'getAssetHistory',
    providerParity: directEligible
      ? 'asset-modal-parallel-direct-plus-history'
      : 'return-history-default',
    directIndexAlternative: selected?.provider === 'Investidor10DirectIndexHistory'
  };
}

export async function buildPortfolioReturns(payload = {}) {
  const now = new Date();
  const range = String(payload.range || payload.period || 'SINCE_START').trim().toUpperCase();
  const assetFilter = String(payload.assetFilter || payload.typeFilter || 'ALL').trim().toUpperCase();
  const displayMonths = returnRangeMonths(range, payload, now);
  const portfolioMonths = Math.max(displayMonths, Number(payload.historyMonths || 0) || 0, 12);
  const portfolioFetchMonths = Math.min(600, portfolioMonths + 1);
  // Os índices devem seguir a janela realmente exibida. O payload antigo do APK sempre
  // enviava 120 meses e fazia consultas MAX/10y desnecessárias até para "Ano atual".
  // `SINCE_START` can exceed the APK's conservative 120-month hint. Benchmarks must
  // cover the actual visible portfolio window; otherwise Máx can show the portfolio
  // alone or silently compare a shorter index period.
  const requestedBenchmarkMonths = Number(payload.benchmarkMonths || 0) || 0;
  const benchmarkMonths = Math.max(1, Math.min(600, Math.max(displayMonths, requestedBenchmarkMonths)));
  const benchmarkFetchMonths = Math.min(600, benchmarkMonths + 2);
  const filteredPayload = filterPayloadByAssetClass({ ...payload, historyMonths: portfolioFetchMonths }, assetFilter);
  const currentPositions = normalizePositions(filteredPayload.positions || []).filter(position => position.quantity > 0);
  const currentPricing = liveCurrentPricingSnapshot(filteredPayload.positions || []);
  const currentSnapshotMissingTickers = currentPositions
    .map(position => position.ticker)
    .filter(ticker => !currentPricing.prices.has(ticker))
    .sort();
  const currentSnapshotComplete = currentPositions.length > 0 && currentSnapshotMissingTickers.length === 0;
  const currentSnapshotMarketValue = currentSnapshotComplete
    ? round(currentPositions.reduce((sum, position) => {
        const price = currentPricing.prices.get(position.ticker);
        return sum + (Number.isFinite(price) && price > 0 ? position.quantity * price : 0);
      }, 0), 2)
    : 0;
  const history = await buildRealMarketHistory({
    ...filteredPayload,
    limitHistoryToRequestedWindow: true,
    // Return v5 is accuracy-first: a missing market close must break the comparable
    // performance chain. Cost basis is accounting data, not a substitute for market value.
    allowHistoricalCostBasisCarry: false
  }, now);
  const strictReturn = buildExposureOnlyReturnSeriesV5(history.points || history.history || [], {
    skippedMonths: history.skippedMonths || []
  });
  const rawPortfolio = strictReturn.rows;
  const droppedReturnMonths = strictReturn.diagnostics.droppedMonths;
  const selectedPortfolio = selectExposureReturnWindowV5(rawPortfolio, range, displayMonths, saoPauloCalendarDate(now));
  const portfolio = selectedPortfolio.rows;
  const isYearToDate = ['YTD', 'ANO_ATUAL'].includes(range);
  const currentYear = String(saoPauloCalendarDate(now).getUTCFullYear());
  if (!portfolio.length) {
    return {
      status: 'EMPTY',
      contractVersion: 'valorae-portfolio-returns-v5-exposure-only',
      range,
      assetFilter,
      summary: {},
      series: [],
      monthlyTable: [],
      benchmarks: [],
      highlights: [],
      diagnostics: { portfolioHistoryStatus: history.status, reason: history.reason || 'portfolio-history-empty', partial: true, warnings: ['Histórico real insuficiente para calcular retorno.'] }
    };
  }

  const rawRequestedBenchmarks = Array.isArray(payload.benchmarks) && payload.benchmarks.length
    ? payload.benchmarks.map(x => String(x).toUpperCase())
    : ['CDI', 'IPCA', 'IBOV', 'SMLL', 'IFIX', 'IDIV', 'IVVB11'];
  const benchmarkAlias = { SMAL11: 'SMLL', DIVO11: 'IDIV' };
  const requestedBenchmarks = [...new Set(rawRequestedBenchmarks.map(code => benchmarkAlias[code] || code))];
  const cdiRequested = requestedBenchmarks.includes('CDI');
  const ipcaRequested = requestedBenchmarks.includes('IPCA');
  const [cdi, ipca] = await Promise.all([
    cdiRequested ? getCdiAccumulatedSeries(benchmarkFetchMonths, Number(payload.indexTimeoutMs || payload.timeoutMs || 6500)) : Promise.resolve({ status: 'SKIPPED', points: [] }),
    ipcaRequested ? getIpcaSeries(benchmarkFetchMonths).catch(error => ({ status: 'ERROR', points: [], error: error?.message })) : Promise.resolve({ status: 'SKIPPED', points: [] })
  ]);
  const marketBenchmarkMap = { IBOV: 'IBOV', IFIX: 'IFIX', SMLL: 'SMLL', SMAL11: 'SMLL', IDIV: 'IDIV', DIVO11: 'IDIV', IVVB11: 'IVVB11' };
  const marketBenchmarks = await Promise.all(requestedBenchmarks.filter(b => marketBenchmarkMap[b]).map(async (benchmark) => {
    const benchmarkLimit = benchmarkMonths <= 12 ? 320 : (benchmarkMonths <= 60 ? 900 : 1600);
    const result = await fetchPortfolioReturnBenchmarkHistory(marketBenchmarkMap[benchmark], {
      months: benchmarkFetchMonths,
      timeoutMs: Number(payload.indexTimeoutMs || payload.timeoutMs || 9000),
      limit: benchmarkLimit
    });
    const historyPayload = result.history || {};
    const integrity = result.integrity || inspectRealHistoryIntegrity(historyPayload);
    const points = result.points || [];
    const isOfficialB3Index = ['IBOV', 'SMLL', 'IFIX', 'IDIV'].includes(benchmark);
    return {
      ticker: benchmark,
      label: benchmark,
      status: points.length >= 2 ? 'OK' : (integrity.trusted ? (historyPayload.status || 'EMPTY') : 'REJECTED'),
      points,
      source: historyPayload.source || (isOfficialB3Index ? `Índice direto ${benchmark}` : 'YahooChart'),
      official: isOfficialB3Index ? historyPayload.official === true : undefined,
      directIndexSymbol: historyPayload.directIndexSymbol === true,
      directIndexAlternative: result.directIndexAlternative === true,
      provider: result.provider,
      providerParity: result.providerParity,
      providerAttempts: result.attempts || [],
      yahooSymbol: historyPayload.yahooSymbol || undefined,
      reconstructedFromMonthlyReturns: historyPayload.reconstructedFromMonthlyReturns === true,
      simulated: historyPayload.simulated === true,
      proxyTickerUsed: historyPayload.proxyTickerUsed === true,
      integrity,
      warning: integrity.trusted ? historyPayload.warning : `Série rejeitada pelo gate de integridade: ${integrity.reasons.join(', ')}`,
      error: historyPayload.error
    };
  }));

  const baseMonth = selectedPortfolio.comparisonStartMonth || portfolio[0]?.month || '';
  // Return v5 owns the portfolio comparison window. Benchmarks must use the exact same
  // previous real portfolio close as denominator; after a broken valuation chain this is
  // intentionally blank so no index is bridged across an unmeasurable portfolio interval.
  const comparisonBaseMonth = selectedPortfolio.comparisonBaseMonth || '';
  const cdiMap = benchmarkExposureAlignedMonthMap(cdi.points || [], 'accumulatedPercent', portfolio, comparisonBaseMonth);
  const ipcaAccum = accumulatedFromMonthly((ipca.points || ipca.series || []).map(p => ({ ...p, value: Number(p.monthlyPercent ?? p.value ?? 0) })));
  const ipcaMap = benchmarkExposureAlignedMonthMap(ipcaAccum, 'accumulatedPercent', portfolio, comparisonBaseMonth);
  const marketMaps = Object.fromEntries(marketBenchmarks.map(b => [
    b.ticker,
    benchmarkExposureAlignedMonthMap(b.points || [], 'accumulatedPercent', portfolio, comparisonBaseMonth)
  ]));

  const currentMonth = saoPauloMonthKey(now);
  const series = portfolio.map(point => {
    const historicalMarketValue = round(Number(point.marketValue ?? point.totalValue ?? point.value ?? 0), 2);
    const marketValue = point.month === currentMonth && currentSnapshotComplete && currentSnapshotMarketValue > 0
      ? currentSnapshotMarketValue
      : historicalMarketValue;
    const dividendsReceived = round(Number(point.dividendsReceived || 0), 2);
    const totalValue = point.month === currentMonth && currentSnapshotComplete
      ? round(marketValue + dividendsReceived, 2)
      : round(Number(point.totalValue ?? point.value ?? 0), 2);
    const row = {
      month: point.month,
      label: point.label,
      date: `${point.month}-01`,
      portfolioReturnPercent: round(Number(point.portfolioReturnPercent || 0), 4),
      monthlyReturnPercent: round(Number(point.monthlyReturnPercent || 0), 4),
      marketValue,
      totalValue,
      investedValue: round(Number(point.investedValue ?? point.invested ?? 0), 2),
      dividendsReceived,
      partialValuation: point.partialValuation === true,
      completeValuation: point.partialValuation !== true,
      valuationCoveragePercent: Number.isFinite(Number(point.valuationCoveragePercent))
        ? round(Number(point.valuationCoveragePercent), 2)
        : 100,
      unavailableValuationTickers: Array.isArray(point.unavailableValuationTickers)
        ? [...point.unavailableValuationTickers]
        : [],
      currentMonthPartial: point.currentMonthPartial === true,
      exposureCycleId: Number(point.exposureCycleId || 0),
      chartSegmentId: Number(point.chartSegmentId || 0),
      segmentStart: point.segmentStart === true,
      capitalExposureStartDate: point.capitalExposureStartDate || null,
      capitalExposureEndDate: point.capitalExposureEndDate || null,
      partialExposureMonth: point.partialExposureMonth === true,
      cdiReturnPercent: cdiMap.get(point.month) ?? null,
      ipcaReturnPercent: ipcaMap.get(point.month) ?? null
    };
    for (const ticker of Object.keys(marketMaps)) {
      const value = marketMaps[ticker].get(point.month) ?? null;
      row[`${ticker.toLowerCase()}ReturnPercent`] = value;
      if (ticker === 'SMLL') row.smal11ReturnPercent = value;
    }
    return row;
  });

  const returnMetrics = summarizeExposureReturnV5(series);
  const totalReturnPercent = returnMetrics.totalReturnPercent;
  const lastMonthReturnPercent = returnMetrics.lastMonthReturnPercent;
  const last12MonthsReturnPercent = returnMetrics.last12MonthsReturnPercent;
  const cdiSeriesPoints = series
    .map((point, index) => ({
      index,
      month: point.month,
      value: point.cdiReturnPercent == null ? null : Number(point.cdiReturnPercent)
    }))
    .filter(point => point.value !== null && Number.isFinite(point.value));
  // The summary and the graph must share the same comparison contract. Never take
  // the “latest non-null CDI” when the portfolio's selected month has no CDI close:
  // that would compare different months while visually presenting the same period.
  const cdiUsableInChart = cdiSeriesPoints.length >= 2;
  const cdiCoverageComplete = series.length > 0 && series.every(point => Number.isFinite(Number(point.cdiReturnPercent)));
  const lastAlignedCdi = Number(series.at(-1)?.cdiReturnPercent);
  const cdiTotalPercent = cdiCoverageComplete && Number.isFinite(lastAlignedCdi) ? lastAlignedCdi : 0;
  const cdiLastMonthPercent = trailingBenchmarkReturnFromSeries(series, 1, point => point.cdiReturnPercent) ?? 0;
  const cdiLast12MonthsPercent = trailingBenchmarkReturnFromSeries(series, 12, point => point.cdiReturnPercent) ?? 0;
  const bestMonth = returnMetrics.bestMonth;
  const worstMonth = returnMetrics.worstMonth;
  const averageMonthly = returnMetrics.averageMonthlyReturnPercent;
  const volatilityMonthly = returnMetrics.volatilityMonthlyPercent;
  const historicalTransactions = normalizeTransactions(filteredPayload.transactions || []);
  const historicalTickers = [...new Set(historicalTransactions.map(transaction => transaction.ticker).filter(Boolean))].sort();
  const currentTickers = currentPositions.map(position => position.ticker).filter(Boolean).sort();
  const inceptionDate = portfolioStartDate(filteredPayload, currentPositions, historicalTransactions);

  return {
    status: history.status === 'OK' ? 'OK' : (series.length ? 'PARTIAL' : 'EMPTY'),
    contractVersion: 'valorae-portfolio-returns-v5-exposure-only',
    range,
    assetFilter,
    comparisonBaseMonth,
    comparisonStartMonth: baseMonth,
    source: 'VALORAE Proxy Return v5: performance somente durante exposição real + fluxos ajustados no tempo',
    summary: {
      totalReturnPercent,
      last12MonthsReturnPercent,
      lastMonthReturnPercent,
      cdiTotalPercent: round(cdiTotalPercent, 2),
      cdiLast12MonthsPercent: round(cdiLast12MonthsPercent, 2),
      cdiLastMonthPercent: round(cdiLastMonthPercent, 2),
      totalVsCdiPercent: comparisonToCdi(totalReturnPercent, cdiTotalPercent).percent,
      totalVsCdiLabel: comparisonToCdi(totalReturnPercent, cdiTotalPercent).label,
      last12MonthsVsCdiPercent: comparisonToCdi(last12MonthsReturnPercent, cdiLast12MonthsPercent).percent,
      last12MonthsVsCdiLabel: comparisonToCdi(last12MonthsReturnPercent, cdiLast12MonthsPercent).label,
      lastMonthVsCdiPercent: comparisonToCdi(lastMonthReturnPercent, cdiLastMonthPercent).percent,
      lastMonthVsCdiLabel: comparisonToCdi(lastMonthReturnPercent, cdiLastMonthPercent).label,
      averageMonthlyReturnPercent: averageMonthly,
      volatilityMonthlyPercent: volatilityMonthly,
      bestMonthLabel: bestMonth?.label || '',
      bestMonthReturnPercent: bestMonth ? round(Number(bestMonth.monthlyReturnPercent || 0), 2) : 0,
      worstMonthLabel: worstMonth?.label || '',
      worstMonthReturnPercent: worstMonth ? round(Number(worstMonth.monthlyReturnPercent || 0), 2) : 0
    },
    series,
    chartSeries: series,
    monthlyTable: monthlyTableFromSeries(series),
    analytics: buildReturnAnalytics(series),
    exposureCycles: buildReturnExposureCycles(series),
    benchmarks: [
      { ticker: 'CDI', label: 'CDI', status: cdi.status, source: cdi.source || 'BancoCentralSGS', points: cdi.points || [] },
      { ticker: 'IPCA', label: 'IPCA', status: ipca.status, source: ipca.source || 'BancoCentralSGS', points: ipcaAccum },
      ...marketBenchmarks
    ],
    highlights: [
      bestMonth ? { label: 'Melhor mês', value: bestMonth.label, detail: `${round(Number(bestMonth.monthlyReturnPercent || 0), 2)}%` } : null,
      worstMonth ? { label: 'Pior mês', value: worstMonth.label, detail: `${round(Number(worstMonth.monthlyReturnPercent || 0), 2)}%` } : null,
      { label: 'Média mensal', value: `${averageMonthly}%`, detail: 'no período selecionado' },
      { label: 'Volatilidade mensal', value: `${volatilityMonthly}%`, detail: 'oscilação dos retornos mensais' }
    ].filter(Boolean),
    diagnostics: {
      portfolioHistoryStatus: history.status,
      portfolioHistorySource: history.source,
      returnEngine: strictReturn.diagnostics.engine,
      returnComparableMonths: strictReturn.diagnostics.performanceMonths,
      returnDroppedMonths: strictReturn.diagnostics.droppedMonths,
      returnBaselineMonths: strictReturn.diagnostics.baselineMonths,
      portfolioStartDate: inceptionDate ? inceptionDate.toISOString().slice(0, 10) : null,
      historicalTickers,
      currentTickers,
      closedHistoricalTickers: historicalTickers.filter(ticker => !currentTickers.includes(ticker)),
      partialValuationUsed: history.partialValuationUsed === true,
      partialValuationMonths: history.partialValuationMonths || [],
      partialValuationTickers: history.partialValuationTickers || [],
      openingInventoryReconciled: history.openingInventoryReconciled === true,
      openingInventoryReconciledTickers: history.openingInventoryReconciledTickers || [],
      cdiStatus: cdi.status,
      cdiCoverageComplete,
      ipcaStatus: ipca.status,
      displayMonths,
      yearToDate: isYearToDate,
      currentYear,
      comparisonBaseMonth,
      comparisonStartMonth: baseMonth,
      exposureCycleCount: selectedPortfolio.exposureCycleCount || 0,
      chartSegmentCount: selectedPortfolio.chartSegmentCount || 0,
      excludedInactiveMonths: strictReturn.diagnostics.inactiveMonths || [],
      currentSnapshotMarketValue: currentSnapshotComplete ? currentSnapshotMarketValue : null,
      currentSnapshotComplete,
      currentSnapshotMissingTickers,
      latestSeriesMarketValue: series.at(-1)?.marketValue ?? null,
      marketValueAnchoredToCurrentSnapshot: series.at(-1)?.month === currentMonth && currentSnapshotComplete && currentSnapshotMarketValue > 0,
      portfolioMonths,
      portfolioFetchMonths,
      benchmarkMonths,
      marketBenchmarkStatus: marketBenchmarks.map(b => ({ ticker: b.ticker, status: b.status, count: b.points?.length || 0, source: b.source, provider: b.provider, providerParity: b.providerParity, attempts: b.providerAttempts, error: b.error })),
      unavailableTickers: history.unavailableTickers || [],
      skippedMonths: history.skippedMonths || [],
      inactiveMonths: history.inactiveMonths || [],
      partial: history.partial || droppedReturnMonths.length > 0 || (!currentSnapshotComplete && currentPositions.length > 0)
        || (cdiRequested && (cdi.status !== 'OK' || !cdiUsableInChart))
        || (ipcaRequested && ipca.status !== 'OK')
        || marketBenchmarks.some(b => b.status !== 'OK'),
      warnings: [
        ...(history.unavailableTickers?.length ? [`Sem histórico de preço para: ${history.unavailableTickers.join(', ')}`] : []),
        ...(history.partialValuationMonths?.length ? [`Meses preservados com valuation parcial para não apagar ativos históricos: ${history.partialValuationMonths.slice(0, 6).join(', ')}${history.partialValuationTickers?.length ? ` (${history.partialValuationTickers.join(', ')})` : ''}.`] : []),
        ...(history.openingInventoryReconciledTickers?.length ? [`Histórico transacional parcial reconciliado com a posição atual para: ${history.openingInventoryReconciledTickers.join(', ')}. Quantidade/custo de abertura foram preservados sem fabricar cotação.`] : []),
        ...(history.skippedMonths?.length ? [`Meses sem qualquer base de valuation: ${history.skippedMonths.slice(0, 6).join(', ')}`] : []),
        ...(!currentSnapshotComplete && currentSnapshotMissingTickers.length ? [`Cotação atual incompleta para: ${currentSnapshotMissingTickers.join(', ')}. O mês corrente usa somente uma base histórica consistente, sem misturar preços parciais.`] : []),
        ...(droppedReturnMonths.length ? [`Meses fora da cadeia comparável por valuation insuficiente ou retorno não mensurável: ${droppedReturnMonths.slice(0, 6).join(', ')}.`] : []),
        ...(cdiRequested && cdi.status !== 'OK' ? ['CDI oficial Banco Central indisponível agora.'] : []),
        ...(cdiRequested && cdi.status === 'OK' && !cdiUsableInChart ? ['CDI oficial disponível, mas sem mês em comum com a carteira neste filtro.'] : []),
        ...(ipcaRequested && ipca.status !== 'OK' ? ['IPCA indisponível agora.'] : []),
        ...(marketBenchmarks.some(b => b.ticker === 'IBOV' && b.status !== 'OK') ? ['IBOV indisponível na cadeia de séries reais usada pelo comparador.'] : []),
        ...(marketBenchmarks.some(b => b.ticker === 'SMLL' && b.status !== 'OK') ? ['SMLL indisponível na cadeia de índices usada pelos modais (API direta + contingência de histórico).'] : []),
        ...(marketBenchmarks.some(b => b.ticker === 'IFIX' && b.status !== 'OK') ? ['IFIX indisponível na cadeia de índices usada pelos modais (API direta + contingência de histórico).'] : []),
        ...(marketBenchmarks.some(b => b.ticker === 'IDIV' && b.status !== 'OK') ? ['IDIV indisponível na cadeia de índices usada pelos modais (API direta + contingência de histórico).'] : []),
        ...(marketBenchmarks.some(b => ['IBOV', 'SMLL', 'IFIX', 'IDIV'].includes(b.ticker) && (b.simulated || b.proxyTickerUsed)) ? ['Índice rejeitado: fonte simulada/proxy não permitida.'] : [])
      ]
    }
  };
}

export function buildRankings(payload = {}) {
  const rows = payload.portfolioRanking || payload.rankings || payload.items || [];
  if (!Array.isArray(rows) || !rows.length) {
    return { status: 'EMPTY', portfolio: [], items: [], rankings: [], source: 'VALORAE Proxy real-only rankings', reason: 'real-ranking-source-required' };
  }
  const normalized = rows.map((item = {}, index) => {
    const ticker = normalizeTicker(item.ticker || item.symbol || item.codigo || item.ativo || '');
    const score = Number(item.score ?? item.rankScore ?? item.value ?? NaN);
    if (!ticker || !Number.isFinite(score)) return null;
    return {
      ticker,
      rank: Number(item.rank || index + 1),
      score: round(score, 2),
      assetClass: item.assetClass || classifyTicker(ticker),
      reason: String(item.reason || item.source || 'Ranking real fornecido por fonte externa')
    };
  }).filter(Boolean).sort((a, b) => a.rank - b.rank);
  return { status: normalized.length ? 'OK' : 'EMPTY', portfolio: normalized, items: normalized, rankings: normalized, source: 'VALORAE Proxy real-only rankings', reason: normalized.length ? undefined : 'provided-ranking-empty' };
}


export function buildAssetHistory(payload = {}) {
  const ticker = normalizeTicker(payload.ticker || payload.symbol || payload.q || '');
  if (!ticker) return { status: 'EMPTY', ticker: '', points: [], history: [], series: [], chartHistory: [], reason: 'ticker-required' };
  const rows = payload.points || payload.history || payload.series || payload.chartHistory || payload.prices || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return { status: 'EMPTY', ticker, points: [], history: [], series: [], chartHistory: [], reason: 'real-asset-history-required' };
  }
  const syntheticPattern = /(fallback|estimativa|simulad|synthetic|normalized|fabricated|mock)/i;
  const points = rows.map((point = {}) => {
    const source = String(point.source || payload.source || 'VALORAE external asset-history');
    if (syntheticPattern.test(source)) return null;
    const millis = pricePointMillis(point);
    const close = pricePointClose(point);
    if (!millis || close <= 0) return null;
    const date = new Date(millis);
    return {
      date: date.toISOString().slice(0, 10),
      month: date.toISOString().slice(0, 7),
      ticker,
      close,
      price: close,
      value: close,
      source
    };
  }).filter(Boolean).sort((a, b) => tsMillis(a.date) - tsMillis(b.date));
  return {
    status: points.length ? 'OK' : 'EMPTY',
    ticker,
    points,
    history: points,
    series: points,
    chartHistory: points,
    source: points.length ? 'VALORAE Proxy real-only asset-history' : 'VALORAE Proxy real-only asset-history',
    realOnly: true,
    reason: points.length ? undefined : 'provided-asset-history-empty-or-synthetic'
  };
}
