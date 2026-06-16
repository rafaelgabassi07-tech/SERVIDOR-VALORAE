// Diagnóstico de consumo para o app/painéis.
// Não faz chamadas externas; apenas consolida o que o proxy já captou, normalizou e tentou nas fontes.

export const VALORAE_CONSUMER_DIAGNOSTICS_VERSION = '21.12.4-consumer-source-diagnostics';

function get(obj, path) {
  return String(path || '').split('.').reduce((acc, key) => acc == null ? undefined : acc[key], obj);
}

function hasValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return Number.isFinite(Number(value)) || typeof value === 'boolean';
}

function keysOf(obj) {
  return obj && typeof obj === 'object' && !Array.isArray(obj) ? Object.keys(obj).filter(k => k !== 'sections') : [];
}

function splitSources(source = '') {
  return String(source || '')
    .split('+')
    .map(s => s.trim())
    .filter(Boolean);
}

function normalizeAttempt(a = {}) {
  const provider = a.name || a.provider || 'UnknownSource';
  const ok = a.ok === true;
  const status = Number(a.status || 0);
  return {
    provider,
    transport: a.provider || provider,
    ok,
    status: status || undefined,
    blocked: Boolean(a.blocked || status === 401 || status === 403 || status === 429),
    retryable: a.retryable === true,
    errorType: a.errorType || undefined,
    error: a.error || undefined,
    htmlLength: Number(a.htmlLength || 0),
    selectorResultKeys: Array.isArray(a.selectorResultKeys) ? a.selectorResultKeys : undefined,
    attempts: Array.isArray(a.attempts) ? a.attempts.length : undefined,
  };
}

function buildAttemptSummary(payload = {}) {
  const attempts = Array.isArray(payload.metrics?.sourcesTried) ? payload.metrics.sourcesTried.map(normalizeAttempt) : [];
  const providers = new Map();
  for (const a of attempts) {
    const current = providers.get(a.provider) || { provider: a.provider, attempts: 0, ok: 0, failed: 0, blocked: 0, retryable: 0, htmlBytes: 0, statuses: {} };
    current.attempts += 1;
    if (a.ok) current.ok += 1; else current.failed += 1;
    if (a.blocked) current.blocked += 1;
    if (a.retryable) current.retryable += 1;
    current.htmlBytes += Number(a.htmlLength || 0);
    if (a.status) current.statuses[a.status] = (current.statuses[a.status] || 0) + 1;
    providers.set(a.provider, current);
  }
  return {
    totalAttempts: attempts.length,
    okAttempts: attempts.filter(a => a.ok).length,
    failedAttempts: attempts.filter(a => !a.ok).length,
    blockedAttempts: attempts.filter(a => a.blocked).length,
    retryableAttempts: attempts.filter(a => a.retryable).length,
    providers: [...providers.values()].map(p => ({ ...p, htmlBytes: Math.round(p.htmlBytes) })),
    attempts: attempts.slice(0, 12),
  };
}

function buildDataMap(payload = {}) {
  const results = payload.results || {};
  const sections = results.sections || {};
  const normalized = payload.normalized || {};
  const panels = payload.panelReadiness?.panels || {};
  const chartSeries = Array.isArray(payload.chartSeries?.series) ? payload.chartSeries.series : [];
  const normalizedFields = Object.entries(normalized)
    .filter(([key]) => key !== '_meta')
    .map(([field, value]) => ({
      field,
      unit: value?.unit,
      source: value?.source,
      confidence: typeof value?.confidence === 'number' ? value.confidence : undefined,
      hasValue: hasValue(value?.value ?? value?.display),
    }));
  return {
    rawResultKeys: keysOf(results),
    sectionKeys: keysOf(sections),
    normalizedFieldCount: normalizedFields.filter(f => f.hasValue).length,
    normalizedFields,
    chartSeriesCount: chartSeries.length,
    chartPointCount: chartSeries.reduce((sum, s) => sum + (Array.isArray(s.points) ? s.points.length : 0), 0),
    chartSeriesNames: chartSeries.slice(0, 12).map(s => ({ key: s.key, name: s.name, points: Array.isArray(s.points) ? s.points.length : 0, sourceFormat: s.sourceFormat })),
    panelStates: Object.fromEntries(Object.entries(panels).map(([name, p]) => [name, { ready: Boolean(p.ready), completenessPercent: p.completenessPercent || 0, missingPaths: p.missingPaths || [] }])),
  };
}

