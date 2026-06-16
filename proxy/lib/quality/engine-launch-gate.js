// Gate final de lançamento pessoal por resposta do VALORAE Engine.
// Consolida maturidade, consistência, orçamento, ação e integridade em uma decisão simples para o app/monitor.

export const VALORAE_ENGINE_LAUNCH_GATE_VERSION = '21.12.32-engine-launch-gate';

function clamp(n, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(Number(n) || 0))); }
function arr(v) { return Array.isArray(v) ? v : []; }
function scoreOf(v, fallback = 0) { return Number.isFinite(Number(v)) ? Number(v) : fallback; }
function grade(score) { return score >= 88 ? 'A' : score >= 78 ? 'B' : score >= 66 ? 'C' : 'D'; }

function collectBlockers(payload = {}, scores = {}) {
  const blockers = [];
  if (payload.status === 'ERROR') blockers.push({ level: 'error', code: 'status_error', message: 'Resposta em erro; não renderizar como dado novo.' });
  if (payload.appResponseIntegrity && payload.appResponseIntegrity.renderSafe === false) blockers.push({ level: 'warn', code: 'render_not_safe', message: 'Integridade recomenda não substituir a tela atual.' });
  if (payload.appResponseIntegrity && payload.appResponseIntegrity.cacheSafe === false) blockers.push({ level: 'warn', code: 'cache_not_safe', message: 'Cache local não deve ser substituído por este payload.' });
  if (payload.fieldConsistencyGuard?.issueCounts?.errors) blockers.push({ level: 'error', code: 'field_consistency_errors', message: 'Há campos financeiros com inconsistência crítica.' });
  if (String(payload.payloadBudget?.state || '').includes('heavy')) blockers.push({ level: 'warn', code: 'payload_heavy', message: 'Payload pesado; usar view=app/compact para apps.' });
  if (scores.runtime < 55) blockers.push({ level: 'warn', code: 'runtime_slow', message: 'Runtime abaixo do ideal; verificar etapas lentas no profiler.' });
  if (scores.coverage < 45) blockers.push({ level: 'warn', code: 'coverage_low', message: 'Cobertura de indicadores baixa para esta classe de ativo.' });
  return blockers;
}

function decisionFrom(score, blockers = [], payload = {}) {
  if (blockers.some(b => b.level === 'error')) return 'hold_previous_snapshot';
  if (payload.status === 'PARTIAL' || payload.partial || blockers.length) return score >= 72 ? 'render_partial_with_banner' : 'render_readonly_keep_cache';
  if (score >= 80) return 'release_to_app';
  return 'release_controlled_with_monitoring';
}

export function buildEngineLaunchGate(payload = {}, options = {}) {
  const scores = {
    maturity: scoreOf(payload.engineMaturityBooster?.scores?.overall, scoreOf(payload.quality?.score, 0)),
    runtime: scoreOf(payload.engineRuntimeProfiler?.score, 70),
    integrity: scoreOf(payload.appResponseIntegrity?.score, 0),
    consistency: scoreOf(payload.fieldConsistencyGuard?.score, 0),
    payload: payload.payloadBudget?.state === 'excellent_mobile' ? 96 : payload.payloadBudget?.state === 'good_app' ? 88 : payload.payloadBudget?.state === 'acceptable_detail' ? 74 : 58,
    coverage: scoreOf(payload.assetIndicatorCoverage?.criticalCompletenessPercent, scoreOf(payload.assetIndicatorCoverage?.completenessPercent, 0)),
    action: scoreOf(payload.assetActionPlan?.score, 0),
  };
  const overall = clamp(scores.maturity * 0.18 + scores.runtime * 0.16 + scores.integrity * 0.18 + scores.consistency * 0.14 + scores.payload * 0.12 + scores.coverage * 0.12 + scores.action * 0.10);
  const blockers = collectBlockers(payload, scores);
  const decision = decisionFrom(overall, blockers, payload);
  return {
    version: VALORAE_ENGINE_LAUNCH_GATE_VERSION,
    generatedAt: payload.metrics?.generatedAt || new Date().toISOString(),
    ticker: payload.ticker,
    type: payload.type,
    view: payload.view || options.view || 'full',
    status: payload.status,
    grade: grade(overall),
    score: overall,
    readyForPersonalUse: ['release_to_app', 'release_controlled_with_monitoring', 'render_partial_with_banner'].includes(decision),
    decision,
    scores,
    blockers,
    appRules: {
      firstPaint: 'appMobileSnapshot',
      hydrate: 'appPayload',
      cacheDecision: 'appSyncEnvelope',
      safety: 'appResponseIntegrity',
      neverBlank: true,
      keepPreviousWhen: ['status=ERROR', 'renderSafe=false', 'cacheSafe=false', 'fieldConsistencyGuard.errors>0'],
    },
    launchChecklist: [
      { key: 'view_app', ok: /app|compact|mobile|watchlist|list/.test(String(payload.view || options.view || '')), label: 'Usar view=app/compact nos apps.' },
      { key: 'snapshot', ok: Boolean(payload.appMobileSnapshot), label: 'Snapshot mobile presente.' },
      { key: 'integrity', ok: payload.appResponseIntegrity?.renderSafe !== false, label: 'Renderização segura.' },
      { key: 'cache', ok: payload.appResponseIntegrity?.cacheSafe !== false, label: 'Cache local seguro.' },
      { key: 'payload', ok: !String(payload.payloadBudget?.state || '').includes('heavy'), label: 'Payload dentro do orçamento.' },
      { key: 'consistency', ok: !payload.fieldConsistencyGuard?.issueCounts?.errors, label: 'Sem inconsistência crítica de campos.' },
      { key: 'runtime', ok: scores.runtime >= 60, label: 'Runtime dentro do aceitável.' },
    ],
    nextBestActions: [
      ...arr(payload.engineRuntimeProfiler?.recommendations).slice(0, 3),
      ...arr(payload.engineMaturityBooster?.recommendations).slice(0, 3),
      ...arr(payload.assetActionPlan?.priorityActions).slice(0, 3),
    ].slice(0, 8),
  };
}

export function compactEngineLaunchGate(gate = {}) {
  if (!gate || typeof gate !== 'object') return undefined;
  return {
    version: gate.version,
    grade: gate.grade,
    score: gate.score,
    readyForPersonalUse: gate.readyForPersonalUse,
    decision: gate.decision,
    blockers: arr(gate.blockers).slice(0, 5),
    appRules: gate.appRules,
    launchChecklist: arr(gate.launchChecklist),
  };
}
