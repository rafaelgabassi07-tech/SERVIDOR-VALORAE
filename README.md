# VALORAE Proxy

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