function buildPriorityPaths(payload = {}) {
  const paths = [
    ['quote', 'normalized.precoAtual.value', 'results.precoAtual', 'results.cotacao.precoAtual'],
    ['fundamentals', 'normalized.dividendYield.value', 'normalized.pl.value', 'normalized.pvp.value', 'results.indicadores'],
    ['dividends', 'results.dividendos.historico', 'results.historicoDividendos', 'dividendStats'],
    ['charts', 'chartSeries.series', 'chartReadiness.topSeries', 'results.historicoIndicadores'],
    ['news', 'news'],
    ['sourceTrace', 'sourceReport', 'metrics.sourcesTried', 'sourceReliability'],
  ];
  return paths.map(([panel, ...candidatePaths]) => ({
    panel,
    preferredPath: candidatePaths.find(p => hasValue(get(payload, p))) || candidatePaths[0],
    availablePaths: candidatePaths.filter(p => hasValue(get(payload, p))),
    missingPaths: candidatePaths.filter(p => !hasValue(get(payload, p))),
  }));
}

function buildRecommendations(payload = {}, dataMap = {}, attemptSummary = {}) {
  const out = [];
  if (!dataMap.chartSeriesCount) out.push('App: mostrar estado de gráfico indisponível e usar métricas normalizadas enquanto histórico não chegar.');
  if (!dataMap.normalizedFieldCount) out.push('App: usar results como fallback bruto, pois normalized veio vazio.');
  if (attemptSummary.blockedAttempts) out.push('Proxy: fonte externa bloqueou/limitou resposta; manter cache stale e tentar fonte alternativa.');
  if (payload.partial) out.push('App: exibir banner de dados parciais usando panelReadiness e dataQualityMatrix.');
  if (payload.cacheStatus && /STALE/i.test(String(payload.cacheStatus))) out.push('App: indicar dados em cache/stale sem apagar painéis já renderizados.');
  if (!payload.sourceReport?.primarySource) out.push('Proxy: resposta sem fonte primária clara; revisar metrics.sourcesTried e provider health.');
  return out;
}

export function buildConsumerDiagnostics(payload = {}, runtime = {}) {
  const attemptSummary = buildAttemptSummary(payload);
  const dataMap = buildDataMap(payload);
  const sourcesUsed = Array.isArray(payload.sourceReport?.sourcesUsed) && payload.sourceReport.sourcesUsed.length
    ? payload.sourceReport.sourcesUsed
    : splitSources(payload.metrics?.source);
  const readyPanels = Object.values(dataMap.panelStates || {}).filter(p => p.ready).length;
  const panelCount = Object.keys(dataMap.panelStates || {}).length;
  const sourceHealth = Array.isArray(payload.sourceReliability) ? payload.sourceReliability : [];
  const degradedSources = sourceHealth.filter(s => ['cooldown','degraded','blocked'].includes(String(s.status || '').toLowerCase()));
  const captureScore = Math.max(0, Math.min(100, Math.round(
    (payload.status === 'OK' ? 22 : payload.partial ? 10 : 0) +
    Math.min(22, dataMap.normalizedFieldCount * 2) +
    Math.min(18, dataMap.chartSeriesCount * 6) +
    (panelCount ? (readyPanels / panelCount) * 24 : 8) +
    (attemptSummary.okAttempts ? 10 : 0) -
    Math.min(18, attemptSummary.blockedAttempts * 6 + degradedSources.length * 3)
  )));
  return {
    version: VALORAE_CONSUMER_DIAGNOSTICS_VERSION,
    captureScore,
    status: captureScore >= 80 ? 'ready' : captureScore >= 55 ? 'partial' : 'limited',
    generatedAt: payload.metrics?.generatedAt || new Date().toISOString(),
    sourcesUsed,
    primarySource: payload.sourceReport?.primarySource || sourcesUsed[0] || null,
    sourceAttempts: attemptSummary,
    dataMap,
    priorityPaths: buildPriorityPaths(payload),
    runtimeSignals: {
      providerCount: Object.keys(runtime.providers || {}).length,
      cacheDriver: runtime.cache?.driver || runtime.cacheDriver || 'memory',
      failureCache: runtime.failureCache || undefined,
      inflight: runtime.inflight || undefined,
    },
    recommendations: buildRecommendations(payload, dataMap, attemptSummary),
    appContract: {
      neverBlankDashboard: true,
      prefer: ['panelReadiness', 'consumerDiagnostics.priorityPaths', 'chartSeries.series', 'normalized', 'results'],
      fallbackOrder: ['chartSeries.series', 'chartReadiness.topSeries', 'results.sections', 'results', 'warnings'],
      partialDataBanner: Boolean(payload.partial || captureScore < 80),
    },
  };
}
