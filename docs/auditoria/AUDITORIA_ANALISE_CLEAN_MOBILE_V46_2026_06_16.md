# Relatório — Organização clean mobile da página Análise v46

Data: 2026-06-16  
Proxy: `21.12.130-analysis-clean-mobile-v46`  
APK: `versionCode = 26061401`, `versionName = 2026.06.14.1`

## Escopo solicitado
Reorganizar a página de Análise para telas mobile, reduzindo poluição visual, melhorando listas, separando informações por categorias e corrigindo a exibição do gráfico de comparação com índices.

## Checkpoints aplicados

### 1. Organização visual da página
- Removida a renderização solta de Resumo, Indicadores e Proventos antes das categorias.
- A Análise agora apresenta um painel introdutório curto e depois blocos por categoria.
- Cada categoria concentra suas seções internas, evitando excesso de cards independentes.

Categorias implementadas:
- Resumo e fundamentos
- Desempenho e comparação
- Resultados e composição
- Proventos
- Detalhes do ativo

### 2. Listas mobile
- As listas longas deixaram de usar um container/card por linha.
- Comparadores, histórico de indicadores, demonstrativos, proventos e composição usam linhas compactas com divisórias discretas.
- Tabelas largas foram substituídas por linhas mobile com conta/período/valor, evitando truncamento excessivo.

### 3. Comparação com índices
- O Proxy agora preserva ativo + IBOV + IFIX + CDI + IPCA + SMLL + IDIV no gráfico combinado `asset_vs_indices`, quando todos chegam com séries reais alinhadas.
- O limite do gráfico combinado subiu de 5 para 7 séries.
- O APK deixou de limitar esse gráfico a 3 séries visíveis.
- A legenda foi ajustada para quebrar em duas colunas e não esconder índices em telas pequenas.
- A paleta foi alterada para tons mais distintos e legíveis no mobile.

### 4. Receita por negócios e regiões
- O detalhamento ganhou barras percentuais discretas.
- A composição visual principal foi preservada.
- Não houve alteração de dados: apenas renderização e organização.

## Validação executada

Proxy:
- `npm run check` — OK, 228 arquivos JS verificados
- `npm test -- --runInBand` — OK, 45 arquivos de teste, 0 falhas
- `npm run typecheck` — OK
- `npm run audit:version` — OK
- `npm run audit:identity` — OK, 0 ocorrências externas proibidas
- `npm run smoke` — OK
- `npm run verify` — OK

APK:
- `changelog.json`, `version.json`, `update.json` e `app/src/main/assets/valorae_changelog.json` validados como JSON.
- `AnalysisScreen.kt` revisado estaticamente com contagem de chaves/parênteses equilibrada.
- O pacote APK não contém `gradlew`, então não foi possível executar build Android neste ambiente.

## Regra de dados
Nenhum dado foi inventado, simulado ou inferido como se fosse real. As mudanças foram de organização visual e preservação de séries reais que já chegavam pelo Proxy.
