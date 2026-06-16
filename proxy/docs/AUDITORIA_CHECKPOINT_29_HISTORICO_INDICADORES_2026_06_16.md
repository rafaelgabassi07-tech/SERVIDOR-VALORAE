# Auditoria — Checkpoint 29 — Histórico de Indicadores

Data: 2026-06-16

## Base

- APK base: Checkpoint 28 revisado.
- Proxy base: Checkpoint 28 revisado.
- Endpoint oficial da Análise: `/api/v1/analysis`.
- Contrato oficial: `AnalysisPageResponse`.
- Contract version: `26.analysis.v2`.

## Implementação no APK

- `AnalysisScreen.kt` continua usando `ValoraeProxyClient.getAnalysisPage()`.
- Não houve retorno a `assetSummary`, `quoteOverview`, `assetAnalysisPage`, `appPayload.assetAnalysisPage` ou `appMobileSnapshot.assetAnalysisPage` na página Análise.
- A seção `historical_indicators` ganhou tabela própria com três colunas visuais: Indicador, Período e Valor.
- Os gráficos recebidos na seção continuam sendo desenhados em Canvas nativo pelo componente já criado no Checkpoint 28.

## Política preservada

- Sem HTML no APK.
- Sem iframe.
- Sem WebView.
- Sem imagem externa de site.
- Sem simulação de indicadores ausentes.

## Versão do APK

- `versionCode`: 26061401.
- `versionName`: 2026.06.14.1.
- Ambos foram preservados conforme regra do projeto.

## Limitação de validação

O Gradle não foi executado porque o pacote não possui `gradlew` executável e o ambiente não possui `gradle` instalado. Foi feita validação estática dos arquivos Kotlin alterados e validação completa do contrato no Proxy.
