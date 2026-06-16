// Contrato de renderização do APK/Web.
// Objetivo: entregar ao app um mapa estável de cards, gráficos e validações para evitar divergência
// entre results/normalized/chartSeries/appPayload.

export const VALORAE_APP_RENDER_CONTRACT_VERSION = '21.12.6-app-render-contract';

const GROUPS = {
  quote: ['precoAtual', 'variacaoDay', 'variacao12m'],
  valuation: ['pvp', 'pl', 'valorPatrimonialCota', 'valorDeMercado', 'patrimonioLiquido'],
  dividends: ['dividendYield', 'dyMedio5a', 'ultimoRendimento', 'totalDividendos12m', 'yield1m', 'yield3m', 'yield6m', 'yield12m'],
  profitability: ['roe', 'roic', 'roa', 'margemLiquida', 'margemEbitda', 'payout'],
  liquidity: ['liquidezMediaDiaria', 'vacanciaFisica'],
};

function present(value) {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function metricValue(field) {
  if (field === undefined || field === null || field === '') return null;
  if (typeof field !== 'object' || Array.isArray(field)) return asNumber(field);
  const n = asNumber(field.value);
  return n !== null ? n : asNumber(field.display);
}

function metricDisplay(field) {
  if (field === undefined || field === null || field === '') return null;
  if (typeof field !== 'object' || Array.isArray(field)) return String(field);
  return field.display ?? (field.value == null ? null : String(field.value));
}

function findPanel(payload, key) {
  const panels = payload.appPayload?.panels || payload.panelReadiness?.panels || [];
  return Array.isArray(panels) ? panels.find(p => p?.key === key) : null;
}

function stateFromSignals({ ready = false, hasData = false, partial = false }) {
  if (ready && hasData && !partial) return 'ready';
  if (hasData || ready || partial) return 'partial';
  return 'empty';
}

function buildMetricGroups(payload = {}) {
  const canonical = payload.appPayload?.metrics?.canonical || payload.normalized || {};
  const out = {};
  for (const [group, keys] of Object.entries(GROUPS)) {
    const fields = keys
      .map(key => {
        const field = canonical[key];
        if (!present(field)) return null;
        return {
          key,
          label: key,
          display: metricDisplay(field),
          value: metricValue(field),
          unit: field?.unit || null,
          source: field?.source || null,
          confidence: typeof field?.confidence === 'number' ? field.confidence : null,
          path: `appPayload.metrics.canonical.${key}`,
        };
      })
      .filter(Boolean);
    out[group] = {
      key: group,
      count: fields.length,
      ready: fields.length > 0,
      fields,
    };
  }
  return out;
}

function inferChartKind(series = {}) {
  const first = Array.isArray(series.points) ? series.points.find(Boolean) : null;
  if (first?.ohlc || /ohlc|candle/i.test(String(series.sourceFormat || series.key || ''))) return 'candlestick';
  if (/volume|quantidade|liquidez/i.test(String(series.key || series.name || ''))) return 'bar';
  if (/dividend|rendimento|provento|yield/i.test(String(series.key || series.name || ''))) return 'bar';
  return 'line';
}

function buildChartTemplates(payload = {}) {
  const series = Array.isArray(payload.appPayload?.charts?.series) ? payload.appPayload.charts.series
    : Array.isArray(payload.chartSeries?.series) ? payload.chartSeries.series
    : [];
  return series.map((s, index) => ({
    id: s.key || `series_${index + 1}`,
    title: s.name || s.key || `Série ${index + 1}`,
    dataPath: `appPayload.charts.series.${index}.points`,
    sourcePath: `chartSeries.series.${index}.points`,
    kind: inferChartKind(s),
    pointCount: Number(s.pointCount || (Array.isArray(s.points) ? s.points.length : 0)),
    score: Number.isFinite(Number(s.score)) ? Number(s.score) : null,
    yUnit: /dy|yield|percent|margem|roe|roic|roa/i.test(String(s.key || s.name || '')) ? '%' : null,
    safeForMainChart: index === 0 || Number(s.pointCount || 0) >= 6,
  }));
}

function buildCards(payload = {}, metricGroups = {}, chartTemplates = []) {
  const app = payload.appPayload || {};
  const quotePanel = findPanel(payload, 'quote');
  const fundamentalsPanel = findPanel(payload, 'fundamentals');
  const dividendsPanel = findPanel(payload, 'dividends');
  const chartsPanel = findPanel(payload, 'charts');
  const sourcePanel = findPanel(payload, 'sourceTrace');
  const quoteHasData = present(app.quote?.price) || present(metricGroups.quote?.fields);
  const fundamentalsHasData = (metricGroups.valuation?.count || 0) + (metricGroups.profitability?.count || 0) > 0;
  const dividendsHasData = (metricGroups.dividends?.count || 0) > 0 || present(app.dividends?.history);
  const chartsHasData = chartTemplates.length > 0;
  return [
    { key: 'quote', title: 'Cotação', state: stateFromSignals({ ready: quotePanel?.ready, hasData: quoteHasData, partial: payload.partial }), primaryPath: 'appPayload.quote', fallbackPaths: ['appPayload.metrics.canonical.precoAtual', 'normalized.precoAtual', 'results.precoAtual'] },
    { key: 'fundamentals', title: 'Fundamentos', state: stateFromSignals({ ready: fundamentalsPanel?.ready, hasData: fundamentalsHasData, partial: payload.partial }), primaryPath: 'appPayload.metrics.canonical', fallbackPaths: ['normalized', 'results.indicadores', 'results.indicadoresFundamentalistas'] },
    { key: 'dividends', title: 'Dividendos/Rendimentos', state: stateFromSignals({ ready: dividendsPanel?.ready, hasData: dividendsHasData, partial: payload.partial }), primaryPath: 'appPayload.dividends', fallbackPaths: ['appPayload.metrics.canonical.dividendYield', 'results.dividendos', 'results.historicoDividendos'] },
    { key: 'charts', title: 'Gráficos', state: stateFromSignals({ ready: chartsPanel?.ready, hasData: chartsHasData, partial: payload.partial }), primaryPath: 'appPayload.charts.series', fallbackPaths: ['chartSeries.series', 'results.historicoIndicadores', 'results.historicoDividendos'] },
    { key: 'sourceTrace', title: 'Fonte e cache', state: stateFromSignals({ ready: sourcePanel?.ready, hasData: present(app.source?.primary) || present(app.source?.sourcesUsed) || present(payload.sourceReport?.primarySource), partial: false }), primaryPath: 'appPayload.source', fallbackPaths: ['consumerDiagnostics', 'sourceReport', 'metrics.sourcesTried'] },
  ];
}

function buildConsistency(payload = {}, metricGroups = {}, chartTemplates = []) {
  const issues = [];
  const app = payload.appPayload || {};
  const canonicalPrice = metricValue(app.metrics?.canonical?.precoAtual || payload.normalized?.precoAtual);
  const quotePrice = asNumber(app.quote?.price);
  if (canonicalPrice !== null && quotePrice !== null && Math.abs(canonicalPrice - quotePrice) > 0.0001) {
    issues.push({ severity: 'warn', code: 'QUOTE_PRICE_MISMATCH', message: 'Preço do card diverge da métrica canônica.', paths: ['appPayload.quote.price', 'appPayload.metrics.canonical.precoAtual.value'] });
  }
  const appChartCount = Array.isArray(app.charts?.series) ? app.charts.series.length : 0;
  const rawChartCount = Array.isArray(payload.chartSeries?.series) ? payload.chartSeries.series.length : 0;
  if (rawChartCount !== appChartCount) {
    issues.push({ severity: 'info', code: 'CHART_COUNT_TRUNCATED_OR_MAPPED', message: 'Quantidade de séries no appPayload difere de chartSeries; o app deve usar appPayload como contrato preferencial.', paths: ['appPayload.charts.series', 'chartSeries.series'] });
  }
  if (payload.appPayload?.blankShield?.canRenderCharts && chartTemplates.length === 0) {
    issues.push({ severity: 'warn', code: 'CHART_FLAG_WITHOUT_SERIES', message: 'Flag canRenderCharts ativa sem séries renderizáveis.', paths: ['appPayload.blankShield.canRenderCharts', 'appPayload.charts.series'] });
  }
  const totalMetrics = Object.values(metricGroups).reduce((sum, group) => sum + (group.count || 0), 0);
  if (payload.appPayload?.blankShield?.canRenderDashboard && totalMetrics === 0 && chartTemplates.length === 0) {
    issues.push({ severity: 'warn', code: 'DASHBOARD_READY_WITHOUT_CORE_DATA', message: 'Dashboard marcado como renderizável sem métricas nem gráficos.', paths: ['appPayload.blankShield', 'appPayload.metrics', 'appPayload.charts'] });
  }
  return {
    ok: !issues.some(i => i.severity === 'error' || i.severity === 'warn'),
    issueCount: issues.length,
    issues: issues.slice(0, 12),
  };
}

function buildOfflinePolicy(payload = {}) {
  return {
    keepPreviousDataOnPartial: true,
    canUseStaleCache: Boolean(payload.cacheStatus && /STALE|CACHE/i.test(String(payload.cacheStatus))),
    staleBadge: /STALE/i.test(String(payload.cacheStatus || '')) ? 'Dados de cache' : null,
    refreshHint: payload.partial ? 'Atualize em segundo plano e mantenha os últimos dados válidos na tela.' : 'Atualização normal permitida.',
    emptyFallbackPath: 'appPayload.blankShield.recommendedEmptyState',
  };
}

export function buildAppRenderContract(payload = {}) {
  const metricGroups = buildMetricGroups(payload);
  const chartTemplates = buildChartTemplates(payload);
  const cards = buildCards(payload, metricGroups, chartTemplates);
  const consistency = buildConsistency(payload, metricGroups, chartTemplates);
  const readyCards = cards.filter(c => c.state === 'ready').length;
  return {
    version: VALORAE_APP_RENDER_CONTRACT_VERSION,
    generatedAt: payload.metrics?.generatedAt || new Date().toISOString(),
    ticker: payload.ticker,
    type: payload.type,
    contractPath: 'appRenderContract',
    primaryDataPath: 'appPayload',
    renderState: readyCards >= 2 ? 'ready' : cards.some(c => c.state !== 'empty') ? 'partial' : 'empty',
    cards,
    metricGroups,
    chartTemplates,
    consistency,
    offlinePolicy: buildOfflinePolicy(payload),
    appInstructions: {
      firstPaintOrder: ['quote', 'fundamentals', 'dividends', 'charts', 'sourceTrace'],
      neverBlockWholeDashboardForOnePanel: true,
      useCanonicalAliases: true,
      preferPaths: ['appPayload.quote', 'appPayload.metrics.canonical', 'appPayload.charts.series', 'appPayload.dividends', 'appPayload.blankShield'],
    },
  };
}
