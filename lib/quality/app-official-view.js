import { compactEngineRuntimeProfiler } from './engine-runtime-profiler.js';
import { compactEngineLaunchGate } from './engine-launch-gate.js';

export const VALORAE_APP_VIEW_VERSION = '21.12.29-operational-resilience-app-contract';

function clone(value) {
  if (value == null) return value;
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}

function objectKeys(obj = {}) {
  return obj && typeof obj === 'object' && !Array.isArray(obj) ? Object.keys(obj) : [];
}

function compactEngineEfficiency(efficiency = {}) {
  if (!efficiency || typeof efficiency !== 'object') return undefined;
  return {
    version: efficiency.version,
    mode: efficiency.mode || efficiency.assemblyMode,
    scores: efficiency.scores,
    precision: efficiency.precision,
    reliability: efficiency.reliability,
    delivery: efficiency.delivery,
    recommendations: Array.isArray(efficiency.recommendations) ? efficiency.recommendations.slice(0, 6) : undefined,
    moduleTreeSummary: efficiency.moduleTreeSummary,
  };
}


function compactAssetClassContract(contract = {}) {
  if (!contract || typeof contract !== 'object') return undefined;
  const groups = {};
  for (const [key, group] of Object.entries(contract.groups || {})) {
    groups[key] = {
      title: group.title,
      description: group.description,
      completenessPercent: group.completenessPercent,
      present: group.present,
      expected: group.expected,
      missing: Array.isArray(group.missing) ? group.missing.slice(0, 8) : [],
      fields: Object.fromEntries(Object.entries(group.fields || {}).slice(0, 24).map(([field, value]) => [field, {
        value: value?.value,
        display: value?.display,
        unit: value?.unit,
        confidence: value?.confidence,
        source: value?.source,
      }]))
    };
  }
  return {
    version: contract.version,
    assetType: contract.assetType,
    sourceModel: contract.sourceModel,
    score: contract.score,
    state: contract.state,
    summary: contract.summary,
    groups,
    sourceMap: Array.isArray(contract.sourceMap) ? contract.sourceMap.slice(0, 8) : [],
    missingCriticalFields: Array.isArray(contract.missingCriticalFields) ? contract.missingCriticalFields.slice(0, 12) : [],
    appGuidance: contract.appGuidance,
  };
}


function compactAssetIndicatorCoverage(coverage = {}) {
  if (!coverage || typeof coverage !== 'object') return undefined;
  return {
    version: coverage.version,
    assetType: coverage.assetType,
    model: coverage.model,
    completenessPercent: coverage.completenessPercent,
    criticalCompletenessPercent: coverage.criticalCompletenessPercent,
    readyForPersonalUse: coverage.readyForPersonalUse,
    summary: coverage.summary,
    groups: Array.isArray(coverage.groups) ? coverage.groups.map(g => ({
      key: g.key,
      title: g.title,
      purpose: g.purpose,
      expected: g.expected,
      present: g.present,
      completenessPercent: g.completenessPercent,
      criticalMissing: g.criticalMissing,
      fields: Array.isArray(g.fields) ? g.fields.slice(0, 18).map(f => ({ key: f.key, label: f.label, unit: f.unit, priority: f.priority, present: f.present, sourceAlias: f.sourceAlias, value: f.value })) : [],
    })) : [],
    missingCriticalFields: Array.isArray(coverage.missingCriticalFields) ? coverage.missingCriticalFields.slice(0, 16) : [],
    integration: coverage.integration,
  };
}

function compactMaturityBooster(maturity = {}) {
  if (!maturity || typeof maturity !== 'object') return undefined;
  return {
    version: maturity.version,
    grade: maturity.grade,
    scores: maturity.scores,
    signals: maturity.signals,
    processingPlan: maturity.processingPlan,
    bottlenecks: Array.isArray(maturity.bottlenecks) ? maturity.bottlenecks.slice(0, 8) : [],
    recommendations: Array.isArray(maturity.recommendations) ? maturity.recommendations.slice(0, 8) : [],
  };
}

function compactFieldGuard(guard = {}) {
  if (!guard || typeof guard !== 'object') return undefined;
  return {
    version: guard.version,
    score: guard.score,
    state: guard.state,
    checkedFields: guard.checkedFields,
    issueCounts: guard.issueCounts,
    appPolicy: guard.appPolicy,
    topIssues: Array.isArray(guard.issues) ? guard.issues.slice(0, 8) : [],
  };
}

