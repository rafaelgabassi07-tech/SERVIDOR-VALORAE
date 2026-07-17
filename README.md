# VALORAE Proxy 21.12.381 — Checkpoint 381 / v349

## Release atual — 21.12.381 / v349 (2026-07-17)

Monitor operacional renovado, plano e centrado no que realmente atravessa o Proxy, mantendo intacto o contrato consumido pelo APK v528.

- Linha do tempo única para respostas externas, com método, rota, status, latência, bytes, consumidor, fonte, cache e request ID.
- Requisições em voo aparecem com idade, entrada, tipo de conteúdo, app/canal, ticker e parâmetros explicitamente seguros.
- Valores arbitrários de query, tokens, IPs e hashes de cliente não são expostos pela interface.
- Rotas e fontes, saúde/erros e preferências essenciais substituem as páginas antigas de documentação, arquitetura e benchmark.
- Interface sem cards decorativos, gradientes, blur ou sidebar; layout responsivo com temas claro, escuro e sistema.
- Polling do próprio monitor continua separado dos totais externos, evitando recursão e inflação de métricas.
- Exportação JSON/CSV, filtros, pausa, atualização manual e snapshot técnico permanecem disponíveis.
- Rotas, formatos de resposta, campos financeiros, headers móveis e negociação Proxy/APK permanecem inalterados.

## Checkpoint 380 — 21.12.380 / v348 (2026-07-17)

Hardening do runtime de scraping pareado ao APK v528 / Checkpoint 118, mantendo o contrato do Checkpoint 117 para compatibilidade com o APK v527.

- Seletores que dependem da árvore `html/head/body`, de seções implícitas de tabela ou de formulários usam parse5 automaticamente.
- HTML comum e tabelas consultadas por seletores simples continuam no htmlparser2 rápido.
- Respostas remotas 4xx/5xx não podem renovar o cache fresco.
- Headers são combinados antes da sanitização final; headers hop-by-hop permanecem bloqueados.
- Texto sem charset e com UTF-8 inválido recebe fallback Windows-1252.
- O cancelamento da requisição interrompe também o backoff entre tentativas.
- Rotas, campos financeiros, schemas, ETags e políticas de promoção permanecem inalterados.
- Diagnóstico aditivo: `hardeningVersion=2026.07.17-checkpoint118-v1` no endpoint `/api/v1/contract/scraping-engine`.

## Checkpoint 379 — 21.12.379 / v347 (2026-07-16)

Motor híbrido de scraping pareado ao APK v527 / Checkpoint 117, com o contrato existente preservado.

- Cheerio 1.2.0 usa htmlparser2 no caminho rápido e parse5 em HTML sensível a regras do navegador.
- Um DOM preguiçoso é compartilhado por seletores CSS e descoberta de JSON estruturado.
- Seletores idênticos são consultados e extraídos uma única vez, preservando a ordem das chaves.
- Respostas HTML respeitam BOM, `Content-Type` e `<meta charset>` dentro do limite de corpo existente.
- Playwright reutiliza apenas o processo Chromium local; cada execução recebe contexto isolado novo.
- Fallback dinâmico espera primeiro o seletor ausente, reduzindo dependência de `networkidle`.
- Rotas, campos financeiros, cache, ETags, schemas e políticas de promoção existentes permanecem inalterados.
- Diagnóstico aditivo: `/api/v1/contract/scraping-engine`; Proxies anteriores sem o header continuam aceitos pelo APK.

# VALORAE Proxy 21.12.377 — Checkpoint 377 / v345

## Release atual — 21.12.377 / v345 (2026-07-15)

Canários determinísticos em tráfego real, pareados ao APK v525 / Checkpoint 115.

