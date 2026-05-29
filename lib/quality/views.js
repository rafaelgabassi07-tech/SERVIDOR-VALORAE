import { buildOfficialAppView } from './app-official-view.js';

function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
function pick(obj, keys) { const out = {}; for (const k of keys) if (obj?.[k] !== undefined) out[k] = obj[k]; return out; }

export const VALORAE_VIEW_ALIASES_VERSION = '21.12.11-mobile-safe-payload-views';

export const VIEW_ALIASES = Object.freeze({
  instant: 'compact',
  ultra: 'compact',
  tiny: 'compact',
  quote: 'compact',
  card: 'compact',
  mobile: 'compact',
  snapshot: 'compact',
  sync: 'compact',
  compact: 'compact',
  wallet: 'standard',
  portfolio: 'standard',
  list: 'compact',
  watchlist: 'compact',
  app: 'app',
  production: 'app',
  launch: 'app',
  public: 'app',
  standard: 'standard',
  detail: 'full',
  detailed: 'full',
  analysis: 'full',
  full: 'full',
});

const HEAVY_QUALITY_ROOTS = [
  'validation',
  'quality',
  'fieldConfidence',
  'dataQualityMatrix',
  'sourceReliability',
  'schemaStability',
  'valoraeScore',
];

const COMPACT_HEAVY_ROOTS = [
  'chartReadiness',
  'chartSeries',
  'panelReadiness',
  'consumerDiagnostics',
  'appRenderContract',
  'appDataContract',
  'dividendStats',
  'performance',
];

function approxBytes(value) {
  try { return Buffer.byteLength(JSON.stringify(value || {})); }
  catch { return 0; }
}

function compactIntegrity(integrity = {}) {
  if (!integrity || typeof integrity !== 'object') return integrity;
  return {
    version: integrity.version,
    ok: integrity.ok,
    score: integrity.score,
    renderSafe: integrity.renderSafe,
    cacheSafe: integrity.cacheSafe,
    issueCounts: integrity.issueCounts,
    recommendedAction: integrity.recommendedAction,
    topIssues: Array.isArray(integrity.issues) ? integrity.issues.slice(0, 5) : [],
  };
}

function compactSyncEnvelope(sync = {}) {
  if (!sync || typeof sync !== 'object') return sync;
  return {
    version: sync.version,
    generatedAt: sync.generatedAt,
    ticker: sync.ticker,
    type: sync.type,
    status: sync.status,
    syncKey: sync.syncKey,
    identity: sync.identity,
    decision: sync.decision,
    firstPaint: sync.firstPaint,
    transport: sync.transport,
    polling: sync.polling,
    appInstructions: sync.appInstructions,
  };
}

function compactAppPayload(appPayload = {}) {
  if (!appPayload || typeof appPayload !== 'object') return appPayload;
  const charts = appPayload.charts && typeof appPayload.charts === 'object' ? {
    count: appPayload.charts.count,
    bestPointCount: appPayload.charts.bestPointCount,
    hasOhlc: appPayload.charts.hasOhlc,
    preferredPath: appPayload.charts.preferredPath,
    fallbackPath: appPayload.charts.fallbackPath,
    // No view compact, o app deve usar appMobileSnapshot.charts para primeira pintura.
    seriesPreview: Array.isArray(appPayload.charts.series) ? appPayload.charts.series.slice(0, 3).map(s => ({
      key: s.key,
      label: s.label,
      type: s.type,
      pointCount: s.pointCount,
      sampled: true,
      points: Array.isArray(s.points) ? s.points.slice(-12) : undefined,
      summary: s.summary,
    })) : [],
  } : undefined;
  return {
    version: appPayload.version,
    generatedAt: appPayload.generatedAt,
    ticker: appPayload.ticker,
    type: appPayload.type,
    status: appPayload.status,
    quote: appPayload.quote,
    metrics: appPayload.metrics,
    panels: appPayload.panels,
    charts,
    dividends: appPayload.dividends,
    source: appPayload.source,
    blankShield: appPayload.blankShield,
    consumerContract: appPayload.consumerContract,
  };
}

function attachViewProfile(payload = {}, resolution = {}, beforeBytes = 0, removed = []) {
  const afterBytes = approxBytes(payload);
  payload.payloadViewProfile = {
    version: VALORAE_VIEW_ALIASES_VERSION,
    requested: resolution.requested,
    resolved: resolution.resolved,
    aliased: resolution.aliased,
    beforeBytesApprox: beforeBytes,
    afterBytesApprox: afterBytes,
    reductionPercent: beforeBytes ? Math.max(0, Math.min(100, Math.round((1 - afterBytes / beforeBytes) * 100))) : 0,
    removedRoots: removed,
    appPreferredFirstPaintRoot: payload.appMobileSnapshot ? 'appMobileSnapshot' : 'appPayload',
    notes: payload.view === 'compact'
      ? ['compact preserva appMobileSnapshot/appSyncEnvelope e remove diagnósticos pesados para listas, cards e primeira pintura mobile']
      : payload.view === 'standard'
        ? ['standard mantém contratos do app e remove apenas debug/diagnósticos pesados quando includeQuality=false']
        : ['full preserva payload completo'],
  };
  return payload;
}

