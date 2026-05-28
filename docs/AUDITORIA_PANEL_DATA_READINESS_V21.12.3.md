# Auditoria v21.12.3 — Panel Data Readiness

## Objetivo

Esta etapa adiciona uma camada explícita de prontidão para consumo por painéis/APK, sem dividir o `lib/Valorae-engine.js`.

O foco é evitar que o app tente renderizar gráficos, métricas ou cards quando o proxy recebeu dados apenas parciais, além de indicar caminhos preferenciais já normalizados para o consumidor.

## Alterações aplicadas

- Novo módulo auxiliar: `lib/quality/panel-readiness.js`.
- Integração no payload principal do engine via `payload.panelReadiness`.
- Tipagem atualizada em `lib/engine/Valorae-engine-types.ts`.
- Novo teste dedicado: `test/panel-readiness-v21-12-3.test.js`.
- Inclusão do teste no script `npm test`.

## O que o app passa a receber

`panelReadiness` contém:

- `ready`, `score` e `grade` geral do painel.
- Lista de painéis com status independente:
  - `quote`
  - `fundamentals`
  - `dividends`
  - `charts`
  - `news`
  - `sourceTrace`
- `missingPaths` por painel, permitindo identificar exatamente o que faltou.
- `gaps` com campos críticos ausentes ou em formato inválido.
- `consumerContract`, com caminhos preferenciais para o app:
  - `preferredChartPath: chartSeries.series`
  - `preferredMetricsPath: normalized`
  - `preferredRawPath: results`
  - `canRenderDashboard`
  - `canRenderCharts`
  - `shouldShowPartialBanner`

## Benefícios práticos

- O APK/Web pode renderizar telas parciais sem quebrar.
- O app deixa de depender de tentativa e erro para descobrir se há dados de gráfico.
- Fica mais fácil mostrar mensagens como “dados parciais” quando fonte externa, scraper ou API interna falhar.
- Os painéis passam a consumir `chartSeries.series` como fonte preferencial para gráficos já normalizados.
- Mantém compatibilidade com Vercel Free e com a arquitetura de function única.

## Validações executadas

- `node test/panel-readiness-v21-12-3.test.js`
- `npm run check`
- `npm test`
- `npm run audit:vercel-api`
- `npm run audit:dashboard-live`
- `npm run audit:live-endpoints`
- `npm run build`

Todas passaram.