- Modo padrão `shadow` com amostragem determinística inicial de 1%.
- Identidades de coorte persistidas somente como SHA-256.
- Promoção `safe-promote` opcional e estritamente aditiva: apenas chaves declaradas e ausentes no legado.
- Valores legados existentes nunca são substituídos.
- Leases e circuit breaker usam o estado compartilhado do Checkpoint 114.
- Concorrência, frequência, TTL, payload e cooldown possuem limites rígidos.
- Falha, candidato inválido ou orçamento excedido retornam a resposta legada.
- Diagnóstico oculto: `/api/v1/contract/real-canaries`.
- Rollback: desativação, modo `shadow` ou amostragem zero.
- Nenhum campo financeiro, layout, cache ou tabela pessoal foi alterado.

# VALORAE Proxy 21.12.376 — Checkpoint 376 / v344

## Release atual — 21.12.376 / v344 (2026-07-15)

Estado operacional compartilhado entre instâncias serverless, pareado ao APK v524 / Checkpoint 114.

- Continuidade do último payload formalmente válido por identidade anonimizada.
- Saúde, cooldown e score das fontes compartilhados com TTL.
- Backoff negativo compartilhado para falhas repetidas de scraping.
- Leases atômicos preparados para os canários reais do Checkpoint 115.
- Supabase opcional com escrita versionada, RLS e acesso exclusivo de `service_role`.
- Espelho em memória limitado e fallback não bloqueante quando o remoto está ausente.
- Diagnóstico oculto: `/api/v1/contract/shared-state`.
- Rollback: `VALORAE_SHARED_STATE_MODE=memory` ou `VALORAE_SHARED_STATE_ENABLED=0`.
- Nenhum campo financeiro, layout, tabela pessoal ou contrato existente foi alterado.

# VALORAE Proxy — Checkpoint 370 / v338

## Release atual — 21.12.370 / v338 (2026-07-14)

Isolamento dos provedores em adaptadores independentes, pareado ao APK v518.

- Yahoo, Investidor10, StatusInvest, B3 e Banco Central possuem módulos e operações próprios.
- Feature flags globais, por adaptador e por operação permitem desligamento e rollback localizado.
- Métricas e fallback ficam fora do contrato financeiro; os objetos retornados permanecem inalterados.
- Diagnóstico: `/api/v1/contract/source-adapters`.
- Baseline 106 e observabilidade 107 permanecem ativos.

# VALORAE Proxy

## Release atual — 21.12.369 / v337 (2026-07-14)

Rastreabilidade por campo e por fonte pareada ao APK v517, sem alteração do contrato financeiro.

- Cada resposta crítica recebe um envelope compacto `fieldObservability`, oculto da interface.
- Origem, método, confiança, cache, fallback e tempos são resumidos sem incluir HTML bruto ou segredos.
- A trilha completa permanece temporariamente disponível por `traceId` em `/api/v1/contract/observability`.
- O baseline `2026.07.14-checkpoint106-v1` continua estabilizando os dados antes da coleta.
- O APK negocia `field-lineage-v1`, valida a versão e usa os metadados somente para diagnóstico.

## Release atual — 21.12.366 / v334 (2026-07-13)

Paridade real dos índices entre a página Retorno e os modais de Ação/FII.

- SMLL, IFIX e IDIV passam a consultar primeiro a mesma API direta de histórico usada pelos modais.
- Yahoo Finance permanece como contingência quando a fonte direta não entrega pontos suficientes.
- O contrato de Retorno publica o provedor efetivo, a cadeia tentada e a série mensal já mesclada.
- Nenhum ETF, ticker substituto, snapshot duplicado ou curva sintética foi introduzido.
- Pareamento: APK v514 / protocolo 2026.07.10.10 / contrato de Retorno v2.
- Validação final: 215 arquivos de teste, 412 arquivos JavaScript e 24 testes cross-stack aprovados.


## Release atual — 21.12.364 / v332 (2026-07-13)

Variação mensal histórica, logotipos oficiais e índices do modal Retorno.

- O fechamento anterior oculto serve de âncora para a primeira variação visível.
- Uma posição mensal sem histórico não elimina as demais cotações reais; a avaliação parcial é sinalizada.
- Intraday só publica pontos com cobertura real de todas as posições ativas.
- `/api/v1/asset/logo` aceita GET/HEAD do APK sem chave privada, mantendo rate limit e validações.
- Os benchmarks do Retorno usam a janela selecionada, com aliases deduplicados.
- Validação: 411 arquivos JavaScript, 214 arquivos de teste e 23 testes cross-stack aprovados.
- Pareamento: APK v512 / protocolo 2026.07.10.10 / portfolio history v332.


