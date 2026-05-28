import { ValoraeEngine } from '../lib/Valorae-engine.js';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute } from '../lib/http/route.js';
import { VIEW_ALIASES, PROFILE_ALIASES, TTL_MATRIX } from '../lib/catalogs/valorae-catalogs.js';

const FIELD_CATALOG_VERSION = '21.12.0';

const stableAssetFields = [
  { path: 'version', type: 'string', description: 'Versão do engine que gerou o payload.' },
  { path: 'schemaVersion', type: 'string', description: 'Versão lógica do schema de ativo, quando disponível.' },
  { path: 'status', type: 'string', description: 'OK, PARTIAL ou ERROR.' },
  { path: 'partial', type: 'boolean', description: 'Indica payload incompleto por fallback, bloqueio ou falta de fonte.' },
  { path: 'ticker', type: 'string', description: 'Ticker canônico.' },
  { path: 'type', type: 'string', description: 'Tipo inferido: ACAO, FII, ETF, BDR ou outro.' },
  { path: 'results', type: 'object', description: 'Dados brutos/estruturados por domínio: cotação, indicadores, dividendos e empresa/fundo.' },
  { path: 'normalized', type: 'object', description: 'Campos financeiros normalizados em display/value/unit/source/confidence.' },
  { path: 'parserResilience', type: 'object', description: 'Pontuação, avisos, campos críticos ausentes e campos suspeitos.' },
  { path: 'schemaStability', type: 'object', description: 'Chaves estáveis, presentes e ausentes no contrato asset-v1.' },
  { path: 'quality', type: 'object', description: 'Score de qualidade/cobertura de dados.' },
  { path: 'fieldConfidence', type: 'object', description: 'Confiança por campo extraído ou derivado.' },
  { path: 'valoraeScore', type: 'object', description: 'Score analítico derivado para comparação.' },
  { path: 'alerts', type: 'array', description: 'Alertas analíticos e de qualidade.' },
  { path: 'sourceReport', type: 'object', description: 'Fontes usadas/tentadas e fallback.' },
  { path: 'consumerDiagnostics', type: 'object', description: 'Mapa de consumo do app: caminhos disponíveis, tentativas de fonte, fallback e score de captura.' },
  { path: 'appPayload', type: 'object', description: 'Payload direto para APK/Web com aliases, painéis, gráficos e blankShield anti-tela-vazia.' },
  { path: 'appRenderContract', type: 'object', description: 'Contrato de renderização por card/gráfico com estados ready/partial/empty e validações de consistência.' },
  { path: 'appDataContract', type: 'object', description: 'Validador final do payload consumível: score, cobertura crítica, renderSafe e política de snapshot/cache.' },
  { path: 'appSyncEnvelope', type: 'object', description: 'Envelope de sincronização para APK/Web: decisão de snapshot, hash estável, first paint, hidratação e política de polling.' },
  { path: 'appMobileSnapshot', type: 'object', description: 'Snapshot compacto para primeira pintura/cache local do APK/Web, com cotação, métricas, painéis, gráficos amostrados e decisão sync.' },
  { path: 'appResponseIntegrity', type: 'object', description: 'Auditor final de integridade dos contratos do app: raízes presentes, paridade de métricas/gráficos, sync/hash e orçamento de payload.' },
  { path: 'payloadViewProfile', type: 'object', description: 'Diagnóstico do view aplicado: compact/standard/full, redução aproximada de bytes e raízes removidas para mobile.' },
  { path: 'performance', type: 'object', description: 'Perfil, timing e política de execução.' }
];

const normalizedFields = [
  'precoAtual','variacaoDay','variacao12m','dividendYield','dyMedio5a','pvp','pl','roe','roic','roa','margemLiquida','margemEbitda','payout','valorPatrimonialCota','patrimonioLiquido','valorDeMercado','liquidezMediaDiaria','vacanciaFisica','yield1m','yield3m','yield6m','yield12m'
].map(path => ({ path: `normalized.${path}`, shape: 'FinancialField', fields: ['display','value','unit','source','confidence'] }));


