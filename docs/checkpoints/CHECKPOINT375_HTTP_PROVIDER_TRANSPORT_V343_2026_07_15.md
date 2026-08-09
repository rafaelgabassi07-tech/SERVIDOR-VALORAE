# Checkpoint 375 / v343 — transporte HTTP por provedor

## Objetivo
Reduzir custo de conexão e controlar rajadas nas fontes externas sem alterar qualquer contrato consumido pelo APK.

## Implementação
- `undici` 7.28 como dependência direta.
- `Pool` por origem/provedor com keep-alive, conexões e pipelining limitados.
- Semáforo e fila bounded por provedor, com backpressure explícito.
- Timeouts independentes de conexão, headers, corpo, fila e prazo total.
- Cancelamento pai propagado; chamadas canceladas na fila não chegam à fonte.
- Fallback legado apenas para métodos idempotentes quando o dispatcher gerenciado falha.
- Cache, stale-if-error, coalescência, circuit breaker e contratos anteriores permanecem acima da nova camada.

## Integração
A camada cobre as fontes de extração em `lib/`: Investidor10, StatusInvest, Yahoo, B3, Banco Central, CVM, Fundamentus, rankings, agenda e logos. A sincronização Supabase continua usando seu transporte separado.

## Rollback
- `VALORAE_HTTP_TRANSPORT_MODE=legacy`
- `VALORAE_HTTP_TRANSPORT_ENABLED=0`
- `VALORAE_HTTP_LEGACY_FALLBACK=1` mantém a contingência automática.

## Compatibilidade
Nenhum campo financeiro, lista, série, unidade, rota existente ou nome de contrato foi removido ou transformado. O APK v523 apenas negocia o manifesto oculto `2026.07.15-checkpoint113-v1`.

## Validação final
- Build Vercel aprovado e 443 arquivos JavaScript verificados.
- 229 arquivos de teste do Proxy aprovados, sem falhas.
- 31 testes APK↔Proxy aprovados, sem falhas.
- Reutilização real de conexão validada com três requisições no mesmo socket.
- Backpressure, cancelamento em fila, fallback e rollback validados por testes dedicados.
