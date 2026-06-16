# Auditoria — Checkpoint 28 — Gráficos reais da Análise

Data: 2026-06-16

## Base

- APK base: `apk_valorae_checkpoint_27_auditoria_contrato_analise_2026_06_16.zip`
- Proxy base: `valorae_proxy_21_12_106_checkpoint_27_auditoria_contrato_analise_2026_06_16.zip`
- Endpoint oficial da Análise: `/api/v1/analysis`
- Contrato oficial: `AnalysisPageResponse`
- `contractVersion`: `26.analysis.v2`

## Implementação

### APK

- `AnalysisScreen.kt` agora renderiza gráficos por Canvas nativo.
- A antiga renderização de mini-barras foi removida da Análise.
- O componente novo recebe `ValoraeAnalysisChart`, respeita `chartType`, lê `series[].points[]`, desenha barras/linhas e mostra legenda/último ponto.
- A tela não usa HTML, iframe, WebView ou imagem externa para gráficos.

### Proxy

- `buildAssetCharts()` foi ampliado para expor séries reais adicionais quando disponíveis.
- Gráficos estruturados cobertos: cotação histórica, proventos/rendimentos, Dividend Yield histórico, Receitas e Lucros, Lucro x Cotação, Evolução Patrimonial, Payout histórico, valor patrimonial de FIIs e distribuição de ativos de FIIs.
- Comparadores permanecem em `comparisons.charts[]` e só aparecem com pontos reais.
- Nenhuma série é fabricada quando a fonte não entrega dados confiáveis.

## Validação

- Teste novo: `test/analysis-real-charts-v28.test.js`.
- Resultado local do Proxy: `26 test files; failures=0`.
- Gradle do APK não foi executado porque o pacote não contém `gradlew` e o ambiente não possui `gradle` instalado. Foi feita validação estática dos arquivos Kotlin alterados.

## Versões

- APK `versionCode`: `26061401` — mantido.
- APK `versionName`: `2026.06.14.1` — mantido.
- Proxy patch: `21.12.107-analysis-real-charts-v28`.