const appConsumerFields = [
  { path: 'appPayload.quote', description: 'Card de cotação pronto para APK/Web, com preço, variação, DY e fonte.' },
  { path: 'appPayload.metrics.canonical', description: 'Índice canônico de métricas financeiras com aliases estáveis para o app.' },
  { path: 'appPayload.metrics.aliases', description: 'Mapa de aliases: price/currentPrice/dy/p_vp etc apontando para chaves canônicas.' },
  { path: 'appPayload.panels', description: 'Prontidão por painel em formato simples para renderização segura.' },
  { path: 'appPayload.charts.series', description: 'Séries de gráficos normalizadas e preferenciais para consumo direto.' },
  { path: 'appPayload.dividends', description: 'Histórico/resumo de dividendos com fallback e contagem.' },
  { path: 'appPayload.blankShield', description: 'Contrato anti-tela-vazia com flags canRender*, fallbackOrder e empty state recomendado.' },
  { path: 'appRenderContract.cards', description: 'Lista de cards do dashboard com estado ready/partial/empty, primaryPath e fallbackPaths.' },
  { path: 'appRenderContract.metricGroups', description: 'Agrupamento de métricas por quote, valuation, dividends, profitability e liquidity.' },
  { path: 'appRenderContract.chartTemplates', description: 'Templates de gráfico com tipo recomendado: line, bar ou candlestick.' },
  { path: 'appRenderContract.consistency', description: 'Validações de divergência entre appPayload, normalized e chartSeries.' },
  { path: 'appRenderContract.offlinePolicy', description: 'Política para manter dados anteriores, usar cache stale e evitar tela vazia.' },
  { path: 'appDataContract.score', description: 'Score final de segurança do payload consumível pelo app.' },
  { path: 'appDataContract.renderSafe', description: 'Indica se o app pode renderizar/substituir tela sem risco crítico.' },
  { path: 'appDataContract.canReplacePreviousSnapshot', description: 'Indica se pode substituir o último snapshot bom no APK/Web.' },
  { path: 'appDataContract.coverage', description: 'Cobertura de métricas críticas, cards e gráficos.' },
  { path: 'appDataContract.fieldMap', description: 'Mapa de campos canônicos com aliases, fonte, confiança e caminhos de fallback.' },
  { path: 'appDataContract.uiGuards', description: 'Guardrails de UI para evitar tela vazia e dados regressivos.' },
  { path: 'appSyncEnvelope.identity.payloadHash', description: 'Hash estável para o app decidir se houve mudança real nos dados consumíveis.' },
  { path: 'appSyncEnvelope.decision', description: 'Ação recomendada: substituir snapshot, mesclar com anterior, manter cache ou mostrar empty state.' },
  { path: 'appSyncEnvelope.firstPaint', description: 'Checklist dos caminhos mínimos para primeira renderização segura no APK/Web.' },
  { path: 'appSyncEnvelope.hydration', description: 'Ordem de hidratação incremental e caminhos lazy para reduzir telas em branco.' },
  { path: 'appSyncEnvelope.transport', description: 'Diagnóstico de cache/fonte/tamanho aproximado para payload mobile.' },
  { path: 'appMobileSnapshot.quote', description: 'Cotação compacta pronta para card/lista/watchlist mobile.' },
  { path: 'appMobileSnapshot.metrics', description: 'Métricas financeiras canônicas compactadas para primeira pintura.' },
  { path: 'appMobileSnapshot.charts', description: 'Até 6 séries amostradas com no máximo 80 pontos por série para renderização rápida.' },
  { path: 'appMobileSnapshot.sync', description: 'Resumo da decisão de sincronização/cache do appSyncEnvelope.' },
  { path: 'appMobileSnapshot.snapshotHash', description: 'Hash estável do snapshot compacto para cache local e detecção de mudança real.' },
  { path: 'appResponseIntegrity.score', description: 'Score final de integridade entre appPayload, contratos, sync e snapshot mobile.' },
  { path: 'appResponseIntegrity.ok', description: 'Indica se os contratos do app estão consistentes para consumo seguro.' },
  { path: 'appResponseIntegrity.cacheSafe', description: 'Indica se é seguro substituir o cache/snapshot local do APK/Web.' },
  { path: 'appResponseIntegrity.sections', description: 'Diagnóstico por raiz, métricas, gráficos, sincronização/hash e orçamento de payload.' },
  { path: 'appResponseIntegrity.issues', description: 'Lista de inconsistências detectadas com severidade e recomendação de fallback.' },
  { path: 'payloadViewProfile.reductionPercent', description: 'Percentual aproximado de redução após aplicar view=compact/mobile/standard.' },
  { path: 'payloadViewProfile.appPreferredFirstPaintRoot', description: 'Raiz recomendada para primeira pintura do app, normalmente appMobileSnapshot no modo compact.' },
];

