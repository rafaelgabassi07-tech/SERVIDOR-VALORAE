import { ValoraeEngine } from '../lib/Valorae-engine.js';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute } from '../lib/http/route.js';
import { VIEW_ALIASES, PROFILE_ALIASES, TTL_MATRIX } from '../lib/catalogs/valorae-catalogs.js';

const FIELD_CATALOG_VERSION = '21.12.32-launch-performance-fields';

const stableAssetFields = [
  { path: 'officialAppContractVersion', type: 'string', description: 'Versão do contrato oficial view=app para Web/APK.' },
  { path: 'endpointCoverage', type: 'object', description: 'Cobertura enxuta de cotação, métricas, fundamentos, gráficos, dividendos, fonte e segurança de render/cache no view=app.' },
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
  { path: 'engineEfficiency', type: 'object', description: 'Auditoria leve de eficiência, precisão, confiabilidade, delivery e árvore resumida do ecossistema Valorae Engine.' },
  { path: 'assetClassContract', type: 'object', description: 'Contrato especializado por classe de ativo: ação como empresa e FII como fundo imobiliário, com grupos, completude, sourceMap e confiança por campo.' },
  { path: 'assetIndicatorCoverage', type: 'object', description: 'Taxonomia oficial de indicadores por classe, cobertura por grupo, campos críticos ausentes e orientação para páginas Ação/FII.' },
  { path: 'engineMaturityBooster', type: 'object', description: 'Auditoria de performance, precisão, confiabilidade e sincronização de app, com gargalos e recomendações.' },
  { path: 'fieldConsistencyGuard', type: 'object', description: 'Guardião de consistência por campo: detecta valores suspeitos, fora de escala, extremos e orienta badge/cache no app.' },
  { path: 'payloadBudget', type: 'object', description: 'Orçamento aproximado do payload por raiz, com recomendação de view e peso para mobile/Web.' },
  { path: 'assetActionPlan', type: 'object', description: 'Plano de ação por ativo: decisão de renderização, cache, banner, endpoints e prioridades.' },
  { path: 'engineRuntimeProfiler', type: 'object', description: 'Profiler de runtime do Engine por etapa: fonte, fallback, contratos, guardrails, score, gargalos e recomendações de performance.' },
  { path: 'engineLaunchGate', type: 'object', description: 'Gate final de lançamento pessoal por resposta: score, decisão, bloqueios, checklist de app e regras anti-tela-vazia.' },
  { path: 'engineModuleTree', type: 'object', description: 'Árvore completa de módulos do ecossistema, disponível em modo debug/fullContracts para documentação e auditoria.' },
  { path: 'payloadViewProfile', type: 'object', description: 'Diagnóstico do view aplicado: compact/standard/full, redução aproximada de bytes e raízes removidas para mobile.' },
  { path: 'performance', type: 'object', description: 'Perfil, timing e política de execução.' }
];

const normalizedFields = [
  'precoAtual','variacaoDay','variacao12m','dividendYield','dyMedio5a','pvp','pl','psr','evEbitda','evEbit','roe','roic','roa','margemLiquida','margemBruta','margemEbit','margemEbitda','payout','vpa','lpa','valorPatrimonialCota','patrimonioLiquido','valorDeMercado','valorDeFirma','liquidezMediaDiaria','vacanciaFisica','vacanciaFinanceira','yield1m','yield3m','yield6m','yield12m','numeroCotistas','cotasEmitidas','taxaAdministracao','segmentoFii','tipoFundo','tipoGestao','mandato','publicoAlvo','valorPatrimonialTotal'
].map(path => ({ path: `normalized.${path}`, shape: 'FinancialField', fields: ['display','value','unit','source','confidence'] }));


