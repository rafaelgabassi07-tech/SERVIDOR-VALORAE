(() => {
  'use strict';

  const root = document.querySelector('[data-flow-map]');
  if (!root) return;

  const ALL_JOURNEYS = ['home', 'modal', 'analysis', 'quotes', 'portfolio', 'sync', 'daily', 'logos', 'failures'];
  const CORE = ['*'];

  const journeys = [
    { id: 'all', label: 'Visão completa' },
    { id: 'home', label: 'Home, notícias e rankings' },
    { id: 'modal', label: 'Modal de Ação ou FII' },
    { id: 'analysis', label: 'Análise de ativos' },
    { id: 'quotes', label: 'Cotações e histórico' },
    { id: 'portfolio', label: 'Carteira e patrimônio' },
    { id: 'sync', label: 'Sincronização Supabase' },
    { id: 'daily', label: 'Fechamento diário' },
    { id: 'logos', label: 'Logotipos' },
    { id: 'failures', label: 'Falhas e fallbacks' },
  ];

  const lanes = [
    { id: 'ui', index: '01', title: 'Usuário e interface', subtitle: 'Ação, tela Compose e resultado percebido', color: '#65c987', soft: 'rgba(101,201,135,.09)' },
    { id: 'apk', index: '02', title: 'Camadas internas do APK', subtitle: 'ViewModel, Repository, Room, serviços e workers', color: '#75a7ff', soft: 'rgba(117,167,255,.09)' },
    { id: 'transport', index: '03', title: 'Comunicação HTTPS', subtitle: 'OkHttp, headers, JSON e contrato de resposta', color: '#8db5ff', soft: 'rgba(117,167,255,.075)' },
    { id: 'proxy', index: '04', title: 'Proxy VALORAE', subtitle: 'Roteamento e módulos específicos por jornada', color: '#e8bd58', soft: 'rgba(232,189,88,.09)' },
    { id: 'resilience', index: '05', title: 'Cache, segurança e resiliência', subtitle: 'Compatibilidade, autenticação, limites e recuperação', color: '#b38cff', soft: 'rgba(179,140,255,.085)' },
    { id: 'external', index: '06', title: 'Fontes externas e Supabase', subtitle: 'Mercado, conteúdo público e dados privados', color: '#3fc5b5', soft: 'rgba(63,197,181,.085)' },
    { id: 'return', index: '07', title: 'Retorno, persistência e interface', subtitle: 'Validação, continuidade, Room e renderização', color: '#f3a84f', soft: 'rgba(243,168,79,.075)' },
  ];

  const nodes = [
    {
      id: 'user-start', lane: 'ui', column: 0, row: 0, type: 'start', journeys: CORE,
      title: 'Usuário inicia uma jornada', shortDescription: 'Abre uma tela, seleciona um ativo, atualiza conteúdo ou aciona sincronização.',
      component: 'Interação do usuário', sourceFile: ['ui/PortfolioScreen.kt', 'ui/AnalysisScreen.kt', 'ui/AssetDetailsModalUi.kt'],
      input: 'Toque, abertura de tela, pull-to-refresh, ação do modal ou execução de worker.', output: 'Evento de UI com contexto da jornada.',
      cache: 'Não se aplica.', timeout: 'Não se aplica.', retry: 'Somente quando a jornada permite.', fallback: 'A interface pode manter conteúdo anterior.',
      errors: ['Ação cancelada pelo ciclo de vida', 'Tela fechada antes da resposta'], userImpact: 'Início visível do fluxo.', security: 'Nenhuma credencial é exibida na interface.'
    },
    {
      id: 'compose-ui', lane: 'ui', column: 1, row: 0, type: 'action', journeys: CORE,
      title: 'Compose UI identifica a necessidade', shortDescription: 'A tela emite intenção e observa estado sem chamar rede diretamente.',
      component: 'Compose + estado de tela', sourceFile: ['ui/PortfolioHomeUi.kt', 'ui/PortfolioNewsUi.kt', 'ui/AnalysisScreenContent.kt'],
      input: 'Evento de interação e estado atualmente exibido.', output: 'Intenção encaminhada ao ViewModel.', cache: 'Pode reaproveitar estado em memória.',
      timeout: 'Controlado pela coroutine da tela.', retry: 'Atualização manual quando disponível.', fallback: 'Mantém último estado renderizável.',
      errors: ['Recomposição não deve duplicar requisições'], userImpact: 'Feedback visual imediato e carregamento progressivo.', security: 'UI não contém service role ou segredo do servidor.'
    },
    {
      id: 'ui-success', lane: 'return', column: 20, row: 0, type: 'success', journeys: CORE,
      title: 'Conteúdo atualizado', shortDescription: 'A tela apresenta dados novos ou preservados com estado coerente.',
      component: 'Renderização Compose', sourceFile: ['ui/PortfolioViewModel.kt', 'ui/AssetDetailsModalViewModel.kt'],
      input: 'Estado validado pelo Repository e ViewModel.', output: 'Cards, gráficos, notícias, rankings, modal ou confirmação de sync.',
      cache: 'O conteúdo passa a ser reutilizável conforme sua política.', timeout: 'Não se aplica.', retry: 'Nova atualização somente por evento autorizado.',
      fallback: 'Pode indicar conteúdo preservado ou parcial.', errors: [], userImpact: 'Conclusão bem-sucedida.', security: 'Somente campos permitidos pelo contrato são renderizados.'
    },
    {
      id: 'ui-error', lane: 'return', column: 20, row: 1, type: 'failure', journeys: ['failures', '*'],
      title: 'Erro útil ou conteúdo preservado', shortDescription: 'A interface diferencia indisponibilidade, incompatibilidade, autenticação e dados inválidos.',
      component: 'Política de falha da UI', sourceFile: ['domain/ValoraeFailurePolicy.kt', 'ui/AssetModalFallbackPolicy.kt', 'ui/SyncStatusUi.kt'],
      input: 'Falha tipada e existência ou não de conteúdo local.', output: 'Mensagem acionável, estado parcial ou preservação do último conteúdo.',
      cache: 'Usa último dado íntegro quando permitido.', timeout: 'Exibe estado de timeout sem travar a tela.', retry: 'Manual ou controlado por worker.',
      fallback: 'Conteúdo local, cache durável ou erro vazio.', errors: ['NETWORK', 'UPDATE_REQUIRED', 'AUTH_REQUIRED', 'INVALID_CONTRACT'],
      userImpact: 'Evita tela em branco e mensagem genérica.', security: 'Mensagens sanitizadas; nenhum detalhe sensível do servidor.'
    },
    {
      id: 'viewmodel', lane: 'apk', column: 2, row: 0, type: 'action', journeys: CORE,
      title: 'ViewModel orquestra o estado', shortDescription: 'Deduplica intenções, cancela operações obsoletas e coordena carregamento progressivo.',
      component: 'ViewModel', sourceFile: ['ui/PortfolioViewModel.kt', 'ui/AssetDetailsModalViewModel.kt', 'ui/AnalysisRuntimeState.kt'],
      input: 'Intenção da UI e contexto atual.', output: 'Chamada ao Repository e estados loading/data/error.', cache: 'Estado em memória por jornada.',
      timeout: 'Limitado pela chamada do Repository.', retry: 'Somente para operação ainda relevante.', fallback: 'Mantém estado anterior enquanto atualiza.',
      errors: ['Resposta tardia de outro ticker', 'Coroutine cancelada'], userImpact: 'Evita saltos, duplicação e conteúdo de ativo errado.', security: 'Não monta credenciais de servidor.'
    },
    {
      id: 'background-worker', lane: 'apk', column: 2, row: 1, type: 'action', journeys: ['sync', 'daily', 'home'],
      title: 'Worker inicia fluxo em segundo plano', shortDescription: 'WorkManager executa sync, alertas ou fechamento diário sob condições autorizadas.',
      component: 'WorkManager', sourceFile: ['data/notifications/ValoraeDailyCloseWorker.kt', 'data/notifications/ValoraeNotificationWorker.kt', 'data/sync/SyncOutboxWorker.kt'],
      input: 'Agenda, conectividade, outbox pendente ou janela de fechamento.', output: 'Execução idempotente da jornada correspondente.',
      cache: 'Consulta Room e estado da outbox.', timeout: 'Limitado pela política do worker e HTTP.', retry: 'Backoff controlado; fechamento diário limitado à janela útil.',
      fallback: 'Reagenda somente quando seguro.', errors: ['Sistema encerra worker', 'Sem rede', 'Fora da janela operacional'],
      userImpact: 'Atualizações confiáveis sem abrir o app.', security: 'Sessão e payload mínimo; sem segredo privilegiado no APK.'
    },
    {
      id: 'repository', lane: 'apk', column: 3, row: 0, type: 'action', journeys: CORE,
      title: 'Repository decide a fonte', shortDescription: 'Centraliza contratos locais e remotos e impede que a UI conheça transporte.',
      component: 'ValoraeRemoteRepository', sourceFile: ['domain/repository/ValoraeRemoteRepository.kt', 'data/proxy/ValoraeRemoteRepositoryImpl.kt', 'data/AssetRepository.kt'],
      input: 'Operação tipada e parâmetros normalizados.', output: 'Dados locais imediatos ou solicitação remota.', cache: 'Room, memória, HTTP cache e cache durável de cotações.',
      timeout: 'Herdado do serviço específico.', retry: 'Definido por tipo de operação.', fallback: 'Conteúdo local íntegro.',
      errors: ['Contrato remoto incompatível', 'Persistência indisponível'], userImpact: 'Uma única fonte de verdade para a tela.', security: 'Separa domínio, dados locais e rede.'
    },
    {
      id: 'local-data-decision', lane: 'apk', column: 4, row: 0, type: 'decision', journeys: CORE,
      title: 'Existe conteúdo local utilizável?', shortDescription: 'Compara idade, integridade, jornada e necessidade de refresh forçado.',
      component: 'Política de cache local', sourceFile: ['data/cache/ValoraeCachePolicy.kt', 'data/AppDatabase.kt', 'ui/PortfolioHomeRuntimeCache.kt'],
      input: 'Dado local, timestamp, origem e flags refresh/nocache.', output: 'Usar local agora ou iniciar comunicação remota.',
      cache: 'Políticas diferentes para notícias, rankings, modal, cotações e carteira.', timeout: 'Não se aplica.', retry: 'Não se aplica.',
      fallback: 'Mesmo conteúdo pode ser mantido durante refresh.', errors: ['Dado expirado', 'Dado incompleto', 'Cache ausente'], userImpact: 'Abertura rápida e menos rede.', security: 'Dados privados continuam no banco local criptografado conforme plataforma.'
    },
    {
      id: 'local-cache-hit', lane: 'apk', column: 5, row: 0, type: 'cache', journeys: CORE,
      title: 'Room ou memória atende imediatamente', shortDescription: 'Conteúdo válido segue para o estado sem aguardar o Proxy.',
      component: 'Room / memória', sourceFile: ['data/AssetDao.kt', 'data/AppDatabase.kt', 'data/proxy/ValoraeDurableQuoteStore.kt'],
      input: 'Registro local íntegro.', output: 'Modelo de domínio pronto para renderização.', cache: 'HIT local.', timeout: 'Leitura local.',
      retry: 'Refresh pode ocorrer em paralelo quando permitido.', fallback: 'É o próprio fallback principal.', errors: ['Migração ou leitura local falhou'], userImpact: 'Conteúdo instantâneo.', security: 'Nenhuma chamada externa.'
    },
    {
      id: 'request-normalizer', lane: 'apk', column: 5, row: 1, type: 'action', journeys: CORE,
      title: 'Serviço monta a requisição mínima', shortDescription: 'Normaliza ticker, range, posições, IDs e budgets antes do HTTP.',
      component: 'Serviços do Proxy no APK', sourceFile: ['data/proxy/ValoraeProxyClient.kt', 'data/proxy/ValoraePortfolioRequestNormalizer.kt', 'data/proxy/ValoraeUniversalAssetModalService.kt'],
      input: 'Parâmetros do domínio.', output: 'Query ou JSON canônico, sem campos redundantes.', cache: 'Pode enviar ETag/cache-control via OkHttp.',
      timeout: 'Budget por jornada.', retry: 'Somente chamadas idempotentes ou outbox segura.', fallback: 'Reverte para conteúdo local.', errors: ['Ticker inválido', 'Payload excede limite local'], userImpact: 'Menor latência e consumo de dados.', security: 'Payload mínimo e sem service role.'
    },
    {
      id: 'okhttp-client', lane: 'apk', column: 6, row: 1, type: 'transport', journeys: CORE,
      title: 'OkHttp aplica transporte e headers', shortDescription: 'Pool compartilhado, cache HTTP, cancelamento e timeouts específicos.',
      component: 'ValoraeProxyHttp', sourceFile: ['data/proxy/ValoraeProxyHttp.kt', 'data/http/ValoraeHttpResources.kt', 'data/http/CancellableOkHttp.kt'],
      headers: ['X-Valorae-App', 'X-Valorae-Channel', 'X-Valorae-App-Version', 'X-Valorae-Mobile-Protocol', 'X-Valorae-Delivery-Schema', 'X-Request-Id'],
      input: 'URL, método, query/body e request ID.', output: 'Request HTTPS cancelável.', cache: 'OkHttp cache conforme Cache-Control e política local.',
      timeout: 'Connect 15 s; read 32 s; chamada entre 3,5 s e 32 s conforme budget.', retry: 'retryOnConnectionFailure para falhas de transporte; lógica de negócio permanece controlada.',
      fallback: 'Retorna Result tipado ao Repository.', errors: ['DNS', 'TLS', 'timeout', 'cancelamento', 'HTTP não-2xx'], userImpact: 'Rede previsível e cancelável.', security: 'HTTPS, headers de identidade do app e nenhum segredo do servidor.'
    },
    {
      id: 'https-request', lane: 'transport', column: 7, row: 0, type: 'transport', journeys: CORE,
      title: 'APK → Proxy: HTTPS + JSON', shortDescription: 'A operação cruza a rede com rota canônica, versão, protocolo e request ID.',
      component: 'Canal HTTPS', sourceFile: 'data/proxy/ValoraeProxyHttp.kt', endpoint: 'Depende da jornada selecionada', method: ['GET', 'POST'],
      headers: ['Accept: application/json', 'X-Valorae-App-Version', 'X-Valorae-Mobile-Protocol', 'X-Request-Id'], input: 'Query ou payload JSON mínimo.', output: 'Requisição recebida pelo roteador.',
      cache: 'GET pode ser atendido pelo cache HTTP.', timeout: 'Budget do cliente.', retry: 'Apenas conforme política da jornada.', fallback: 'Erro de transporte volta ao Repository.', errors: ['Sem conectividade', 'TLS/DNS', 'timeout'], userImpact: 'Ponto de comunicação entre os dois sistemas.', security: 'Sem tráfego HTTP aberto.'
    },
    {
      id: 'router-entry', lane: 'proxy', column: 8, row: 0, type: 'action', journeys: CORE,
      title: 'Router recebe e observa a requisição', shortDescription: 'Normaliza prefixo /api/v1, aplica CORS, request ID, limites iniciais e métricas.',
      component: 'Router principal', sourceFile: ['api/router.js', 'routes/_router.js', 'lib/observability/request-metrics.js'],
      input: 'Request HTTP do APK.', output: 'Path normalizado, método e payload prontos para gates.', cache: 'Métricas e estado compartilhado por instância.',
      timeout: 'Inicia medição da rota.', retry: 'Não repete automaticamente a requisição completa.', fallback: 'Erro é sanitizado pelo guard.', errors: ['Método inválido', 'URL ou body excessivo'], userImpact: 'Entrada única e rastreável.', security: 'Security headers, budgets de URL/body e request ID seguro.'
    },
    {
      id: 'route-selector', lane: 'proxy', column: 9, row: 0, type: 'decision', journeys: CORE,
      title: 'Qual módulo atende a jornada?', shortDescription: 'Seleciona somente a rota necessária e importa o módulo sob demanda.',
      component: 'Allowlist e lazy imports', sourceFile: 'routes/_router.js', input: 'Path normalizado.', output: 'Handler específico ou 404.',
      cache: 'Módulos lazy ficam reutilizáveis na instância.', timeout: 'Incluído no tempo da rota.', retry: 'Não se aplica.', fallback: 'Rota desconhecida é rejeitada.',
      errors: ['NOT_FOUND', 'Método não permitido'], userImpact: 'Cold start menor e comportamento previsível.', security: 'Em produção, rotas internas ficam fora da allowlist.'
    },
    {
      id: 'route-home', lane: 'proxy', column: 10, row: 0, type: 'action', journeys: ['home'],
      title: 'Feed, alertas e rankings', shortDescription: 'Consolida conteúdo da Home com caches e TTL independentes.',
      component: 'News, rankings e mobile alerts', sourceFile: ['lib/sources/news.js', 'lib/sources/adapters/index.js', 'routes/_router.js'],
      endpoint: ['/api/v1/news', '/api/v1/news/article', '/api/v1/market/rankings', '/api/v1/mobile/alerts'], method: ['GET', 'POST'],
      input: 'Categoria, ticker, paginação ou posições.', output: 'Notícias deduplicadas, artigo seguro, rankings e alertas.', cache: 'News com max-age/stale-while-revalidate; rankings com TTL próprio.',
      timeout: 'Deadlines por fonte.', retry: 'Fallback de fonte e cache anterior.', fallback: 'Último conteúdo íntegro ou lista parcial marcada.', errors: ['Feed vazio', 'Parser falhou', 'Fonte indisponível'], userImpact: 'Home continua útil durante degradação.', security: 'Artigos passam por validação HTTPS, DNS, redirects e limite de bytes.'
    },
    {
      id: 'route-modal', lane: 'proxy', column: 10, row: 1, type: 'action', journeys: ['modal'],
      title: 'Modal universal de Ação ou FII', shortDescription: 'Entrega contrato progressivo com cotação, fundamentos, histórico e seções específicas.',
      component: 'Asset modal contract', sourceFile: ['lib/analysis/asset-modal-contract.js', 'lib/sources/asset-details.js', 'routes/_router.js'],
      endpoint: ['/api/v1/asset/modal', '/api/v1/asset/history', '/api/v1/asset/quote'], method: ['GET', 'POST'],
      input: 'Ticker, stage, range, budgets e request ID.', output: 'Contrato modal normalizado com qualidade por seção.', cache: 'Fast cache, contract continuity e cache de fontes.',
      timeout: 'Stages fast/full com deadlines próprios.', retry: 'Requisição cancelável ao trocar ticker; recovery controlado.', fallback: 'Skeleton, cache anterior e seções parciais.',
      errors: ['Ticker desconhecido', 'Seção atrasada', 'Contrato incompleto'], userImpact: 'Modal abre rápido e completa progressivamente.', security: 'Validação de ticker, budgets e remoção de campos retirados.'
    },
    {
      id: 'route-analysis', lane: 'proxy', column: 10, row: 2, type: 'action', journeys: ['analysis'],
      title: 'Análise e descoberta de ativos', shortDescription: 'Combina catálogo, cotações, índices, retornos e fundamentos para páginas de análise.',
      component: 'Market + analysis', sourceFile: ['lib/sources/quotes.js', 'lib/portfolio/analysis.js', 'routes/market/indices.js'],
      endpoint: ['/api/v1/assets', '/api/v1/quotes', '/api/v1/market/indices', '/api/v1/portfolio/returns'], method: ['GET', 'POST'],
      input: 'Tickers, filtros, range e posições.', output: 'Catálogo, séries, benchmarks e retornos normalizados.', cache: 'Batch quotes, cache de índices e retornos.',
      timeout: 'Budget por provedor.', retry: 'Fallback entre fontes autorizadas.', fallback: 'Série anterior, benchmark parcial ou lista local.', errors: ['Série vazia', 'Ticker sem cobertura', 'Índice indisponível'], userImpact: 'Análise continua navegável sem números inventados.', security: 'Somente fontes públicas autorizadas.'
    },
    {
      id: 'route-quotes', lane: 'proxy', column: 10, row: 3, type: 'action', journeys: ['quotes'],
      title: 'Cotações e histórico', shortDescription: 'Busca cotação individual, batch e candles conforme range e intervalo.',
      component: 'Quote/history providers', sourceFile: ['lib/sources/quotes.js', 'lib/sources/asset-details.js', 'routes/asset/history.js'],
      endpoint: ['/api/v1/asset/quote', '/api/v1/quotes', '/api/v1/asset/history'], method: ['GET', 'POST'],
      input: 'Ticker(s), range e interval.', output: 'Preço, variação, timestamp e pontos históricos.', cache: 'Cache por ticker/range/interval e single-flight.',
      timeout: 'Deadline do provedor.', retry: 'Fallback de provider e último quote durável.', fallback: 'Não cria candles artificiais.', errors: ['429 do provedor', 'Histórico vazio', 'Timestamp inválido'], userImpact: 'Gráficos coerentes e atualizações econômicas.', security: 'Ticker normalizado e payload limitado.'
    },
    {
      id: 'route-portfolio', lane: 'proxy', column: 10, row: 4, type: 'action', journeys: ['portfolio'],
      title: 'Carteira, retorno e patrimônio', shortDescription: 'Calcula equilíbrio, histórico, retornos e dividendos com posições enviadas pelo APK.',
      component: 'Portfolio contracts', sourceFile: ['lib/portfolio/history.js', 'lib/portfolio/analysis.js', 'lib/portfolio/dividends-contract.js'],
      endpoint: ['/api/v1/portfolio/equilibrium', '/api/v1/portfolio/history', '/api/v1/portfolio/returns', '/api/v1/dividends/batch'], method: 'POST',
      input: 'Posições, transações, dividendos e janela.', output: 'Patrimônio, séries, retornos, benchmark e agenda.', cache: 'Identidade estável baseada em carteira sem preços transitórios.',
      timeout: 'Budget do bundle.', retry: 'POST analítico idempotente pode ser repetido.', fallback: 'Histórico local e último resultado íntegro.', errors: ['Posição inválida', 'Cotação faltante', 'Janela insuficiente'], userImpact: 'Carteira consistente entre telas.', security: 'Payload financeiro mínimo; nenhuma persistência privada nesta rota.'
    },
    {
      id: 'route-sync', lane: 'proxy', column: 10, row: 5, type: 'security', journeys: ['sync'],
      title: 'Sincronização financeira privada', shortDescription: 'Valida sessão, versão e integridade antes de ler ou alterar dados no Supabase.',
      component: 'Sync route', sourceFile: ['routes/sync.js', 'lib/sync/financial-integrity.js'], endpoint: '/api/v1/sync', method: ['GET', 'POST', 'DELETE'],
      headers: ['Authorization/session', 'X-Valorae-App-Version', 'X-Request-Id'], input: 'Transações, dividendos, tombstones ou solicitação de restauração.', output: 'Snapshot ou confirmação atômica.',
      cache: 'no-store para mutações; outbox local controla repetição.', timeout: 'Deadline de sync e banco.', retry: 'Idempotência/outbox; conflitos não são repetidos cegamente.',
      fallback: 'Mantém outbox e dados locais até confirmação.', errors: ['AUTH_REQUIRED', 'APK_VERSION_UNSUPPORTED', 'CONFLICT', 'INTEGRITY_ERROR'], userImpact: 'Dados não somem quando a nuvem falha.', security: 'Única rota em que incompatibilidade pode bloquear com HTTP 426.'
    },
    {
      id: 'route-daily', lane: 'proxy', column: 10, row: 6, type: 'action', journeys: ['daily'],
      title: 'Fechamento diário consolidado', shortDescription: 'Entrega cotações e série 1D/5 min em uma única chamada para a notificação.',
      component: 'Daily close bundle', sourceFile: ['routes/_router.js', 'lib/portfolio/history.js'], endpoint: '/api/v1/mobile/daily-close', method: 'POST',
      input: 'Posições e identificação idempotente da carteira.', output: 'Resultado, patrimônio, contribuições e série intradiária.', cache: 'max-age 300 + stale-while-revalidate 1800.',
      timeout: 'Budget do worker.', retry: 'Até a política do worker; somente dentro da janela útil.', fallback: 'Abertura/fechamento oficiais sem inventar oscilação.', errors: ['Sem histórico intradiário', 'Mercado fechado', 'Cotação parcial'], userImpact: 'Notificação fiel e sem dupla chamada.', security: 'Sem dados de autenticação privilegiada.'
    },
    {
      id: 'route-logo', lane: 'proxy', column: 10, row: 7, type: 'action', journeys: ['logos'],
      title: 'Logotipos oficiais', shortDescription: 'Resolve imagem com fast path e fallback visual sem exigir headers customizados do Coil.',
      component: 'Official logo route', sourceFile: ['lib/market/official-logo.js', 'routes/_router.js'], endpoint: '/api/v1/asset/logo', method: 'GET',
      input: 'Ticker normalizado.', output: 'Imagem oficial ou fallback adequado.', cache: 'Cache público/privado conforme resposta e versão do logo.',
      timeout: 'Fast path curto.', retry: 'Coil e cache local controlam nova tentativa.', fallback: 'Logo local por classe do ativo.', errors: ['Logo não encontrado', 'Fonte lenta'], userImpact: 'Cards e modais não quebram por falta de imagem.', security: 'Rota pública somente de leitura; não expõe dados privados.'
    },
    {
      id: 'compatibility-gate', lane: 'resilience', column: 8, row: 0, type: 'decision', journeys: CORE,
      title: 'A versão do APK é compatível?', shortDescription: 'Negociação é informativa para leitura e bloqueante somente em sync sensível.',
      component: 'APK compatibility', sourceFile: ['lib/core/apk-compatibility.js', 'routes/_router.js'],
      headers: ['X-Valorae-Apk-Compatibility', 'X-Valorae-Min-Apk-Version', 'X-Valorae-Max-Tested-Apk-Version'], input: 'Versão enviada pelo APK.', output: 'SUPPORTED, advisory ou HTTP 426 em /sync.',
      cache: 'Não se aplica.', timeout: 'Imediato.', retry: 'Atualizar APK quando sync for incompatível.', fallback: 'Rotas de leitura seguem para preservar experiência.',
      errors: ['APK_VERSION_UNSUPPORTED', 'UPDATE_REQUIRED'], userImpact: 'Evita que um gate global derrube todas as telas.', security: 'Protege mutações financeiras contra drift de contrato.'
    },
    {
      id: 'auth-gate', lane: 'resilience', column: 8, row: 1, type: 'decision', journeys: CORE,
      title: 'A rota exige autenticação?', shortDescription: 'Identidade canônica do APK é validada; sessão é obrigatória apenas onde há dados privados.',
      component: 'Client auth', sourceFile: ['lib/security/client-auth.js', 'lib/security/guard.js'], input: 'Headers do app e sessão quando aplicável.', output: 'Modo de auth e permissão para seguir.',
      cache: 'Não se aplica.', timeout: 'Imediato.', retry: 'Login/renovação de sessão.', fallback: 'Rotas públicas de leitura não exigem sessão.',
      errors: ['AUTH_REQUIRED', 'INVALID_CLIENT_IDENTITY'], userImpact: 'Conteúdo público continua acessível; sync permanece protegido.', security: 'Service role nunca sai do servidor.'
    },
    {
      id: 'rate-limit', lane: 'resilience', column: 9, row: 0, type: 'security', journeys: CORE,
      title: 'Rate limit e budgets', shortDescription: 'Limita requisições, URL, query, body e custo por rota antes do processamento pesado.',
      component: 'Security guard', sourceFile: 'lib/security/guard.js', input: 'Identidade, IP, path, método e tamanho.', output: 'Permissão ou erro sanitizado.',
      cache: 'Buckets em memória com limpeza e limite rígido.', timeout: 'Imediato.', retry: 'Somente após Retry-After.', fallback: 'Cache local do APK reduz repetição.',
      errors: ['RATE_LIMITED', 'PAYLOAD_TOO_LARGE', 'URL_BUDGET_EXCEEDED'], userImpact: 'Protege disponibilidade para todos.', security: 'Evita abuso e payloads excessivos.'
    },
    {
      id: 'schema-validation', lane: 'resilience', column: 9, row: 1, type: 'decision', journeys: CORE,
      title: 'Parâmetros e schema são válidos?', shortDescription: 'Normaliza ticker, método, ranges e contratos formais antes de consultar fontes.',
      component: 'Formal schema validation', sourceFile: ['lib/contract/formal-schema-validation.js', 'lib/core/tickers.js'], input: 'Query/body da rota.', output: 'Payload canônico ou INVALID_REQUEST.',
      cache: 'Não se aplica.', timeout: 'Imediato.', retry: 'Corrigir parâmetros; não repetir igual.', fallback: 'Resposta de erro tipada.', errors: ['INVALID_JSON', 'INVALID_REQUEST', 'INVALID_TICKER'], userImpact: 'Erros claros e dados não corrompidos.', security: 'Reduz superfície de injeção e ambiguidades.'
    },
    {
      id: 'cache-decision', lane: 'resilience', column: 11, row: 0, type: 'decision', journeys: CORE,
      title: 'Existe resultado válido em cache?', shortDescription: 'Chave estável considera rota, ticker, range e identidade financeira necessária.',
      component: 'Cache compartilhado', sourceFile: ['lib/core/cache.js', 'lib/cache/memory.js', 'lib/cache/scrape-result-cache.js'], input: 'Chave normalizada e TTL.', output: 'HIT imediato ou MISS.',
      cache: 'Limites por quantidade, bytes e TTL.', timeout: 'Leitura em memória.', retry: 'Não se aplica.', fallback: 'Stale-while-revalidate em rotas permitidas.', errors: ['Cache expirado', 'Entrada inválida'], userImpact: 'Resposta rápida e menor carga externa.', security: 'Chaves não contêm segredo; dados privados não usam cache público.'
    },
    {
      id: 'proxy-cache-hit', lane: 'resilience', column: 12, row: 0, type: 'cache', journeys: CORE,
      title: 'Cache HIT retorna sem fonte externa', shortDescription: 'O Proxy reutiliza o contrato já normalizado e informa o status ao APK.',
      component: 'Response cache', sourceFile: 'lib/core/cache.js', headers: ['X-Valorae-Cache: HIT', 'Cache-Control'], input: 'Entrada válida.', output: 'Contrato pronto para resposta.',
      cache: 'HIT ou stale permitido.', timeout: 'Submilissegundo local em cenário quente.', retry: 'Não se aplica.', fallback: 'É a recuperação mais barata.', errors: [], userImpact: 'Menor latência e consumo de bateria.', security: 'Política de cache depende da sensibilidade da rota.'
    },
    {
      id: 'single-flight', lane: 'resilience', column: 11, row: 1, type: 'cache', journeys: CORE,
      title: 'Single-flight coalesce requisições iguais', shortDescription: 'Chamadas concorrentes para a mesma chave compartilham uma única execução externa.',
      component: 'Inflight resilience', sourceFile: 'lib/resilience/inflight.js', input: 'Chave de operação e função produtora.', output: 'Promise compartilhada.',
      cache: 'Mapa inflight com remoção ao concluir.', timeout: 'Limitado pelo deadline da rota.', retry: 'Nova execução apenas após concluir/falhar.', fallback: 'Evita tempestade de fontes.', errors: ['Produtor falha para todos os consumidores'], userImpact: 'Estabilidade em picos e recomposições simultâneas.', security: 'Identidade da chave separa contextos necessários.'
    },
    {
      id: 'deadline-policy', lane: 'resilience', column: 12, row: 1, type: 'decision', journeys: CORE,
      title: 'A fonte respondeu dentro do deadline?', shortDescription: 'Cada módulo aplica budgets e encerra fontes lentas antes de bloquear a experiência.',
      component: 'Deadlines e circuit breaker', sourceFile: ['lib/resilience/engine-policy.js', 'lib/resilience/circuit-breaker.js', 'lib/http/provider-transport.js'], input: 'Operação de fonte e budget.', output: 'Resposta válida, timeout ou circuito aberto.',
      cache: 'Pode consultar failure cache.', timeout: 'Específico por provedor/rota.', retry: 'Fallback antes de repetição cega.', fallback: 'Fonte secundária ou último dado íntegro.', errors: ['TIMEOUT', 'CIRCUIT_OPEN', 'PROVIDER_ERROR'], userImpact: 'Tela não fica esperando indefinidamente.', security: 'Limites de redirects, bytes e destinos.'
    },
    {
      id: 'fallback-decision', lane: 'resilience', column: 14, row: 1, type: 'decision', journeys: ['failures', '*'],
      title: 'Existe fallback íntegro?', shortDescription: 'Classifica falha, qualidade e possibilidade de usar cache, fonte secundária ou último contrato.',
      component: 'Failure policy', sourceFile: ['lib/resilience/error-classifier.js', 'lib/resilience/failure-cache.js', 'lib/contract/continuity-store.js'], input: 'Erro da fonte e dados anteriores.', output: 'Fallback marcado ou falha tipada.',
      cache: 'Last-good e failure cache.', timeout: 'Após deadline principal.', retry: 'Somente se classificação permitir.', fallback: 'Stale, parcial ou fonte alternativa.', errors: ['Sem fallback seguro'], userImpact: 'Evita dados inventados e tela vazia.', security: 'Conteúdo antigo conserva origem e qualidade.'
    },
    {
      id: 'last-good', lane: 'resilience', column: 15, row: 1, type: 'cache', journeys: ['failures', '*'],
      title: 'Último contrato íntegro é preservado', shortDescription: 'Continuidade mantém campos válidos sem ressuscitar dados removidos ou incompatíveis.',
      component: 'Contract continuity', sourceFile: ['lib/contract/continuity-store.js', 'data/proxy/ValoraeContractContinuityGuard.kt'], input: 'Contrato anterior e novo parcial.', output: 'Payload estabilizado com qualidade explícita.',
      cache: 'Store de continuidade e cache local correspondente.', timeout: 'Imediato.', retry: 'Refresh posterior.', fallback: 'Última versão íntegra.', errors: ['Baseline incompatível'], userImpact: 'Conteúdo não desaparece durante degradação.', security: 'Campos retirados permanecem removidos.'
    },
    {
      id: 'regression-v398', lane: 'resilience', column: 8, row: 2, type: 'history', journeys: ['failures'], historical: true,
      title: 'v398: gate global bloqueava tudo', shortDescription: 'Compatibilidade era avaliada antes de todas as rotas e devolvia 426 ao APK instalado.',
      component: 'Histórico técnico', sourceFile: 'routes/_router.js (v398)', input: 'APK 2026.07.30.01.', output: 'HTTP 426 antes de análise, notícias, modal e rankings.',
      cache: 'Nenhum handler era alcançado.', timeout: 'Falha imediata.', retry: 'Repetir não resolvia.', fallback: 'Inexistente.', errors: ['UPDATE_REQUIRED transversal'], userImpact: 'Ecossistema aparentava não receber nenhum dado.', security: 'Controle correto no lugar errado e com escopo excessivo.'
    },
    {
      id: 'hotfix-v399', lane: 'resilience', column: 9, row: 2, type: 'success', journeys: ['failures'], historical: true,
      title: 'v399: bloqueio restrito ao sync', shortDescription: 'Rotas de leitura aceitam v569–v571; somente mutações incompatíveis podem receber 426.',
      component: 'Hotfix de transporte', sourceFile: ['lib/core/apk-compatibility.js', 'routes/_router.js'], input: 'APK suportado ou futuro não homologado.', output: 'Leitura preservada; sync protegido.',
      cache: 'Fluxos normais voltam a alcançar seus handlers.', timeout: 'Imediato.', retry: 'Atualização necessária apenas em sync incompatível.', fallback: 'Leituras continuam operacionais.', errors: [], userImpact: 'Restaura análise, notícias, modal e rankings.', security: 'Mantém proteção onde há mutação financeira.'
    },
    {
      id: 'market-sources', lane: 'external', column: 13, row: 0, type: 'source', journeys: ['home', 'modal', 'analysis', 'quotes', 'portfolio', 'daily', 'logos'],
      title: 'Fontes de mercado autorizadas', shortDescription: 'B3, Yahoo Finance, CVM, Banco Central, Investidor10 e complementares por contrato.',
      component: 'Source adapters', sourceFile: ['lib/sources/quotes.js', 'lib/sources/adapters/index.js', 'lib/market/official-logo.js'], input: 'Ticker, série, indicador ou documento público.', output: 'Dados brutos com origem e timestamp.',
      cache: 'Cache por fonte e rota.', timeout: 'Transport deadline por provedor.', retry: 'Fallback entre provedores permitidos.', fallback: 'Último valor íntegro ou parcial explícito.', errors: ['429', 'HTML alterado', 'série vazia', 'fonte fora do ar'], userImpact: 'Dados de mercado sem dependência única.', security: 'Destinos allowlisted e limites de resposta.'
    },
    {
      id: 'news-sources', lane: 'external', column: 13, row: 1, type: 'source', journeys: ['home', 'modal'],
      title: 'Feeds, artigos e documentos públicos', shortDescription: 'Google News e páginas editoriais são resolvidos pelo Proxy, nunca diretamente pelo APK.',
      component: 'News + safe target fetch', sourceFile: ['lib/sources/news.js', 'lib/scrape/safe-target-fetch.js'], input: 'Categoria, ticker ou URL previamente recebida.', output: 'Feed deduplicado ou artigo limpo.',
      cache: 'Feed curto; artigo com stale-while-revalidate longo.', timeout: 'DNS, redirects e download limitados.', retry: 'Redirecionamentos públicos válidos; fontes alternativas.',
      fallback: 'Resumo/feed sem corpo completo.', errors: ['DNS privado', 'redirect bloqueado', 'HTML vazio'], userImpact: 'Leitura segura dentro do app.', security: 'Proteção SSRF, HTTPS, DNS público e limite de bytes.'
    },
    {
      id: 'supabase-source', lane: 'external', column: 13, row: 2, type: 'source', journeys: ['sync'],
      title: 'Supabase autenticado', shortDescription: 'Persiste e restaura transações e dividendos com integridade financeira.',
      component: 'Supabase + financial integrity', sourceFile: ['routes/sync.js', 'lib/sync/financial-integrity.js', 'supabase/'], input: 'Sessão válida e operação financeira.', output: 'Snapshot consistente ou confirmação de mutação.',
      cache: 'Sem cache público; transação e outbox controlam consistência.', timeout: 'Deadline de banco/serverless.', retry: 'Idempotência por IDs e tombstones.', fallback: 'Dados locais permanecem fonte operacional.',
      errors: ['Sessão expirada', 'Conflito', 'Falha de banco'], userImpact: 'Nuvem sem apagar histórico local.', security: 'Credenciais privilegiadas ficam exclusivamente no Proxy.'
    },
    {
      id: 'normalization', lane: 'proxy', column: 14, row: 0, type: 'action', journeys: CORE,
      title: 'Proxy normaliza e classifica qualidade', shortDescription: 'Converte formatos divergentes em contratos estáveis com origem, parcialidade e timestamps.',
      component: 'Normalizers + contracts', sourceFile: ['lib/normalizers/', 'lib/contract/', 'lib/quality/'], input: 'Resposta de cache ou fonte externa.', output: 'Contrato valorae-api-v1.',
      cache: 'Resultado normalizado pode ser armazenado.', timeout: 'Dentro do budget da rota.', retry: 'Não repete fonte nesta etapa.', fallback: 'Continuidade preserva campos íntegros.', errors: ['Schema de fonte mudou', 'Valor não finito', 'timestamp inválido'], userImpact: 'APK recebe o mesmo formato independentemente da origem.', security: 'Sanitização e remoção de campos não permitidos.'
    },
    {
      id: 'proxy-response', lane: 'proxy', column: 15, row: 0, type: 'action', journeys: CORE,
      title: 'Resposta JSON é montada', shortDescription: 'Inclui dados, qualidade, cache, compatibilidade, request ID e headers do contrato.',
      component: 'sendJson + response metadata', sourceFile: ['lib/core/http.js', 'routes/_router.js'],
      headers: ['X-Request-Id', 'X-Valorae-Contract-Version', 'X-Valorae-Cache', 'X-Valorae-Response-Bytes', 'Cache-Control'], input: 'Contrato final ou erro sanitizado.', output: 'HTTP response.',
      cache: 'Cache-Control varia por rota.', timeout: 'Final do budget serverless.', retry: 'Responsabilidade do cliente conforme código.', fallback: 'Erro tipado, sem stack trace.', errors: ['ROUTE_ERROR', 'NOT_FOUND'], userImpact: 'Resposta observável e interpretável.', security: 'Headers de segurança e mensagens sanitizadas.'
    },
    {
      id: 'https-response', lane: 'transport', column: 16, row: 0, type: 'transport', journeys: CORE,
      title: 'Proxy → APK: contrato normalizado', shortDescription: 'O cliente recebe status, body, metadados de compatibilidade e cache.',
      component: 'HTTP response', sourceFile: ['lib/core/http.js', 'data/proxy/ValoraeProxyHttp.kt'], input: 'HTTP do Proxy.', output: 'ProxyRawResponse no APK.',
      cache: 'Pode ser armazenada no cache HTTP.', timeout: 'Dentro do limite da chamada OkHttp.', retry: 'Somente após classificação.', fallback: 'Falha de transporte tipada.', errors: ['Body vazio', 'HTTP 4xx/5xx', 'timeout de leitura'], userImpact: 'Retorno rastreado pelo mesmo request ID.', security: 'JSON; conteúdo de artigo já foi sanitizado no servidor.'
    },
    {
      id: 'apk-parser', lane: 'apk', column: 17, row: 0, type: 'action', journeys: CORE,
      title: 'APK interpreta o contrato', shortDescription: 'Parsers específicos convertem JSON em modelos de domínio sem confiar cegamente nos campos.',
      component: 'Proxy parsers', sourceFile: ['data/proxy/ValoraeProxyParsers.kt', 'data/proxy/ValoraeProxyAssetModalParsers.kt', 'data/proxy/ValoraeProxyMarketPortfolioParsers.kt'], input: 'ProxyRawResponse.', output: 'Modelos tipados, metadados e falhas classificadas.',
      cache: 'Ainda não persiste antes de validar.', timeout: 'Processamento local.', retry: 'Não se aplica.', fallback: 'Parser pode usar seções válidas e rejeitar inválidas.',
      errors: ['JSON inválido', 'Campo obrigatório ausente', 'versão de schema incompatível'], userImpact: 'Evita crash e número incorreto.', security: 'Não executa HTML/JavaScript vindo da rede.'
    },
    {
      id: 'contract-decision', lane: 'return', column: 17, row: 0, type: 'decision', journeys: CORE,
      title: 'A resposta contém dados válidos?', shortDescription: 'Aplica continuidade, baseline, qualidade e política específica da jornada.',
      component: 'Contract continuity policy', sourceFile: ['data/proxy/ValoraeContractContinuityPolicy.kt', 'data/proxy/ValoraeContractContinuityGuard.kt', 'domain/model/ValoraeAssetModalQuality.kt'], input: 'Modelos parseados e conteúdo local anterior.', output: 'Aceitar, mesclar, preservar ou falhar.',
      cache: 'Compara com last-good local.', timeout: 'Local.', retry: 'Refresh posterior se parcial.', fallback: 'Preserva conteúdo anterior.', errors: ['INVALID_CONTRACT', 'NO_USABLE_DATA'], userImpact: 'Dados ruins não substituem dados bons.', security: 'Baseline impede downgrade silencioso.'
    },
    {
      id: 'persist-room', lane: 'return', column: 18, row: 0, type: 'cache', journeys: CORE,
      title: 'Room e caches são atualizados', shortDescription: 'Somente dados validados entram na persistência e tornam-se o novo last-good.',
      component: 'Persistence layer', sourceFile: ['data/AppDatabase.kt', 'data/AssetDao.kt', 'data/proxy/ValoraeDurableQuoteStore.kt'], input: 'Contrato aceito.', output: 'Registro local atualizado e observável.',
      cache: 'Room, memória e/ou cache durável por tipo.', timeout: 'Transação local curta.', retry: 'Operação local pode ser repetida com segurança.', fallback: 'Se persistir falhar, estado em memória ainda pode renderizar.', errors: ['SQLite/Room failure'], userImpact: 'Próxima abertura mais rápida e offline útil.', security: 'Persistência segue escopo do usuário no dispositivo.'
    },
    {
      id: 'preserve-previous', lane: 'return', column: 18, row: 1, type: 'cache', journeys: ['failures', '*'],
      title: 'Conteúdo anterior é mantido', shortDescription: 'Falha parcial ou resposta inválida não limpa cards, gráficos ou modal já íntegros.',
      component: 'Failure/merge policy', sourceFile: ['ui/AssetModalMergePolicy.kt', 'ui/AssetModalFallbackPolicy.kt', 'domain/ValoraeFailurePolicy.kt'], input: 'Falha e estado anterior.', output: 'Estado preservado com aviso ou qualidade reduzida.',
      cache: 'Last-good local.', timeout: 'Imediato.', retry: 'Manual, automático controlado ou próxima abertura.', fallback: 'É o fallback final do APK.', errors: ['Sem conteúdo anterior'], userImpact: 'Evita regressão visual e telas vazias.', security: 'Não mascara autenticação necessária em sync.'
    },
    {
      id: 'state-update', lane: 'return', column: 19, row: 0, type: 'action', journeys: CORE,
      title: 'ViewModel publica novo estado', shortDescription: 'Atualiza somente a jornada e o ticker ainda ativos, descartando respostas tardias.',
      component: 'StateFlow / Compose state', sourceFile: ['ui/PortfolioViewModel.kt', 'ui/AssetDetailsModalViewModel.kt', 'ui/AnalysisState.kt'], input: 'Dados persistidos ou preservados.', output: 'Estado consistente para a UI.',
      cache: 'Estado em memória.', timeout: 'Local.', retry: 'Não se aplica.', fallback: 'Estado anterior permanece.', errors: ['Resposta de contexto obsoleto é ignorada'], userImpact: 'Sem troca de ativo ou piscar de conteúdo.', security: 'Somente modelos de domínio.'
    },
    {
      id: 'typed-error', lane: 'return', column: 19, row: 1, type: 'failure', journeys: ['failures', '*'],
      title: 'Falha é transformada em ação útil', shortDescription: 'Distingue atualizar app, autenticar, tentar novamente, operar offline ou aguardar fonte.',
      component: 'Diagnostics + failure policy', sourceFile: ['data/proxy/ValoraeProxyDiagnosticsService.kt', 'domain/ValoraeFailurePolicy.kt', 'ui/SettingsHelpDiagnosticsUi.kt'], input: 'HTTP, exception e metadados do Proxy.', output: 'Erro de domínio com mensagem e ação.',
      cache: 'Pode indicar conteúdo stale preservado.', timeout: 'Local.', retry: 'Conforme tipo.', fallback: 'Erro vazio apenas quando nenhum dado seguro existe.',
      errors: ['UPDATE_REQUIRED', 'AUTH_REQUIRED', 'NETWORK', 'PROVIDER_UNAVAILABLE'], userImpact: 'Mensagem correta em vez de “não funciona”.', security: 'Sem stack trace, token ou URL sensível.'
    },
  ];

  const edges = [
    ['user-start','compose-ui','main','ação',CORE],
    ['compose-ui','viewmodel','main','intenção',CORE],
    ['background-worker','repository','main','execução agendada',['sync','daily','home']],
    ['viewmodel','repository','main','consulta',CORE],
    ['repository','local-data-decision','main','verifica',CORE],
    ['local-data-decision','local-cache-hit','cache','sim',CORE],
    ['local-cache-hit','state-update','cache','HIT local',CORE],
    ['local-data-decision','request-normalizer','main','não / refresh',CORE],
    ['request-normalizer','okhttp-client','main','request canônico',CORE],
    ['okhttp-client','https-request','main','envia',CORE],
    ['https-request','router-entry','main','HTTPS',CORE],
    ['router-entry','compatibility-gate','main','identidade',CORE],
    ['compatibility-gate','route-selector','success','suportado / leitura',CORE],
    ['compatibility-gate','typed-error','failure','426 somente sync',['sync','failures']],
    ['route-selector','route-home','main','home',['home']],
    ['route-selector','route-modal','main','modal',['modal']],
    ['route-selector','route-analysis','main','análise',['analysis']],
    ['route-selector','route-quotes','main','cotações',['quotes']],
    ['route-selector','route-portfolio','main','carteira',['portfolio']],
    ['route-selector','route-sync','main','sync',['sync']],
    ['route-selector','route-daily','main','fechamento',['daily']],
    ['route-selector','route-logo','main','logo',['logos']],
    ['route-home','auth-gate','main','rota selecionada',['home']],
    ['route-modal','auth-gate','main','rota selecionada',['modal']],
    ['route-analysis','auth-gate','main','rota selecionada',['analysis']],
    ['route-quotes','auth-gate','main','rota selecionada',['quotes']],
    ['route-portfolio','auth-gate','main','rota selecionada',['portfolio']],
    ['route-sync','auth-gate','main','sessão obrigatória',['sync']],
    ['route-daily','auth-gate','main','rota selecionada',['daily']],
    ['route-logo','auth-gate','main','pública',['logos']],
    ['auth-gate','rate-limit','main','autorizado / pública',CORE],
    ['auth-gate','typed-error','failure','não autorizado',['sync','failures']],
    ['rate-limit','schema-validation','main','dentro do limite',CORE],
    ['rate-limit','typed-error','failure','429 / budget',['failures']],
    ['schema-validation','cache-decision','main','válido',CORE],
    ['schema-validation','typed-error','failure','inválido',['failures']],
    ['cache-decision','proxy-cache-hit','cache','HIT',CORE],
    ['proxy-cache-hit','proxy-response','cache','contrato pronto',CORE],
    ['cache-decision','single-flight','main','MISS',CORE],
    ['single-flight','deadline-policy','main','produtor único',CORE],
    ['deadline-policy','market-sources','main','mercado',['home','modal','analysis','quotes','portfolio','daily','logos']],
    ['deadline-policy','news-sources','main','conteúdo',['home','modal']],
    ['deadline-policy','supabase-source','main','dados privados',['sync']],
    ['market-sources','normalization','main','dados brutos',['home','modal','analysis','quotes','portfolio','daily','logos']],
    ['news-sources','normalization','main','feed/artigo',['home','modal']],
    ['supabase-source','normalization','main','snapshot',['sync']],
    ['deadline-policy','fallback-decision','fallback','timeout / erro',['failures','home','modal','analysis','quotes','portfolio','daily','logos','sync']],
    ['normalization','fallback-decision','main','qualidade',CORE],
    ['fallback-decision','proxy-response','success','válido',CORE],
    ['fallback-decision','last-good','fallback','fallback disponível',['failures','home','modal','analysis','quotes','portfolio','daily','logos']],
    ['last-good','proxy-response','cache','stale/partial',['failures','home','modal','analysis','quotes','portfolio','daily','logos']],
    ['fallback-decision','typed-error','failure','sem fallback',['failures']],
    ['proxy-response','https-response','main','HTTP + headers',CORE],
    ['https-response','apk-parser','main','body',CORE],
    ['apk-parser','contract-decision','main','modelos',CORE],
    ['contract-decision','persist-room','success','válido',CORE],
    ['contract-decision','preserve-previous','fallback','parcial / inválido',['failures','home','modal','analysis','quotes','portfolio','daily','logos']],
    ['contract-decision','typed-error','failure','sem dado utilizável',['failures']],
    ['persist-room','state-update','main','persistido',CORE],
    ['preserve-previous','state-update','fallback','estado anterior',['failures','home','modal','analysis','quotes','portfolio','daily','logos']],
    ['state-update','ui-success','success','renderiza',CORE],
    ['typed-error','ui-error','failure','mensagem útil',['failures','sync']],
    ['regression-v398','hotfix-v399','success','corrigido no v399',['failures']],
  ].map(([source,target,type,label,edgeJourneys]) => ({ source,target,type,label,journeys: edgeJourneys }));

  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const laneById = new Map(lanes.map(lane => [lane.id, lane]));

  const elements = {
    journeyButtons: document.getElementById('flowJourneyButtons'),
    search: document.getElementById('flowMapSearch'),
    clearSearch: document.getElementById('flowClearSearch'),
    zoomOut: document.getElementById('flowZoomOut'),
    zoomIn: document.getElementById('flowZoomIn'),
    zoomValue: document.getElementById('flowZoomValue'),
    fit: document.getElementById('flowFit'),
    reset: document.getElementById('flowReset'),
    history: document.getElementById('flowHistoryToggle'),
    viewport: document.getElementById('flowMapViewport'),
    space: document.getElementById('flowMapSpace'),
    canvas: document.getElementById('flowMapCanvas'),
    svg: document.getElementById('flowMapEdges'),
    laneLayer: document.getElementById('flowMapLanes'),
    nodeLayer: document.getElementById('flowMapNodes'),
    breadcrumb: document.getElementById('flowBreadcrumb'),
    summary: document.getElementById('flowMapSummary'),
    dialog: document.getElementById('flowNodeDialog'),
    dialogTitle: document.getElementById('flowNodeDialogTitle'),
    dialogLane: document.getElementById('flowNodeDialogLane'),
    dialogBody: document.getElementById('flowNodeDialogBody'),
    dialogClose: document.getElementById('flowNodeDialogClose'),
  };

  const state = {
    activeJourney: 'all',
    search: '',
    zoom: 1,
    selectedNode: null,
    hoverNode: null,
    showHistory: false,
    collapsedLanes: new Set(),
    positions: new Map(),
    baseWidth: 0,
    baseHeight: 0,
    mobile: false,
    drag: null,
  };

  function text(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  function listify(value) {
    if (value == null || value === '') return [];
    return Array.isArray(value) ? value : [value];
  }

  function isCore(node) {
    return node.journeys?.includes('*');
  }

  function isJourneyActive(itemJourneys = []) {
    return state.activeJourney === 'all' || itemJourneys.includes('*') || itemJourneys.includes(state.activeJourney);
  }

  function normalizedSearch(node) {
    return [node.title,node.shortDescription,node.component,...listify(node.sourceFile),...listify(node.endpoint),...listify(node.method),...listify(node.headers),node.input,node.output,node.cache,node.fallback,...listify(node.errors)].join(' ').toLocaleLowerCase('pt-BR');
  }

  function searchMatches(node) {
    const query = state.search.trim().toLocaleLowerCase('pt-BR');
    return !query || normalizedSearch(node).includes(query);
  }

  function visibleNodes() {
    return nodes.filter(node => (!node.historical || state.showHistory) && !state.collapsedLanes.has(node.lane));
  }

  function renderJourneyButtons() {
    elements.journeyButtons.innerHTML = journeys.map(item => `<button type="button" class="flow-chip" data-journey="${item.id}" aria-pressed="${state.activeJourney === item.id}">${text(item.label)}</button>`).join('');
    elements.journeyButtons.querySelectorAll('[data-journey]').forEach(button => {
      button.addEventListener('click', () => {
        state.activeJourney = button.dataset.journey;
        state.selectedNode = null;
        render();
        if (!state.mobile && state.zoom < .72) { state.zoom = .82; applyScale(); }
        const routeByJourney = { home:'route-home', modal:'route-modal', analysis:'route-analysis', quotes:'route-quotes', portfolio:'route-portfolio', sync:'route-sync', daily:'route-daily', logos:'route-logo', failures:'fallback-decision', all:'user-start' };
        window.requestAnimationFrame(() => scrollNodeIntoView(routeByJourney[state.activeJourney], state.activeJourney === 'all' ? 'start' : 'center'));
      });
    });
  }

  function layoutDesktop(activeNodes) {
    const labelWidth = 160;
    const columnWidth = 218;
    const rowGap = 108;
    const laneHeader = 64;
    const nodeWidth = 184;
    const nodeHeight = 92;
    const maxColumn = Math.max(...activeNodes.map(node => node.column), 20);
    const width = labelWidth + (maxColumn + 1) * columnWidth + 80;
    let top = 14;
    const laneLayouts = [];
    state.positions.clear();

    for (const lane of lanes) {
      const laneNodes = activeNodes.filter(node => node.lane === lane.id);
      const collapsed = state.collapsedLanes.has(lane.id);
      const maxRow = Math.max(...laneNodes.map(node => node.row || 0), 0);
      const height = collapsed ? 58 : laneHeader + (maxRow + 1) * rowGap + 12;
      laneLayouts.push({ lane, top, height, count: laneNodes.length, collapsed });
      if (!collapsed) {
        laneNodes.forEach(node => {
          state.positions.set(node.id, {
            x: labelWidth + node.column * columnWidth,
            y: top + laneHeader + (node.row || 0) * rowGap,
            width: nodeWidth,
            height: nodeHeight,
          });
        });
      }
      top += height;
    }
    return { width, height: top + 20, laneLayouts };
  }

  function layoutMobile(activeNodes) {
    const width = Math.max(320, elements.viewport.clientWidth || 360);
    const nodeWidth = Math.max(260, width - 32);
    const nodeHeight = 90;
    const gap = 14;
    let top = 8;
    const laneLayouts = [];
    state.positions.clear();

    for (const lane of lanes) {
      const laneNodes = activeNodes.filter(node => node.lane === lane.id).sort((a,b) => a.column - b.column || (a.row || 0) - (b.row || 0));
      const collapsed = state.collapsedLanes.has(lane.id);
      const mobileHeader = 96;
      const height = collapsed ? 58 : mobileHeader + laneNodes.length * (nodeHeight + gap) + 8;
      laneLayouts.push({ lane, top, height, count: laneNodes.length, collapsed });
      if (!collapsed) {
        laneNodes.forEach((node,index) => {
          state.positions.set(node.id, { x: 16, y: top + mobileHeader + index * (nodeHeight + gap), width: nodeWidth, height: nodeHeight });
        });
      }
      top += height;
    }
    return { width, height: top + 10, laneLayouts };
  }

  function renderLanes(layout) {
    elements.laneLayer.innerHTML = layout.laneLayouts.map(({lane,top,height,count,collapsed}) => `
      <section class="flow-lane${collapsed ? ' is-collapsed' : ''}" data-lane="${lane.id}" style="top:${top}px;width:${layout.width}px;height:${height}px;--lane-color:${lane.color};--lane-soft:${lane.soft}">
        <div class="flow-lane-label">
          <button type="button" data-toggle-lane="${lane.id}" aria-expanded="${!collapsed}" title="${collapsed ? 'Expandir' : 'Recolher'} camada">
            <span class="flow-lane-index">Camada ${lane.index}</span>
            <span class="flow-lane-title">${text(lane.title)}</span>
            <span class="flow-lane-subtitle">${text(lane.subtitle)}</span>
            <span class="flow-lane-count">${count} etapas · ${collapsed ? 'expandir' : 'recolher'}</span>
          </button>
        </div>
      </section>`).join('');

    elements.laneLayer.querySelectorAll('[data-toggle-lane]').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        const laneId = button.dataset.toggleLane;
        if (state.collapsedLanes.has(laneId)) state.collapsedLanes.delete(laneId); else state.collapsedLanes.add(laneId);
        render();
      });
    });
  }

  function relatedNodeIds(originId) {
    if (!originId) return new Set();
    const related = new Set([originId]);
    const activeEdges = edges.filter(edge => state.positions.has(edge.source) && state.positions.has(edge.target) && isJourneyActive(edge.journeys));
    const visitUpstream = id => {
      activeEdges.filter(edge => edge.target === id).forEach(edge => {
        if (related.has(edge.source)) return;
        related.add(edge.source);
        visitUpstream(edge.source);
      });
    };
    const visitDownstream = id => {
      activeEdges.filter(edge => edge.source === id).forEach(edge => {
        if (related.has(edge.target)) return;
        related.add(edge.target);
        visitDownstream(edge.target);
      });
    };
    visitUpstream(originId);
    visitDownstream(originId);
    return related;
  }

  function nodeClass(node, related) {
    const classes = ['flow-node', `type-${node.type}`];
    const activeJourney = isJourneyActive(node.journeys);
    const match = searchMatches(node);
    const focusId = state.hoverNode || state.selectedNode;
    if (state.selectedNode === node.id) classes.push('is-selected');
    if (state.search && match) classes.push('is-search-match');
    if (focusId) {
      if (related.has(node.id)) classes.push('is-related'); else classes.push('is-dimmed');
    } else if (!activeJourney || (state.search && !match)) {
      classes.push('is-dimmed');
    }
    return classes.join(' ');
  }

  function renderNodes(activeNodes) {
    const related = relatedNodeIds(state.hoverNode || state.selectedNode);
    elements.nodeLayer.innerHTML = activeNodes.map(node => {
      const position = state.positions.get(node.id);
      if (!position) return '';
      const lane = laneById.get(node.lane);
      const route = listify(node.endpoint)[0] || '';
      const typeLabel = ({start:'Início',action:'Ação',decision:'Decisão',cache:'Cache / resiliência',transport:'Transporte',security:'Segurança',source:'Fonte externa',success:'Sucesso',failure:'Falha',history:'Histórico'})[node.type] || 'Etapa';
      return `<button type="button" class="${nodeClass(node, related)}" data-node-id="${node.id}" style="left:${position.x}px;top:${position.y}px;width:${position.width}px;min-height:${position.height}px;--node-color:${lane.color}" aria-label="${text(typeLabel)}: ${text(node.title)}">
        <span class="flow-node-type"><span>${text(typeLabel)}</span>${route ? `<span class="flow-node-route">${text(route)}</span>` : ''}</span>
        <span class="flow-node-title">${text(node.title)}</span>
        <span class="flow-node-desc">${text(node.shortDescription)}</span>
        <span class="flow-node-marker">Você está aqui</span>
      </button>`;
    }).join('');

    elements.nodeLayer.querySelectorAll('[data-node-id]').forEach(button => {
      const id = button.dataset.nodeId;
      button.addEventListener('mouseenter', () => { state.hoverNode = id; updateHighlights(); });
      button.addEventListener('mouseleave', () => { state.hoverNode = null; updateHighlights(); });
      button.addEventListener('focus', () => { state.hoverNode = id; updateHighlights(); });
      button.addEventListener('blur', () => { if (state.hoverNode === id) { state.hoverNode = null; updateHighlights(); } });
      button.addEventListener('click', event => { event.stopPropagation(); selectNode(id); });
    });
  }

  function edgePath(source, target) {
    if (state.mobile) {
      const sx = source.x + source.width / 2;
      const sy = source.y + source.height;
      const tx = target.x + target.width / 2;
      const ty = target.y;
      const midY = sy + (ty - sy) / 2;
      return { d: `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`, lx: (sx+tx)/2, ly: midY };
    }
    const forward = target.x >= source.x;
    const sx = forward ? source.x + source.width : source.x;
    const sy = source.y + source.height / 2;
    const tx = forward ? target.x : target.x + target.width;
    const ty = target.y + target.height / 2;
    const bend = Math.max(55, Math.abs(tx - sx) * .46);
    const c1x = forward ? sx + bend : sx - bend;
    const c2x = forward ? tx - bend : tx + bend;
    return { d: `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}`, lx: (sx+tx)/2, ly: (sy+ty)/2 - 5 };
  }

  function renderEdges() {
    const focusId = state.hoverNode || state.selectedNode;
    const related = relatedNodeIds(focusId);
    const markerColors = { main:'#aeb6c6',success:'#65c987',failure:'#ef6a6a',cache:'#b38cff',fallback:'#f3a84f',retry:'#75a7ff' };
    const defs = `<defs>${Object.entries(markerColors).map(([type,color]) => `<marker id="flow-arrow-${type}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"></path></marker>`).join('')}</defs>`;
    const parts = [defs];
    edges.forEach((edge,index) => {
      const source = state.positions.get(edge.source);
      const target = state.positions.get(edge.target);
      if (!source || !target) return;
      const journeyActive = isJourneyActive(edge.journeys);
      const searchActive = !state.search || searchMatches(nodeById.get(edge.source)) || searchMatches(nodeById.get(edge.target));
      const edgeRelated = !focusId || (related.has(edge.source) && related.has(edge.target));
      const classes = ['flow-edge', `edge-${edge.type}`];
      if (!journeyActive || !searchActive || !edgeRelated) classes.push('is-dimmed'); else if (focusId) classes.push('is-related');
      const path = edgePath(source,target);
      parts.push(`<path id="flow-edge-${index}" class="${classes.join(' ')}" d="${path.d}" marker-end="url(#flow-arrow-${edge.type in markerColors ? edge.type : 'main'})"></path>`);
      if (edge.label && (state.activeJourney !== 'all' || focusId || edge.type !== 'main')) {
        parts.push(`<text class="flow-edge-label edge-${edge.type}" x="${path.lx}" y="${path.ly}" text-anchor="middle">${text(edge.label)}</text>`);
      }
    });
    elements.svg.setAttribute('viewBox', `0 0 ${state.baseWidth} ${state.baseHeight}`);
    elements.svg.setAttribute('width', state.baseWidth);
    elements.svg.setAttribute('height', state.baseHeight);
    elements.svg.innerHTML = parts.join('');
  }

  function updateHighlights() {
    const related = relatedNodeIds(state.hoverNode || state.selectedNode);
    elements.nodeLayer.querySelectorAll('[data-node-id]').forEach(button => {
      const node = nodeById.get(button.dataset.nodeId);
      button.className = nodeClass(node, related);
    });
    renderEdges();
  }

  function renderSummary(activeNodes) {
    const activeCount = activeNodes.filter(node => isJourneyActive(node.journeys)).length;
    const searchCount = state.search ? activeNodes.filter(searchMatches).length : null;
    const journeyLabel = journeys.find(item => item.id === state.activeJourney)?.label || 'Visão completa';
    elements.breadcrumb.textContent = state.selectedNode ? `${journeyLabel} › ${laneById.get(nodeById.get(state.selectedNode).lane).title} › ${nodeById.get(state.selectedNode).title}` : `${journeyLabel} · ${state.showHistory ? 'histórico visível' : 'fluxo atual'}`;
    elements.summary.textContent = state.search ? `${searchCount} resultado(s) para “${state.search}” · ${activeCount} etapas da jornada` : `${activeCount} etapas destacadas · ${edges.length} conexões documentadas`;
  }

  function applyScale() {
    elements.canvas.style.width = `${state.baseWidth}px`;
    elements.canvas.style.height = `${state.baseHeight}px`;
    elements.canvas.style.transform = `scale(${state.zoom})`;
    elements.space.style.width = `${Math.max(elements.viewport.clientWidth, state.baseWidth * state.zoom)}px`;
    elements.space.style.height = `${Math.max(elements.viewport.clientHeight, state.baseHeight * state.zoom)}px`;
    elements.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function render() {
    state.mobile = window.matchMedia('(max-width: 760px)').matches;
    const activeNodes = visibleNodes();
    const layout = state.mobile ? layoutMobile(activeNodes) : layoutDesktop(activeNodes);
    state.baseWidth = layout.width;
    state.baseHeight = layout.height;
    renderJourneyButtons();
    renderLanes(layout);
    renderNodes(activeNodes);
    renderEdges();
    renderSummary(activeNodes);
    applyScale();
    elements.history.setAttribute('aria-pressed', String(state.showHistory));
  }

  function formatDetail(value) {
    const items = listify(value).filter(item => item !== '');
    if (!items.length) return '<span aria-label="Não se aplica">—</span>';
    if (items.length === 1) return `<span>${text(items[0])}</span>`;
    return `<ul class="flow-detail-list">${items.map(item => `<li>${text(item)}</li>`).join('')}</ul>`;
  }

  function detailCard(label, value, full = false) {
    if (value == null || (Array.isArray(value) && !value.length)) return '';
    return `<div class="flow-detail-card${full ? ' full' : ''}"><dt>${text(label)}</dt><dd>${formatDetail(value)}</dd></div>`;
  }

  function selectNode(id) {
    const node = nodeById.get(id);
    if (!node) return;
    state.selectedNode = id;
    updateHighlights();
    renderSummary(visibleNodes());
    const lane = laneById.get(node.lane);
    elements.dialogLane.textContent = `${lane.title} · ${node.type === 'decision' ? 'Decisão' : node.type === 'history' ? 'Histórico técnico' : 'Etapa operacional'}`;
    elements.dialogTitle.textContent = node.title;
    const nodeJourneys = node.journeys.includes('*') ? ALL_JOURNEYS : node.journeys;
    elements.dialogBody.innerHTML = `
      <p class="flow-dialog-summary">${text(node.shortDescription)}</p>
      <dl class="flow-detail-grid">
        ${detailCard('Responsabilidade', node.component)}
        ${detailCard('Camada', lane.title)}
        ${detailCard('Arquivo ou componente', node.sourceFile, true)}
        ${detailCard('Endpoint', node.endpoint)}
        ${detailCard('Método HTTP', node.method)}
        ${detailCard('Headers relevantes', node.headers, true)}
        ${detailCard('Entrada esperada', node.input, true)}
        ${detailCard('Saída produzida', node.output, true)}
        ${detailCard('Cache', node.cache)}
        ${detailCard('Timeout', node.timeout)}
        ${detailCard('Retry', node.retry)}
        ${detailCard('Fallback', node.fallback)}
        ${detailCard('Possíveis erros', node.errors, true)}
        ${detailCard('Impacto para o usuário', node.userImpact, true)}
        ${detailCard('Segurança', node.security, true)}
      </dl>
      <div class="flow-journey-badges" aria-label="Jornadas relacionadas">${nodeJourneys.map(id => `<span>${text(journeys.find(item => item.id === id)?.label || id)}</span>`).join('')}</div>`;
    if (typeof elements.dialog.showModal === 'function') elements.dialog.showModal(); else elements.dialog.setAttribute('open','');
  }

  function closeDialog() {
    if (elements.dialog.open && typeof elements.dialog.close === 'function') elements.dialog.close(); else elements.dialog.removeAttribute('open');
    state.selectedNode = null;
    updateHighlights();
    renderSummary(visibleNodes());
  }

  function scrollNodeIntoView(id, align = 'center') {
    const position = state.positions.get(id);
    if (!position) return;
    const viewport = elements.viewport;
    const targetX = (position.x + position.width / 2) * state.zoom;
    const targetY = (position.y + position.height / 2) * state.zoom;
    viewport.scrollLeft = align === 'start' ? 0 : Math.max(0, targetX - viewport.clientWidth / 2);
    viewport.scrollTop = align === 'start' ? 0 : Math.max(0, targetY - viewport.clientHeight / 2);
  }

  function setZoom(next, anchor = null) {
    const previous = state.zoom;
    const clamped = Math.max(state.mobile ? .82 : .35, Math.min(1.65, next));
    if (Math.abs(clamped - previous) < .001) return;
    const viewport = elements.viewport;
    const pointX = anchor?.x ?? viewport.clientWidth / 2;
    const pointY = anchor?.y ?? viewport.clientHeight / 2;
    const contentX = (viewport.scrollLeft + pointX) / previous;
    const contentY = (viewport.scrollTop + pointY) / previous;
    state.zoom = clamped;
    applyScale();
    viewport.scrollLeft = contentX * clamped - pointX;
    viewport.scrollTop = contentY * clamped - pointY;
  }

  function fitMap({ preserveScroll = false } = {}) {
    if (state.mobile) {
      state.zoom = 1;
      applyScale();
      if (!preserveScroll) { elements.viewport.scrollLeft = 0; elements.viewport.scrollTop = 0; }
      return;
    }
    const availableWidth = Math.max(200, elements.viewport.clientWidth - 24);
    const availableHeight = Math.max(200, elements.viewport.clientHeight - 24);
    state.zoom = Math.max(.35, Math.min(1, availableWidth / state.baseWidth, availableHeight / state.baseHeight));
    applyScale();
    if (!preserveScroll) { elements.viewport.scrollLeft = 0; elements.viewport.scrollTop = 0; }
  }

  function resetMap() {
    state.activeJourney = 'all';
    state.search = '';
    state.selectedNode = null;
    state.hoverNode = null;
    state.showHistory = false;
    state.collapsedLanes.clear();
    elements.search.value = '';
    render();
    if (state.mobile) {
      fitMap({ preserveScroll: false });
    } else {
      state.zoom = .95;
      applyScale();
      elements.viewport.scrollLeft = 0;
      elements.viewport.scrollTop = 0;
    }
  }

  elements.search.addEventListener('input', () => { state.search = elements.search.value.trim(); updateHighlights(); renderSummary(visibleNodes()); });
  elements.clearSearch.addEventListener('click', () => { elements.search.value = ''; state.search = ''; updateHighlights(); renderSummary(visibleNodes()); elements.search.focus(); });
  elements.zoomIn.addEventListener('click', () => setZoom(state.zoom + .12));
  elements.zoomOut.addEventListener('click', () => setZoom(state.zoom - .12));
  elements.fit.addEventListener('click', () => fitMap({ preserveScroll: false }));
  elements.reset.addEventListener('click', resetMap);
  elements.history.addEventListener('click', () => { state.showHistory = !state.showHistory; render(); fitMap({ preserveScroll: true }); });
  elements.dialogClose.addEventListener('click', closeDialog);
  elements.dialog.addEventListener('close', () => { if (state.selectedNode) { state.selectedNode = null; updateHighlights(); renderSummary(visibleNodes()); } });

  elements.viewport.addEventListener('wheel', event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = elements.viewport.getBoundingClientRect();
    setZoom(state.zoom + (event.deltaY < 0 ? .1 : -.1), { x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, { passive: false });

  elements.viewport.addEventListener('pointerdown', event => {
    if (state.mobile || event.button !== 0 || event.target.closest('.flow-node,.flow-lane-label,button,input')) return;
    state.drag = { x: event.clientX, y: event.clientY, left: elements.viewport.scrollLeft, top: elements.viewport.scrollTop };
    elements.viewport.classList.add('is-dragging');
    elements.viewport.setPointerCapture(event.pointerId);
  });
  elements.viewport.addEventListener('pointermove', event => {
    if (!state.drag) return;
    elements.viewport.scrollLeft = state.drag.left - (event.clientX - state.drag.x);
    elements.viewport.scrollTop = state.drag.top - (event.clientY - state.drag.y);
  });
  const endDrag = event => {
    if (!state.drag) return;
    state.drag = null;
    elements.viewport.classList.remove('is-dragging');
    if (event.pointerId != null && elements.viewport.hasPointerCapture(event.pointerId)) elements.viewport.releasePointerCapture(event.pointerId);
  };
  elements.viewport.addEventListener('pointerup', endDrag);
  elements.viewport.addEventListener('pointercancel', endDrag);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && elements.dialog.open) closeDialog();
    if (event.key === '0' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); fitMap({ preserveScroll: false }); }
  });

  let resizeTimer = 0;
  const resizeObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const wasMobile = state.mobile;
      render();
      if (wasMobile !== state.mobile) fitMap({ preserveScroll: false }); else applyScale();
    }, 120);
  });
  resizeObserver.observe(elements.viewport);

  render();
  window.requestAnimationFrame(() => {
    if (state.mobile) {
      fitMap({ preserveScroll: false });
    } else {
      state.zoom = .95;
      applyScale();
      elements.viewport.scrollLeft = 0;
      elements.viewport.scrollTop = 0;
    }
  });
})();
