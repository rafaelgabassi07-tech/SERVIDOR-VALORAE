// Contrato final de dados para APK/Web.
// Objetivo: validar se appPayload + appRenderContract conseguem alimentar telas, gráficos e métricas
// sem inconsistência crítica, sem depender do formato bruto de cada fonte pública.

export const VALORAE_APP_DATA_CONTRACT_VERSION = '21.12.7-app-data-contract-validator';

const CRITICAL_METRICS_BY_TYPE = {
  FII: ['precoAtual', 'dividendYield', 'pvp', 'valorPatrimonialCota', 'ultimoRendimento'],
  ETF: ['precoAtual', 'variacaoDay', 'liquidezMediaDiaria'],
  BDR: ['precoAtual', 'variacaoDay', 'valorDeMercado'],
  ACAO: ['precoAtual', 'pl', 'pvp', 'roe', 'dividendYield', 'valorDeMercado'],
  STOCK: ['precoAtual', 'pl', 'pvp', 'roe', 'valorDeMercado'],
  DEFAULT: ['precoAtual', 'dividendYield', 'pvp'],
};

const REQUIRED_CARDS = ['quote', 'fundamentals', 'charts', 'sourceTrace'];

function present(value) {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function get(obj, path) {
  return String(path || '').split('.').reduce((acc, key) => acc == null ? undefined : acc[key], obj);
}

function metricHasValue(field) {
  if (field === undefined || field === null || field === '') return false;
  if (typeof field !== 'object' || Array.isArray(field)) return present(field);
  return present(field.value) || present(field.display);
}

function normalizeState(state) {
  const s = String(state || 'empty').toLowerCase();
  return ['ready', 'partial', 'empty'].includes(s) ? s : 'empty';
}

function stateScore(state) {
  const s = normalizeState(state);
  if (s === 'ready') return 1;
  if (s === 'partial') return 0.55;
  return 0;
}

function clampPercent(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function criticalKeys(type) {
  return CRITICAL_METRICS_BY_TYPE[String(type || '').toUpperCase()] || CRITICAL_METRICS_BY_TYPE.DEFAULT;
}

function buildFieldMap(payload = {}) {
  const canonical = payload.appPayload?.metrics?.canonical || payload.normalized || {};
  const aliases = payload.appPayload?.metrics?.aliases || {};
  return Object.entries(canonical)
    .filter(([key, field]) => key !== '_meta' && metricHasValue(field))
    .map(([key, field]) => ({
      key,
      aliases: Object.entries(aliases).filter(([, target]) => target === key).map(([alias]) => alias).slice(0, 12),
      display: typeof field === 'object' && !Array.isArray(field) ? field.display ?? (field.value == null ? null : String(field.value)) : String(field),
      hasNumericValue: Number.isFinite(Number(typeof field === 'object' && !Array.isArray(field) ? field.value : field)),
      unit: typeof field === 'object' && !Array.isArray(field) ? field.unit || null : null,
      source: typeof field === 'object' && !Array.isArray(field) ? field.source || payload.appPayload?.source?.primary || payload.sourceReport?.primarySource || null : payload.appPayload?.source?.primary || payload.sourceReport?.primarySource || null,
      confidence: typeof field === 'object' && !Array.isArray(field) && typeof field.confidence === 'number' ? Math.max(0, Math.min(1, field.confidence)) : null,
      preferredPath: `appPayload.metrics.canonical.${key}`,
      fallbackPaths: [`normalized.${key}`, `results.${key}`, `results.indicadores.${key}`],
    }))
    .slice(0, 80);
}

function buildCriticalMetricCoverage(payload = {}) {
  const canonical = payload.appPayload?.metrics?.canonical || payload.normalized || {};
  const keys = criticalKeys(payload.type);
  const presentKeys = keys.filter(key => metricHasValue(canonical[key]));
  return {
    assetType: payload.type || 'DEFAULT',
    expected: keys,
    present: presentKeys,
    missing: keys.filter(key => !presentKeys.includes(key)),
    percent: clampPercent((presentKeys.length / Math.max(1, keys.length)) * 100),
  };
}

function buildCardCoverage(payload = {}) {
  const cards = Array.isArray(payload.appRenderContract?.cards) ? payload.appRenderContract.cards : [];
  const byKey = Object.fromEntries(cards.map(card => [card.key, card]));
  const states = REQUIRED_CARDS.map(key => {
    const card = byKey[key] || { key, state: 'empty' };
    return {
      key,
      state: normalizeState(card.state),
      primaryPath: card.primaryPath || null,
      hasPrimaryData: present(get(payload, card.primaryPath)),
      fallbackPaths: Array.isArray(card.fallbackPaths) ? card.fallbackPaths : [],
    };
  });
  const score = clampPercent((states.reduce((sum, card) => sum + stateScore(card.state), 0) / Math.max(1, states.length)) * 100);
  return { score, states, readyCards: states.filter(s => s.state === 'ready').length, partialCards: states.filter(s => s.state === 'partial').length };
}

function buildChartCoverage(payload = {}) {
  const templates = Array.isArray(payload.appRenderContract?.chartTemplates) ? payload.appRenderContract.chartTemplates : [];
  const series = Array.isArray(payload.appPayload?.charts?.series) ? payload.appPayload.charts.series : [];
  const pointTotal = series.reduce((sum, s) => sum + Number(s.pointCount || (Array.isArray(s.points) ? s.points.length : 0)), 0);
  const safeTemplates = templates.filter(t => t.safeForMainChart && Number(t.pointCount || 0) >= 2);
  return {
    seriesCount: series.length,
    templateCount: templates.length,
    pointTotal,
    safeMainCharts: safeTemplates.length,
    best: templates[0] ? {
      id: templates[0].id,
      title: templates[0].title,
      kind: templates[0].kind,
      pointCount: templates[0].pointCount,
      dataPath: templates[0].dataPath,
    } : null,
    percent: clampPercent(Math.min(1, (safeTemplates.length ? 0.65 : 0) + Math.min(pointTotal, 60) / 180 + Math.min(series.length, 4) / 20) * 100),
  };
}

function buildIssues(payload = {}, coverage = {}) {
  const issues = [];
  if (!coverage.criticalMetrics.present.includes('precoAtual')) {
    issues.push({ severity: 'warn', code: 'MISSING_PRICE', message: 'Preço atual/cotação ausente no contrato canônico.', paths: ['appPayload.metrics.canonical.precoAtual', 'appPayload.quote.price'] });
  }
  if (coverage.cardCoverage.score < 40) {
    issues.push({ severity: 'warn', code: 'LOW_CARD_COVERAGE', message: 'Poucos cards renderizáveis; app deve manter dados anteriores e mostrar estado parcial.', paths: ['appRenderContract.cards', 'appPayload.blankShield'] });
  }
  if (!coverage.chartCoverage.seriesCount) {
    issues.push({ severity: 'info', code: 'NO_CHART_SERIES', message: 'Nenhuma série de gráfico normalizada disponível.', paths: ['appPayload.charts.series', 'chartSeries.series'] });
  }
  if (payload.appRenderContract?.consistency?.issueCount) {
    for (const issue of payload.appRenderContract.consistency.issues || []) {
      issues.push({ severity: issue.severity || 'info', code: issue.code || 'RENDER_CONTRACT_CONSISTENCY', message: issue.message || 'Inconsistência no contrato de renderização.', paths: issue.paths || ['appRenderContract.consistency'] });
    }
  }
  if (payload.consumerDiagnostics?.sourceAttempts?.blockedAttempts) {
    issues.push({ severity: 'info', code: 'SOURCE_BLOCKED_OR_LIMITED', message: 'Uma ou mais fontes públicas bloquearam/limitaram tentativa; manter cache/fallback.', paths: ['consumerDiagnostics.sourceAttempts', 'sourceReliability'] });
  }
  return issues.slice(0, 16);
}

function buildFreshness(payload = {}) {
  const cacheStatus = String(payload.cacheStatus || payload.metrics?.resultCache || 'UNKNOWN');
  const generatedAt = payload.metrics?.generatedAt || payload.appPayload?.generatedAt || new Date().toISOString();
  const live = /LIVE|MISS|BYPASS/i.test(cacheStatus) && !/STALE/i.test(cacheStatus);
  const stale = /STALE/i.test(cacheStatus);
  return {
    generatedAt,
    cacheStatus,
    isLiveish: live,
    isStale: stale,
    badge: stale ? 'cache_stale' : /CACHE|HIT|COALESCED/i.test(cacheStatus) ? 'cache' : live ? 'live' : 'unknown',
    appPolicy: stale || payload.partial ? 'keep_previous_and_refresh_background' : 'replace_when_contract_score_is_not_lower',
  };
}

export function buildAppDataContract(payload = {}) {
  const fieldMap = buildFieldMap(payload);
  const criticalMetrics = buildCriticalMetricCoverage(payload);
  const cardCoverage = buildCardCoverage(payload);
  const chartCoverage = buildChartCoverage(payload);
  const coverage = { criticalMetrics, cardCoverage, chartCoverage };
  const issues = buildIssues(payload, coverage);
  const freshness = buildFreshness(payload);
  const sourceScore = Number(payload.consumerDiagnostics?.captureScore ?? payload.valoraeScore?.score ?? 0);
  const score = clampPercent(
    criticalMetrics.percent * 0.35 +
    cardCoverage.score * 0.28 +
    chartCoverage.percent * 0.17 +
    Math.min(100, fieldMap.length * 7) * 0.1 +
    Math.max(0, Math.min(100, sourceScore)) * 0.1 -
    issues.filter(i => i.severity === 'warn').length * 5
  );
  const hardWarn = issues.some(i => i.severity === 'error' || ['MISSING_PRICE', 'LOW_CARD_COVERAGE'].includes(i.code));
  return {
    version: VALORAE_APP_DATA_CONTRACT_VERSION,
    generatedAt: freshness.generatedAt,
    ticker: payload.ticker,
    type: payload.type,
    score,
    grade: score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'E',
    renderSafe: score >= 55 && !hardWarn,
    canReplacePreviousSnapshot: score >= 70 && !freshness.isStale && !payload.partial,
    preferredRoot: 'appPayload',
    coverage,
    fieldMap,
    freshness,
    sourceTrace: {
      primary: payload.appPayload?.source?.primary || payload.sourceReport?.primarySource || null,
      sourcesUsed: payload.appPayload?.source?.sourcesUsed || payload.sourceReport?.sourcesUsed || [],
      captureScore: payload.consumerDiagnostics?.captureScore ?? null,
    },
    issues,
    uiGuards: {
      neverShowBlankDashboard: true,
      renderOrder: ['appPayload.quote', 'appRenderContract.metricGroups', 'appRenderContract.chartTemplates', 'appPayload.dividends', 'appPayload.news'],
      keepPreviousWhen: ['partial=true', 'freshness.isStale=true', 'score drops below previous snapshot score'],
      showPartialBanner: Boolean(payload.partial || score < 75 || issues.some(i => i.severity === 'warn')),
      safeFallbackPaths: ['appPayload.blankShield', 'appRenderContract.offlinePolicy', 'consumerDiagnostics.priorityPaths', 'normalized', 'results'],
    },
  };
}
