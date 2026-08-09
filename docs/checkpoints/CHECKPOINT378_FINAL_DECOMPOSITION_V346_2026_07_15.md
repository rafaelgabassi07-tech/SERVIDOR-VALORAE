# Proxy 21.12.378 / v346 — Decomposição final

## Objetivo

Concluir a modernização estrutural dos checkpoints 113–115 separando configuração, política e drivers internos, sem trocar os caminhos públicos consumidos pelo restante do Proxy ou pelo APK.

## Módulos decompostos

### Transporte HTTP

- Fachada preservada: `lib/http/provider-transport.js`.
- Novo módulo puro: `lib/http/provider-transport-profile.js`.
- Perfis, identificação de provedor e leitura de limites por ambiente não criam pools nem executam rede.
- Pooling, backpressure, cancelamento, fallback e métricas permanecem na fachada existente.

### Estado compartilhado

- Fachada preservada: `lib/state/shared-runtime-state.js`.
- Fundação local: `lib/state/shared-state-foundation.js`.
- Driver remoto: `lib/state/shared-state-supabase.js`.
- Configuração, validação, serialização e espelho em memória ficaram separados do acesso Supabase.
- Tabela, RPCs, TTLs, versionamento e comportamento de fallback permaneceram iguais.

### Canários reais

- Fachada preservada: `lib/canary/real-canary.js`.
- Política pura: `lib/canary/real-canary-policy.js`.
- Coorte, limites, validação estrutural e promoção aditiva foram isolados da coordenação por lease, circuit breaker, outcomes e métricas.
- A regra de nunca sobrescrever o legado permaneceu inalterada.

## Contrato APK ↔ Proxy

- Versão: `2026.07.15-checkpoint116-v1`.
- Política: `stable-facades-cohesive-internals-v1`.
- Header: `X-Valorae-Final-Decomposition`.
- Negociação: `X-Valorae-Final-Decomposition-Accept`.
- Manifesto: `/api/v1/contract/final-decomposition`.

O APK apenas reconhece o manifesto oculto. Ausência do header continua aceita para compatibilidade com Proxies anteriores.

## Invariantes

- Caminhos de importação e exports públicos preservados.
- Rotas, campos financeiros, cache, ETags e schemas Supabase preservados.
- Módulos de política sem I/O de rede.
- Módulos internos não importam rotas.
- Dependências circulares proibidas e testadas.
- Flags operacionais dos checkpoints anteriores preservadas.

## Validação final

- Build seguro para Vercel aprovado.
- Sintaxe aprovada em 454 arquivos JavaScript.
- 233 arquivos de teste do Proxy aprovados sem falhas.
- 34 testes APK ↔ Proxy aprovados.
- 56 checkpoints do APK, do 61 ao 116, aprovados individualmente.
- 212 arquivos Kotlin principais auditados.
- Parser Kotlin/JVM do manifesto compilado e executado.
- ZIPs validados novamente após extração limpa.