function compactPayloadBudget(budget = {}) {
  if (!budget || typeof budget !== 'object') return undefined;
  return {
    version: budget.version,
    view: budget.view,
    totalBytesApprox: budget.totalBytesApprox,
    state: budget.state,
    routePlan: budget.routePlan,
    thresholds: budget.thresholds,
    signals: budget.signals,
    topRoots: Array.isArray(budget.rootWeights) ? budget.rootWeights.slice(0, 8) : [],
    suggestions: Array.isArray(budget.suggestions) ? budget.suggestions.slice(0, 6) : [],
    appGuidance: budget.appGuidance,
  };
}

function compactActionPlan(plan = {}) {
  if (!plan || typeof plan !== 'object') return undefined;
  return {
    version: plan.version,
    score: plan.score,
    grade: plan.grade,
    releaseDecision: plan.releaseDecision,
    appInstructions: plan.appInstructions,
    suggestedPages: plan.suggestedPages,
    nextEndpoints: plan.nextEndpoints,
    priorityActions: Array.isArray(plan.priorityActions) ? plan.priorityActions.slice(0, 8) : [],
  };
}

function compactSourceReport(sourceReport = {}) {
  if (!sourceReport || typeof sourceReport !== 'object') return undefined;
  const tried = Array.isArray(sourceReport.sourcesTried) ? sourceReport.sourcesTried : [];
  return {
    primarySource: sourceReport.primarySource,
    sourcesUsed: sourceReport.sourcesUsed,
    totalTried: tried.length,
    ok: tried.filter(s => s?.ok || (Number(s?.status || 0) >= 200 && Number(s?.status || 0) < 400)).length,
    blocked: tried.filter(s => s?.blocked || [401, 403, 429].includes(Number(s?.status || 0))).length,
    failed: tried.filter(s => s?.error || Number(s?.status || 0) >= 400).length,
    attemptsPreview: tried.slice(0, 5).map(s => ({
      provider: s.provider || s.source || s.hostname,
      status: s.status,
      ok: Boolean(s.ok),
      blocked: Boolean(s.blocked),
      errorType: s.errorType,
      error: s.error ? String(s.error).slice(0, 120) : undefined,
    })),
  };
}

function buildEndpointCoverage(payload = {}) {
  const normalized = payload.normalized || {};
  const appPayload = payload.appPayload || {};
  const chartCount = Number(appPayload?.charts?.count || appPayload?.charts?.series?.length || payload.chartSeries?.series?.length || 0);
  const metricCount = Number(appPayload?.metrics?.count || objectKeys(appPayload?.metrics?.canonical).length || objectKeys(normalized).filter(k => k !== '_meta').length || 0);
  const dividendCount = Number(appPayload?.dividends?.count || appPayload?.dividends?.items?.length || payload.results?.dividendos?.historico?.length || 0);
  return {
    version: VALORAE_APP_VIEW_VERSION,
    ticker: payload.ticker,
    type: payload.type,
    status: payload.status,
    score: payload.quality?.score ?? payload.valoraeScore?.score ?? payload.appResponseIntegrity?.score ?? null,
    blocks: {
      quote: Boolean(appPayload?.quote?.price || normalized.precoAtual || normalized.price),
      metrics: metricCount > 0,
      fundamentals: Boolean(payload.assetClassContract?.score >= 35 || metricCount >= (payload.type === 'FII' ? 6 : 8)),
      charts: chartCount > 0,
      dividends: dividendCount > 0,
      sourceTrace: Boolean(payload.sourceReport || payload.cacheStatus),
      renderSafe: Boolean(payload.appResponseIntegrity?.renderSafe || payload.appDataContract?.renderSafe),
      cacheSafe: Boolean(payload.appResponseIntegrity?.cacheSafe || payload.appDataContract?.canReplacePreviousSnapshot),
    },
    counts: {
      metrics: metricCount,
      chartSeries: chartCount,
      chartPoints: Number(appPayload?.charts?.bestPointCount || appPayload?.charts?.totalPoints || 0),
      dividends: dividendCount,
      warnings: Array.isArray(payload.warnings) ? payload.warnings.length : 0,
    },
    missingCritical: payload.appDataContract?.uiGuards?.missingCritical || payload.appPayload?.blankShield?.missingCritical || [],
    recommendation: payload.appResponseIntegrity?.recommendedAction || payload.appSyncEnvelope?.decision || (payload.partial ? 'render_partial_keep_previous_available' : 'render'),
  };
}

