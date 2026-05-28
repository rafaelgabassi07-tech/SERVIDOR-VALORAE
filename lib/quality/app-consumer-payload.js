// Camada de consumo direto para APK/Web.
// Objetivo: evitar telas vazias no app mesmo quando a fonte pública retorna dados parciais.

import { makeFinancialField } from '../normalizers/universal.js';

export const VALORAE_APP_CONSUMER_PAYLOAD_VERSION = '21.12.5-app-consumer-blank-shield';

const METRIC_ALIASES = {
  precoAtual: ['price', 'currentPrice', 'lastPrice', 'cotacao', 'valorAtual'],
  variacaoDay: ['dayChange', 'changeDay', 'variacaoDia'],
  variacao12m: ['change12m', 'yearChange', 'variacaoAno'],
  dividendYield: ['dy', 'dividend_yield', 'yield', 'dividendYield12m'],
  dyMedio5a: ['averageDy5y', 'dyAvg5y', 'dyMedio'],
  ultimoRendimento: ['lastDividend', 'ultimoDividendo', 'lastIncome', 'ultimoProvento'],
  totalDividendos12m: ['dividends12m', 'income12m', 'proventos12m'],
  pvp: ['p_vp', 'pVp', 'priceToBook'],
  pl: ['p_l', 'pL', 'priceEarnings'],
  roe: ['returnOnEquity'],
  roic: ['returnOnInvestedCapital'],
  roa: ['returnOnAssets'],
  margemLiquida: ['netMargin'],
  margemEbitda: ['ebitdaMargin'],
  payout: ['payoutRatio'],
  valorPatrimonialCota: ['bookValuePerShare', 'vpCota', 'valorPatrimonial'],
  patrimonioLiquido: ['netWorth', 'patrimonio'],
  valorDeMercado: ['marketCap', 'marketValue'],
  liquidezMediaDiaria: ['dailyLiquidity', 'liquidezDiaria'],
  vacanciaFisica: ['physicalVacancy', 'vacancia'],
  yield1m: ['yield_1m'],
  yield3m: ['yield_3m'],
  yield6m: ['yield_6m'],
  yield12m: ['yield_12m'],
};

const PANEL_ORDER = ['quote', 'fundamentals', 'dividends', 'charts', 'news', 'sourceTrace'];

