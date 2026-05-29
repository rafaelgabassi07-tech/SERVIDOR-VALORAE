// Auditoria leve de eficiência, precisão e árvore do ecossistema Valorae Engine.
// Mantém compatibilidade com Vercel Free: sem I/O externo, banco, KV ou dependência paga.

export const VALORAE_ENGINE_EFFICIENCY_VERSION = '21.12.24-efficiency-precision-ecosystem';

function clamp(n, min = 0, max = 100) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function countKeys(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).length : 0;
}

function arrayLen(value) { return Array.isArray(value) ? value.length : 0; }

function valueOf(field) {
  if (field == null || field === '') return undefined;
  if (typeof field !== 'object' || Array.isArray(field)) return field;
  return field.value ?? field.display;
}

function metricEntries(payload = {}) {
  const canonical = payload.appPayload?.metrics?.canonical || payload.normalized || {};
  return Object.entries(canonical).filter(([key, value]) => key !== '_meta' && valueOf(value) !== undefined);
}

function countChartPoints(payload = {}) {
  const series = payload.chartSeries?.series || payload.appPayload?.charts?.series || payload.appMobileSnapshot?.charts?.series || [];
  if (!Array.isArray(series)) return 0;
  return series.reduce((sum, s) => sum + arrayLen(s?.points || s?.data || s?.values), 0);
}

function classifyUnits(entries = []) {
  const units = { currency: 0, percent: 0, ratio: 0, number: 0, unknown: 0 };
  for (const [, field] of entries) {
    const unit = String(typeof field === 'object' && !Array.isArray(field) ? field.unit || field.kind || '' : '').toLowerCase();
    const display = String(typeof field === 'object' && !Array.isArray(field) ? field.display || '' : field || '');
    if (/r\$|brl|currency|money/.test(unit) || /r\$/.test(display.toLowerCase())) units.currency += 1;
    else if (/%|percent|percentage/.test(unit) || /%/.test(display)) units.percent += 1;
    else if (/ratio|multiple|x$/.test(unit) || /x$/.test(display.trim())) units.ratio += 1;
    else if (Number.isFinite(Number(valueOf(field)))) units.number += 1;
    else units.unknown += 1;
  }
  return units;
}

function suspiciousNumbers(entries = []) {
  const issues = [];
  for (const [key, field] of entries) {
    const value = valueOf(field);
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) continue;
    if (/yield|dy|roe|roic|roa|margem|payout|vacancia/i.test(key) && Math.abs(numeric) > 500) {
      issues.push({ key, code: 'PERCENT_OUTLIER', value: numeric, message: 'Percentual acima do esperado; conferir unidade/origem.' });
    }
    if (/preco|price|cotacao/i.test(key) && numeric < 0) {
      issues.push({ key, code: 'NEGATIVE_PRICE', value: numeric, message: 'Preço negativo não deve substituir snapshot anterior.' });
    }
    if (/pvp|pl|p_l|p_vp/i.test(key) && Math.abs(numeric) > 5000) {
      issues.push({ key, code: 'MULTIPLE_OUTLIER', value: numeric, message: 'Múltiplo muito alto; conferir parse de vírgula/ponto.' });
    }
  }
  return issues.slice(0, 12);
}

export function buildEngineModuleTree({ summaryOnly = false } = {}) {
  const groups = [
    {
      key: 'entrypoints', title: 'Entrada HTTP e Vercel', purpose: 'Recebe chamadas /api, aplica CORS, roteamento único e intercepta respostas para telemetria.',
      modules: ['api/router.js', 'routes/_router.js', 'lib/http/route.js', 'lib/observability/server-metrics.js'],
    },
    {
      key: 'engine-core', title: 'Núcleo Valorae Engine', purpose: 'Orquestra fontes, cache, normalização, contratos de app e perfil de performance sem desmembrar Valorae-engine.js.',
      modules: ['lib/Valorae-engine.js', 'lib/performance/profile.js', 'lib/resilience/engine-policy.js'],
    },
    {
      key: 'fetch-resilience', title: 'Busca, resiliência e cache', purpose: 'Deduplica chamadas, aplica circuit breaker, stale-if-error, cache de HTML/scrape e fallback de fonte.',
      modules: ['lib/resilience/inflight.js', 'lib/resilience/circuit-breaker.js', 'lib/resilience/error-classifier.js', 'lib/resilience/failure-cache.js', 'lib/cache/scrape-result-cache.js'],
    },
    {
      key: 'normalization', title: 'Normalização e precisão', purpose: 'Transforma HTML, APIs e números brasileiros em campos canônicos consumíveis por APK/Web.',
      modules: ['lib/normalizers/universal.js', 'lib/normalizers/numbers.js', 'lib/quality/chart-series.js', 'lib/quality/chart-readiness.js'],
    },
    {
      key: 'app-contracts', title: 'Contratos para apps', purpose: 'Garante renderização sem tela vazia, sync seguro, snapshot mobile, integridade e fallback.',
      modules: ['lib/quality/app-consumer-payload.js', 'lib/quality/app-render-contract.js', 'lib/quality/app-data-contract.js', 'lib/quality/app-sync-envelope.js', 'lib/quality/app-mobile-snapshot.js', 'lib/quality/app-response-integrity.js'],
    },
    {
      key: 'monitor-ui', title: 'Monitor do proxy', purpose: 'Mostra tudo que sai do proxy para apps/usuários: rotas, apps, payloads, métricas, gráficos, cache e Vercel Runtime.',
      modules: ['public/server.html', 'public/index.html', 'public/manifest.webmanifest', 'public/service-worker.js'],
    },
    {
      key: 'audits-tests', title: 'Auditorias e testes', purpose: 'Protege compatibilidade, Vercel Free, contratos, rotas, dashboard, build e maturidade operacional.',
      modules: ['test/*.test.js', 'scripts/audit-*.js', 'scripts/build-vercel-safe.js', 'scripts/typecheck-free.js'],
    },
  ];
  if (summaryOnly) return groups.map(g => ({ key: g.key, title: g.title, modules: g.modules.length }));
  return { version: VALORAE_ENGINE_EFFICIENCY_VERSION, groups, totalGroups: groups.length, totalModulesListed: groups.reduce((n, g) => n + g.modules.length, 0) };
}

