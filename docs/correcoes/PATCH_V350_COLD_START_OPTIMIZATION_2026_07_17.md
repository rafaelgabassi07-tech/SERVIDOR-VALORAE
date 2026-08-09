# Patch V350 — otimização de inicialização fria

## Escopo

A V350 preserva a identidade pública `21.12.382-quote-state-resilience-v350`, todos os endpoints, payloads, cabeçalhos e políticas do APK v529. O patch altera somente o momento em que dependências internas são inicializadas.

## Causa confirmada

O cold start não regrediu por uma única função lenta. O custo era acumulado por quatro inicializações antecipadas:

1. `lib/core/http.js` importava nove subsistemas completos apenas para obter strings imutáveis usadas nos cabeçalhos de versão.
2. Ajv era importado e compilava os 16 schemas de request/response durante a avaliação do módulo, mesmo em `/ready`, `/quote` e rotas sem schema aplicável.
3. `undici` e `Pool` eram carregados antes da primeira operação HTTP gerenciada.
4. O roteador central importava contratos de modal, carteira, histórico, scraping e handlers físicos de todas as rotas antes de saber qual endpoint seria executado.

## Correções

- Criado `lib/core/feature-versions.js`, registro sem dependências para os identificadores usados nos headers.
- Ajv passou a ser inicializado de forma síncrona sob demanda e compila somente o schema do endpoint solicitado. Instância e validators permanecem armazenados globalmente e são reutilizados.
- O construtor `undici.Pool` passou a ser resolvido apenas na primeira chamada em modo gerenciado. Pools, limites, filas, fallback legado e cancelamento não foram alterados.
- Implementações pesadas passaram a usar `import()` por rota, com cache global da Promise. Chamadas concorrentes compartilham a mesma inicialização; uma falha remove somente a Promise defeituosa para permitir retry seguro.
- Manifests operacionais continuam expondo as mesmas versões e métricas, mas seus módulos são carregados apenas quando consultados.

## Benchmark Node.js 24.14.0

Medianas obtidas no mesmo ambiente, cinco a vinte e uma execuções isoladas por cenário, com rede externa desativada para medir apenas inicialização e roteamento.

| Cenário | V350 original | V350 otimizada | Melhoria |
|---|---:|---:|---:|
| Importação de `api/router.js` | 484,83 ms | 87,32 ms | 82,0% |
| RSS após importação | 115,1 MiB | 57,2 MiB | 50,3% |
| Heap após importação | 31,6 MiB | 8,3 MiB | 73,7% |
| Primeiro `/ready` completo | 498,74 ms | 98,20 ms | 80,3% |
| Primeiro `/asset/quote` completo | 559,36 ms | 97,47 ms | 82,6% |
| Primeiro `/quotes` completo | 499,98 ms | 95,40 ms | 80,9% |
| Primeiro `/mobile/portfolio-sync` completo | 518,08 ms | 414,10 ms | 20,1% |
| Primeiro `/asset/modal` completo | 564,79 ms | 491,00 ms | 13,1% |
| Primeiro `/contract/http-transport` completo | 499,72 ms | 103,33 ms | 79,3% |

A V342 mediu 475,96 ms para importar o roteador no mesmo ensaio. A V350 otimizada ficou 81,7% abaixo dela.

Nas rotas pesadas, parte do custo migra corretamente para a primeira chamada que realmente utiliza o módulo. Ainda assim, o tempo total de cold request caiu; chamadas posteriores reutilizam módulos, Ajv, validators e pools já inicializados.

## Compatibilidade e validação

- 239/239 arquivos de teste do Proxy aprovados, incluindo o novo gate específico de cold start e carregamento sob demanda.
- 37/37 testes cross-stack aprovados contra o código-fonte do APK Valorae v529 enviado.
- Os corpos das rotas `/ready`, `/asset/quote`, `/quotes`, `/mobile/portfolio-sync` e `/asset/modal` mantiveram o mesmo tamanho entre a V350 original e a otimizada nos cenários determinísticos do benchmark.
- Nenhuma versão de protocolo, schema, rota, cache, autenticação, observabilidade ou estado compartilhado foi alterada.
- `scripts/benchmark-cold-start.js` permite repetir a medição e configurar um limite opcional por `VALORAE_COLD_START_MAX_MEDIAN_MS`. A repetição final com 11 processos isolados registrou mediana de 87,67 ms, RSS de 52,39 MiB e heap de 8,26 MiB.
