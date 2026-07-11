# Checkpoint 350 — Full audit integration hardening v318

## Escopo

Auditoria conjunta do Proxy 21.12.349 e do APK v481, cobrindo rotas HTTP, deadlines, cache, delivery progressivo, readiness visual, testes unitários, testes cross-stack e empacotamento.

## Correções

### Deadline global das rotas legadas

A rota legada `/api/asset` e suas variantes podiam aguardar indefinidamente quando um produtor interno ou origem não encerrava. O v318 envolve a construção com `withRouteDeadline`, devolvendo um payload `PARTIAL`, `retryable`, `cacheSafe=false` e `Cache-Control: no-store`. O snapshot anterior permanece elegível para preservação no cliente.

### Fail-fast com fontes externas desativadas

`/api/v1/assets` aguardava o orçamento normal mesmo em `VALORAE_DISABLE_EXTERNAL=1`. O novo caminho retorna imediatamente um diagnóstico explícito por ticker, evitando latência artificial em ambiente degradado e em smoke tests.

### Cross-stack estrito

O helper passou a aceitar `VALORAE_APK_ROOT`. Em release, `VALORAE_REQUIRE_APK=1` transforma ausência ou caminho inválido do APK em falha, em vez de ignorar silenciosamente as verificações.
Na suíte autônoma, a leitura cruzada fica desabilitada sem configuração explícita, impedindo que um checkout global antigo contamine o resultado dos testes do Proxy.


### Deadline explícito e cache de respostas parciais

`timeoutMs` explícito passou a limitar também o deadline total das rotas de ativo física e consolidada. Além disso, qualquer batch com `partial=true` ou erros usa `Cache-Control: no-store`, evitando estabilização de respostas incompletas.

### Runtime Node coerente

A `.nvmrc` ainda apontava para Node 20 enquanto `package.json` e o lockfile exigiam Node 24; o monitor também anunciava Node.js 20. Todos foram alinhados a Node 24 e a auditoria de versão agora falha se voltarem a divergir.

### Paridade de readiness

O APK v482 passa a exigir linhas reais em histórico, DRE e balanço. O Proxy mantém o delivery schema v2 e a prontidão por conteúdo real; não houve quebra de contrato.

## Validação

- `npm run verify` com 194 arquivos de teste.
- `VALORAE_REQUIRE_APK=1 VALORAE_APK_ROOT=<checkpoint72> npm run test:cross-stack` com 13 testes.
- Teste `asset-route-deadline-cross-stack-v318.test.js` com Promise que nunca resolve.
- Smoke HTTP local com origens desativadas e habilitadas.
- Reexecução a partir do ZIP final extraído.

## Compatibilidade

Core `21.12.0`, release pública `21.12.350`, protocolo móvel `2026.07.10.10` e delivery schema v2.