export function buildEngineEfficiencyReport(payload = {}, assemblyPlan = {}, runtimeStats = {}, options = {}) {
  const entries = metricEntries(payload);
  const units = classifyUnits(entries);
  const precisionIssues = suspiciousNumbers(entries);
  const sourceAttempts = arrayLen(payload.metrics?.sourcesTried);
  const okSources = (payload.metrics?.sourcesTried || []).filter(s => s?.ok || (Number(s?.status || 0) >= 200 && Number(s?.status || 0) < 400)).length;
  const blockedAttempts = (payload.metrics?.sourcesTried || []).filter(s => s?.blocked || [401, 403, 429].includes(Number(s?.status || 0))).length;
  const normalizedFields = countKeys(payload.normalized) - (payload.normalized?._meta ? 1 : 0);
  const chartSeries = arrayLen(payload.chartSeries?.series || payload.appPayload?.charts?.series);
  const chartPoints = countChartPoints(payload);
  const roots = Object.keys(payload || {});
  const appRoots = ['appPayload', 'appSyncEnvelope', 'appMobileSnapshot', 'appResponseIntegrity'].filter(k => payload[k]);
  const compact = assemblyPlan.mode === 'mobile-optimized' || String(options.view || '').toLowerCase().match(/compact|mobile|watchlist|list|instant|fast/);
  const precisionScore = clamp(100 - precisionIssues.length * 9 - Math.max(0, units.unknown - 3) * 2);
  const reliabilityScore = clamp((okSources ? 65 : 35) + Math.min(20, sourceAttempts * 4) + (payload.partial ? -10 : 10) - blockedAttempts * 12 - (payload.warnings?.length || 0) * 2);
  const efficiencyScore = clamp(
    52 +
    (compact ? 16 : 6) +
    Math.min(18, normalizedFields * 2) +
    Math.min(10, chartSeries * 2) -
    Math.max(0, roots.length - 34) -
    (assemblyPlan.buildHeavyQualityMatrices ? 4 : 0)
  );
  const overallScore = clamp(efficiencyScore * 0.38 + precisionScore * 0.28 + reliabilityScore * 0.22 + Math.min(100, appRoots.length * 25) * 0.12);
  return {
    version: VALORAE_ENGINE_EFFICIENCY_VERSION,
    generatedAt: payload.metrics?.generatedAt || new Date().toISOString(),
    mode: assemblyPlan.mode || 'unknown',
    profile: assemblyPlan.profile || payload.performance?.profile || options.profile || 'standard',
    view: assemblyPlan.resolvedView || payload.view || options.view || 'full',
    scores: { overall: overallScore, efficiency: efficiencyScore, precision: precisionScore, reliability: reliabilityScore },
    assembly: {
      appRootsAlwaysBuilt: appRoots,
      skippedRootsWhenOptimized: assemblyPlan.skippedRootsWhenMobileOptimized || [],
      heavyMatricesBuilt: Boolean(assemblyPlan.buildHeavyQualityMatrices),
      chartSeriesLimit: payload.metrics?.engineOptimizations?.chartSeriesLimit || null,
      recommendedAppRoot: compact ? 'appMobileSnapshot' : 'appPayload',
    },
    precision: {
      normalizedFields,
      metricFields: entries.length,
      units,
      issues: precisionIssues,
      parser: 'normalizers/numbers.js + universal aliases',
    },
    delivery: {
      chartSeries,
      chartPoints,
      payloadRoots: roots.length,
      appRoots,
      renderSafe: payload.appResponseIntegrity?.renderSafe ?? payload.appDataContract?.renderSafe ?? null,
      cacheSafe: payload.appResponseIntegrity?.cacheSafe ?? payload.appDataContract?.canReplacePreviousSnapshot ?? null,
      syncDecision: payload.appSyncEnvelope?.decision || payload.appSyncEnvelope?.action || null,
    },
    reliability: {
      status: payload.status,
      partial: Boolean(payload.partial),
      warnings: arrayLen(payload.warnings),
      sourceAttempts,
      okSources,
      blockedAttempts,
      cacheStatus: payload.cacheStatus || payload.metrics?.resultCache || 'unknown',
    },
    runtime: {
      assetCacheEntries: runtimeStats?.caches?.assetResult?.entries ?? runtimeStats?.caches?.assetResult?.size ?? null,
      htmlCacheEntries: runtimeStats?.caches?.html?.entries ?? runtimeStats?.caches?.html?.size ?? null,
      inflight: runtimeStats?.inflight?.active ?? runtimeStats?.inflight?.size ?? null,
      freeTierSafe: true,
    },
    moduleTreeSummary: buildEngineModuleTree({ summaryOnly: true }),
  };
}
