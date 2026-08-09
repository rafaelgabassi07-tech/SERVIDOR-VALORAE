# Checkpoint 32 — Negócios e Regiões de Receita

Data: 2026-06-16  
Base anterior: Checkpoint 31 revisado — gráficos da Análise em linhas/composições  
APK versionCode/versionName: mantidos em `26061401` / `2026.06.14.1`

## Objetivo

Implementar a seção **Negócios e Regiões de Receita** na página Análise usando somente o contrato único:

- Endpoint: `/api/v1/analysis`
- Contrato: `AnalysisPageResponse`
- Seção: `revenue_breakdown`

## Regras preservadas

- A Análise continua lendo somente `/api/v1/analysis`.
- O APK não recebe HTML, iframe, WebView ou imagem externa.
- O Proxy envia JSON estruturado.
- Nenhum percentual ausente é simulado.
- Se não houver dado real de negócio/região/mercado interno/externo, a seção fica `empty` e entra em `missingSignals`.
- Séries temporais continuam em linha; barras horizontais foram usadas apenas para composição percentual de receita.

## Implementação no Proxy

O normalizador `buildRevenueBreakdown` foi ampliado para buscar percentuais reais em caminhos como:

- `revenueByBusiness`
- `businessRevenue`
- `negociosReceita`
- `negociosQueGeramReceita`
- `receitaPorNegocio`
- `segmentRevenue`
- `revenueByRegion`
- `regionRevenue`
- `regioesReceita`
- `regioesOndeGeraReceita`
- `receitaPorRegiao`
- `geographicRevenue`
- `mercadoInternoExterno`

A seção `revenue_breakdown` agora envia:

- `items[]` com label, grupo e percentual formatado;
- `charts[]` com `chartType = horizontal_bar_composition`;
- pontos numéricos apenas entre 0 e 100;
- sem aceitar valores `n/d`, zero, negativos ou percentuais acima de 100.

## Implementação no APK

A `AnalysisScreen.kt` ganhou renderização específica para `revenue_breakdown`:

- `RevenueBreakdownBlock`
- `RevenueBreakdownGroup`
- `RevenueBreakdownBarRow`
- `parseAnalysisPercent`

Visual esperado:

- grupos separados para negócios e regiões;
- barras horizontais leves;
- percentual à direita;
- legenda discreta;
- sem reutilizar gráfico temporal em barras.

## Validação

Proxy:

- `npm run check`: passou.
- `npm test`: passou com 31 arquivos de teste e 0 falhas.
- Novo teste: `analysis-revenue-breakdown-v32.test.js`.

APK:

- Validação estática Kotlin feita.
- Gradle não foi executado porque o pacote não possui wrapper completo e o ambiente não possui `gradle`.

