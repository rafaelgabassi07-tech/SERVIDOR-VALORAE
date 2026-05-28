# Auditoria e aprimoramento — Chart Series Rich Normalizer v21.12.1

## Objetivo

Aprimorar a etapa em que o VALORAE Proxy transforma dados capturados pelo engine, scraper e APIs auxiliares em séries prontas para gráficos, métricas e painéis consumidores.

## Melhorias aplicadas

- `lib/quality/chart-series.js` passou a reconhecer formatos ricos de gráficos, não apenas arrays simples.
- Suporte ampliado para:
  - `series[].data` em estilo Highcharts/Apex-like.
  - `xAxis.categories`, `categories`, `labels` e `axisLabels` como eixo X.
  - `datasets[].data` em estilo Chart.js.
  - pontos em pares `[x, y]`.
  - objetos `{ date/data/periodo/competencia, value/valor/y/preco/cotacao }`.
  - anos (`2024`), datas ISO, datas `dd/mm/aaaa`, meses `Jan/2024`, trimestres e timestamps.
- Cada série normalizada agora inclui:
  - `key`
  - `name`
  - `points`
  - `pointCount`
  - `score`
  - `summary`
  - `sourceFormat`
- `lib/quality/chart-readiness.js` agora usa a normalização rica como base, reduzindo divergência entre `chartReadiness` e `chartSeries`.
- Tipos do engine atualizados em `lib/engine/Valorae-engine-types.ts` para refletir `chartSeries` e `chartReadiness`.
- Novo teste dedicado em `test/chart-series-rich-normalizer.test.js`.

## Impacto esperado no app/APK

O consumidor mobile/web passa a receber séries mais previsíveis para gráficos, mesmo quando a fonte externa ou API interna entrega estruturas diferentes. Isso reduz telas vazias, dados que não chegam ao painel e necessidade de parsing duplicado no app.

## Validações executadas

```bash
npm run check
node test/chart-series-rich-normalizer.test.js
npm test
npm run audit:vercel-api
npm run audit:dashboard-live
npm run audit:live-endpoints
npm run build
```

Todos os comandos passaram.

## Compatibilidade

- Mantém `lib/Valorae-engine.js` como núcleo central.
- Sem dependências externas.
- Sem banco, KV, Redis, cron ou recurso pago.
- Compatível com GitHub/Vercel Free.
