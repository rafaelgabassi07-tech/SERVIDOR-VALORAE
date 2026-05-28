import { createHash } from 'node:crypto';

// Envelope de sincronização para APK/Web.
// Objetivo: transformar o payload enriquecido em um conjunto pequeno e estável de decisões
// para hidratação, cache local, substituição de snapshot e renderização incremental.

export const VALORAE_APP_SYNC_ENVELOPE_VERSION = '21.12.8-app-sync-envelope';

const FIRST_PAINT_PATHS = [
  { key: 'quote', path: 'appPayload.quote', fallbackPaths: ['appPayload.metrics.canonical.precoAtual', 'normalized.precoAtual'] },
  { key: 'metrics', path: 'appPayload.metrics.canonical', fallbackPaths: ['appRenderContract.metricGroups', 'normalized'] },
  { key: 'charts', path: 'appPayload.charts.series', fallbackPaths: ['chartSeries.series'] },
  { key: 'dividends', path: 'appPayload.dividends', fallbackPaths: ['results.dividendos', 'results.historicoDividendos'] },
  { key: 'source', path: 'appPayload.source', fallbackPaths: ['sourceReport', 'consumerDiagnostics'] },
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

function clampPercent(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    if (['generatedAt', 'totalTimeMs', 'runtime', 'requestId', 'debug'].includes(key)) return acc;
    acc[key] = stableSort(value[key]);
    return acc;
  }, {});
}

function stableHash(value) {
  const json = JSON.stringify(stableSort(value));
  return createHash('sha256').update(json).digest('hex').slice(0, 24);
}

function approxBytes(value) {
  try { return Buffer.byteLength(JSON.stringify(value || {})); }
  catch { return 0; }
}

function resolvePathStatus(payload = {}, item = {}) {
  const primaryValue = get(payload, item.path);
  const fallback = (item.fallbackPaths || []).find(path => present(get(payload, path)));
  const ready = present(primaryValue) || Boolean(fallback);
  return {
    key: item.key,
    ready,
    primaryPath: item.path,
    usedPath: present(primaryValue) ? item.path : (fallback || null),
    fallbackPaths: item.fallbackPaths || [],
  };
}

function buildFirstPaint(payload = {}) {
  const paths = FIRST_PAINT_PATHS.map(item => resolvePathStatus(payload, item));
  const readyCount = paths.filter(p => p.ready).length;
  const criticalReady = paths.some(p => p.key === 'quote' && p.ready) || paths.some(p => p.key === 'metrics' && p.ready);
  return {
    ready: criticalReady && readyCount >= 2,
    readyCount,
    total: paths.length,
    completenessPercent: clampPercent((readyCount / Math.max(1, paths.length)) * 100),
    paths,
  };
}

function buildDecision(payload = {}, firstPaint = {}) {
  const contract = payload.appDataContract || {};
  const score = clampPercent(contract.score ?? payload.consumerDiagnostics?.captureScore ?? payload.valoraeScore?.score ?? 0);
  const stale = Boolean(contract.freshness?.isStale || /STALE/i.test(String(payload.cacheStatus || '')));
  const partial = Boolean(payload.partial || payload.status === 'PARTIAL');
  const renderSafe = Boolean(contract.renderSafe || firstPaint.ready);
  const canReplace = Boolean(contract.canReplacePreviousSnapshot && !stale && !partial);

  let action = 'render_partial_keep_previous';
  if (canReplace && score >= 70) action = 'replace_snapshot';
  else if (renderSafe && firstPaint.ready) action = partial || stale ? 'merge_with_previous_snapshot' : 'render_without_replacing_snapshot';
  else if (stale) action = 'keep_previous_show_stale_badge';
  else action = 'keep_previous_show_empty_state';

  return {
    action,
    renderSafe,
    canReplacePreviousSnapshot: canReplace,
    shouldKeepPreviousSnapshot: !canReplace,
    shouldShowPartialBanner: Boolean(partial || stale || score < 75 || contract.uiGuards?.showPartialBanner),
    reasonCodes: [
      partial ? 'PARTIAL_PAYLOAD' : null,
      stale ? 'STALE_CACHE' : null,
      !firstPaint.ready ? 'FIRST_PAINT_INCOMPLETE' : null,
      score < 70 ? 'LOW_CONTRACT_SCORE' : null,
    ].filter(Boolean),
    score,
  };
}