const appConsumerFields = [
  { path: 'view=app', description: 'Contrato oficial de produção: appMobileSnapshot, appPayload, appSyncEnvelope, appResponseIntegrity, engineRuntimeProfiler, engineLaunchGate, endpointCoverage e engineEfficiency enxuto.' },
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
  { path: 'fieldConsistencyGuard.score', description: 'Score de consistência financeira do payload, usado para badge de qualidade e decisão de snapshot.' },
  { path: 'fieldConsistencyGuard.issues', description: 'Lista de campos suspeitos/fora de escala com severidade, motivo e recomendação.' },
  { path: 'payloadBudget.totalBytesApprox', description: 'Peso aproximado do payload JSON antes/depois de views compactas.' },
  { path: 'payloadBudget.rootWeights', description: 'Peso por raiz para descobrir o que está deixando a resposta pesada.' },
  { path: 'assetActionPlan.releaseDecision', description: 'Decisão pronta para o app: render_full, render_partial, manter snapshot ou mostrar badge.' },
  { path: 'assetActionPlan.priorityActions', description: 'Próximas ações recomendadas para completar dados, revisar fonte ou melhorar renderização.' },
  { path: 'engineEfficiency.scores', description: 'Scores de eficiência, precisão, confiabilidade e score geral do payload montado.' },
  { path: 'engineMaturityBooster.scores', description: 'Scores de maturidade operacional: overall, performance, precision, reliability e appSync.' },
  { path: 'engineMaturityBooster.bottlenecks', description: 'Gargalos detectados no payload/fonte/indicadores/sincronização.' },
  { path: 'assetIndicatorCoverage.groups', description: 'Cobertura de indicadores por grupo canônico para Ação ou FII.' },
  { path: 'assetIndicatorCoverage.missingCriticalFields', description: 'Campos críticos ainda ausentes para aquela classe de ativo.' },
  { path: 'engineEfficiency.precision', description: 'Contagem de campos normalizados, unidades financeiras detectadas e possíveis outliers numéricos.' },
  { path: 'engineEfficiency.delivery', description: 'Sinais de entrega: raízes app, séries, pontos, renderSafe, cacheSafe e decisão de sync.' },
  { path: 'engineEfficiency.moduleTreeSummary', description: 'Resumo da árvore de módulos para o app/monitor documentar o ecossistema.' },
  { path: 'payloadViewProfile.reductionPercent', description: 'Percentual aproximado de redução após aplicar view=compact/mobile/standard.' },
  { path: 'payloadViewProfile.appPreferredFirstPaintRoot', description: 'Raiz recomendada para primeira pintura do app, normalmente appMobileSnapshot no modo compact.' },
];


const assetClassFields = [
  { path: 'assetClassContract.assetType', description: 'Classe lógica: stock, fii, etf, bdr ou stock_us.' },
  { path: 'assetClassContract.sourceModel', description: 'Modelo de leitura: stock-as-company ou fii-as-fund.' },
  { path: 'assetClassContract.score', description: 'Score de completude do contrato especializado.' },
  { path: 'assetClassContract.groups.profile', description: 'Perfil cadastral/corporativo/fundo.' },
  { path: 'assetClassContract.groups.valuation', description: 'Múltiplos e valuation de ações.' },
  { path: 'assetClassContract.groups.profitability', description: 'ROE, ROIC, ROA, margens e CAGR.' },
  { path: 'assetClassContract.groups.debt', description: 'Dívida, caixa, liquidez corrente, passivos e patrimônio.' },
  { path: 'assetClassContract.groups.statements', description: 'Demonstrações e séries financeiras quando disponíveis.' },
  { path: 'assetClassContract.groups.peers', description: 'Comparação setorial, pares, tipo/segmento e índices.' },
  { path: 'assetClassContract.groups.income', description: 'Rendimentos de FII por janelas e histórico.' },
  { path: 'assetClassContract.groups.patrimonial', description: 'VP por cota, P/VP, patrimônio e cotas emitidas de FII.' },
  { path: 'assetClassContract.groups.portfolio', description: 'Imóveis, estados, ABL e concentração de FII.' },
  { path: 'assetClassContract.groups.vacancy', description: 'Vacância física/financeira de FII.' },
  { path: 'assetClassContract.groups.communications', description: 'Comunicados, informes, fatos relevantes e relatórios.' },
  { path: 'assetClassContract.fieldConfidence', description: 'Confiança por campo, com valor, fonte, path e crossCheck.' },
  { path: 'assetClassContract.sourceMap', description: 'Resumo de quantos campos vieram de cada fonte/camada.' },
  { path: 'assetClassContract.missingCriticalFields', description: 'Campos importantes ausentes por grupo.' },
];

const investidor10EndpointFields = [
  { path: '/api/v1/asset/profile', description: 'Perfil de ação/ativo.' },
  { path: '/api/v1/asset/valuation', description: 'Valuation de ações.' },
  { path: '/api/v1/asset/profitability', description: 'Rentabilidade e margens.' },
  { path: '/api/v1/asset/debt', description: 'Endividamento e liquidez.' },
  { path: '/api/v1/asset/statements', description: 'Demonstrações e séries financeiras.' },
  { path: '/api/v1/asset/peers', description: 'Comparação setorial/pares.' },
  { path: '/api/v1/asset/source-map', description: 'Mapa de fonte/confiança por campo.' },
  { path: '/api/v1/fii/profile', description: 'Perfil do FII.' },
  { path: '/api/v1/fii/income', description: 'Rendimentos do FII.' },
  { path: '/api/v1/fii/patrimonial', description: 'Patrimonial do FII.' },
  { path: '/api/v1/fii/portfolio', description: 'Portfólio imobiliário do FII.' },
  { path: '/api/v1/fii/vacancy', description: 'Vacância do FII.' },
  { path: '/api/v1/fii/communications', description: 'Comunicados e relatórios do FII.' },
  { path: '/api/v1/fii/checklist', description: 'Checklist educativo de FII.' },
];

