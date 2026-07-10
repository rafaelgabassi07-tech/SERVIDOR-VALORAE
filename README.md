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