## Release 21.12.338

`21.12.338-asset-modal-late-producer-quality-v306`: producer profundo persistente após deadline, cache `full` por qualidade e recuperação progressiva alinhada ao APK v470.

### Destaques
- Deadline HTTP não descarta nem duplica a captura profunda em andamento.
- `full` parcial não se declara final e pode ser recuperado pelo APK.
- Cache `full` rejeita contratos com menos de 40% das seções.
- HTML fundamentalista é entregue sem aguardar indefinidamente extras REST, ranking e comunicados.
- Pareado com APK v470 / Checkpoint 60.

## Release 21.12.337

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