## Release atual — 21.12.363 / v331 (2026-07-13)

Reparo pareado dos gráficos **Preços da carteira** e **Patrimônio total**.

- Candles mensais e semanais usam o fim do bucket para calcular a posição que compõe o fechamento.
- Compras realizadas no meio do mês entram no fechamento daquele mês.
- Estoque anterior ao primeiro lançamento importado mantém a série aberta e o custo reconciliado.
- O APK deixa de reescalar retroativamente a série para coincidir com a cotação atual.
- Pareamento: APK v511 / protocolo 2026.07.10.10 / portfolio history v331.

## Release atual — 21.12.362 / v330 (2026-07-13)

Reparo das fontes e do contrato de entrega dos modais de FII e Ação.

- A API real do comparador entrega Tipo e Segmento dos FIIs relacionados.
- Checklists preservam o estado marcado pela fonte e publicam evidência por critério.
- O Payout associa o lucro líquido retroativo pelo ano efetivo do registro.
- IBOV, IFIX, SMLL e IDIV usam séries históricas diretas, sem ETFs ou interpolação.
- Coletas independentes iniciam em paralelo e os limites de entrega foram alinhados ao APK.
- Pareamento: APK v510 / protocolo 2026.07.10.10 / delivery v4.

## Release atual — 21.12.361 / v329 (2026-07-13)

Auditoria integral do APK e do Proxy, com segurança uniforme, contratos sincronizados e ciclo de rede fortalecido.

- 32 endpoints literais conferidos.
- CORS, autenticação, rate limit, métodos, URL e payload protegidos.
- Cache administrativo exige token.
- Pareamento: APK v509 / protocolo 2026.07.10.10 / delivery v4.

## Release atual — 21.12.360 / v328 (2026-07-13)

Notícias específicas dos ativos, logotipos compatíveis com o APK e Dividend Yield histórico de FII baseado em séries reais.

### Validação desta entrega

- Busca por ticker e nome com retry estrito, sem fallback para feed geral.
- Endpoint de logo entrega bytes pelo Proxy antes de recorrer a redirecionamento.
- Dividend Yield usa dividendo real e fechamento histórico do mesmo período.
- Pareamento: APK v508 / protocolo móvel 2026.07.10.10.

## Release atual — 21.12.359 / v327 (2026-07-13)

Integridade da chegada efetiva das fontes nos modais de Ação e FII.

### Validação desta entrega

- Containers vazios não contam como seção recebida.
- Histórico e demonstrativos exigem valores renderizáveis.
- Comparações com índices exigem séries temporais reais.
- Delivery schema v4 publica estado e settlement por seção.
- Pareamento: APK v507 / protocolo móvel `2026.07.10.10`.

## Release atual — 21.12.358 / v326 (2026-07-13)

Auditoria de procedência dos dados dos modais de Ação e FII, com política fail-closed e identificação explícita de cálculos.

### Validação desta entrega

- Checklist sem evidência permanece `UNKNOWN`.
- DY histórico não é reconstruído usando cotação atual.
- Identidade do ticker é validada antes de aceitar página de FII.
- FIIs relacionados não herdam tipo/segmento nem geram médias falsas.
- Ocupação derivada é marcada como calculada.
- `dataTruth` descreve dados diretos, cálculos e substituições proibidas.
- Pareamento: APK v506 / protocolo móvel `2026.07.10.10`.

## Release atual — 21.12.357 / v325 (2026-07-13)

Integridade real das séries de índices, enriquecimento do valor patrimonial dos pares de FII e saneamento temporal do histórico de indicadores das ações.