function buildHydration(payload = {}, firstPaint = {}) {
  return {
    preferredRoot: 'appPayload',
    firstPaintPath: 'appSyncEnvelope.firstPaint.paths',
    stablePaths: [
      'appPayload.quote',
      'appPayload.metrics.canonical',
      'appRenderContract.metricGroups',
      'appPayload.charts.series',
      'appPayload.dividends',
      'appDataContract.fieldMap',
    ],
    lazyPaths: [
      'results',
      'normalized',
      'chartSeries',
      'consumerDiagnostics',
      'sourceReliability',
      'quality',
    ],
    missingFirstPaintKeys: firstPaint.paths.filter(p => !p.ready).map(p => p.key),
    neverClearPreviousDataBeforeHydration: true,
  };
}

function buildCacheIdentity(payload = {}) {
  const appPayload = payload.appPayload || {};
  const renderContract = payload.appRenderContract || {};
  const dataContract = payload.appDataContract || {};
  const hashBasis = {
    ticker: payload.ticker,
    type: payload.type,
    status: payload.status,
    quote: appPayload.quote,
    metrics: appPayload.metrics?.canonical,
    charts: appPayload.charts?.series?.map(s => ({ key: s.key, pointCount: s.pointCount, summary: s.summary })),
    dividends: appPayload.dividends?.historyCount,
    renderState: renderContract.renderState,
    score: dataContract.score,
    issues: dataContract.issues?.map(i => i.code),
  };
  return {
    syncKey: `${payload.ticker || 'UNKNOWN'}:${payload.type || 'UNKNOWN'}:asset`,
    payloadHash: stableHash(hashBasis),
    appPayloadHash: stableHash(appPayload),
    dataContractHash: stableHash(dataContract),
    compareStrategy: 'replace_when_payloadHash_changes_and_decision_allows',
  };
}

function buildTransport(payload = {}) {
  return {
    cacheStatus: payload.cacheStatus || payload.appDataContract?.freshness?.cacheStatus || null,
    badge: payload.appDataContract?.freshness?.badge || null,
    primarySource: payload.appPayload?.source?.primary || payload.sourceReport?.primarySource || null,
    sourcesUsed: payload.appPayload?.source?.sourcesUsed || payload.sourceReport?.sourcesUsed || [],
    resultBytesApprox: approxBytes(payload),
    appPayloadBytesApprox: approxBytes(payload.appPayload),
    compactRecommended: approxBytes(payload) > 500_000,
  };
}

export function buildAppSyncEnvelope(payload = {}) {
  const firstPaint = buildFirstPaint(payload);
  const decision = buildDecision(payload, firstPaint);
  const identity = buildCacheIdentity(payload);
  return {
    version: VALORAE_APP_SYNC_ENVELOPE_VERSION,
    generatedAt: payload.metrics?.generatedAt || payload.appPayload?.generatedAt || new Date().toISOString(),
    ticker: payload.ticker,
    type: payload.type,
    status: payload.status,
    syncKey: identity.syncKey,
    identity,
    decision,
    firstPaint,
    hydration: buildHydration(payload, firstPaint),
    transport: buildTransport(payload),
    polling: {
      recommendedTtlMs: decision.action === 'replace_snapshot' ? 300000 : decision.shouldShowPartialBanner ? 60000 : 180000,
      backgroundRefreshAllowed: true,
      retryWhen: ['SOURCE_BLOCKED_OR_LIMITED', 'FIRST_PAINT_INCOMPLETE', 'LOW_CONTRACT_SCORE'],
    },
    appInstructions: {
      useThisEnvelopeBeforeReplacingLocalCache: true,
      compareHashPath: 'appSyncEnvelope.identity.payloadHash',
      decisionPath: 'appSyncEnvelope.decision.action',
      keepPreviousSnapshotWhen: ['decision.shouldKeepPreviousSnapshot=true', 'firstPaint.ready=false'],
    },
  };
}
