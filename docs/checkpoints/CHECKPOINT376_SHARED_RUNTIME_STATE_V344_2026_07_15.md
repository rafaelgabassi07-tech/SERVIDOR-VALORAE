# Checkpoint 376 / v344 — estado operacional compartilhado

## Objetivo
Preservar o estado operacional relevante entre instâncias serverless sem tornar banco externo obrigatório, sem expor credenciais ao APK e sem alterar contratos financeiros.

## Estado compartilhado implementado
- **Continuidade contratual:** o último payload formalmente válido dos contratos críticos é persistido por identidade anonimizada e pode ser reidratado por outra instância antes da proteção contra regressão.
- **Saúde das fontes:** circuit breaker, cooldown, amostras recentes, score e latência dos provedores são espelhados com TTL e mesclados somente quando o estado remoto é mais novo.
- **Backoff de falhas:** o cache negativo curto de scraping é compartilhado para impedir que várias instâncias insistam simultaneamente em uma fonte temporariamente indisponível.
- **Leases atômicos:** RPCs de aquisição e liberação fornecem coordenação distribuída para os canários reais do Checkpoint 115.

## Armazenamento e consistência
- Driver remoto opcional via Supabase REST/Postgres com `service_role` somente no Proxy.
- Espelho em memória limitado por quantidade e tamanho, com TTL, LRU, cache de misses e coalescência de leituras.
- Escrita remota atômica por versão rejeita atualização atrasada e devolve o registro vigente.
- Falha, timeout ou ausência da migração aciona cooldown remoto e fallback em memória; a resposta financeira continua disponível.
- Chaves de continuidade e falhas são SHA-256; o APK não recebe identidade interna, valor armazenado ou credencial.

## Migração
Execute `supabase/004_valorae_runtime_shared_state_checkpoint114.sql` no SQL Editor do mesmo projeto usado pelo Proxy. A migração cria:
- `public.valorae_runtime_shared_state`;
- RPC `valorae_shared_state_put` com proteção contra escrita atrasada;
- RPCs atômicas de lease;
- função de expurgo por TTL;
- RLS e permissões exclusivas de `service_role`.

Sem a migração, o Proxy permanece funcional no driver de memória.

## Configuração e rollback
- `VALORAE_SHARED_STATE_MODE=auto` usa Supabase quando configurado e memória em contingência.
- `VALORAE_SHARED_STATE_MODE=memory` força estado local por instância.
- `VALORAE_SHARED_STATE_ENABLED=0` desativa a camada sem derrubar o readiness.
- `VALORAE_SHARED_STATE_REMOTE_TIMEOUT_MS`, `VALORAE_SHARED_STATE_REMOTE_COOLDOWN_MS`, TTLs e limites são configuráveis.

## Contrato APK ↔ Proxy
- Endpoint oculto: `/api/v1/contract/shared-state`.
- Resposta: `X-Valorae-Shared-State: 2026.07.15-checkpoint114-v1`.
- Requisição do APK: `X-Valorae-Shared-State-Accept: supabase-shared-runtime-state-memory-fallback-v1`.
- Proxies anteriores sem o header continuam compatíveis.
- Nenhum card, gráfico, modal, campo financeiro, tabela de usuário ou fluxo de sincronização foi alterado.

## Evidência de validação
A suíte dedicada cobre memória, TTL, continuidade após limpeza local, reidratação de circuit breaker, cache negativo, driver Supabase simulado, rejeição de escrita atrasada, leases distribuídos, endpoint e headers. A validação integral e as contagens finais constam nos metadados do pacote.

## Resultado integral
- npm run build aprovado para Vercel.
- npm run check:syntax aprovado em 446 arquivos JavaScript.
- npm test aprovado em 231 arquivos de teste, sem falhas.
- npm run audit:version aprovado para Proxy 21.12.376 / patch v344.
- Matriz cross-stack aprovada em 32 testes contra o APK v524.
- Estado em memória, Supabase REST simulado, TTL, coalescência, escrita versionada, continuidade, saúde, backoff negativo, leases e rollback aprovados.
- 54 checkpoints do APK (61–114) e contrato Kotlin/JVM do checkpoint 114 aprovados.
- Estrutura AI Studio diretamente na raiz e ausência de node_modules/caches/artefatos de build verificadas após extração limpa dos ZIPs.

A migração Supabase não foi aplicada em banco real neste ambiente; o teste remoto utilizou driver REST simulado, preservando a distinção entre validação lógica e implantação operacional.
