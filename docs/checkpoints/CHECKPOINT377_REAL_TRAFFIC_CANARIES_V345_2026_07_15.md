# Proxy 21.12.377 / v345 — Canários reais controlados

## Objetivo

Expor uma fração pequena e determinística de requisições reais aos pipelines modernizados, inicialmente apenas em modo sombra, com promoção opcional incapaz de sobrescrever valores legados.

## Fluxo

1. A requisição é classificada por endpoint permitido.
2. Uma identidade operacional é convertida em SHA-256 com salt e bucket de 0 a 9.999.
3. Apenas a coorte configurada prossegue.
4. Orçamentos locais, circuit breaker compartilhado e lease por identidade são verificados.
5. Candidatos de parser HTML padrão, dados estruturados e renderização dinâmica são comparados ao resultado legado.
6. No modo `shadow`, somente métricas e resultado anonimizado são registrados.
7. No modo `safe-promote`, apenas chaves declaradas e vazias no legado podem ser preenchidas.
8. Qualquer falha devolve integralmente a resposta legada.

## Segurança contratual

- Nunca sobrescreve valor presente no legado.
- Nunca adiciona chave fora da lista de seletores da requisição.
- Bloqueia `__proto__`, `prototype`, `constructor`, números não finitos e estruturas fora dos limites.
- Limita profundidade, nós, arrays, objetos, strings e tamanho serializado.
- Não armazena URL ou identidade bruta nos outcomes compartilhados.
- Diagnóstico permanece fora do ETag financeiro e da interface do APK.

## Estado compartilhado

O Checkpoint 114 fornece leases, outcomes temporários e circuit breaker entre instâncias. Quando o armazenamento remoto não está configurado, o fallback em memória preserva a resposta, mas a prevenção de duplicidade fica restrita à instância atual. `VALORAE_REAL_CANARY_REQUIRE_SHARED_LEASE=1` pode bloquear a execução quando coordenação remota for requisito operacional.

## Rollback

- `VALORAE_REAL_CANARY_ENABLED=0` desativa o recurso.
- `VALORAE_REAL_CANARY_MODE=shadow` impede qualquer promoção.
- `VALORAE_REAL_CANARY_SAMPLE_BPS=0` remove a coorte sem desativar o manifesto.

## Validação

Foram exercitados seleção determinística, sombra, promoção aditiva, preservação de valor legado, restrição de chaves, número não finito, lease ocupado, integração do parser, manifesto, rota, headers e negociação com o APK.
