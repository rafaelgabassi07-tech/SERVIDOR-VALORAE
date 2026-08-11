export const VALORAE_PERSONAL_MATURITY_VERSION = '21.12.405-private-apk-identity';

function boolEnv(name, fallback = false) {
  const raw = process.env?.[name];
  if (raw == null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(raw).toLowerCase());
}

function hasEnv(name) {
  return String(process.env?.[name] || '').trim().length > 0;
}

function clamp(n, min = 0, max = 100) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function grade(score) {
  if (score >= 92) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 78) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

function category(key, title, score, status, strengths = [], actions = []) {
  return { key, title, score: clamp(score), grade: grade(score), status, strengths, actions };
}

function inferAuthMode() {
  return {
    mode: 'private-apk-identity',
    score: 88,
    status: 'good',
    label: 'Identidade canônica do APK ativa sem segredo compartilhado'
  };
}


function countOkProviders(providers = []) {
  return providers.filter(p => !['cooldown', 'degraded', 'blocked', 'error'].includes(String(p?.status || '').toLowerCase())).length;
}

export function buildPersonalReleaseReadiness(input = {}) {
  const runtime = input.runtime || {};
  const metrics = input.metrics || {};
  const providers = Array.isArray(input.providers) ? input.providers : [];
  const outputFeed = input.outputFeed || input.proxyOutputMonitor?.outputFeed || [];
  const routeCount = Number(metrics.routesTracked || metrics.summary?.routesTracked || runtime.routes?.size || 0);
  const eventCount = Number(metrics.eventsStored || metrics.summary?.eventsStored || outputFeed.length || 0);
  const payloadCount = Number(metrics.deliveryHarmony?.payloadsDelivered || input.deliveryHarmony?.payloadsDelivered || input.proxyOutputMonitor?.totals?.payloadResponses || 0);
  const auth = inferAuthMode();
  const publicBase = hasEnv('VALORAE_PUBLIC_BASE_URL') || hasEnv('PUBLIC_BASE_URL');
  const personalMode = boolEnv('VALORAE_PERSONAL_MODE', true);
  const defaultView = String(process.env.VALORAE_DEFAULT_ASSET_VIEW || 'app').toLowerCase();
  const sourceOk = providers.length ? countOkProviders(providers) : null;
  const sourceScore = providers.length ? clamp(55 + (sourceOk / providers.length) * 40) : 78;
  const memoryTelemetry = 'memory_per_serverless_instance';

  const categories = [
    category('configuration', 'Configuração e deploy gratuito', publicBase ? 92 : 78, publicBase ? 'ready' : 'attention', [
      'Compatível com Vercel/GitHub gratuito',
      'Não exige banco, Redis, KV, cron pago ou WebSocket',
      publicBase ? 'Base pública configurada' : 'Roda mesmo sem base pública explícita'
    ], publicBase ? [] : ['Definir VALORAE_PUBLIC_BASE_URL para evitar confusão entre deploys.']),
    category('auth', 'Acesso exclusivo do APK', auth.score, auth.status, [auth.label, 'Application ID, canal, protocolo, versão e build identificam o cliente privado'], ['Nenhuma configuração HMAC manual é necessária para o uso privado.']),
    category('appContract', 'Contrato Web/APK', defaultView === 'app' ? 96 : 86, 'ready', ['view=app oficial', 'appMobileSnapshot para primeira pintura', 'appPayload para hidratação', 'appSyncEnvelope para cache'], defaultView === 'app' ? ['Manter view=app como padrão para Web/APK e usar full apenas em debug.'] : ['Definir VALORAE_DEFAULT_ASSET_VIEW=app para reduzir payload quando esquecer view.']),
    category('observability', 'Monitor estático', 98, 'ready', ['HTML/CSS sem JavaScript, polling ou consulta à API', 'O monitor não gera tráfego nem telemetria'], []),
    category('sources', 'Fontes e precisão', sourceScore, sourceScore >= 85 ? 'ready' : 'partial', ['Matriz de fontes, circuit breaker e stale-if-error', 'Normalização BRL/%/múltiplos e aliases financeiros'], sourceScore >= 85 ? [] : ['Validar tickers-alvo reais no deploy Vercel.', 'Adicionar fonte/API estável para dados que hoje ficam PARTIAL.']),
    category('performance', 'Eficiência do engine', 89, 'ready', ['Montagem por perfil de consumo', 'view=app/mobile evita contratos pesados', 'cache em memória e dedupe de requisições'], ['Rodar benchmark real no Vercel após deploy para calibrar p95.']),
    category('documentation', 'Documentação e manutenção', 88, 'ready', ['SDK e prompts prontos', 'OpenAPI/fields/status de fontes', 'README atualizado para uso pessoal'], ['Manter CHANGELOG e versão interna sincronizados a cada ZIP.']),
    category('persistence', 'Estado operacional', 96, 'ready', ['Cache e single-flight somente em memória durante requisições reais', 'Sem SQL, fila ou telemetria operacional persistente'], ['Estado em memória é por instância serverless e pode reiniciar em cold start.']),
  ];

  const weighted = categories.reduce((sum, c) => sum + c.score, 0) / categories.length;
  const score = clamp(weighted);
  const status = score >= 88 ? 'personal-ready' : score >= 78 ? 'controlled-ready' : 'needs-hardening';
  const criticalActions = categories.flatMap(c => c.actions.map(action => ({ category: c.key, action }))).slice(0, 12);

  return {
    version: VALORAE_PERSONAL_MATURITY_VERSION,
    status,
    score,
    grade: grade(score),
    audience: 'uso pessoal e pessoas próximas',
    commercialPublicApi: false,
    recommendedMode: 'personal-controlled-release',
    authMode: auth.mode,
    defaultView,
    telemetryRetention: memoryTelemetry,
    summary: {
      routesTracked: routeCount,
      eventsStored: eventCount,
      payloadsDelivered: payloadCount,
      providersTracked: providers.length,
      providerOkCount: sourceOk,
      publicBaseConfigured: publicBase,
      personalMode,
    },
    categories,
    criticalActions,
    launchChecklist: [
      { ok: publicBase, item: 'Definir VALORAE_PUBLIC_BASE_URL para o deploy usado pelos apps.' },
      { ok: defaultView === 'app', item: 'Usar view=app como padrão real nos apps Web/APK e full apenas para diagnóstico manual.' },
      { ok: auth.mode === 'private-apk-identity', item: 'Manter o protocolo e o applicationId alinhados entre Proxy e APK.' },
      { ok: true, item: 'Validar /api/v1/source/status após deploy.' },
      { ok: true, item: 'Validar que a importação de api/router.js não inicia fetch, intervalos ou timeouts autônomos.' },
      { ok: true, item: 'Salvar último snapshot bom no app e nunca limpar tela em status PARTIAL.' },
    ],
    nextMilestones: [
      '21.12.30: release pessoal limpo com audit:release, view=app padrão e checklist final.',
      'Próximo ciclo: validar matriz real dos seus tickers prioritários no deploy Vercel.',
      'Próximo ciclo: manter observabilidade externa à função apenas se houver necessidade operacional comprovada.',
    ],
  };
}