export function buildOfficialAppView(payload = {}) {
  const p = clone(payload) || {};
  const endpointCoverage = buildEndpointCoverage(p);
  const output = {
    schemaVersion: p.schemaVersion,
    version: p.version,
    view: 'app',
    officialAppContractVersion: VALORAE_APP_VIEW_VERSION,
    status: p.status,
    partial: Boolean(p.partial),
    ticker: p.ticker,
    type: p.type,
    generatedAt: p.metrics?.generatedAt || new Date().toISOString(),
    cacheStatus: p.cacheStatus,
    warnings: Array.isArray(p.warnings) ? p.warnings.slice(0, 8) : [],

    // Raízes oficiais que Web/APK devem consumir. O monitor também detecta estas raízes.
    appMobileSnapshot: p.appMobileSnapshot,
    appPayload: p.appPayload,
    appSyncEnvelope: p.appSyncEnvelope,
    appResponseIntegrity: p.appResponseIntegrity,
    engineEfficiency: compactEngineEfficiency(p.engineEfficiency),
    engineMaturityBooster: compactMaturityBooster(p.engineMaturityBooster),
    assetClassContract: compactAssetClassContract(p.assetClassContract),
    assetIndicatorCoverage: compactAssetIndicatorCoverage(p.assetIndicatorCoverage),
    fieldConsistencyGuard: compactFieldGuard(p.fieldConsistencyGuard),
    payloadBudget: compactPayloadBudget(p.payloadBudget),
    assetActionPlan: compactActionPlan(p.assetActionPlan),
    engineRuntimeProfiler: compactEngineRuntimeProfiler(p.engineRuntimeProfiler),
    engineLaunchGate: compactEngineLaunchGate(p.engineLaunchGate),

    // Diagnóstico enxuto para lançamento e integração.
    endpointCoverage,
    normalizedSummary: {
      count: objectKeys(p.normalized).filter(k => k !== '_meta').length,
      fields: objectKeys(p.normalized).filter(k => k !== '_meta').slice(0, 80),
      meta: p.normalized?._meta,
    },
    sourceReport: compactSourceReport(p.sourceReport),
    extractionCompleteness: p.metrics?.extractionCompleteness,
    dataReliability: p.dataReliability,
    bestSnapshotHydration: p.bestSnapshotHydration,
    metrics: p.metrics?.extractionCompleteness ? {
      generatedAt: p.metrics?.generatedAt,
      source: p.metrics?.source,
      foundKeysCount: p.metrics?.foundKeysCount,
      performanceProfile: p.metrics?.performanceProfile,
      extractionCompleteness: p.metrics.extractionCompleteness,
    } : undefined,
    appContract: {
      stableRootOrder: ['appMobileSnapshot', 'appPayload', 'appSyncEnvelope', 'appResponseIntegrity', 'assetActionPlan', 'engineLaunchGate', 'fieldConsistencyGuard', 'payloadBudget', 'assetIndicatorCoverage', 'engineMaturityBooster', 'engineRuntimeProfiler', 'dataReliability'],
      firstPaintRoot: 'appMobileSnapshot',
      hydrateRoot: 'appPayload',
      cacheDecisionRoot: 'appSyncEnvelope',
      safetyRoot: 'appResponseIntegrity',
      debugViews: ['standard', 'full', 'analysis'],
      rule: 'Nunca apague o último snapshot bom quando renderSafe/cacheSafe vier falso ou status vier PARTIAL.',
    },
    links: {
      self: `/api/v1/asset?ticker=${encodeURIComponent(p.ticker || '')}&view=app`,
      coverage: `/api/v1/asset/coverage?ticker=${encodeURIComponent(p.ticker || '')}`,
      fundamentals: `/api/v1/asset/fundamentals?ticker=${encodeURIComponent(p.ticker || '')}`,
      sourceMap: `/api/v1/asset/source-map?ticker=${encodeURIComponent(p.ticker || '')}`,
      quality: `/api/v1/asset/quality?ticker=${encodeURIComponent(p.ticker || '')}`,
      actionPlan: `/api/v1/asset/action-plan?ticker=${encodeURIComponent(p.ticker || '')}`,
      integrationManifest: '/api/v1/integration/manifest',
      profile: `/api/v1/${p.type === 'FII' ? 'fii' : 'asset'}/profile?ticker=${encodeURIComponent(p.ticker || '')}`,
      sourceStatus: '/api/v1/source/status',
      fields: '/api/v1/fields',
      openapi: '/api/v1/openapi',
    },
  };
  Object.keys(output).forEach(k => output[k] === undefined && delete output[k]);
  return output;
}
