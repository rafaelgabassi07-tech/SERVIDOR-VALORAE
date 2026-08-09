# Revisão dos gráficos da Análise — 2026-06-16

Base: Checkpoint 31.

## Problema revisado

Foi confirmado que parte dos gráficos ainda podia aparecer em barras porque o APK obedecia tipos `bar`/`bar_line` enviados pelo Proxy para séries temporais. Isso deixava o resultado visual distante do objetivo de gráficos reais da Análise.

## Correções

- Séries temporais passam a ser classificadas pelo Proxy como `line` ou `multi_line`.
- Distribuições passam a ser classificadas como `donut_composition`.
- O APK removeu o caminho visual de barras para séries da Análise.
- O Canvas agora desenha linhas nativas para séries temporais.
- Composições são desenhadas com arcos/donut e legenda percentual.
- Mantida a regra de não usar HTML, iframe, WebView, imagem externa ou dado simulado.

## Validação

- `npm run check`: passou.
- `npm test`: passou com 30 arquivos de teste e 0 falhas.
- Teste regressivo novo: `analysis-chart-rendering-v31-review.test.js`.
- `versionCode` e `versionName` do APK preservados.

## Observação

Gradle do APK não foi executado porque o ambiente não possui Gradle e o pacote não contém wrapper completo executável/jar. A validação do APK foi estática em Kotlin e por teste regressivo lendo `AnalysisScreen.kt`.
