import { portfolioSummary, normalizePositions, normalizeTransactions, quantityAtDate } from './positions.js';
import { classifyTicker } from '../core/tickers.js';
import { getAssetHistory } from '../sources/asset-details.js';
import { round } from '../core/numbers.js';

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
  const allocation = positions.map(p => ({
    ticker: p.ticker,
    name: p.name || '',
    marketValue: p.marketValue,
    invested: p.invested,
    weight: round((p.marketValue / total) * 100, 2),
    assetClass: classFor(p),
    sector: sectorFor(p)
  })).sort((a,b) => b.weight - a.weight);
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
function normalizeHistoryDividendEvents(rawEvents = [], positions = [], transactions = []) {
  const list = Array.isArray(rawEvents) ? rawEvents : [];
  return list.map((event = {}) => {
    const ticker = String(event.ticker || event.symbol || event.codigo || '').trim().toUpperCase();
    const paymentMillis = tsMillis(event.paymentDate || event.dataPagamento || event.payDate || event.datePayment);
    if (!ticker || !paymentMillis) return null;
    const eligibilityDate = event.eligibilityDate || event.dateCom || event.dataCom || event.exDate || event.dataEx || '';
    const quantity = Number(event.quantityAtDate || event.eligibilityQuantity || event.quantity || event.quantidade || 0) ||
      quantityAtDate(ticker, eligibilityDate, positions, transactions);
    const perShare = Number(event.netValuePerShare ?? event.valuePerShare ?? event.valorLiquidoPorAcao ?? event.valorPorAcao ?? event.value ?? 0);
    const amount = Number(event.netAmount ?? event.estimatedAmount ?? event.amountTotal ?? event.valorLiquidoTotal ?? event.total ?? 0) ||
      (quantity > 0 && perShare > 0 ? quantity * perShare : 0);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return { ticker, paymentMillis, amount: round(amount, 2) };
  }).filter(Boolean).sort((a, b) => a.paymentMillis - b.paymentMillis);
}

function dividendsReceivedUntil(events = [], boundary = 0) {
  if (!boundary) return 0;
  return round(events.reduce((sum, event) => event.paymentMillis <= boundary ? sum + event.amount : sum, 0), 2);
}


