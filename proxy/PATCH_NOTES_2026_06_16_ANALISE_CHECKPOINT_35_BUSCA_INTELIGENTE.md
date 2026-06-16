# 2026-06-16 — Checkpoint 35 — Busca inteligente da Análise

Patch: `21.12.119-analysis-intelligent-search-v35`

## Objetivo

Aprimorar a barra de pesquisa da página Análise sem quebrar a regra do contrato único: o APK deve carregar dados completos somente por `/api/v1/analysis`, mas sugestões leves podem vir de `/api/v1/assets` em modo de busca.

## Implementado

- Sugestões por ticker, nome da empresa/fundo e segmento.
- Política `analysis_intelligent_search_v35` no Proxy.
- Resultado de sugestão com `rank`, `match`, `source` e sem preço/variação simulados.
- APK com debounce de 360 ms para sugestões.
- Separação entre texto digitado e ticker submetido (`submittedTicker`).
- Últimos pesquisados persistidos localmente.
- Prioridade visual para favoritos, carteira, últimos pesquisados, Proxy e sugestões-base.
- Estados claros de carregamento e sem resultado.

## Garantias

- A página Análise continua lendo dados completos somente de `/api/v1/analysis`.
- Não há busca completa a cada letra digitada.
- Sugestões não simulam cotação, indicadores ou gráficos.
- `versionCode` e `versionName` do APK permanecem inalterados.
