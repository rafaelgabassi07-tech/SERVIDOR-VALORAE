// Perfil de runtime do VALORAE Engine v21.12.32.
// Mede etapas de montagem sem I/O extra e gera recomendações de performance para uso pessoal/controlado.

export const VALORAE_ENGINE_RUNTIME_PROFILER_VERSION = '21.12.32-engine-runtime-profiler';

function nowMs() {
  try { return performance.now(); } catch { return Date.now(); }
}
function roundMs(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function clamp(n, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(Number(n) || 0))); }
function arr(v) { return Array.isArray(v) ? v : []; }
function objectKeys(v = {}) { return v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v) : []; }
function approxBytes(value) { try { return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8'); } catch { return 0; } }

const STAGE_TARGETS_MS = Object.freeze({
  'source.investidor10': 8500,
  'source.statusinvest': 6000,
  'source.investidor10InternalApis': 2500,
  'source.yahoo': 1800,
  'postprocess.enrich': 120,
  'news.google': 2500,
  'payload.base': 80,
  'contracts.coreQuality': 160,
  'contracts.chartSeries': 180,
  'contracts.app': 220,
  'guardrails.final': 140,
  'payload.view': 120,
});

function targetForStage(name = '') {
  return STAGE_TARGETS_MS[name] || (/source\./.test(name) ? 5000 : 180);
}

function gradeFromScore(score) {
  if (score >= 90) return 'A+';
  if (score >= 84) return 'A';
  if (score >= 76) return 'B';
  if (score >= 66) return 'C';
  return 'D';
}

function classifyStage(stage = {}) {
  const target = Number(stage.targetMs || targetForStage(stage.name));
  const ratio = target > 0 ? Number(stage.durationMs || 0) / target : 0;
  if (ratio <= 0.45) return 'excellent';
  if (ratio <= 0.8) return 'good';
  if (ratio <= 1.15) return 'watch';
  return 'slow';
}

function recommendations({ stages = [], payload = {}, assemblyPlan = {}, totalMs = 0, payloadBytes = 0 } = {}) {
  const out = [];
  const slow = stages.filter(s => s.state === 'slow').slice(0, 4);
  for (const s of slow) {
    if (/source\./.test(s.name)) out.push({ level: 'warn', area: 'source', title: `${s.name} acima do alvo`, action: 'Usar cache, stale-if-error e ValoraeScrape/self-scrape para reduzir espera de fonte externa.' });
    else if (/chart|contracts/.test(s.name)) out.push({ level: 'warn', area: 'assembly', title: `${s.name} pesado`, action: 'Preferir view=app/compact em APK/Web e full apenas para auditoria.' });
    else out.push({ level: 'info', area: 'runtime', title: `${s.name} deve ser observado`, action: 'Verifique payloadBudget e engineMaturityBooster para decidir compactação.' });
  }
  if (payloadBytes > 180000) out.push({ level: 'warn', area: 'payload', title: 'Payload acima do ideal para mobile', action: 'Manter appMobileSnapshot como primeira pintura e hidratar detalhes sob demanda.' });
  if (payload.partial) out.push({ level: 'warn', area: 'data', title: 'Resposta parcial', action: 'Não substituir último snapshot bom se appResponseIntegrity/cacheSafe estiver falso.' });
  if (String(assemblyPlan.mode || '').includes('full') && /app|compact|mobile|watchlist|list/.test(String(assemblyPlan.resolvedView || ''))) out.push({ level: 'warn', area: 'view', title: 'View mobile com plano pesado', action: 'Confirmar contracts=lite ou view=app para endpoints de produção.' });
  if (totalMs > 12000) out.push({ level: 'warn', area: 'latency', title: 'Tempo total alto', action: 'Reduzir timeout, usar profile=fast e ativar cache de resultado para uso diário.' });
  if (!out.length) out.push({ level: 'ok', area: 'release', title: 'Runtime saudável', action: 'Manter view=app como padrão e monitorar piores etapas no Proxy Monitor.' });
  return out.slice(0, 8);
}

export function createEngineRuntimeProfiler(context = {}) {
  const started = nowMs();
  const stages = [];
  return {
    start(name = 'stage') {
      return { name, at: nowMs() };
    },
    end(token, details = {}) {
      if (!token) return null;
      const durationMs = roundMs(nowMs() - Number(token.at || nowMs()));
      const targetMs = targetForStage(token.name);
      const stage = {
        name: token.name,
        durationMs,
        targetMs,
        state: classifyStage({ name: token.name, durationMs, targetMs }),
        details,
      };
      stages.push(stage);
      return stage;
    },
    report(payload = {}, assemblyPlan = {}, runtimeStats = {}, options = {}) {
      const totalMs = roundMs(nowMs() - started);
      const roots = objectKeys(payload);
      const normalizedCount = objectKeys(payload.normalized).filter(k => k !== '_meta').length;
      const charts = arr(payload.chartSeries?.series || payload.appPayload?.charts?.series || payload.appMobileSnapshot?.charts?.series);
      const payloadBytes = Number(payload.payloadBudget?.totalBytesApprox || 0) || approxBytes({ appPayload: payload.appPayload, appMobileSnapshot: payload.appMobileSnapshot, appSyncEnvelope: payload.appSyncEnvelope, appResponseIntegrity: payload.appResponseIntegrity, assetActionPlan: payload.assetActionPlan, fieldConsistencyGuard: payload.fieldConsistencyGuard });
      const slowStages = stages.filter(s => s.state === 'slow');
      const sourceMs = stages.filter(s => /^source\./.test(s.name)).reduce((n, s) => n + s.durationMs, 0);
      const assemblyMs = Math.max(0, totalMs - sourceMs);
      const compact = /app|compact|mobile|watchlist|list|instant|fast/.test(String(assemblyPlan.resolvedView || options.view || ''));
      const score = clamp(100
        - Math.max(0, totalMs - (compact ? 4500 : 9000)) / (compact ? 120 : 200)
        - slowStages.length * 8
        - (payloadBytes > (compact ? 160000 : 320000) ? 10 : 0)
        - (payload.partial ? 4 : 0));
      return {
        version: VALORAE_ENGINE_RUNTIME_PROFILER_VERSION,
        generatedAt: payload.metrics?.generatedAt || new Date().toISOString(),
        ticker: payload.ticker || context.ticker,
        type: payload.type || context.type,
        view: assemblyPlan.resolvedView || options.view || context.view || 'full',
        profile: assemblyPlan.profile || options.profile || options.performanceProfile || context.profile || 'standard',
        grade: gradeFromScore(score),
        score,
        totalMs,
        sourceMs: roundMs(sourceMs),
        assemblyMs: roundMs(assemblyMs),
        stages,
        slowStages,
        bottlenecks: slowStages.slice(0, 5).map(s => ({ stage: s.name, durationMs: s.durationMs, targetMs: s.targetMs, state: s.state })),
        signals: {
          rootCount: roots.length,
          normalizedCount,
          chartSeries: charts.length,
          payloadBytesApprox: payloadBytes,
          appViewOptimized: compact,
          assemblyMode: assemblyPlan.mode || 'unknown',
          resultCache: payload.metrics?.resultCache || payload.cacheStatus || null,
          runtime: runtimeStats?.runtime || payload.metrics?.runtime?.runtime || null,
        },
        targets: {
          appViewTotalMs: 4500,
          fullViewTotalMs: 9000,
          mobilePayloadBytes: 160000,
          detailPayloadBytes: 320000,
        },
        recommendations: recommendations({ stages, payload, assemblyPlan, totalMs, payloadBytes }),
      };
    }
  };
}

export function compactEngineRuntimeProfiler(profile = {}) {
  if (!profile || typeof profile !== 'object') return undefined;
  return {
    version: profile.version,
    grade: profile.grade,
    score: profile.score,
    totalMs: profile.totalMs,
    sourceMs: profile.sourceMs,
    assemblyMs: profile.assemblyMs,
    bottlenecks: arr(profile.bottlenecks).slice(0, 5),
    signals: profile.signals,
    recommendations: arr(profile.recommendations).slice(0, 5),
  };
}
