# Auditoria v21.12.6 — App Render Contract

## Objetivo

Adicionar uma camada de contrato de renderização para o APK/Web consumir o payload do Valorae sem depender de heurísticas frágeis no cliente. A camada complementa `appPayload` e reduz o risco de telas vazias, gráficos incompatíveis e cards com dados divergentes.

## Arquivos alterados

- `lib/quality/app-render-contract.js`
- `lib/Valorae-engine.js`
- `routes/fields.js`
- `routes/openapi.js`
- `lib/engine/Valorae-engine-types.ts`
- `test/app-render-contract-v21-12-6.test.js`

## Novo campo no payload

```js
appRenderContract
```

## Conteúdo entregue ao app

### `cards`

Lista cards principais com estado de renderização:

- `quote`
- `fundamentals`
- `dividends`
- `charts`
- `sourceTrace`

Cada card possui:

- `state`: `ready`, `partial` ou `empty`
- `primaryPath`
- `fallbackPaths`

### `metricGroups`

Agrupa métricas canônicas para consumo visual:

- `quote`
- `valuation`
- `dividends`
- `profitability`
- `liquidity`

Cada campo preserva `display`, `value`, `unit`, `source`, `confidence` e o caminho preferencial em `appPayload.metrics.canonical`.

### `chartTemplates`

Transforma `appPayload.charts.series` em instruções de renderização:

- `line`
- `bar`
- `candlestick`

A detecção considera OHLC, dividendos/rendimentos, yield e volume/liquidez.

### `consistency`

Valida divergências úteis para debug:

- preço do card diferente da métrica canônica
- quantidade de séries diferente entre `chartSeries` e `appPayload`
- flags de renderização incompatíveis com dados existentes

### `offlinePolicy`

Orienta o app a manter dados anteriores em caso de payload parcial, cache stale ou falha de fonte pública.

## Benefício prático

O APK/Web pode renderizar o dashboard em camadas, sem bloquear a tela inteira quando um painel estiver incompleto. O cliente passa a ter caminhos estáveis para cards, métricas e gráficos, além de instruções explícitas para fallback e modo offline.

## Validações

- `npm run check`
- `node test/app-render-contract-v21-12-6.test.js`
- `npm test`
- `npm run audit:vercel-api`
- `npm run audit:dashboard-live`
- `npm run audit:live-endpoints`
- `npm run audit:single-app`
- `npm run build`
- `npm run smoke`
