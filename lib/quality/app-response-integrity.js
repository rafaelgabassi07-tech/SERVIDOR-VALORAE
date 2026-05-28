// Auditor final de integridade do payload entregue ao APK/Web.
// Objetivo: detectar regressões entre appPayload, contratos, sync e snapshot mobile
// antes do app substituir cache local ou tentar renderizar gráficos/cards.

export const VALORAE_APP_RESPONSE_INTEGRITY_VERSION = '21.12.10-app-response-integrity';

const REQUIRED_APP_ROOTS = [
  'appPayload',
  'appRenderContract',
  'appDataContract',
  'appSyncEnvelope',
  'appMobileSnapshot',
];

function present(value) {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function get(obj, path) {
  return String(path || '').split('.').reduce((acc, key) => acc == null ? undefined : acc[key], obj);
}

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function approxBytes(value) {
  try { return Buffer.byteLength(JSON.stringify(value || {})); }
  catch { return 0; }
}

function issue(severity, code, message, path = null, recommendation = null) {
  return { severity, code, message, path, recommendation };
}

function buildRootCoverage(payload = {}) {
  const roots = REQUIRED_APP_ROOTS.map(path => ({ path, present: present(get(payload, path)) }));
  const ready = roots.filter(r => r.present).length;
  return {
    ready,
    total: roots.length,
    completenessPercent: clampPercent((ready / Math.max(1, roots.length)) * 100),
    roots,
  };
}

function buildChartIntegrity(payload = {}) {
  const chartSeriesCount = Number(payload.chartSeries?.count ?? payload.chartSeries?.series?.length ?? 0) || 0;
  const appChartCount = Number(payload.appPayload?.charts?.count ?? payload.appPayload?.charts?.series?.length ?? 0) || 0;
  const mobileChartCount = Array.isArray(payload.appMobileSnapshot?.charts) ? payload.appMobileSnapshot.charts.length : 0;
  const templateCount = Array.isArray(payload.appRenderContract?.chartTemplates) ? payload.appRenderContract.chartTemplates.length : 0;
  const bestPointCount = Number(payload.appPayload?.charts?.bestPointCount || 0);
  const sampledOverflow = (payload.appMobileSnapshot?.charts || []).filter(s => Number(s.sampledPointCount || 0) > 80).map(s => s.key);
  const ok = chartSeriesCount === 0 || appChartCount > 0;
  return {
    ok,
    chartSeriesCount,
    appChartCount,
    mobileChartCount,
    templateCount,
    bestPointCount,
    sampledOverflow,
    parity: {
      appPayloadMirrorsChartSeries: chartSeriesCount === appChartCount,
      mobileIsCompactSubset: mobileChartCount <= Math.min(6, Math.max(chartSeriesCount, appChartCount)),
      templatesAvailableWhenChartsExist: chartSeriesCount === 0 || templateCount > 0,
    },
  };
}

function buildMetricIntegrity(payload = {}) {
  const canonical = payload.appPayload?.metrics?.canonical || {};
  const aliases = payload.appPayload?.metrics?.aliases || {};
  const normalized = payload.normalized || {};
  const mobileMetrics = payload.appMobileSnapshot?.metrics || {};
  const canonicalKeys = Object.keys(canonical).filter(k => k !== '_meta');
  const normalizedKeys = Object.keys(normalized).filter(k => k !== '_meta');
  const aliasBroken = Object.entries(aliases)
    .filter(([, canonicalKey]) => canonicalKey && !present(canonical[canonicalKey]))
    .slice(0, 20)
    .map(([alias, canonicalKey]) => ({ alias, canonicalKey }));
  const critical = payload.appDataContract?.coverage?.criticalMetrics || {};
  return {
    ok: canonicalKeys.length > 0 || normalizedKeys.length > 0,
    canonicalCount: canonicalKeys.length,
    normalizedCount: normalizedKeys.length,
    mobileMetricCount: Object.keys(mobileMetrics || {}).length,
    aliasBrokenCount: aliasBroken.length,
    aliasBroken,
    criticalPresent: critical.present || 0,
    criticalTotal: critical.total || 0,
    preferredPath: 'appPayload.metrics.canonical',
    fallbackPaths: ['normalized', 'results'],
  };
}

function buildSyncIntegrity(payload = {}) {
  const sync = payload.appSyncEnvelope || {};
  const mobile = payload.appMobileSnapshot || {};
  const contract = payload.appDataContract || {};
  const action = sync.decision?.action || null;
  const payloadHash = sync.identity?.payloadHash || null;
  const mobilePayloadHash = mobile.sync?.payloadHash || null;
  const renderSafe = Boolean(sync.decision?.renderSafe || contract.renderSafe || mobile.sync?.renderSafe);
  const canReplace = Boolean(sync.decision?.canReplacePreviousSnapshot || contract.canReplacePreviousSnapshot || mobile.sync?.canReplacePreviousSnapshot);
  return {
    ok: present(sync.decision) && present(sync.identity) && present(mobile.snapshotHash),
    action,
    renderSafe,
    canReplacePreviousSnapshot: canReplace,
    hashParity: {
      syncPayloadHash: payloadHash,
      mobilePayloadHash,
      mobileReferencesSyncHash: Boolean(payloadHash && mobilePayloadHash && payloadHash === mobilePayloadHash),
      snapshotHashPresent: present(mobile.snapshotHash),
    },
    firstPaintReady: Boolean(sync.firstPaint?.ready),
    firstPaintCompletenessPercent: clampPercent(sync.firstPaint?.completenessPercent),
    shouldKeepPreviousSnapshot: Boolean(sync.decision?.shouldKeepPreviousSnapshot),
  };
}

function buildPayloadBudget(payload = {}) {
  const totalBytes = approxBytes(payload);
  const appPayloadBytes = approxBytes(payload.appPayload);
  const mobileBytes = approxBytes(payload.appMobileSnapshot);
  const chartBytes = approxBytes(payload.chartSeries);
  return {
    totalBytesApprox: totalBytes,
    appPayloadBytesApprox: appPayloadBytes,
    appMobileSnapshotBytesApprox: mobileBytes,
    chartSeriesBytesApprox: chartBytes,
    mobileRatioPercent: totalBytes ? clampPercent((mobileBytes / totalBytes) * 100) : 0,
    budget: {
      mobileSnapshotMaxRecommendedBytes: 120_000,
      appPayloadMaxRecommendedBytes: 350_000,
      fullPayloadMaxRecommendedBytes: 1_200_000,
    },
    overBudget: {
      mobileSnapshot: mobileBytes > 120_000,
      appPayload: appPayloadBytes > 350_000,
      fullPayload: totalBytes > 1_200_000,
    },
    recommendedView: totalBytes > 1_200_000 ? 'compact' : totalBytes > 600_000 ? 'standard' : 'full',
  };
}

function collectIssues(payload = {}, sections = {}) {
  const issues = [];
  for (const root of sections.rootCoverage.roots) {
    if (!root.present) issues.push(issue('error', 'MISSING_APP_ROOT', `Raiz ${root.path} ausente no payload final.`, root.path, 'Gerar todos os contratos antes de responder ao app.'));
  }
  if (!sections.metrics.ok) issues.push(issue('error', 'NO_CONSUMABLE_METRICS', 'Nenhuma métrica consumível foi encontrada em appPayload.metrics.canonical ou normalized.', 'appPayload.metrics.canonical', 'Manter snapshot anterior e renderizar empty state com botão de atualizar.'));
  if (sections.metrics.aliasBrokenCount) issues.push(issue('warn', 'BROKEN_METRIC_ALIASES', `${sections.metrics.aliasBrokenCount} aliases apontam para métricas canônicas ausentes.`, 'appPayload.metrics.aliases', 'Revisar aliases antes de o app usar nomes alternativos.'));
  if (!sections.charts.ok) issues.push(issue('warn', 'CHART_PARITY_MISMATCH', 'chartSeries contém séries, mas appPayload.charts não espelhou séries para o consumidor.', 'appPayload.charts.series', 'Usar chartSeries.series como fallback e não ocultar o card de métricas.'));
  if (sections.charts.sampledOverflow.length) issues.push(issue('warn', 'MOBILE_CHART_SAMPLE_OVERFLOW', 'Há séries mobile com mais pontos do que o limite de snapshot.', 'appMobileSnapshot.charts', 'Reamostrar séries para até 80 pontos por série.'));
  if (!sections.sync.ok) issues.push(issue('error', 'SYNC_ENVELOPE_INCOMPLETE', 'Envelope de sincronização ou snapshot hash ausente.', 'appSyncEnvelope', 'Não substituir cache local até ter decisão e hash estável.'));
  if (sections.sync.hashParity.syncPayloadHash && sections.sync.hashParity.mobilePayloadHash && !sections.sync.hashParity.mobileReferencesSyncHash) {
    issues.push(issue('warn', 'SNAPSHOT_HASH_REFERENCE_MISMATCH', 'Snapshot mobile não referencia o mesmo payloadHash do appSyncEnvelope.', 'appMobileSnapshot.sync.payloadHash', 'Comparar appSyncEnvelope.identity.payloadHash como fonte da verdade.'));
  }
  if (sections.sync.action === 'replace_snapshot' && !sections.sync.canReplacePreviousSnapshot) {
    issues.push(issue('error', 'REPLACE_ACTION_WITHOUT_PERMISSION', 'A decisão recomenda replace_snapshot, mas o contrato não permite substituir snapshot anterior.', 'appSyncEnvelope.decision', 'Tratar como merge_with_previous_snapshot no app.'));
  }
  if (sections.budget.overBudget.mobileSnapshot) issues.push(issue('warn', 'MOBILE_SNAPSHOT_OVER_BUDGET', 'Snapshot mobile passou do orçamento recomendado.', 'appMobileSnapshot', 'Usar fields=appMobileSnapshot ou view=compact em listas/watchlist.'));
  if (sections.budget.overBudget.fullPayload) issues.push(issue('info', 'FULL_PAYLOAD_HEAVY', 'Payload completo está pesado para mobile.', null, 'Usar appMobileSnapshot para primeira pintura e hidratar detalhes sob demanda.'));
  return issues;
}

function scoreFrom(sections = {}, issues = []) {
  let score = 100;
  score -= (100 - sections.rootCoverage.completenessPercent) * 0.35;
  if (!sections.metrics.ok) score -= 28;
  if (!sections.charts.ok) score -= 10;
  if (!sections.sync.ok) score -= 24;
  if (!sections.sync.hashParity.mobileReferencesSyncHash && sections.sync.hashParity.syncPayloadHash && sections.sync.hashParity.mobilePayloadHash) score -= 8;
  if (sections.budget.overBudget.mobileSnapshot) score -= 8;
  if (sections.budget.overBudget.fullPayload) score -= 5;
  score -= issues.filter(i => i.severity === 'error').length * 12;
  score -= issues.filter(i => i.severity === 'warn').length * 4;
  return clampPercent(score);
}

export function buildAppResponseIntegrity(payload = {}) {
  const sections = {
    rootCoverage: buildRootCoverage(payload),
    metrics: buildMetricIntegrity(payload),
    charts: buildChartIntegrity(payload),
    sync: buildSyncIntegrity(payload),
    budget: buildPayloadBudget(payload),
  };
  const issues = collectIssues(payload, sections);
  const score = scoreFrom(sections, issues);
  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warn').length;
  return {
    version: VALORAE_APP_RESPONSE_INTEGRITY_VERSION,
    generatedAt: payload.metrics?.generatedAt || payload.appPayload?.generatedAt || new Date().toISOString(),
    ticker: payload.ticker,
    type: payload.type,
    status: payload.status,
    score,
    ok: errors === 0 && score >= 70,
    renderSafe: Boolean(payload.appDataContract?.renderSafe || sections.sync.renderSafe || payload.appPayload?.blankShield?.canRenderDashboard),
    cacheSafe: Boolean(sections.sync.canReplacePreviousSnapshot && errors === 0 && score >= 75),
    sections,
    issueCounts: { errors, warnings, info: issues.filter(i => i.severity === 'info').length },
    issues,
    appInstructions: {
      preferredFirstPaintRoot: 'appMobileSnapshot',
      preferredFullRenderRoot: 'appPayload',
      useHashForCache: 'appSyncEnvelope.identity.payloadHash',
      keepPreviousSnapshotWhen: ['ok=false', 'cacheSafe=false', 'appSyncEnvelope.decision.shouldKeepPreviousSnapshot=true'],
      safeFallbackOrder: ['appMobileSnapshot', 'appPayload', 'normalized', 'results'],
    },
  };
}