const portfolioFields = [
  { path: 'portfolio.summary', description: 'Totais, rentabilidade, contagem e qualidade média.' },
  { path: 'portfolio.positions[].annualRatePercent', description: 'Taxa anual informada para renda fixa/caixa remunerado.' },
  { path: 'portfolio.positions[].liquidityDays', description: 'Liquidez declarada em dias para reserva, CDB, LCI/LCA, Tesouro etc.' },
  { path: 'portfolio.intelligence.incomeCalendar', description: 'Calendário estimado de renda mensal por eventos/projeção.' },
  { path: 'portfolio.intelligence.goalProjection', description: 'Projeção educativa por aporte mensal, retorno esperado e inflação.' },
  { path: 'portfolio.intelligence.taxPlanner', description: 'Checklist fiscal educativo por classe de ativo.' },
  { path: 'portfolio.intelligence.technologyReadiness', description: 'Score de prontidão para dashboards, apps e automações.' },
  { path: 'portfolio.intelligence.positionRanking', description: 'Ranking por posição com score, fatores, aderência à meta e ação sugerida.' },
  { path: 'portfolio.intelligence.portfolioNarrative', description: 'Narrativa em linguagem natural com pontos fortes, atenção e próximos passos.' },
  { path: 'portfolio.intelligence.passiveIncomeProjection', description: 'Projeção educativa de renda passiva com aportes futuros.' },
  { path: 'portfolio.intelligence.rebalanceRoadmap', description: 'Roteiro de aportes para rebalanceamento por metas.' },
  { path: 'portfolio.intelligence.concentrationMap', description: 'Concentração por ticker, classe, setor, emissor/conta, objetivo e tags.' },
  { path: 'scrape.sourceDrift', description: 'Detecção de mudança de fonte/seletores em /api/scrape e /api/batch-scrape.' },
  { path: 'cache.stats', description: 'Métricas em memória: entries, bytes, in-flight, hit/miss e driver free-only.' },
];

const queryControls = [
  { name: 'fields', example: 'ticker,type,status,normalized,quality.score', description: 'Recorta o payload final por caminhos separados por vírgula.' },
  { name: 'dataFields', example: 'ticker,normalized,parserResilience', description: 'Recorta o campo data quando o endpoint usa envelope.' },
  { name: 'lean', example: '1', description: 'Remove blocos pesados como debug, rawHtml, html e text.' },
  { name: 'maxItems', example: '20', description: 'Limita arrays em todo o payload para reduzir resposta em Web/APK.' },
  { name: 'view', example: 'instant|ultra|tiny|quote|card|mobile|snapshot|sync|wallet|portfolio|watchlist|detail|analysis|compact|standard|full', description: 'Controla o nível de detalhe antes do recorte por fields.' },
  { name: 'profile', example: 'instant|quote|card|wallet|analysis|fast|standard|deep|portfolio', description: 'Perfil de performance/completude.' }
];

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET'], route: 'fields', rateMax: Number(process.env.VALORAE_RATE_LIMIT_HEALTH_MAX || 180), profile: 'fields', cacheControl: TTL_MATRIX.staticCatalog.cacheControl });
  if (route.done) return;
  return sendJson(req, res, {
    version: ValoraeEngine.version,
    catalogVersion: FIELD_CATALOG_VERSION,
    requestId: route.requestId,
    endpoint: 'fields',
    freeOnly: true,
    stableAssetFields,
    normalizedFields,
    portfolioFields,
    appConsumerFields,
    queryControls,
    financialFieldShape: { display: 'string', value: 'number|null', unit: 'BRL|%|ratio|m2|number', source: 'string', confidence: '0..1' },
    viewAliases: VIEW_ALIASES,
    profileAliases: PROFILE_ALIASES,
    cacheTtlMatrix: TTL_MATRIX
  }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'fields', cachePolicy: 'etag', cacheControl: TTL_MATRIX.staticCatalog.cacheControl });
}