function monthCloseAtOrBefore(points = [], monthStart, boundary) {
  let selected = null;
  for (const point of points) {
    if (point.millis < monthStart) continue;
    if (point.millis > boundary) break;
    selected = point;
  }
  return selected?.close || 0;
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

export async function buildRealMarketHistory(payload = {}) {
  const provided = normalizeProvidedPortfolioHistory(payload);
  if (provided.points.length) return provided;

  const positions = normalizePositions(payload.positions || []);
  const transactions = normalizeTransactions(payload.transactions || []);
  const realDividendEvents = normalizeHistoryDividendEvents(payload.dividendEvents || payload.events || payload.dividends || [], positions, transactions);
  if (!transactions.length) {
    return { status: 'EMPTY', points: [], history: [], series: [], source: 'VALORAE Proxy real-only portfolio-history', reason: 'transactions-required-for-real-portfolio-history' };
  }

  const requestedMonths = Number(payload.historyMonths || payload.months || 12);
  const now = new Date();
  const firstTxMillis = Math.min(...transactions.map(t => t.millis).filter(Number.isFinite));
  if (!Number.isFinite(firstTxMillis) || firstTxMillis <= 0) {
    return { status: 'EMPTY', points: [], history: [], series: [], source: 'VALORAE Proxy real-only portfolio-history', reason: 'valid-transaction-dates-required' };
  }
  const startDate = portfolioStartDate(payload, positions) || new Date(firstTxMillis);
  const ageMonths = ((now.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - startDate.getUTCMonth()) + 1);
  const months = Math.max(1, Math.min(120, Number.isFinite(requestedMonths) ? Math.max(requestedMonths, ageMonths || 1) : (ageMonths || 12)));
  const tickers = [...new Set(transactions.map(t => t.ticker).filter(Boolean))].slice(0, Number(payload.maxHistoryTickers || 35));
  if (!tickers.length) {
    return { status: 'EMPTY', points: [], history: [], series: [], source: 'VALORAE Proxy real-only portfolio-history', reason: 'tickers-required' };
  }

  const range = historyRangeForMonths(months);
  const priceEntries = await Promise.all(tickers.map(async (ticker) => {
    try {
      const history = await getAssetHistory({ ticker, range, timeoutMs: Number(payload.timeoutMs || 3800), limit: 320 });
      return [ticker, normalizeHistoryPricePoints(history), history?.status || 'EMPTY'];
    } catch (error) {
      return [ticker, [], 'ERROR'];
    }
  }));
  const pricesByTicker = new Map(priceEntries.map(([ticker, points]) => [ticker, points]));
  const unavailableTickers = priceEntries.filter(([, points]) => !points.length).map(([ticker]) => ticker);

  const points = [];
  const skippedMonths = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = monthStartUtc(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)));
    if (d < monthStartUtc(startDate)) continue;
    const monthStart = d.getTime();
    const boundary = monthEndUtc(d).getTime();
    const buckets = transactionBucketsAtBoundary(transactions, boundary);
    const active = [...buckets.entries()].filter(([, b]) => b.quantity > 0.000001 && b.costBasis > 0);
    if (!active.length) continue;

    let invested = 0;
    let value = 0;
    let missing = false;
    const components = [];
    for (const [ticker, bucket] of active) {
      const close = monthCloseAtOrBefore(pricesByTicker.get(ticker) || [], monthStart, boundary);
      if (close <= 0) {
        missing = true;
        break;
      }
      const tickerValue = bucket.quantity * close;
      invested += Math.max(0, bucket.costBasis);
      value += tickerValue;
      components.push({ ticker, quantity: round(bucket.quantity, 8), close: round(close, 4), value: round(tickerValue, 2), invested: round(bucket.costBasis, 2) });
    }
    if (missing || invested <= 0 || value <= 0) {
      skippedMonths.push(d.toISOString().slice(0, 7));
      continue;
    }
    const marketValue = round(value, 2);
    const dividendsReceived = dividendsReceivedUntil(realDividendEvents, boundary);
    const totalValue = round(marketValue + dividendsReceived, 2);
    const investedValue = round(invested, 2);
    const returnPercent = round(((totalValue - investedValue) / investedValue) * 100, 2);
    points.push({
      date: d.toISOString().slice(0, 10),
      month: d.toISOString().slice(0, 7),
      value: totalValue,
      patrimonio: totalValue,
      totalValue,
      marketValue,
      dividendsReceived,
      investedValue,
      invested: investedValue,
      returnPercent,
      returnPct: returnPercent,
      components,
      source: realDividendEvents.length
        ? 'VALORAE Proxy real portfolio-history Yahoo Finance + transações + proventos confirmados'
        : 'VALORAE Proxy real portfolio-history Yahoo Finance + transações'
    });
  }

  return {
    status: points.length ? (skippedMonths.length || unavailableTickers.length ? 'PARTIAL' : 'OK') : 'EMPTY',
    points,
    history: points,
    series: points,
    source: realDividendEvents.length
      ? 'VALORAE Proxy real portfolio-history Yahoo Finance + transações + proventos confirmados'
      : 'VALORAE Proxy real portfolio-history Yahoo Finance + transações',
    realOnly: true,
    partial: Boolean(skippedMonths.length || unavailableTickers.length),
    skippedMonths,
    unavailableTickers,
    reason: points.length ? undefined : 'insufficient-real-price-history'
  };
}

export function buildRankings(payload = {}) {
  const rows = payload.portfolioRanking || payload.rankings || payload.items || [];
  if (!Array.isArray(rows) || !rows.length) {
    return { status: 'EMPTY', portfolio: [], items: [], rankings: [], source: 'VALORAE Proxy real-only rankings', reason: 'real-ranking-source-required' };
  }
  const normalized = rows.map((item = {}, index) => {
    const ticker = String(item.ticker || item.symbol || item.codigo || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
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
  const ticker = String(payload.ticker || payload.symbol || payload.q || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
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