- Retorno e modais rejeitam séries simuladas, snapshots reconstruídos, proxy ticker e fallback estático.
- IFIX, IDIV e SMLL não recebem mais valores fixos embutidos.
- Valor patrimonial dos pares vem da página individual de cada FII, sem inferência.
- Histórico de indicadores exige períodos reais e respeita prioridade de fonte.
- Pareamento: APK v505 / protocolo móvel `2026.07.10.10`.

## Release atual — 21.12.357 / v324 (2026-07-12)

Notícias por ativo pareadas ao APK v505. Solicitações dos modais usam `assetOnly=true`, preservam apenas itens relacionados ao ticker e não recorrem a notícias gerais de mercado quando a fonte específica não retorna conteúdo.

### Validação desta entrega

- `assetOnly`, `strictAsset` e `assetNewsOnly` ativam o modo estrito.
- O fallback amplo de mercado é bloqueado no modo estrito.
- Cache e política de aplicativo distinguem notícias gerais de notícias do ativo.
- A sequência visual de Ação e FII é validada no teste cross-stack do APK v505.
- Pareamento: APK v505 / protocolo móvel `2026.07.10.10`.

## Release atual — 21.12.355 / v323 (2026-07-12)

Limpeza de conteúdo dos modais pareada ao APK v503. A posição acionária foi desativada em toda a cadeia operacional de Ações: não é chamada, entregue, recuperada nem considerada para cache/completude.

### Validação desta entrega

- Nenhum endpoint dedicado de posição acionária, acionistas ou shareholders é agendado.
- `shareholdingPosition` foi removido de recovery, readiness, resposta principal e quality profile.
- Solicitações legadas exclusivamente para essa seção são ignoradas sem coleta profunda genérica.
- As demais seções e o settlement de chegada tardia permanecem preservados.
- Pareamento: APK v503 / protocolo móvel `2026.07.10.10`.

## Release atual — 21.12.354 / v322 (2026-07-12)

Chegada tardia de informações corrigida para os modais de Ação e FII: o contrato crítico continua utilizável, mas blocos opcionais lentos recebem recuperação limitada no mesmo modal.

### Validação desta entrega

- `settlementPending` separa entrega utilizável de seções opcionais ainda em chegada.
- Cache idêntico não é mais aceito como upgrade apenas por ser `completeForDelivery`.
- `knownMissingSections` direciona recuperação opcional para Ação e FII sem alterar requisitos críticos, inclusive cotação, gráfico e métricas quando necessário.
- Teste v322 simula atraso real de `peerComparison` e `vacancyHistory`.
- Pareamento: APK v501 / protocolo móvel `2026.07.10.10`.

## Release atual — 21.12.353 / v321 (2026-07-12)

Requisitos críticos do modal imutáveis por família, hints opcionais restritos ao direcionamento de produtores e pareamento com o APK v500.

### Validação desta entrega

- `requiredSections` não reduz o contrato completo.
- `missingSections` e `deferredSections` opcionais não entram em `missingRequiredSections`.
- Recuperação dirigida, cache incremental e separação stock/fii permanecem ativos.
- Pareamento: APK v500 / protocolo móvel `2026.07.10.10`.

## Release atual — 21.12.352 / v320 (2026-07-12)

Família de ativo protegida ponta a ponta, comunicados próprios para Ações/FIIs e comparação com índices alinhada por timestamps reais.

### Destaques

- Tipo explícito da solicitação prevalece sobre heurísticas ambíguas; UNITs conhecidas continuam classificadas como Ação.
- Cache, snapshots e single-flight são separados por `stock` e `fii`.
- `announcements` e `indexComparison` entram na recuperação dirigida por seção.
- Períodos são processados em paralelo; séries usam a interseção temporal real e rebasing sem interpolação.
- Pareamento: APK v499 / protocolo móvel `2026.07.10.10`.

## Release atual — 21.12.352 / v319 (2026-07-11)

Recuperação completa por seção para modais de Ação e FII, com cache incremental que não rebaixa dados válidos, contratos full estritos e fallbacks financeiros baseados somente em fontes reais.

### Destaques