function removeRoots(payload = {}, roots = []) {
  const removed = [];
  for (const root of roots) {
    if (payload[root] !== undefined) {
      delete payload[root];
      removed.push(root);
    }
  }
  return removed;
}

export function resolvePayloadView(view = 'full') {
  const requested = String(view || 'full').toLowerCase().trim();
  const resolved = VIEW_ALIASES[requested] || 'full';
  return {
    requested,
    resolved,
    aliased: requested !== resolved,
    supported: Object.prototype.hasOwnProperty.call(VIEW_ALIASES, requested),
  };
}

export function applyPayloadView(payload = {}, view = 'full', options = {}) {
  const resolution = resolvePayloadView(view);
  const p = clone(payload);
  const beforeBytes = approxBytes(p);
  p.view = resolution.resolved;
  p.requestedView = resolution.requested;
  if (resolution.aliased) p.viewAlias = { requested: resolution.requested, resolved: resolution.resolved };
  if (p.view === 'app') return attachViewProfile(buildOfficialAppView(p), resolution, beforeBytes, ['results','chartSeries','chartReadiness','panelReadiness','consumerDiagnostics','appRenderContract','appDataContract','dividendStats','performance','debug','fieldConfidence','dataQualityMatrix','sourceReliability','schemaStability','validation']);
  if (p.view === 'full') return attachViewProfile(p, resolution, beforeBytes, []);

  const r = p.results || {};
  const common = ['nome','sobre','cotacao','indicadores','precoAtual','variacaoDay','variacao12m','dividendYield','dyMedio5a','pvp','pl','valorPatrimonial','yield12m','ultimoRendimento'];
  if (p.type === 'FII') {
    p.results = {
      ...pick(r, common),
      informacoesFundo: p.view === 'compact' ? pick(r.informacoesFundo || {}, ['segmento','tipoFundo','mandato','tipoGestao','taxaAdministracao','numeroCotistas']) : r.informacoesFundo,
      valorPatrimonial: r.valorPatrimonial,
      rentabilidade: r.rentabilidade,
      portfolioStats: r.portfolioStats,
      dividendos: p.view === 'compact' ? pick(r.dividendos || {}, ['dividendYield','dyMedio5a','ultimoRendimento','yield12m']) : r.dividendos,
    };
  } else {
    p.results = {
      ...pick(r, common),
      dadosEmpresa: p.view === 'compact' ? pick(r.dadosEmpresa || {}, ['nome','setor','segmento','subsetor']) : r.dadosEmpresa,
      informacoesEmpresa: p.view === 'compact' ? pick(r.informacoesEmpresa || {}, ['valorDeMercado','valorDeFirma','patrimonioLiquido','setor','segmento','liquidezMediaDiaria']) : r.informacoesEmpresa,
      comparativoSetor: p.view === 'compact' ? undefined : r.comparativoSetor,
      financialSummary: r.financialSummary,
      rentabilidade: r.rentabilidade,
      dividendos: p.view === 'compact' ? pick(r.dividendos || {}, ['dividendYield','dyMedio5a','ultimoRendimento']) : r.dividendos,
    };
  }
  Object.keys(p.results).forEach(k => p.results[k] === undefined && delete p.results[k]);

  const removed = [];
  if (p.view === 'compact') {
    delete p.metrics;
    removed.push('metrics');
    delete p.coverage;
    removed.push('coverage');
    if (p.sourceReport?.sourcesTried) delete p.sourceReport.sourcesTried;
    p.appPayload = compactAppPayload(p.appPayload);
    p.appSyncEnvelope = compactSyncEnvelope(p.appSyncEnvelope);
    p.appResponseIntegrity = compactIntegrity(p.appResponseIntegrity);
    removed.push(...removeRoots(p, COMPACT_HEAVY_ROOTS));
    if (!options.includeQuality) removed.push(...removeRoots(p, HEAVY_QUALITY_ROOTS));
    else {
      // Mesmo com qualidade ligada, compact não precisa carregar matrizes completas para primeira pintura.
      removed.push(...removeRoots(p, ['fieldConfidence', 'dataQualityMatrix', 'sourceReliability']));
    }
    delete p.debug;
    removed.push('debug');
    if (Array.isArray(p.news)) p.news = p.news.slice(0, 3);
  } else {
    delete p.debug;
    removed.push('debug');
    if (!options.includeQuality) removed.push(...removeRoots(p, HEAVY_QUALITY_ROOTS));
  }
  return attachViewProfile(p, resolution, beforeBytes, [...new Set(removed.filter(Boolean))]);
}
