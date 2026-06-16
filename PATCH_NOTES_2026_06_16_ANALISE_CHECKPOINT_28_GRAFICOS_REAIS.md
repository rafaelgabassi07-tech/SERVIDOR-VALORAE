# 2026-06-16 — Checkpoint 28: Gráficos reais da Análise

## Objetivo
Transformar os gráficos preliminares da página Análise em gráficos reais e úteis, mantendo o Proxy como fonte de séries numéricas estruturadas e o APK como renderizador nativo.

## Proxy
- Mantido endpoint oficial `/api/v1/analysis`.
- Mantido contrato oficial `AnalysisPageResponse` e versão `26.analysis.v2`.
- Adicionados/normalizados gráficos em `asset_charts.charts[]` quando houver dados reais:
  - `price_history`;
  - `dividend_history`;
  - `dividend_yield_history`;
  - `revenue_profit`;
  - `profit_vs_quote`;
  - `equity_evolution`;
  - `payout_history`;
  - `fii_monthly_distribution`;
  - `fii_patrimonial_value`;
  - `fii_asset_distribution`.
- Comparadores seguem em `comparisons.charts[]`, sem simular índice quando a fonte não entrega série confiável.

## APK
- `AnalysisScreen.kt` passou a renderizar gráficos por Canvas nativo.
- Removida a mini-barra simplificada da Análise.
- Gráficos exibem barras/linhas, grade discreta, legenda, rótulos temporais e último ponto.
- Nenhum HTML, iframe, WebView ou imagem de site foi introduzido.

## Validação
- Adicionado teste regressivo `analysis-real-charts-v28.test.js`.
- `npm test` do Proxy passou com 26 arquivos e 0 falhas.

## Versões
- Proxy: `21.12.107-analysis-real-charts-v28`.
- APK `versionCode`: mantido em `26061401`.
- APK `versionName`: mantido em `2026.06.14.1`.