- Asset modal delivery v3 com `requiredSections` e `missingRequiredSections`.
- Ações exigem histórico e os três gráficos financeiros críticos para cache full.
- FIIs exigem histórico e informações patrimoniais para cache full.
- Recuperações consultam apenas os blocos ausentes.
- Pareamento: APK v499 / protocolo móvel `2026.07.10.10`.

## Release atual — 21.12.350 / v318 (2026-07-10)

Auditoria integral e hardening de integração: deadlines globais impedem hangs nas rotas legadas, `timeoutMs` explícito limita a duração total, batches parciais não são cacheados e a suíte cross-stack exige o APK real no modo de release sem ler checkouts globais por acidente. Pareado ao APK v482 / `2026.07.10.12`; protocolo móvel preservado em `2026.07.10.10`.

### Evidência desta entrega

- Build Vercel-safe, auditoria de sintaxe/versão e 194 arquivos de teste Node.
- Runtime declarado, `.nvmrc` e monitor operacional alinhados em Node.js 24.
- 13 testes cross-stack estritos apontando para o checkpoint 72 do APK.
- Smoke tests HTTP locais de health, ready, manifest, modais, análise, batch, carteira e rota legada.
- Empacotamento limpo, sem `node_modules`, pronto para AI Studio.

## Release 21.12.349 — v317 / Checkpoint 349

- Readiness composto para os modais de AÇÃO e FII.
- Entrega full só conclui quando todos os subblocos visuais realmente possuem conteúdo.
- Pareado ao APK v480 / protocolo móvel `2026.07.10.10`.

## Release 21.12.348 — v316 / Checkpoint 348

- Corrige regressões do gráfico **Preço da carteira**.
- Preserva o ponto oficial atual após o saneamento de bordas.
- Reconcilia estoque inicial em históricos de transações incompletos.
- Expõe cobertura e tickers reconciliados no contrato.
- Pareado ao APK v479 / protocolo móvel `2026.07.10.9`.

## Release 21.12.347 — v315 / Checkpoint 347

- Corridas entre normal, recovery e refresh eliminadas.
- Cache promovido por qualidade e protegido contra downgrade tardio.
- Refresh forçado volta a aquecer o cache.
- Upgrade stale imediato com revalidação em segundo plano.
- Pareado ao APK v478 / protocolo móvel `2026.07.10.8`.

# VALORAE Proxy 21.12.347 — v314

Proxy v314 pareado ao APK `2026.07.10.8` / v477. Corrige a recuperação dos modais de Ação e FII: resultados profundos concluídos após o deadline passam a ser reutilizados imediatamente, sem exigir fechar e reabrir a tela.

Principais mudanças:
- handshake de recuperação com completude, seções disponíveis e requestId conhecido;
- estados `RECOVERY_CACHE_COMPLETE` e `RECOVERY_CACHE_UPGRADE`;
- producer profundo permanece aquecendo o cache sem bloquear respostas parciais;
- compatibilidade mantida para clientes legados sem contexto;
- runtime `26.asset-modal.runtime.v14-recovery-cache-upgrade`.

# VALORAE Proxy 21.12.345 — v313

Proxy v313 pareado ao APK `2026.07.10.6` / v476. Corrige a captura central do monitor, cobre respostas JSON/diretas/streaming e renova o cockpit no visual Gold Classic do APK, sem alterar o contrato móvel.

- `fast`: 35 s fresco + 120 s de stale grace.
- `full`: 180 s fresco + 900 s de stale grace.
- cache da Análise: 60 s exatos.
- runtime `26.asset-modal.runtime.v13-protocol-negotiation`.

Validação: build Vercel-safe, 380 arquivos JavaScript, 187 arquivos de teste e auditoria de versão.

# VALORAE Proxy 21.12.343 — v311

Proxy v311 pareado ao APK `2026.07.10.5` / v475. Centraliza o protocolo móvel, publica métodos reais de `/sync`, aplica CORS em respostas normais, correlaciona `requestId` e alinha TTLs de cache.

Validação: build Vercel-safe, 379 arquivos JavaScript, 186 arquivos de teste e auditoria de versão.

