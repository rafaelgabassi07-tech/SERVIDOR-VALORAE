# Auditoria v21.12.5 — App Consumer Blank Shield

## Objetivo
Evitar telas vazias no APK/Web quando as fontes públicas entregarem dados incompletos, bloqueados, em cache stale ou com formatos diferentes entre provedores.

## Alterações aplicadas

- Novo módulo `lib/quality/app-consumer-payload.js`.
- Novo campo final `appPayload` no retorno do `Valorae-engine.js`.
- `appPayload` entrega uma camada já pronta para consumo mobile/web:
  - `quote`: card de cotação com preço, variação, DY e fonte.
  - `metrics.canonical`: métricas financeiras canônicas.
  - `metrics.aliases`: aliases úteis para apps (`price`, `currentPrice`, `dy`, `p_vp`, `marketCap`, etc.).
  - `panels`: prontidão por painel em formato simples.
  - `charts`: séries normalizadas e `emptyState` quando histórico não existir.
  - `dividends`: histórico, último rendimento, DY e estatísticas.
  - `source`: fonte primária, cache e scores.
  - `blankShield`: flags `canRender*`, campos críticos ausentes e ordem de fallback.

## Benefício para o app

O app não precisa depender de nomes variáveis de APIs/scrapers. Pode consumir primeiro:

1. `appPayload.quote`
2. `appPayload.metrics.canonical`
3. `appPayload.charts.series`
4. `appPayload.panels`
5. `appPayload.blankShield`

Quando os dados vierem parciais, o app deve manter o último payload bom em tela, mostrar banner parcial e usar `blankShield.recommendedEmptyState` apenas se `canRenderDashboard=false`.

## Arquivos alterados

- `lib/Valorae-engine.js`
- `lib/quality/app-consumer-payload.js`
- `routes/fields.js`
- `routes/openapi.js`
- `lib/engine/Valorae-engine-types.ts`
- `lib/Valorae-engine.d.ts`
- `test/app-consumer-payload-v21-12-5.test.js`
- `package.json`

## Compatibilidade

- Não exige pacote pago.
- Não altera a estrutura central do engine.
- Não quebra clientes antigos, pois `appPayload` é aditivo.
- Compatível com Vercel Free e roteador único.
