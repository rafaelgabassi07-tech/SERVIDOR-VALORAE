# Auditoria v21.12.7 — App Data Contract Validator

## Objetivo

Adicionar uma camada final de validação do payload consumível pelo APK/Web para reduzir telas vazias, regressões de snapshot e divergências entre `results`, `normalized`, `chartSeries`, `appPayload` e `appRenderContract`.

## Alterações principais

- Novo módulo `lib/quality/app-data-contract.js`.
- Novo campo `appDataContract` no payload do engine.
- Validação por tipo de ativo, com cobertura de métricas críticas para FII, ação, ETF, BDR e stock.
- Mapa de campos canônicos (`fieldMap`) com aliases, fonte, confiança e caminhos de fallback.
- Cobertura de cards (`quote`, `fundamentals`, `charts`, `sourceTrace`).
- Cobertura de gráficos com total de séries, pontos e gráfico principal seguro.
- Política de frescor/cache para decidir se o app pode substituir o último snapshot bom.

## Campos novos para o app

- `appDataContract.score`
- `appDataContract.grade`
- `appDataContract.renderSafe`
- `appDataContract.canReplacePreviousSnapshot`
- `appDataContract.coverage.criticalMetrics`
- `appDataContract.coverage.cardCoverage`
- `appDataContract.coverage.chartCoverage`
- `appDataContract.fieldMap`
- `appDataContract.freshness`
- `appDataContract.uiGuards`

## Regras recomendadas para o APK/Web

1. Usar `appPayload` como raiz principal.
2. Usar `appRenderContract` para montar cards, grupos e gráficos.
3. Usar `appDataContract.renderSafe` para permitir renderização segura.
4. Usar `appDataContract.canReplacePreviousSnapshot` para decidir se deve substituir os dados anteriores em tela/cache local.
5. Quando `score` cair abaixo do snapshot anterior, manter o snapshot anterior e atualizar em segundo plano.
6. Quando `appDataContract.uiGuards.showPartialBanner=true`, mostrar banner de dados parciais.

## Compatibilidade

A mudança é aditiva e não altera o contrato antigo. `lib/Valorae-engine.js` foi preservado como núcleo central; o novo módulo é apenas uma camada auxiliar de qualidade/consumo.