function hasValue(value) {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function get(obj, path) {
  return String(path).split('.').reduce((acc, key) => acc == null ? undefined : acc[key], obj);
}

function fieldValue(field) {
  if (field === undefined || field === null || field === '') return undefined;
  if (typeof field !== 'object' || Array.isArray(field)) return field;
  return field.value ?? field.display;
}

function pickMetric(normalized = {}, results = {}, key) {
  const direct = normalized[key];
  if (hasValue(fieldValue(direct))) return direct;
  const aliases = METRIC_ALIASES[key] || [];
  for (const alias of aliases) {
    const fromNorm = normalized[alias];
    if (hasValue(fieldValue(fromNorm))) return fromNorm;
  }
  const rawCandidates = [
    results[key],
    results.cotacao?.[key],
    results.indicadores?.[key],
    results.indicadoresFundamentalistas?.semComparativos?.[key],
    results.dividendos?.[key],
    results.valorPatrimonial?.[key],
    results.informacoesEmpresa?.[key],
  ];
  for (const alias of aliases) {
    rawCandidates.push(results[alias], results.cotacao?.[alias], results.indicadores?.[alias], results.dividendos?.[alias]);
  }
  const raw = rawCandidates.find(hasValue);
  if (!hasValue(raw)) return undefined;
  return makeFinancialField(key, raw, { source: 'valorae:raw-fallback', confidence: 0.58 });
}

function buildMetricIndex(payload = {}) {
  const normalized = payload.normalized || {};
  const results = payload.results || {};
  const canonical = {};
  const aliases = {};
  for (const key of Object.keys(METRIC_ALIASES)) {
    const metric = pickMetric(normalized, results, key);
    if (metric) {
      canonical[key] = metric;
      aliases[key] = key;
      for (const alias of METRIC_ALIASES[key]) aliases[alias] = key;
    }
  }
  for (const [key, value] of Object.entries(normalized)) {
    if (key === '_meta' || canonical[key]) continue;
    if (hasValue(fieldValue(value))) canonical[key] = value;
  }
  return { canonical, aliases, count: Object.keys(canonical).length };
}

function buildQuoteCard(metrics = {}, payload = {}) {
  const price = metrics.precoAtual || metrics.currentPrice || metrics.price;
  return {
    ticker: payload.ticker,
    type: payload.type,
    name: payload.results?.nome || payload.results?.name || payload.ticker,
    price: fieldValue(price) ?? null,
    priceDisplay: price?.display ?? null,
    dayChange: fieldValue(metrics.variacaoDay) ?? null,
    dayChangeDisplay: metrics.variacaoDay?.display ?? null,
    dividendYield: fieldValue(metrics.dividendYield) ?? null,
    dividendYieldDisplay: metrics.dividendYield?.display ?? null,
    source: price?.source || payload.sourceReport?.primarySource || payload.metrics?.source || null,
  };
}

function buildPanels(payload = {}) {
  const panels = Array.isArray(payload.panelReadiness?.panels) ? payload.panelReadiness.panels : [];
  const byKey = Object.fromEntries(panels.map(p => [p.key, p]));
  return PANEL_ORDER.map(key => {
    const p = byKey[key] || {};
    return {
      key,
      ready: Boolean(p.ready),
      completenessPercent: Number.isFinite(Number(p.completenessPercent)) ? Number(p.completenessPercent) : 0,
      missingPaths: Array.isArray(p.missingPaths) ? p.missingPaths : [],
      hint: p.consumerHint || null,
    };
  });
}

function buildChartContract(payload = {}) {
  const series = Array.isArray(payload.chartSeries?.series) ? payload.chartSeries.series : [];
  const top = series[0] || null;
  return {
    preferredPath: 'appPayload.charts.series',
    sourcePath: 'chartSeries.series',
    count: series.length,
    totalDetected: payload.chartSeries?.totalSeriesDetected || payload.chartSeries?.count || series.length,
    bestKey: top?.key || null,
    bestName: top?.name || null,
    bestPointCount: top?.pointCount || 0,
    series,
    emptyState: series.length ? null : {
      title: 'Histórico indisponível',
      message: 'Use cards de métricas e tente atualizar quando a fonte liberar histórico ou cache.',
      fallbackPaths: ['normalized', 'results', 'warnings'],
    },
  };
}

function buildDividendContract(payload = {}, metrics = {}) {
  const dividendos = payload.results?.dividendos || {};
  const historico = Array.isArray(dividendos.historico) ? dividendos.historico
    : Array.isArray(payload.results?.historicoDividendos) ? payload.results.historicoDividendos
    : [];
  return {
    preferredHistoryPath: historico.length ? 'appPayload.dividends.history' : null,
    history: historico.slice(0, 120),
    historyCount: historico.length,
    lastIncome: fieldValue(metrics.ultimoRendimento) ?? null,
    lastIncomeDisplay: metrics.ultimoRendimento?.display ?? null,
    dy: fieldValue(metrics.dividendYield) ?? null,
    dyDisplay: metrics.dividendYield?.display ?? null,
    stats: payload.dividendStats || null,
  };
}

function buildBlankShield(payload = {}, panels = [], metricIndex = {}, chartContract = {}) {
  const readyPanels = panels.filter(p => p.ready).map(p => p.key);
  const missingCritical = [];
  if (!hasValue(metricIndex.canonical.precoAtual)) missingCritical.push('precoAtual');
  if (!chartContract.count) missingCritical.push('chartSeries');
  if (!readyPanels.length) missingCritical.push('panelReadiness');
  const canRenderDashboard = readyPanels.includes('quote') || metricIndex.count >= 3 || readyPanels.length >= 2;
  return {
    canRenderDashboard,
    canRenderQuote: readyPanels.includes('quote') || hasValue(metricIndex.canonical.precoAtual),
    canRenderCharts: chartContract.count > 0,
    canRenderFundamentals: readyPanels.includes('fundamentals') || metricIndex.count >= 4,
    canRenderDividends: readyPanels.includes('dividends') || hasValue(metricIndex.canonical.dividendYield) || hasValue(metricIndex.canonical.ultimoRendimento),
    missingCritical,
    recommendedEmptyState: canRenderDashboard ? null : {
      title: 'Dados insuficientes no momento',
      message: 'A fonte pública não entregou campos úteis. Mantenha cache anterior na tela e mostre opção de atualizar.',
    },
    fallbackOrder: ['appPayload.metrics.canonical', 'normalized', 'results', 'consumerDiagnostics.priorityPaths', 'warnings'],
  };
}

export function buildAppConsumerPayload(payload = {}) {
  const metricIndex = buildMetricIndex(payload);
  const panels = buildPanels(payload);
  const charts = buildChartContract(payload);
  const quote = buildQuoteCard(metricIndex.canonical, payload);
  const dividends = buildDividendContract(payload, metricIndex.canonical);
  const blankShield = buildBlankShield(payload, panels, metricIndex, charts);
  return {
    version: VALORAE_APP_CONSUMER_PAYLOAD_VERSION,
    generatedAt: payload.metrics?.generatedAt || new Date().toISOString(),
    ticker: payload.ticker,
    type: payload.type,
    status: payload.status,
    partial: Boolean(payload.partial),
    quote,
    metrics: metricIndex,
    panels,
    charts,
    dividends,
    news: {
      ok: Boolean(payload.newsStatus?.ok || (Array.isArray(payload.news) && payload.news.length)),
      items: Array.isArray(payload.news) ? payload.news : [],
      status: payload.newsStatus || null,
    },
    source: {
      primary: payload.sourceReport?.primarySource || payload.consumerDiagnostics?.primarySource || payload.metrics?.source || null,
      cacheStatus: payload.cacheStatus || null,
      sourcesUsed: payload.consumerDiagnostics?.sourcesUsed || payload.sourceReport?.sourcesUsed || [],
      captureScore: payload.consumerDiagnostics?.captureScore ?? null,
      valoraeScore: payload.valoraeScore?.score ?? payload.quality?.score ?? null,
    },
    blankShield,
    warnings: Array.isArray(payload.warnings) ? payload.warnings.slice(0, 12) : [],
    appHints: {
      neverClearPreviousDataOnPartial: true,
      showPartialBanner: Boolean(payload.partial || payload.consumerDiagnostics?.appContract?.partialDataBanner),
      preferMetricPath: 'appPayload.metrics.canonical',
      preferChartPath: 'appPayload.charts.series',
      preferPanelPath: 'appPayload.panels',
    },
  };
}
