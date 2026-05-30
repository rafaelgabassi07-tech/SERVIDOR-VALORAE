import { ValoraeEngine } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute } from '../../lib/http/route.js';

const CONTRACT_VERSION = '21.12.52-news-reliability-upgrade-integration-manifest';

function endpoint(path, purpose, view = 'app') {
  return { path, method: 'GET', purpose, recommendedView: view, cache: 'private, max-age=30, stale-while-revalidate=180' };
}

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET'], route: 'integration/manifest', rateMax: Number(process.env.VALORAE_RATE_LIMIT_HEALTH_MAX || 180), profile: 'integration-manifest', cacheControl: 'private, max-age=120' });
  if (route.done) return;
  return sendJson(req, res, {
    version: ValoraeEngine.version,
    requestId: route.requestId,
    endpoint: 'integration/manifest',
    contractVersion: CONTRACT_VERSION,
    releasePatch: '21.12.52-news-reliability-upgrade',
    status: 'OK',
    audience: 'uso pessoal e pessoas próximas',
    baseUrl: process.env.VALORAE_PUBLIC_BASE_URL || 'https://servidor-valorae.vercel.app',
    recommendedHeaders: {
      'accept': 'application/json',
      'x-valorae-app': 'Nome do app consumidor',
      'x-valorae-channel': 'web | android | dashboard | watchlist | portfolio',
      'x-valorae-app-version': 'versão do app',
      'x-valorae-app-id': 'opcional quando VALORAE_CLIENT_KEYS estiver ativo',
      'x-valorae-client-key': 'opcional quando VALORAE_REQUIRE_CLIENT_AUTH=1',
    },
    stableRoots: {
      firstPaint: 'appMobileSnapshot',
      detail: 'appPayload',
      cacheDecision: 'appSyncEnvelope',
      safety: 'appResponseIntegrity',
      quality: 'fieldConsistencyGuard',
      payloadWeight: 'payloadBudget',
      action: 'assetActionPlan',
      runtime: 'engineRuntimeProfiler',
      launchGate: 'engineLaunchGate',
      coverage: 'assetIndicatorCoverage',
      classContract: 'assetClassContract',
      dataReliability: 'dataReliability',
    },
    views: {
      app: 'Contrato oficial para Web/APK. Use por padrão.',
      compact: 'Listas, watchlist e cards com payload reduzido.',
      standard: 'Detalhe com diagnóstico moderado.',
      full: 'Auditoria/debug; não usar como padrão no APK.',
    },
    endpoints: [
      endpoint('/api/v1/asset?ticker=PETR4&view=app', 'Tela principal do ativo com contrato oficial'),
      endpoint('/api/v1/asset/quality?ticker=PETR4', 'Qualidade, consistência e orçamento de payload'),
      endpoint('/api/v1/asset/action-plan?ticker=PETR4', 'Decisão pronta para render/cache/banner'),
      endpoint('/api/v1/asset/coverage?ticker=PETR4', 'Cobertura dos blocos básicos'),
      endpoint('/api/v1/asset/indicators?ticker=PETR4', 'Taxonomia e indicadores de ação'),
      endpoint('/api/v1/fii/indicators?ticker=HGLG11', 'Taxonomia e indicadores de FII'),
      endpoint('/api/v1/engine/maturity?ticker=PETR4', 'Maturidade do engine por ticker'),
      endpoint('/api/v1/engine/performance?ticker=PETR4&view=app', 'Profiler de performance por etapa e gate de lançamento pessoal'),
      endpoint('/api/server/metrics', 'Monitor do que sai do proxy para apps/usuários', 'diagnostic'),
      endpoint('/api/v1/source/status', 'Saúde de fontes/cache/provedores', 'diagnostic'),
    ],
    appRules: [
      'Renderize appMobileSnapshot primeiro.',
      'Hidrate a tela de detalhe com appPayload.',
      'Antes de substituir cache local, verifique appResponseIntegrity.cacheSafe, assetActionPlan.releaseDecision e engineLaunchGate.decision.',
      'Se fieldConsistencyGuard.state for review_required ou unsafe_for_auto_replace, mostre badge de qualidade e mantenha o último snapshot bom.',
      'Use dataReliability.blocks para mostrar aviso por bloco em vez de limpar a tela inteira quando só cotação, gráfico ou ranking estiver parcial.',
      'CVM/camada canônica só preenche campos ausentes; Investidor10/StatusInvest continuam como fontes ricas de gráficos, rankings, dividendos e indicadores.',
      'Use view=full apenas para diagnóstico no monitor, nunca como padrão de watchlist.',
    ],
    monitorRules: [
      'Toda rota de dados deve aparecer em proxyOutputMonitor.outputFeed quando passar pela mesma instância/origem.',
      'Envie headers x-valorae-app e x-valorae-channel para separar consumidores.',
      'No Vercel Free, histórico é em memória por instância; não prometa histórico global permanente sem persistência externa.',
    ],
  }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'integration-manifest', cachePolicy: 'etag', cacheControl: 'private, max-age=120' });
}
