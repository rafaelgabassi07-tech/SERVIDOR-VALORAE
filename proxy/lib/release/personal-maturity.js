export const VALORAE_PERSONAL_MATURITY_VERSION = '21.12.30-final-personal-launch-cleanup';

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
  const keys = hasEnv('VALORAE_CLIENT_KEYS');
  const required = boolEnv('VALORAE_REQUIRE_CLIENT_AUTH', false);
  if (keys && required) return { mode: 'required', score: 96, status: 'hardened', label: 'Chaves configuradas e exigidas' };
  if (keys) return { mode: 'optional', score: 86, status: 'good', label: 'Chaves configuradas, exigência opcional' };
  return { mode: 'open', score: 70, status: 'personal-ok', label: 'Aberto para uso pessoal/rede confiável' };
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
    category('auth', 'Acesso de pessoas próximas', auth.score, auth.status, [auth.label, 'Headers x-valorae-app e x-valorae-channel continuam alimentando o monitor'], auth.mode === 'open' ? ['Para compartilhar fora da rede confiável, configurar VALORAE_CLIENT_KEYS.', 'Ativar VALORAE_REQUIRE_CLIENT_AUTH=1 quando quiser fechar acesso.'] : ['Documentar appId/clientKey para cada pessoa/app.']),
    category('appContract', 'Contrato Web/APK', defaultView === 'app' ? 96 : 86, 'ready', ['view=app oficial', 'appMobileSnapshot para primeira pintura', 'appPayload para hidratação', 'appSyncEnvelope para cache'], defaultView === 'app' ? ['Manter view=app como padrão para Web/APK e usar full apenas em debug.'] : ['Definir VALORAE_DEFAULT_ASSET_VIEW=app para reduzir payload quando esquecer view.']),
    category('observability', 'Monitor do proxy', eventCount || payloadCount ? 92 : 82, eventCount || payloadCount ? 'ready' : 'needs-traffic', ['proxyOutputMonitor.outputFeed mostra respostas que saem do proxy', 'Polling interno não infla tráfego real', 'Preview limitado evita payload gigante'], eventCount ? [] : ['Gerar tráfego real de um app externo para validar o feed fora do próprio painel.']),
    category('sources', 'Fontes e precisão', sourceScore, sourceScore >= 85 ? 'ready' : 'partial', ['Matriz de fontes, circuit breaker e stale-if-error', 'Normalização BRL/%/múltiplos e aliases financeiros'], sourceScore >= 85 ? [] : ['Validar tickers-alvo reais no deploy Vercel.', 'Adicionar fonte/API estável para dados que hoje ficam PARTIAL.']),
    category('performance', 'Eficiência do engine', 89, 'ready', ['Montagem por perfil de consumo', 'view=app/mobile evita contratos pesados', 'cache em memória e dedupe de requisições'], ['Rodar benchmark real no Vercel após deploy para calibrar p95.']),
    category('documentation', 'Documentação e manutenção', 88, 'ready', ['SDK e prompts prontos', 'OpenAPI/fields/status de fontes', 'README atualizado para uso pessoal'], ['Manter CHANGELOG e versão interna sincronizados a cada ZIP.']),
    category('persistence', 'Histórico de telemetria', personalMode ? 78 : 64, personalMode ? 'acceptable-for-personal' : 'limited', ['Histórico em memória é suficiente para uso pessoal leve', 'Sem dependência paga'], ['Limitação: histórico reinicia com instância fria.', 'Se um dia precisar histórico global, plugar armazenamento opcional sem tornar obrigatório.']),
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
      { ok: auth.mode !== 'open' || personalMode, item: 'Manter aberto apenas para uso pessoal/rede confiável ou ativar client keys.' },
      { ok: true, item: 'Validar /api/v1/source/status após deploy.' },
      { ok: true, item: 'Validar /api/server/metrics enquanto app externo consome /api/v1/asset.' },
      { ok: true, item: 'Salvar último snapshot bom no app e nunca limpar tela em status PARTIAL.' },
    ],
    nextMilestones: [
      '21.12.30: release pessoal limpo com audit:release, view=app padrão e checklist final.',
      'Próximo ciclo: validar matriz real dos seus tickers prioritários no deploy Vercel.',
      'Próximo ciclo: adicionar persistência opcional de telemetria somente se o uso pessoal exigir histórico global.',
    ],
  };
}