const personalMaturityFields = [
  { path: 'personalReleaseReadiness', description: 'Maturidade do deploy para uso pessoal/pessoas próximas: score, categorias, checklist e próximos marcos.' },
  { path: 'personalReleaseReadiness.score', description: 'Score geral de maturidade pessoal controlada, calculado por configuração, auth, contratos, fontes, monitor e documentação.' },
  { path: 'personalReleaseReadiness.categories[]', description: 'Categorias com nota, status, forças e ações recomendadas.' },
  { path: 'personalReleaseReadiness.launchChecklist[]', description: 'Checklist prático antes de compartilhar com pessoas próximas.' },
  { path: 'personalReleaseReadiness.telemetryRetention', description: 'Política de retenção do monitor; no Vercel Free é memória por instância serverless.' },
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


const serverObservabilityFields = [
  { path: 'vercelRuntime', description: 'Ambiente Vercel/local, URL de deploy, região runtime, git e origem observada pelo painel.' },
  { path: 'vercelRuntime.observed.regions', description: 'Regiões Vercel observadas por x-vercel-id/x-vercel-region.' },
  { path: 'vercelRuntime.observed.hosts', description: 'Hosts observados por x-forwarded-host/host para confirmar o deploy que entregou dados.' },
  { path: 'vercelRuntime.observed.countries', description: 'Países de borda observados por tráfego externo ou polling interno isolado.' },
  { path: 'vercelRuntime.observed.source', description: 'Origem da leitura Vercel Runtime: external_traffic, dashboard_internal_telemetry ou environment.' },
  { path: 'vercelRuntime.observed.internalTelemetryRequestsWithVercelHeaders', description: 'Pollings internos que trouxeram headers Vercel sem inflar métricas de usuários.' },
  { path: 'distributions.vercelRegions', description: 'Distribuição agregada de regiões Vercel por evento externo captado.' },
  { path: 'distributions.vercelHosts', description: 'Distribuição agregada de hosts/deploys vistos no tráfego real.' },
  { path: 'distributions.vercelCountries', description: 'Distribuição por país de borda quando x-vercel-ip-country estiver disponível.' },
  { path: 'routeDetails[].topVercelRegion', description: 'Região Vercel mais frequente por rota.' },
  { path: 'routeDetails[].topHost', description: 'Host/deploy mais frequente por rota.' },
  { path: 'recentEvents[].platform', description: 'Contexto de entrega do evento: região, host, país, protocolo e x-vercel-id.' },
  { path: 'proxyOutputMonitor', description: 'Espelho principal da página-servidor: respostas que saíram do proxy para apps/usuários.' },
  { path: 'proxyOutputMonitor.totals', description: 'Totais de saída: respostas, bytes, payloads, métricas, gráficos, dividendos e snapshots mobile entregues.' },
  { path: 'proxyOutputMonitor.outputFeed[]', description: 'Feed recente de cada resposta entregue: rota, app, status, bytes, payloadKind, raízes, sinais e preview.' },
  { path: 'proxyOutputMonitor.routeOutputs[]', description: 'Matriz de rotas que distribuíram informações para usuários, com renderSafe/cacheSafe e dados entregues.' },
  { path: 'proxyOutputMonitor.rootCoverage', description: 'Contagem das raízes de payload vistas na saída, como appPayload, appMobileSnapshot, normalized, chartSeries e results.' },
];

const queryControls = [
  { name: 'fields', example: 'ticker,type,status,normalized,quality.score', description: 'Recorta o payload final por caminhos separados por vírgula.' },
  { name: 'dataFields', example: 'ticker,normalized,parserResilience', description: 'Recorta o campo data quando o endpoint usa envelope.' },
  { name: 'lean', example: '1', description: 'Remove blocos pesados como debug, rawHtml, html e text.' },
  { name: 'maxItems', example: '20', description: 'Limita arrays em todo o payload para reduzir resposta em Web/APK.' },
  { name: 'view', example: 'app|production|launch|public|instant|ultra|tiny|quote|card|mobile|snapshot|sync|wallet|portfolio|watchlist|detail|analysis|compact|standard|full', description: 'Controla o nível de detalhe antes do recorte por fields.' },
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
    assetClassFields,
    investidor10EndpointFields,
    personalMaturityFields,
    serverObservabilityFields,
    queryControls,
    financialFieldShape: { display: 'string', value: 'number|null', unit: 'BRL|%|ratio|m2|number', source: 'string', confidence: '0..1' },
    viewAliases: VIEW_ALIASES,
    profileAliases: PROFILE_ALIASES,
    cacheTtlMatrix: TTL_MATRIX,
    launchEndpoints: ['/api/v1/asset?view=app', '/api/v1/asset/coverage', '/api/v1/asset/fundamentals', '/api/v1/asset/source-map', '/api/v1/fii/income', '/api/v1/fii/patrimonial', '/api/v1/fii/checklist', '/api/v1/integration/sdk', '/api/v1/integration/prompts']
  }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'fields', cachePolicy: 'etag', cacheControl: TTL_MATRIX.staticCatalog.cacheControl });
}
