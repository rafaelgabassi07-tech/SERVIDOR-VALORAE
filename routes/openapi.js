import { ValoraeEngine } from '../lib/Valorae-engine.js';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute } from '../lib/http/route.js';

const version = ValoraeEngine.version;

function qp(name, schema = { type: 'string' }, description = '', required = false) {
  return { name, in: 'query', required, description, schema };
}

function slug(value = '') { return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 64) || 'valorae_operation'; }

function op(summary, parameters = [], requestBody = undefined, tags = ['Valorae']) {
  const base = {
    tags,
    operationId: slug(`${tags[0] || 'Valorae'} ${summary}`),
    summary,
    parameters,
    responses: {
      200: { description: 'Resposta JSON Valorae', content: { 'application/json': { schema: { type: 'object' } } } },
      400: { description: 'Erro de entrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      429: { description: 'Rate limit', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      500: { description: 'Erro interno sanitizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
    },
  };
  if (requestBody) base.requestBody = requestBody;
  return base;
}

const assetParams = [
  qp('ticker', { type: 'string', example: 'PETR4' }, 'Ticker B3 sem .SA.', true),
  qp('mode', { type: 'string', example: 'super' }, 'Modo de coleta/compatibilidade.'),
  qp('view', { type: 'string', enum: ['app','production','launch','public','instant','ultra','tiny','quote','card','mobile','snapshot','sync','wallet','portfolio','watchlist','list','detail','analysis','compact','standard','full'] }, 'Nível de payload; aliases são resolvidos internamente.'),
  qp('profile', { type: 'string', enum: ['instant','ultra','quote','card','wallet','analysis','fast','standard','deep','portfolio'] }, 'Perfil de performance; aliases são resolvidos internamente.'),
  qp('complete', { type: 'boolean' }, 'Força complemento adaptativo quando a extração rápida ficaria PARTIAL.'),
  qp('adaptiveCompletion', { type: 'boolean' }, 'Liga/desliga complemento HTML sob demanda para reduzir PARTIAL sem tornar toda chamada pesada.'),
  qp('adaptiveCompletionTimeoutMs', { type: 'integer', minimum: 1000, maximum: 12000 }, 'Orçamento do complemento adaptativo.'),
  qp('includeNews', { type: 'boolean' }, 'Inclui notícias via RSS quando disponível.'),
  qp('fields', { type: 'string', example: 'ticker,type,status,normalized,quality.score' }, 'Recorte do payload final.'),
  qp('dataFields', { type: 'string', example: 'ticker,normalized,parserResilience' }, 'Recorte do campo data no envelope v2.'),
  qp('lean', { type: 'boolean' }, 'Remove blocos pesados.'),
  qp('maxItems', { type: 'integer', minimum: 1, maximum: 500 }, 'Limita arrays recursivamente.'),
  qp('nocache', { type: 'boolean' }, 'Ignora cache em memória quando suportado.'),
];

const tickersParam = qp('tickers', { type: 'string', example: 'PETR4,VALE3,GARE11' }, 'Lista CSV de tickers.', true);
const postJsonBody = { required: false, content: { 'application/json': { schema: { type: 'object' } } } };

const paths = {
  '/api/v1/health': { get: op('Saúde, versão e capacidades via router v1', [], undefined, ['System']) },
  '/api/v1/ready': { get: op('Readiness de lançamento sem chamadas externas', [], undefined, ['System']) },
  '/api/v1/manifest': { get: op('Manifesto de capacidades, rotas, free-only e compatibilidade', [], undefined, ['System']) },
  '/api/v1/env': { get: op('Catálogo seguro de variáveis de ambiente e status de configuração', [], undefined, ['System']) },
  '/api/v1/schema': { get: op('Catálogo de schemas estáveis e versões de contrato', [], undefined, ['System']) },
  '/api/v1/source/status': { get: op('Status local de confiabilidade das fontes externas sem chamada de rede', [], undefined, ['System']) },
  '/api/v1/release/readiness': { get: op('Maturidade do Valorae para uso pessoal/pessoas próximas: score, checklist e ações restantes', [], undefined, ['System']) },
  '/api/v1/personal/readiness': { get: op('Alias de readiness pessoal do ecossistema Valorae Engine', [], undefined, ['System']) },
  '/api/v1/server/metrics': { get: op('Métricas ao vivo do servidor visual, Vercel Runtime, rotas, eventos, payloads e apps consumidores', [], undefined, ['System']) },
  '/api/v1/asset': { get: op('Dados de ativo sem envelope; use view=app para contrato oficial Web/APK', assetParams, undefined, ['Assets']), post: op('Dados de ativo via JSON sem envelope', [], postJsonBody, ['Assets']) },
  '/api/v1/asset/coverage': { get: op('Cobertura do ativo para lançamento: cotação, fundamentos, dividendos, gráficos, contratos e fonte', [qp('ticker', { type: 'string', example: 'PETR4' }, 'Ticker B3 sem .SA.', true)], undefined, ['Assets']) },
  '/api/v1/asset/fundamentals': { get: op('Fundamentos agrupados por cotação, valuation, dividendos, rentabilidade, balanço, liquidez e FII', [qp('ticker', { type: 'string', example: 'PETR4' }, 'Ticker B3 sem .SA.', true)], undefined, ['Assets']) },
  '/api/v1/asset/profile': { get: op('Perfil de ação/ativo: identidade, setor, governança, free float, tag along e papéis', [qp('ticker', { type: 'string', example: 'PETR4' }, 'Ticker B3 sem .SA.', true)], undefined, ['Assets']) },
  '/api/v1/asset/valuation': { get: op('Valuation de ação: P/L, P/VP, PSR, EV/EBITDA, VPA, LPA e valor de mercado', [qp('ticker', { type: 'string', example: 'PETR4' }, 'Ticker B3 sem .SA.', true)], undefined, ['Assets']) },
  '/api/v1/asset/profitability': { get: op('Rentabilidade de ação: ROE, ROIC, ROA, margens e CAGR', [qp('ticker', { type: 'string', example: 'PETR4' }, 'Ticker B3 sem .SA.', true)], undefined, ['Assets']) },
  '/api/v1/asset/debt': { get: op('Endividamento e liquidez: dívida, caixa, liquidez corrente, passivos e patrimônio', [qp('ticker', { type: 'string', example: 'PETR4' }, 'Ticker B3 sem .SA.', true)], undefined, ['Assets']) },
  '/api/v1/asset/statements': { get: op('Demonstrações e séries: receitas, lucro, lucro x cotação, patrimônio e balanço quando disponíveis', [qp('ticker', { type: 'string', example: 'PETR4' }, 'Ticker B3 sem .SA.', true)], undefined, ['Assets']) },
  '/api/v1/asset/peers': { get: op('Comparação setorial e pares: setor, subsetor, segmento, índices, commodities e pares', [qp('ticker', { type: 'string', example: 'PETR4' }, 'Ticker B3 sem .SA.', true)], undefined, ['Assets']) },
  '/api/v1/asset/source-map': { get: op('Mapa de fonte/confiança por campo para auditoria de precisão', [qp('ticker', { type: 'string', example: 'PETR4' }, 'Ticker B3 sem .SA.', true)], undefined, ['Assets']) },
  '/api/v1/asset/quality': { get: op('Auditoria de qualidade do ativo: consistência por campo, orçamento de payload, cobertura, maturidade e integridade', [qp('ticker', { type: 'string', example: 'PETR4' }, 'Ticker para auditar qualidade.', true)], undefined, ['Assets']) },
  '/api/v1/asset/action-plan': { get: op('Plano de ação por ativo para app: renderização, cache, banner, próximos endpoints e prioridades', [qp('ticker', { type: 'string', example: 'PETR4' }, 'Ticker para gerar plano de ação.', true)], undefined, ['Assets']) },
  '/api/v1/asset/indicators': { get: op('Taxonomia e cobertura de indicadores por classe de ativo, com campos críticos ausentes', [qp('ticker', { type: 'string', example: 'PETR4' }, 'Ticker B3 sem .SA.', true)], undefined, ['Assets']) },
  '/api/v1/fii/profile': { get: op('Perfil de FII: CNPJ, público-alvo, mandato, segmento, gestão, duração e taxa', [qp('ticker', { type: 'string', example: 'HGLG11' }, 'Ticker FII.', true)], undefined, ['FIIs']) },
  '/api/v1/fii/income': { get: op('Rendimentos de FII: DY, yields 1/3/6/12m, último rendimento e total pago', [qp('ticker', { type: 'string', example: 'HGLG11' }, 'Ticker FII.', true)], undefined, ['FIIs']) },
  '/api/v1/fii/patrimonial': { get: op('Patrimonial de FII: P/VP, VP por cota, patrimônio total e cotas emitidas', [qp('ticker', { type: 'string', example: 'HGLG11' }, 'Ticker FII.', true)], undefined, ['FIIs']) },
  '/api/v1/fii/portfolio': { get: op('Portfólio imobiliário de FII: imóveis, estados, ABL e concentração quando disponível', [qp('ticker', { type: 'string', example: 'HGLG11' }, 'Ticker FII.', true)], undefined, ['FIIs']) },
  '/api/v1/fii/vacancy': { get: op('Vacância de FII: física, financeira e flags de disponibilidade', [qp('ticker', { type: 'string', example: 'HGLG11' }, 'Ticker FII.', true)], undefined, ['FIIs']) },
  '/api/v1/fii/communications': { get: op('Comunicados de FII: relatórios, informes, fatos relevantes e links captados', [qp('ticker', { type: 'string', example: 'HGLG11' }, 'Ticker FII.', true)], undefined, ['FIIs']) },
  '/api/v1/fii/checklist': { get: op('Checklist educativo de FII inspirado em critérios buy and hold e qualidade operacional', [qp('ticker', { type: 'string', example: 'HGLG11' }, 'Ticker FII.', true)], undefined, ['FIIs']) },
  '/api/v1/fii/indicators': { get: op('Taxonomia e cobertura de indicadores específica para FIIs', [qp('ticker', { type: 'string', example: 'HGLG11' }, 'Ticker FII.', true)], undefined, ['FIIs']) },
  '/api/v2/asset': { get: op('Dados de ativo com envelope v2', assetParams, undefined, ['Assets']), post: op('Dados de ativo via JSON com envelope v2', [], postJsonBody, ['Assets']) },
  '/api/v1/assets': { get: op('Batch de ativos via router v1', [tickersParam, ...assetParams.filter(p => p.name !== 'ticker')], undefined, ['Assets']), post: op('Batch de ativos via JSON no router v1', [], postJsonBody, ['Assets']) },
  '/api/v1/compare': { get: op('Compara tickers e ranqueia por score, valor, renda e qualidade', [tickersParam, qp('profile', { type: 'string', enum: ['dividendos','conservador','crescimento','valor','rendaFii'] })], undefined, ['Market']), post: op('Compara tickers via JSON', [], postJsonBody, ['Market']) },
  '/api/v1/market/rankings': { get: op('Rankings de ações/FIIs com modo ao vivo Investidor10 e captura completa', [qp('type', { type: 'string', enum: ['ACAO','FII'], default: 'ACAO' }), qp('source', { type: 'string', enum: ['auto','live','compare'], default: 'auto' }), qp('mode', { type: 'string', enum: ['auto','complete'], default: 'auto' }), qp('strict', { type: 'boolean', default: false }), qp('limit', { type: 'integer', default: 15 }), qp('minRows', { type: 'integer', default: 6 }), qp('maxItems', { type: 'integer', default: 20 })], undefined, ['Market']) },
  '/api/v1/market/indices': { get: op('Índices de mercado', [], undefined, ['Market']) },
  '/api/v1/market/ipca': { get: op('IPCA/BCB', [], undefined, ['Market']) },
  '/api/v1/asset/history': { get: op('Cotação histórica via Yahoo Chart', [qp('ticker', { type: 'string' }, '', true), qp('range', { type: 'string', default: '1Y' })], undefined, ['Assets']) },
  '/api/v1/asset/dividends': { get: op('Dividendos por ativo', [qp('ticker', { type: 'string' }, '', true)], undefined, ['Assets']) },
  '/api/v1/asset/next-dividend': { get: op('Próximo dividendo/provento', [qp('ticker', { type: 'string' }, '', true)], undefined, ['Assets']) },
  '/api/v1/scrape': { get: op('Scrape seguro com seletores customizados simples', [qp('url', { type: 'string', format: 'uri' }), qp('selector', { type: 'string' })], undefined, ['Scrape']), post: op('Scrape seguro via JSON com selectors', [], postJsonBody, ['Scrape']) },
  '/api/v1/batch-scrape': { post: op('Batch scrape com deduplicação, fallback, selectors por job e sourceDrift', [], postJsonBody, ['Scrape']) },
  '/api/v1/cache/stats': { get: op('Métricas de cache em memória, hit/miss, in-flight e stores', [], undefined, ['System']) },
  '/api/v1/portfolio/analyze': { get: op('Análise de carteira por parâmetros simples', [], undefined, ['Portfolio']), post: op('Análise completa de carteira', [], { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PortfolioAnalyzeRequest' } } } }, ['Portfolio']) },
  '/api/v1/portfolio/allocation': { post: op('Alocação por ticker, classe, setor e conta', [], postJsonBody, ['Portfolio']) },
  '/api/v1/portfolio/income': { post: op('Renda passiva estimada, DY e calendário de proventos', [], postJsonBody, ['Portfolio']) },
  '/api/v1/portfolio/risk': { post: op('Concentração, diversificação e flags de risco', [], postJsonBody, ['Portfolio']) },
  '/api/v1/portfolio/rebalance': { post: op('Rebalanceamento por classe ou ticker', [], postJsonBody, ['Portfolio']) },
  '/api/v1/portfolio/history': { get: op('Histórico consolidado da carteira', [], undefined, ['Portfolio']), post: op('Histórico consolidado via JSON', [], postJsonBody, ['Portfolio']) },
  '/api/v1/watchlist/analyze': { get: op('Análise de watchlist', [tickersParam], undefined, ['Portfolio']), post: op('Análise de watchlist via JSON', [], postJsonBody, ['Portfolio']) },
  '/api/v1/fields': { get: op('Catálogo de campos estáveis e controles de payload', [], undefined, ['System']) },
  '/api/v1/integration/sdk': { get: op('SDK mínimo Web/Android com view=app, headers de monitoramento e regras anti-tela-vazia', [], undefined, ['Integration']) },
  '/api/v1/integration/prompts': { get: op('Prompts prontos para IA integrar APK/Web, auditar cobertura e conectar o monitor do proxy', [], undefined, ['Integration']) },
  '/api/v1/integration/manifest': { get: op('Manifesto vivo de integração com headers, roots estáveis, views, endpoints e regras anti-tela-vazia', [], undefined, ['Integration']) },
  '/api/v1/engine/maturity': { get: op('Auditoria por ticker de performance, precisão, confiabilidade, cobertura de indicadores e sincronização do app', [qp('ticker', { type: 'string', example: 'PETR4' }, 'Ticker para auditar maturidade.', true), qp('view', { type: 'string', example: 'app' }, 'View usada para avaliar contrato do app.')], undefined, ['Engine']) },
  '/api/v1/engine/performance': { get: op('Profiler de runtime do Engine por etapa: fontes, montagem, contratos, guardrails, gargalos e gate de lançamento pessoal', [qp('ticker', { type: 'string', example: 'PETR4' }, 'Ticker para medir performance.', true), qp('view', { type: 'string', example: 'app' }, 'View usada para medir peso e montagem.'), qp('profile', { type: 'string', example: 'fast' }, 'Perfil de performance.'), qp('nocache', { type: 'boolean' }, 'Ignora cache de resultado.')], undefined, ['Engine']) },
  '/api/v1/errors': { get: op('Catálogo de erros', [], undefined, ['System']) },
  '/api/v1/openapi': { get: op('Especificação OpenAPI', [], undefined, ['System']) },
  '/api/compat/scraper4': { get: op('Compatibilidade com Scraper (4).js via query string', [], undefined, ['Compat']), post: op('Compatibilidade com Scraper (4).js via JSON', [], postJsonBody, ['Compat']) },
  '/api/sync': { get: op('Endpoint legado desativado na build free-only', [], undefined, ['Compat']), post: op('Endpoint legado desativado na build free-only', [], postJsonBody, ['Compat']) },
};

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version, methods: ['GET'], route: 'openapi', rateMax: Number(process.env.VALORAE_RATE_LIMIT_HEALTH_MAX || 180), profile: 'openapi', cacheControl: 'private, max-age=60' });
  if (route.done) return;
  return sendJson(req, res, {
    openapi: '3.1.0',
    info: {
      title: 'Valorae Investment Data API',
      version,
      description: 'API HTTP/JSON para ativos, mercado, comparação, dividendos, watchlist, carteira e observabilidade do servidor visual. Compatível com GitHub/Vercel gratuito, router interno v1/v2, appPayload anti-tela-vazia, appMobileSnapshot, appResponseIntegrity, engineEfficiency, payloadViewProfile e vercelRuntime e proxyOutputMonitor para APK/Web e apenas uma Function física.'
    },
    servers: [{ url: process.env.VALORAE_PUBLIC_BASE_URL || 'https://valorae-proxy.vercel.app' }],
    paths,
    components: {
      schemas: {
        FinancialField: { type: 'object', properties: { display: { type: 'string' }, value: { type: ['number','null'] }, unit: { type: 'string' }, source: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 } } },
        AssetPayload: { type: 'object', properties: { version: { type: 'string' }, schemaVersion: { type: 'string' }, status: { type: 'string', enum: ['OK','PARTIAL','ERROR'] }, ticker: { type: 'string' }, type: { type: 'string' }, results: { type: 'object' }, normalized: { type: 'object', additionalProperties: { $ref: '#/components/schemas/FinancialField' } }, chartSeries: { type: 'object' }, panelReadiness: { type: 'object' }, consumerDiagnostics: { type: 'object' }, appPayload: { type: 'object' }, appRenderContract: { type: 'object' }, appDataContract: { type: 'object' }, appSyncEnvelope: { type: 'object' }, appMobileSnapshot: { type: 'object' }, appResponseIntegrity: { type: 'object' }, engineEfficiency: { type: 'object' }, engineMaturityBooster: { type: 'object' }, fieldConsistencyGuard: { type: 'object' }, payloadBudget: { type: 'object' }, assetActionPlan: { type: 'object' }, engineRuntimeProfiler: { type: 'object' }, engineLaunchGate: { type: 'object' }, assetClassContract: { type: 'object' }, assetIndicatorCoverage: { type: 'object' }, engineModuleTree: { type: 'object' }, payloadViewProfile: { type: 'object' }, quality: { type: 'object' }, parserResilience: { type: 'object' } } },
        EnvelopeV2: { type: 'object', properties: { ok: { type: 'boolean' }, schemaVersion: { const: 'envelope-v2' }, version: { type: 'string' }, requestId: { type: 'string' }, data: { type: 'object' }, meta: { type: 'object' } } },
        Position: { type: 'object', properties: { ticker: { type: 'string' }, quantity: { type: 'number' }, averagePrice: { type: 'number' }, currentPrice: { type: 'number' }, currentValue: { type: 'number' }, investedValue: { type: 'number' }, targetPercent: { type: 'number' }, type: { type: 'string', examples: ['ACAO','FII','ETF','CASH','RENDA_FIXA'] }, annualRatePercent: { type: 'number', description: 'Taxa anual informada para renda fixa/caixa remunerado.' }, indexer: { type: 'string', examples: ['CDI','IPCA','PRE'] }, liquidityDays: { type: 'number' }, maturityDate: { type: 'string' }, issuer: { type: 'string' }, taxExempt: { type: 'boolean' }, objective: { type: 'string' }, account: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } } },
        PortfolioAnalyzeRequest: { type: 'object', properties: { positions: { type: 'array', items: { $ref: '#/components/schemas/Position' } }, targetsByType: { type: 'object' }, targetsByTicker: { type: 'object' }, cashAvailable: { type: 'number' }, monthlyContribution: { type: 'number' }, projectionYears: { type: 'number' }, expectedReturnAnnualPercent: { type: 'number' }, inflationAnnualPercent: { type: 'number' }, view: { enum: ['app','production','launch','public','instant','ultra','tiny','quote','card','mobile','snapshot','sync','wallet','portfolio','watchlist','list','detail','analysis','compact','standard','full'] }, profile: { enum: ['instant','ultra','quote','card','wallet','analysis','fast','standard','deep','portfolio'] } } },
        PortfolioIntelligence: { type: 'object', properties: { incomeCalendar: { type: 'object' }, incomeCoverage: { type: 'object' }, liquidity: { type: 'array', items: { type: 'object' } }, goalProjection: { type: 'object' }, dataCompleteness: { type: 'object' }, taxPlanner: { type: 'object' }, technologyReadiness: { type: 'object' }, concentrationMap: { type: 'object' }, positionRanking: { type: 'object' }, passiveIncomeProjection: { type: 'object' }, rebalanceRoadmap: { type: 'object' }, objectiveProgress: { type: 'object' }, portfolioNarrative: { type: 'object' }, actionPlan: { type: 'array', items: { type: 'object' } } } },
        SourceDriftReport: { type: 'object', properties: { sourceDrift: { type: 'boolean' }, severity: { type: 'string' }, selectorCoverage: { type: 'number' }, changedSelectors: { type: 'array', items: { type: 'string' } }, recommendation: { type: 'string' } } },
        CacheStats: { type: 'object', properties: { driver: { type: 'object' }, caches: { type: 'object' }, providers: { type: 'object' }, freeOnly: { type: 'boolean' } } },
        ServerMetrics: { type: 'object', properties: { summary: { type: 'object' }, vercelRuntime: { type: 'object', description: 'Ambiente, região, URL, git, origem Vercel observada e contexto interno isolado do dashboard.' }, deliveryHarmony: { type: 'object' }, proxyOutputMonitor: { type: 'object', description: 'Espelho das respostas que saem do proxy para apps/usuários, com feed, rotas, raízes transformadas e preview limitado.' }, personalReleaseReadiness: { type: 'object', description: 'Score/checklist de maturidade para uso pessoal controlado.' }, payloadIntelligence: { type: 'object' }, distributions: { type: 'object' }, routeDetails: { type: 'array', items: { type: 'object' } }, recentEvents: { type: 'array', items: { type: 'object' } } } },
        Readiness: { type: 'object', properties: { status: { enum: ['READY','NOT_READY'] }, ready: { type: 'boolean' }, checks: { type: 'array', items: { type: 'object' } }, freeOnly: { type: 'boolean' } } },
        ValoraeManifest: { type: 'object', properties: { release: { type: 'string' }, freeOnly: { type: 'boolean' }, physicalFunctions: { type: 'array', items: { type: 'string' } }, routes: { type: 'array', items: { type: 'string' } }, capabilities: { type: 'object' } } },
        EnvCatalog: { type: 'object', properties: { total: { type: 'integer' }, configured: { type: 'integer' }, requiredMissing: { type: 'array', items: { type: 'string' } }, rows: { type: 'array', items: { type: 'object' } } } },
        SourceStatus: { type: 'object', properties: { status: { enum: ['OK','DEGRADED'] }, providers: { type: 'array', items: { type: 'object' } }, sourceReliability: { type: 'object' }, personalReleaseReadiness: { type: 'object' } } },
        PersonalReleaseReadiness: { type: 'object', properties: { version: { type: 'string' }, status: { type: 'string' }, score: { type: 'number' }, grade: { type: 'string' }, audience: { type: 'string' }, categories: { type: 'array', items: { type: 'object' } }, launchChecklist: { type: 'array', items: { type: 'object' } } } },
        PerformanceProfile: { enum: ['instant','ultra','quote','card','wallet','analysis','fast','standard','deep','portfolio'], description: 'Aliases públicos e perfis internos suportados.' },
        ErrorResponse: { type: 'object', properties: { version: { type: 'string' }, requestId: { type: 'string' }, status: { type: 'string' }, code: { type: 'string' }, error: { type: 'string' } } }
      }
    },
    xValorae: {
      version,
      launchContract: 'view=app + assetClassContract + assetIndicatorCoverage + engineMaturityBooster + engineRuntimeProfiler + engineLaunchGate + endpoints especializados de Ação/FII',
      optionalClientAuth: 'VALORAE_CLIENT_KEYS + x-valorae-app-id/x-valorae-client-key ou HMAC',
      audit: 'v21.12.52: hardening pós-benchmark de performance, espelhamento HTML do Monitor e higiene do pacote; v21.12.49: auditoria extrema pré-integração, logo padronizado e Monitor responsivo; v21.12.48: Monitor Chart Rendering Boost com CVM/camada canônica para dados lentos, status por blocos e preservação de Investidor10/StatusInvest como fontes ricas; v21.12.41: extração turbo com score crítico, complemento StatusInvest sob demanda e cache key ciente de completude; v21.12.40: extração adaptativa anti-PARTIAL, último snapshot real e prefetch de cotação; v21.12.39: auditoria completa de lançamento, release sync e higiene de pacote; v21.12.38: hardening do relatório de falhas; v21.12.29: guardião de consistência, orçamento de payload, plano de ação e manifesto de integração; v21.12.28: taxonomia de indicadores, maturidade do engine, cache numérico LRU e endpoints indicators/maturity; v21.12.27: contratos especializados Ação/FII inspirados no Investidor10; v21.12.26: personal readiness, versão limpa, monitor com maturidade; v21.12.0: launch readiness, ready/manifest endpoints, auditoria sem tsc externo, source reliability, cache metrics, carteira inteligente e OpenAPI ampliado, mantendo free-only.',
      vercelCompatible: true,
      freeOnly: true,
      physicalFunctions: ['api/router.js'],
      router: 'routes/_router.js',
      inspector: '/inspector.html',
    }
  }, { status: 200, engineVersion: version, profile: 'openapi', cachePolicy: 'etag', cacheControl: 'private, max-age=60' });
}
