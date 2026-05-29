import { ValoraeEngine } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute } from '../../lib/http/route.js';

const prompts = [
  {
    title: 'Maturidade pessoal controlada',
    prompt: 'Audite meu deploy VALORAE para uso pessoal e pessoas próximas. Consulte /api/v1/release/readiness, /api/v1/source/status e /api/server/metrics. Verifique score, authMode, launchChecklist, proxyOutputMonitor.outputFeed, view=app, appMobileSnapshot, appSyncEnvelope e appResponseIntegrity. Diga o que falta antes de compartilhar o proxy com outra pessoa.',
  },
  {
    title: 'Integrar app Android ao Valorae Engine',
    prompt: 'Implemente no meu app Android um cliente HTTP para consumir /api/v1/asset?ticker={TICKER}&view=app. Use appMobileSnapshot para primeira renderização, appPayload para hidratação, appSyncEnvelope para decisão de cache e appResponseIntegrity para evitar substituir dados bons por respostas parciais. Envie headers x-valorae-app, x-valorae-channel e x-valorae-app-version em todas as chamadas.'
  },
  {
    title: 'Criar tela de ativo Web',
    prompt: 'Crie uma tela Web profissional para ativos usando Valorae Engine. Consuma /api/v1/asset?view=app, renderize cards de cotação e métricas por appPayload.metrics.canonical, gráficos por appMobileSnapshot.charts/appPayload.charts e mostre banner quando status=PARTIAL ou renderSafe=false. Não use campos brutos quando houver raiz appPayload.'
  },
  {
    title: 'Auditar cobertura de dados',
    prompt: 'Audite a cobertura de dados de um ticker usando /api/v1/asset/coverage?ticker={TICKER}. Explique quais blocos estão prontos, quais estão parciais, o que falta para fundamentos/dividendos/gráficos e quais fallbacks de UI devo usar.'
  },
  {
    title: 'Conectar monitor do proxy',
    prompt: 'Configure o app para enviar x-valorae-app, x-valorae-channel, x-valorae-app-version e x-valorae-build em todas as chamadas ao Valorae Proxy. Depois, valide no /server.html se cada resposta aparece em proxyOutputMonitor.outputFeed com rota, app, canal, status, bytes, raízes do JSON, métricas, gráficos, dividendos e preview do payload.'
  }
];

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET'], route: 'integration/prompts', rateMax: Number(process.env.VALORAE_RATE_LIMIT_HEALTH_MAX || 180), profile: 'integration-prompts', cacheControl: 'private, max-age=120' });
  if (route.done) return;
  return sendJson(req, res, { version: ValoraeEngine.version, requestId: route.requestId, endpoint: 'integration/prompts', status: 'OK', prompts }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'integration-prompts', cachePolicy: 'etag', cacheControl: 'private, max-age=120' });
}
