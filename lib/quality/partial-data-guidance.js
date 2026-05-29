// Orientação operacional para respostas financeiras PARTIAL.
// Mantém o app utilizável sem apagar o último snapshot bom quando fontes públicas falham.

export const VALORAE_PARTIAL_DATA_GUIDANCE_VERSION = '21.12.38-partial-data-guidance';

function compactReason(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 180);
  if (typeof value === 'object') return String(value.error || value.message || value.code || value.status || '').slice(0, 180);
  return String(value).slice(0, 180);
}

function collectReasons(payload = {}) {
  const reasons = [];
  if (payload.error) reasons.push(compactReason(payload.error));
  if (payload.sourceError) reasons.push(compactReason(payload.sourceError));
  if (payload.network?.refreshErrorType) reasons.push(`network:${payload.network.refreshErrorType}`);
  if (payload.fieldConsistencyGuard?.state) reasons.push(`fieldConsistency:${payload.fieldConsistencyGuard.state}`);
  if (Array.isArray(payload.appResponseIntegrity?.issues)) {
    for (const issue of payload.appResponseIntegrity.issues.slice(0, 5)) reasons.push(compactReason(issue.code || issue.title || issue.message));
  }
  if (Array.isArray(payload.attempts)) {
    for (const attempt of payload.attempts.filter(a => a && a.ok === false).slice(-4)) {
      reasons.push(`${attempt.provider || 'source'}:${attempt.status || 0}:${compactReason(attempt.error || attempt.classification || attempt.type)}`);
    }
  }
  return [...new Set(reasons.filter(Boolean))].slice(0, 8);
}

export function isPartialFinancialPayload(payload = {}) {
  const status = String(payload?.status || '').toUpperCase();
  return Boolean(payload?.partial) || status === 'PARTIAL' || status === 'DEGRADED';
}

export function attachPartialDataGuidance(payload, context = {}) {
  if (!payload || typeof payload !== 'object' || !isPartialFinancialPayload(payload)) return payload;
  const ticker = context.ticker || payload.ticker || payload.symbol || '';
  const endpoint = context.endpoint || payload.endpoint || 'asset';
  const renderSafe = payload.appRenderContract?.renderSafe !== false && payload.appResponseIntegrity?.renderSafe !== false;
  const cacheSafe = payload.appResponseIntegrity?.cacheSafe === true || payload.appDataContract?.canReplacePreviousSnapshot === true;
  const reasons = collectReasons(payload);
  payload.partialDataGuidance = {
    version: VALORAE_PARTIAL_DATA_GUIDANCE_VERSION,
    state: 'PARTIAL_SOURCE_DATA',
    severity: 'warning',
    ticker,
    endpoint,
    message: 'A resposta foi entregue em modo parcial porque uma ou mais fontes públicas não forneceram todos os campos a tempo. Isso não deve limpar a tela do app.',
    appAction: cacheSafe ? 'merge_with_previous_snapshot' : 'keep_previous_snapshot_and_render_available_fields',
    canRenderAvailableFields: renderSafe,
    canReplacePreviousSnapshot: cacheSafe,
    shouldShowPartialBanner: true,
    retryPolicy: {
      suggestedDelayMs: 30000,
      useSameEndpoint: true,
      keepViewApp: true,
      avoidDeepProfileOnMobile: true,
    },
    diagnostics: {
      sourceStatusEndpoint: '/api/v1/source/status',
      actionPlanEndpoint: ticker ? `/api/v1/asset/action-plan?ticker=${encodeURIComponent(ticker)}` : '/api/v1/asset/action-plan?ticker=PETR4',
      fieldsGuideEndpoint: '/api/fields',
      reasons,
    },
    checkedAt: new Date().toISOString(),
  };
  return payload;
}
