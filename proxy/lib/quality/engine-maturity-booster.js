// Camada de maturidade operacional v21.12.28.
// Audita eficiência, precisão, confiabilidade, contrato de app e próximos passos sem I/O externo.

export const VALORAE_ENGINE_MATURITY_BOOSTER_VERSION = '21.12.29-engine-maturity-booster';

function countKeys(v) { return v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).length : 0; }
function arr(v) { return Array.isArray(v) ? v : []; }
function clamp(n, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(Number(n) || 0))); }
function boolScore(v, pts) { return v ? pts : 0; }
function rootList(payload) { return Object.keys(payload || {}).filter(k => payload[k] !== undefined); }
function byteSize(value) { try { return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8'); } catch { return 0; } }
function sourceStats(payload = {}) {
  const tried = arr(payload.metrics?.sourcesTried);
  const ok = tried.filter(s => s?.ok || (Number(s?.status || 0) >= 200 && Number(s?.status || 0) < 400));
  const blocked = tried.filter(s => s?.blocked || [401, 403, 429].includes(Number(s?.status || 0)));
  const failed = tried.length - ok.length;
  return { tried: tried.length, ok: ok.length, blocked: blocked.length, failed: Math.max(0, failed), providers: [...new Set(tried.map(s => s.provider || s.name).filter(Boolean))] };
}
function recommendations(payload = {}, scores = {}, signals = {}) {
  const out = [];
  if (scores.performance < 75) out.push({ level: 'warn', area: 'performance', title: 'Reduzir peso por padrão', action: 'Use view=app/compact para APK/Web e deixe full/debug apenas para auditoria.' });
  if (scores.precision < 75) out.push({ level: 'warn', area: 'precision', title: 'Aumentar cobertura de indicadores', action: 'Priorize os campos críticos ausentes em assetIndicatorCoverage.missingCriticalFields.' });
  if (scores.reliability < 75) out.push({ level: 'warn', area: 'reliability', title: 'Fonte parcial ou bloqueada', action: 'Mantenha stale-if-error, Yahoo fallback e mensagem explícita de dados parciais no app.' });
  if (!signals.renderSafe) out.push({ level: 'warn', area: 'app', title: 'Não substituir snapshot bom', action: 'O app deve manter o último appMobileSnapshot válido até renderSafe/cacheSafe voltar.' });
  if (!payload.assetIndicatorCoverage) out.push({ level: 'info', area: 'taxonomy', title: 'Cobertura por indicador ausente', action: 'Ative assetIndicatorCoverage para páginas financeiras e monitor.' });
  if (!out.length) out.push({ level: 'ok', area: 'release', title: 'Contrato saudável para uso pessoal', action: 'Pode continuar com lançamento controlado e monitorar proxyOutputMonitor.' });
  return out;
}

export function buildEngineMaturityBooster(payload = {}, assemblyPlan = {}, runtimeStats = {}, options = {}) {
  const roots = rootList(payload);
  const normalizedCount = Math.max(0, countKeys(payload.normalized) - (payload.normalized?._meta ? 1 : 0));
  const appMetricCount = countKeys(payload.appPayload?.metrics?.canonical);
  const charts = arr(payload.chartSeries?.series || payload.appPayload?.charts?.series);
  const chartPoints = charts.reduce((n, s) => n + arr(s?.points || s?.data || s?.values).length, 0);
  const source = sourceStats(payload);
  const indicator = payload.assetIndicatorCoverage || {};
  const renderSafe = payload.appResponseIntegrity?.renderSafe ?? payload.appDataContract?.renderSafe ?? false;
  const cacheSafe = payload.appResponseIntegrity?.cacheSafe ?? payload.appDataContract?.canReplacePreviousSnapshot ?? false;
  const estimatedPayloadBytes = Number(payload.payloadBudget?.totalBytesApprox || 0) || byteSize({ appPayload: payload.appPayload, appMobileSnapshot: payload.appMobileSnapshot, appSyncEnvelope: payload.appSyncEnvelope, appResponseIntegrity: payload.appResponseIntegrity, assetClassContract: payload.assetClassContract, assetIndicatorCoverage: payload.assetIndicatorCoverage });
  const consistencyScore = Number(payload.fieldConsistencyGuard?.score || 0);
  const consistencyPenalty = payload.fieldConsistencyGuard?.issueCounts?.errors ? 12 : payload.fieldConsistencyGuard?.issueCounts?.warnings ? 4 : 0;
  const view = assemblyPlan.resolvedView || options.view || 'full';
  const compact = /app|compact|mobile|watchlist|list|instant|fast/.test(String(view));
  const performance = clamp(45 + boolScore(compact, 16) + boolScore(payload.appMobileSnapshot, 12) + boolScore(payload.appSyncEnvelope, 8) + Math.min(14, normalizedCount) + Math.min(8, charts.length * 2) - Math.max(0, roots.length - 42) * 1.2 - (estimatedPayloadBytes > 240000 ? 12 : 0));
  const precision = clamp(35 + Math.min(30, normalizedCount * 3) + Math.min(25, Number(indicator.criticalCompletenessPercent || 0) * 0.25) + boolScore(payload.assetClassContract?.fieldConfidence, 8) + Math.min(8, consistencyScore * 0.08) - consistencyPenalty - arr(payload.engineEfficiency?.precision?.issues).length * 4);
  const reliability = clamp(42 + boolScore(source.ok > 0, 20) + boolScore(payload.cacheStatus && !/ERROR/i.test(payload.cacheStatus), 10) + boolScore(!payload.partial, 12) - source.blocked * 10 - arr(payload.warnings).length * 2);
  const appSync = clamp(30 + boolScore(payload.appPayload, 15) + boolScore(payload.appMobileSnapshot, 15) + boolScore(payload.appSyncEnvelope, 14) + boolScore(renderSafe, 14) + boolScore(cacheSafe, 8) + boolScore(payload.appResponseIntegrity?.ok, 4));
  const overall = clamp(performance * 0.28 + precision * 0.26 + reliability * 0.22 + appSync * 0.24);
  const scores = { overall, performance, precision, reliability, appSync };
  const signals = { renderSafe, cacheSafe, compact, rootCount: roots.length, normalizedCount, appMetricCount, chartSeries: charts.length, chartPoints, source, estimatedPayloadBytes, consistencyScore, payloadBudgetState: payload.payloadBudget?.state, assetActionDecision: payload.assetActionPlan?.releaseDecision };
  return {
    version: VALORAE_ENGINE_MATURITY_BOOSTER_VERSION,
    generatedAt: payload.metrics?.generatedAt || new Date().toISOString(),
    ticker: payload.ticker,
    type: payload.type,
    status: payload.status,
    view,
    mode: assemblyPlan.mode || 'unknown',
    grade: overall >= 88 ? 'A' : overall >= 78 ? 'B' : overall >= 65 ? 'C' : 'D',
    scores,
    signals,
    processingPlan: {
      policy: 'montagem por view + contratos leves para app/mobile + auditoria completa só em full/debug',
      preferredAppRoot: compact ? 'appMobileSnapshot' : 'appPayload',
      cachePolicy: 'memory-lru + stale-if-error + inflight coalescing',
      paidDependencies: false,
      preserveCoreFile: 'lib/Valorae-engine.js permanece como núcleo central'
    },
    bottlenecks: [
      estimatedPayloadBytes > 240000 ? { area: 'payload', severity: 'warn', message: 'Payload de app está acima do ideal para mobile.' } : null,
      source.blocked ? { area: 'source', severity: 'warn', message: `${source.blocked} tentativa(s) bloqueada(s) por fonte externa.` } : null,
      payload.partial ? { area: 'data', severity: 'warn', message: 'Resposta parcial; app deve mostrar banner e manter cache bom.' } : null,
      Number(indicator.criticalCompletenessPercent || 100) < 55 ? { area: 'indicators', severity: 'warn', message: 'Cobertura de campos críticos abaixo do ideal para esta classe de ativo.' } : null,
      payload.fieldConsistencyGuard?.issueCounts?.total ? { area: 'consistency', severity: payload.fieldConsistencyGuard.issueCounts.errors ? 'error' : 'warn', message: `${payload.fieldConsistencyGuard.issueCounts.total} campo(s) com consistência suspeita.` } : null,
      payload.payloadBudget?.state === 'heavy_debug_only' ? { area: 'payload', severity: 'warn', message: 'Payload completo pesado; preferir view=app/compact para apps.' } : null,
    ].filter(Boolean),
    recommendations: recommendations(payload, scores, signals),
  };
}