# VALORAE Proxy 21.12.342 — v310

Proxy v310 harmoniza rotas, headers, TTLs e semântica de qualidade do delivery com o APK v474, separando cache estável de entrega completa.

- Pareado ao APK `2026.07.10.4` / v474.
- `/api/sync` e demais rotas auditados por método.
- Delivery v2 com qualidade consumida integralmente pelo APK.
- Cache fast/full e metas de recuperação alinhados.
- Runtime `26.asset-modal.runtime.v11-contract-harmony`.

# VALORAE Proxy 21.12.341 — v309

Proxy v309 reforça a qualidade do contrato full, permite recuperação sem cache conectada ao producer profundo e limita fontes auxiliares para que as seções principais do modal de Ação não fiquem bloqueadas.

## Destaques
- Contrato full só entra no cache quando é realmente expandido.
- `recovery/resume` ignora cache insuficiente e se conecta à captura profunda existente.
- Resposta básica permanece utilizável e retryable, sem se declarar final.
- Comparação com índices não bloqueia indicadores, histórico e demonstrativos.
- Pareado ao APK `2026.07.10.3` / v473.

## Validação
- 184 arquivos de teste, 0 falhas.
- Build, sintaxe e auditoria de versão.
- Execução isolada a partir do ZIP final.

## Release 21.12.340

`21.12.340-apk-v472-compatibility-audit-v308`: Proxy v308 revalida integralmente as rotas e contratos para o APK v472; as mudanças desta rodada são locais ao tema, estado de UI e importação B3 e não alteram o contrato HTTP.

- Pareado com APK v472 / Checkpoint 62.
- Gateway universal e delivery schema v2 permanecem compatíveis.
- Histórico intradiário, logos oficiais e notícias reais possuem testes próprios.
- `npm run verify` executa build, sintaxe, suíte e auditoria de versão.

`21.12.337-asset-modal-fast-cache-context-v305`: auditoria cruzada dos modais com preview `fast` não bloqueante, preferência por cache `full` completo e contexto de solicitação isolado após coalescing.

### Destaques
- Investidor10, histórico e logo deixam de bloquear o preview além do orçamento curto; as Promises originais continuam aquecendo os caches usados pelo `full`.
- Cache `full` válido é servido antes de um `fast` parcial ainda fresco.
- Cada consumidor recebe seu próprio `requestId` e `requestedStage`, mesmo compartilhando a execução.
- Quality gate do Proxy reconhece todas as seções profundas também aceitas pelo APK.
- Pareado com APK v469 / Checkpoint 59.

## Release 21.12.336

`21.12.336-asset-modal-gateway-source-budget-v304`: gateway universal para modais de Ação/FII, classificação canônica no servidor e orçamento resiliente das fontes compartilhadas entre `fast` e `full`.

### Destaques
- `/api/v1/asset/modal` elimina a dupla tentativa de endpoints e classifica units como TAEE11 corretamente.
- Captura Investidor10 coalescida não é mais encurtada pelo primeiro assinante `fast`.
- Cache do HTML fundamentalista usa TTL de 10 minutos e stale de 8 horas, separado da cotação em tempo real.
- Pareado com APK v468 / Checkpoint 58.

## Release 21.12.335

`21.12.335-asset-modal-contract-v2-cancellation-parallel-v303`: contrato progressivo de entrega v2 para os modais de Ação e FII, com cache cross-stage, deadline defensivo no `full` e metadados de completude que permitem ao APK escolher a melhor resposta sem apagar conteúdo útil.

Pareado com APK `2026.07.09.16` / v467.

Core version: 21.12.0

## Release 21.12.333

21.12.333-asset-modal-progressive-fast-full-v301: reativa o carregamento progressivo dos modais de Ação/FII com stages `fast` e `full`, alinhando APK e Proxy para reduzir espera inicial e evitar timeout percebido nos modais de ação. O stage rápido entrega cotação/gráfico/resumo/indicadores básicos; o stage completo mantém os blocos pesados.

Core version: 21.12.0
