// Plano de ação do ativo v21.12.29.
// Traduz cobertura, maturidade, consistência e integridade em decisões simples para app/monitor.

export const VALORAE_ASSET_ACTION_PLAN_VERSION = '21.12.29-asset-action-plan';

function arr(v) { return Array.isArray(v) ? v : []; }
function clamp(n, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(Number(n) || 0))); }
function scoreOf(payload = {}) {
  const maturity = Number(payload.engineMaturityBooster?.scores?.overall || 0);
  const indicator = Number(payload.assetIndicatorCoverage?.criticalCompletenessPercent || payload.assetIndicatorCoverage?.completenessPercent || 0);
  const integrity = Number(payload.appResponseIntegrity?.score || 0);
  const guard = Number(payload.fieldConsistencyGuard?.score || 0);
  const quality = Number(payload.quality?.score || payload.valoraeScore?.score || 0);
  const values = [maturity, indicator, integrity, guard, quality].filter(n => Number.isFinite(n) && n > 0);
  return values.length ? clamp(values.reduce((a, b) => a + b, 0) / values.length) : 0;
}
function decision(payload = {}, score = 0) {
  const guard = payload.fieldConsistencyGuard || {};
  if (payload.status === 'ERROR') return 'show_error_keep_previous_snapshot';
  if (guard.appPolicy?.replaceSnapshotAllowed === false && guard.issueCounts?.errors) return 'render_with_quality_badge_keep_previous_snapshot';
  if (payload.appResponseIntegrity?.cacheSafe === false || payload.appDataContract?.canReplacePreviousSnapshot === false) return 'render_partial_without_replacing_cache';
  if (payload.partial || score < 65) return 'render_partial_with_banner';
  if (score >= 82) return 'render_full_replace_snapshot';
  return 'render_safe_with_minor_warnings';
}
function priorityActions(payload = {}) {
  const out = [];
  const missing = arr(payload.assetIndicatorCoverage?.missingCriticalFields);
  if (missing.length) out.push({ priority: 'high', area: 'coverage', title: 'Completar campos críticos', detail: missing.slice(0, 8).join(', '), endpoint: `/api/v1/asset/indicators?ticker=${encodeURIComponent(payload.ticker || '')}` });
  if (arr(payload.fieldConsistencyGuard?.issues).length) out.push({ priority: 'high', area: 'precision', title: 'Revisar campos suspeitos', detail: `${payload.fieldConsistencyGuard.issueCounts?.total || 0} inconsistência(s) detectada(s)`, endpoint: `/api/v1/asset/quality?ticker=${encodeURIComponent(payload.ticker || '')}` });
  if (payload.partial) out.push({ priority: 'medium', area: 'source', title: 'Resposta parcial', detail: 'Manter snapshot anterior e mostrar aviso de fonte parcial.', endpoint: '/api/v1/source/status' });
  if (!payload.appMobileSnapshot) out.push({ priority: 'medium', area: 'app', title: 'Snapshot mobile ausente', detail: 'Gerar appMobileSnapshot antes de usar em watchlist/listas.', endpoint: `/api/v1/asset?ticker=${encodeURIComponent(payload.ticker || '')}&view=app` });
  if (!out.length) out.push({ priority: 'ok', area: 'release', title: 'Pronto para uso controlado', detail: 'Contrato suficiente para renderização e cache local do app.', endpoint: `/api/v1/asset?ticker=${encodeURIComponent(payload.ticker || '')}&view=app` });
  return out;
}

export function buildAssetActionPlan(payload = {}) {
  const score = scoreOf(payload);
  const releaseDecision = decision(payload, score);
  const type = payload.type === 'FII' ? 'fii' : 'asset';
  const ticker = encodeURIComponent(payload.ticker || '');
  return {
    version: VALORAE_ASSET_ACTION_PLAN_VERSION,
    generatedAt: payload.metrics?.generatedAt || new Date().toISOString(),
    ticker: payload.ticker,
    type: payload.type,
    score,
    grade: score >= 88 ? 'A' : score >= 78 ? 'B' : score >= 65 ? 'C' : 'D',
    releaseDecision,
    appInstructions: {
      firstPaint: 'appMobileSnapshot',
      hydrate: 'appPayload',
      cacheDecision: 'appSyncEnvelope.decision',
      qualityBadge: payload.fieldConsistencyGuard?.appPolicy?.recommendedBadge || (payload.partial ? 'dados_parciais' : 'dados_ok'),
      banner: releaseDecision.includes('partial') || releaseDecision.includes('quality') ? 'Mostrar aviso discreto de dados parciais/revisão.' : 'Sem banner obrigatório.',
    },
    suggestedPages: payload.type === 'FII'
      ? ['Resumo', 'Rendimentos', 'Patrimônio', 'Vacância', 'Portfólio', 'Comunicados']
      : ['Resumo', 'Valuation', 'Rentabilidade', 'Endividamento', 'Dividendos', 'Demonstrativos'],
    nextEndpoints: {
      app: `/api/v1/asset?ticker=${ticker}&view=app`,
      quality: `/api/v1/asset/quality?ticker=${ticker}`,
      actionPlan: `/api/v1/asset/action-plan?ticker=${ticker}`,
      indicators: `/api/v1/${type}/indicators?ticker=${ticker}`,
      profile: `/api/v1/${type}/profile?ticker=${ticker}`,
      sourceMap: `/api/v1/asset/source-map?ticker=${ticker}`,
    },
    priorityActions: priorityActions(payload),
  };
}
